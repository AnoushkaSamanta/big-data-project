# Real-Time Dark Vessel Detection System — Implementation Plan v2

Revised plan. Every phase ends in something you can demo. The methodological weaknesses of v1 (coverage bias, absence-detection, label scarcity) are treated as first-class engineering work rather than assumptions.

> [!NOTE]
> **What changed from v1 at a glance**
> - Added a **coverage-prior baseline** so gap alerts are normalised against receiver geometry instead of a flat threshold.
> - Gap detection moved from "computed on arrival" to an **absence-triggered sweeper** — a vessel that goes dark sends no message, so nothing can fire on arrival.
> - Added a **data validation contract** with a dead-letter topic (AIS sentinel values will otherwise corrupt every distance calculation).
> - **Synthetic anomaly injection** moved to the front so labelled evaluation data exists before the detector is written.
> - Storage split into **hot serving state** vs **cold partitioned history**; the dashboard never touches the big table.
> - Zookeeper dropped (KRaft), single-path processing core with thin adapters, observability added.

---

## Answers to the v1 Open Questions

**Q1 — Resource constraints.** The revised footprint is smaller than v1's:

| Service | RAM | Notes |
|---|---|---|
| Kafka (KRaft) | ~1.0 GB | Zookeeper removed entirely |
| PostgreSQL + PostGIS | ~1.0 GB | Bump `shared_buffers` to 512 MB |
| Spark master + 1 worker | ~3.0 GB | **Batch only** — not required for the live demo |
| Next.js frontend | ~0.5 GB | |
| **Total (streaming demo)** | **~2.5 GB** | Spark stopped |
| **Total (batch run)** | **~5.5 GB** | Spark started, producer stopped |

You never need Spark and the live stream running simultaneously. This fits comfortably in 8 GB and there is no need for a separate "Minimal Viable Stack" fork. Run batch jobs and the streaming demo at different times via Compose profiles.

**Q2 — Geofences.** Don't wait on this; use free authoritative sources:
- **EEZ boundaries:** Marine Regions World EEZ v12 (shapefile, free registration).
- **US Marine Protected Areas:** NOAA MPA Inventory (shapefile).
- **Ports/anchorages:** World Port Index (NGA) — essential, because loitering near a port is normal and must be excluded.

Load all three into a single `geofences` table with a `zone_type` discriminator and a GIST index. Bounding boxes are a fallback only for a smoke test.

---

## Known Data Characteristics (read before writing any code)

These are the things that will silently ruin results if unhandled.

| Issue | Effect if ignored | Handling |
|---|---|---|
| Terrestrial receiver coverage falls off ~50–100 nm offshore | Every offshore transit looks "dark" | Coverage prior (Phase 3) |
| `TransceiverClass` A vs B — Class B is lower power, longer reporting interval | Class B vessels gap constantly | Per-class thresholds |
| Sentinel values: SOG `102.3`, COG `360`, Heading `511`, LAT `91`, LON `181` | Haversine over lat 91 → absurd implied speeds → false spoofing alerts | Reject at validation |
| MMSI collisions (shared/duplicate MMSIs) | Two real vessels look like one teleporting vessel | Separate detector class |
| MMSI `0`, or not 9 digits | Phantom vessels | Reject at validation |
| `VesselType` null in a large fraction of records | Type-conditioned speed limits break | `UNKNOWN` bucket with conservative limits |
| Daily files are downsampled (~1-minute intervals) | Sub-minute gaps invisible; don't claim detection below this | Document as a limitation |
| Satellite vs terrestrial source mixing varies by year | Coverage prior must be computed per-year | Scope the prior to your data window |

---

## Phase 0 — Vertical Slice (do this first, 1–2 days)

Goal: one end-to-end path working before anything is built properly.

- 500 rows of AIS CSV → `kafka-python` producer → `ais.positions.raw` → plain Python consumer → single Postgres table → Next.js map with a handful of dots.
- No Spark, no detection, no ML, no geofences.

**Exit criterion:** dots appear on a map and move when you re-run the producer.

This de-risks Docker networking, Kafka connectivity, PostGIS setup, and Deck.gl rendering all at once — which is where most of the real time gets lost.

---

## Phase 1 — Infrastructure

### `docker-compose.yml`

```yaml
services:
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    environment:
      KAFKA_PROCESS_ROLES: broker,controller       # KRaft — no Zookeeper
      KAFKA_NODE_ID: 1
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "localhost:9092"]
      interval: 10s
      retries: 10
    mem_limit: 1200m

  postgres:
    image: postgis/postgis:16-3.4
    environment: { POSTGRES_DB: ais, POSTGRES_PASSWORD: ais }
    volumes:
      - ./db/init:/docker-entrypoint-initdb.d
      - pgdata:/var/lib/postgresql/data
    command: ["postgres", "-c", "shared_buffers=512MB", "-c", "max_wal_size=2GB"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
    mem_limit: 1200m

  spark-master:
    profiles: ["batch"]          # only starts with --profile batch
  spark-worker:
    profiles: ["batch"]
```

Key points: KRaft mode, healthchecks so dependent services wait, explicit `mem_limit` so a runaway Spark job can't take the machine down, and Compose **profiles** so Spark is opt-in.

### Kafka topics

| Topic | Partitions | Key | Purpose |
|---|---|---|---|
| `ais.positions.raw` | 6 | `MMSI` | Ingest |
| `ais.positions.clean` | 6 | `MMSI` | Post-validation |
| `ais.positions.dlq` | 1 | `MMSI` | Rejected records + reason |
| `ais.alerts` | 3 | `MMSI` | Detector output |

> [!IMPORTANT]
> **Key every message by MMSI.** v1 never mentions partitioning. Without an MMSI key, a vessel's messages scatter across partitions, per-vessel ordering is lost, and stateful processing becomes incorrect. With an MMSI key, ordering is guaranteed per vessel *and* processing parallelises cleanly. This is a one-line change that makes or breaks correctness.

### `Makefile`

Streaming demos break constantly. Make reset trivial:

```make
reset:      ## wipe state, reset offsets, reseed
	docker compose exec postgres psql -U postgres -d ais -c "TRUNCATE vessel_positions, vessel_latest_state, alerts;"
	docker compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 \
		--group detector --topic ais.positions.clean --reset-offsets --to-earliest --execute
demo:       ## deterministic replay for presentations
	python -m streaming.producer --seed 42 --speedup 720 --window 2024-01-15/2024-01-16
```

---

## Phase 2 — Data Acquisition, Validation & Label Generation

### `data_pipeline/load_historical.py`
Download Marine Cadastre dailies, convert to **Parquet partitioned by date** (CSV is far too slow for the batch phase), standardise column names.

### `data_pipeline/validate.py` — the missing layer in v1

A single `validate(record) -> (ok: bool, reason: str | None)` function, used identically by the producer, the streaming consumer, and the batch job. One definition of "clean", no drift.

```python
SENTINELS = {"SOG": 102.3, "COG": 360.0, "Heading": 511.0, "LAT": 91.0, "LON": 181.0}

def validate(r):
    if not (isinstance(r.get("MMSI"), int) and 100_000_000 <= r["MMSI"] <= 999_999_999):
        return False, "bad_mmsi"
    if not (-90 <= r["LAT"] <= 90) or not (-180 <= r["LON"] <= 180):
        return False, "coord_out_of_range"
    if r["LAT"] == SENTINELS["LAT"] or r["LON"] == SENTINELS["LON"]:
        return False, "position_unavailable"
    if r.get("SOG") in (None, SENTINELS["SOG"]) :
        r["SOG"] = None                      # nullable, not rejectable
    if r.get("COG") == SENTINELS["COG"]:
        r["COG"] = None
    return True, None
```

Rejects go to `ais.positions.dlq` with their reason. **Track the reject rate as a headline metric** — a sudden spike is your canary for a broken upstream file, and it's a genuinely good thing to show in a report.

### `data_pipeline/inject_anomalies.py` — moved forward from v1's Phase 7

v1 defers evaluation to the end and hopes GFW labels line up. They probably won't — GFW's AIS-disabling dataset has limited overlap with a US-coastal subset. Generate your own ground truth now:

| Injection | Method | Label |
|---|---|---|
| **AIS disabling** | Delete all pings for MMSI *m* between *t₁* and *t₂* (only in high-coverage cells) | `dark` |
| **Position spoofing** | Offset positions by 50–500 km for a window, then return | `spoof` |
| **Identity swap** | Splice two vessels' tracks under one MMSI | `mmsi_collision` |
| **Loitering** | Compress a transit into a tight circle for 6h | `loiter` |

Write the injected intervals to a `ground_truth` table. You now have precision/recall from day one, reproducible with a fixed seed, and a real evaluation section in the report.

---

## Phase 3 — Coverage Baseline (batch, Spark) — **NEW, and the most important addition**

> [!WARNING]
> Without this phase the system detects receiver coverage boundaries, not vessel behaviour. This is the single change that moves the project from naive to defensible.

### `analysis/build_coverage_prior.py`

For each spatial cell × hour-of-day × transceiver class, compute the empirical distribution of inter-message gaps from a large historical window (≥3 months).

```python
w = Window.partitionBy("MMSI").orderBy("BaseDateTime")
gaps = (df
    .withColumn("prev_ts", F.lag("BaseDateTime").over(w))
    .withColumn("gap_s", F.unix_timestamp("BaseDateTime") - F.unix_timestamp("prev_ts"))
    .withColumn("cell", h3_udf("LAT", "LON", F.lit(5)))
    .filter(F.col("gap_s").between(1, 86400)))

prior = (gaps.groupBy("cell", "TransceiverClass")
    .agg(F.count("*").alias("n_obs"),
         F.expr("percentile_approx(gap_s, 0.50)").alias("p50_gap_s"),
         F.expr("percentile_approx(gap_s, 0.95)").alias("p95_gap_s"),
         F.expr("percentile_approx(gap_s, 0.99)").alias("p99_gap_s"))
    .filter(F.col("n_obs") >= 500))       # sparse cells are untrustworthy
```

Persist to a `coverage_prior` table. The detector then scores:

```
gap_score = observed_gap_s / p99_gap_s(cell, transceiver_class)
```

A `gap_score > 1` in a well-observed cell is genuinely anomalous. The same gap in an unobserved cell scores nothing, because you have no prior. Cells with `n_obs < 500` are marked `coverage = UNKNOWN` and suppressed from alerting entirely — and that suppression map is itself a great figure for the report.

**Deliverable:** a heatmap of receiver coverage, which is a compelling visual and directly justifies the design.

---

## Phase 4 — Streaming Producer

### `streaming/producer.py`

Improvements over v1:

- **Keys by MMSI** (see Phase 1).
- **Injects realistic out-of-order arrival.** v1 emits strictly timestamp-ordered records, which hides the hardest part of stream processing. Add `--late-fraction 0.05 --max-lateness 90s` so ~5% of records arrive late. Now your watermark logic is actually being exercised, and you have something real to write about.
- **Wall-clock speedup factor** (`--speedup 720` → 1 day replays in 2 minutes), with the *event* timestamp preserved so downstream event-time logic stays correct.
- **`--seed`** for deterministic demos.
- **Backpressure aware:** blocks on `producer.flush()` rather than unbounded buffering.

---

## Phase 5 — Stream Processing

### Architecture decision: drop Spark from the live path

> [!IMPORTANT]
> v1 specifies `mapGroupsWithState`. **That API is Scala/Java only.** PySpark exposes arbitrary stateful processing through `applyInPandasWithState` (Spark 3.4+) or `transformWithStateInPandas` (Spark 4.0) — both significantly more awkward, and neither is needed here.

Use Spark where it genuinely earns its keep (Phases 3 and 10 — multi-GB batch aggregation) and a straightforward consumer for the stream. This also removes v1's dual-stack fork, which would have doubled the work.

### `streaming/processor.py` — a pure core

```python
def process_batch(records: list[dict], state: dict[int, VesselState]) -> tuple[list[dict], list[Alert]]:
    """Pure function. No Kafka, no DB. Trivially unit-testable."""
```

Two thin adapters call it: `adapters/kafka_adapter.py` (live) and `adapters/spark_adapter.py` (`foreachBatch`, if you later want to show it scales). One implementation of the logic, two runtimes.

### `streaming/consumer.py`

- Consumes `ais.positions.clean`, maintains in-memory `VesselState` per MMSI, checkpointed to Postgres every N seconds so a restart doesn't lose state.
- Writes positions to Postgres with **`execute_values` batch inserts** (batch of 1000), never row-by-row — this is usually a 50–100× throughput difference.
- Upserts `vessel_latest_state` in the same transaction.
- Commits Kafka offsets **after** the DB transaction, giving at-least-once delivery. Make the position insert idempotent on `(mmsi, ts)`.

---

## Phase 6 — Detection: Rules

### `detection/sweeper.py` — **the fix for v1's core logic bug**

A dark vessel emits nothing, so nothing can be computed "on arrival". Run a sweeper every 60 s over the *small* latest-state table:

```sql
INSERT INTO alerts (mmsi, alert_type, score, detected_at, last_lat, last_lon, details)
SELECT v.mmsi, 'dark_vessel',
       EXTRACT(EPOCH FROM (now() - v.last_seen)) / cp.p99_gap_s,
       now(), v.last_lat, v.last_lon,
       jsonb_build_object('gap_s', EXTRACT(EPOCH FROM (now() - v.last_seen)),
                          'zone', g.name, 'coverage_n', cp.n_obs)
FROM vessel_latest_state v
JOIN coverage_prior cp
  ON cp.cell = v.last_cell AND cp.transceiver_class = v.transceiver_class
LEFT JOIN geofences g
  ON ST_Contains(g.geom, v.last_geom) AND g.zone_type IN ('MPA','EEZ')
WHERE cp.n_obs >= 500                                       -- only well-observed cells
  AND EXTRACT(EPOCH FROM (now() - v.last_seen)) > cp.p99_gap_s
  AND NOT EXISTS (SELECT 1 FROM alerts a
                  WHERE a.mmsi = v.mmsi AND a.alert_type = 'dark_vessel'
                    AND a.detected_at > now() - interval '6 hours')   -- dedup
ON CONFLICT DO NOTHING;
```

Note the three things v1 lacks: coverage gating, a **per-cell** threshold rather than a flat 3 hours, and **alert deduplication** (without it, a single dark vessel generates one alert per sweep, forever).

### `detection/spoof_detector.py`

v1's implied-speed rule fires on corrupt pings and shared MMSIs. Harden it:

1. Reject sentinels first (Phase 2) — this alone removes most false positives.
2. Require a **jump-and-return** pattern: an impossible jump followed within a short window by an impossible jump back. A single outlier ping is a data error; a return trip is spoofing.
3. **Separate MMSI-collision detection:** if the same MMSI appears at two locations with *overlapping* timestamps (not sequential), that's two vessels sharing an identity, not one teleporting. Different alert class, different remediation.
4. Speed limits conditioned on `VesselType`, with `UNKNOWN` getting a conservative ceiling (e.g. 60 kn).

### `detection/loiter_detector.py`

v1's version would flag every anchored vessel. Add exclusions:
- Suppress inside port/anchorage polygons (World Port Index buffered ~5 nm).
- Suppress if `NavStatus` indicates at-anchor or moored.
- Require the loiter be in an MPA/EEZ **and** the vessel's prior trajectory be a transit (loitering is only interesting as a deviation).

### Spatial joins — do them in SQL

> [!WARNING]
> v1 proposes GeoPandas spatial joins inside the streaming path. Per-record GeoPandas is orders of magnitude too slow. Do it in Postgres against a GIST-indexed `geofences` table (as in the sweeper above), or broadcast a prepared `shapely.STRtree` to Spark executors for the batch path.

---

## Phase 7 — Detection: ML

### `detection/features.py`

v1's features are trajectory-level but it scores per-message. Define the window explicitly:

- Group by MMSI over a **1-hour tumbling window** (minimum 10 pings, else skip).
- Features: `sog_mean`, `sog_std`, `sog_max`, `cog_circular_std` (circular — a mean over 359°/1° is not 180°), `mean_turn_rate`, `path_tortuosity` (path length ÷ straight-line displacement), `gap_count`, `max_gap_s`, `gap_score_max`, `dist_to_coast_km`, `dist_to_nearest_port_km`, `in_mpa` flag.
- `dist_to_coast_km` requires a precomputed distance raster or a KD-tree over coastline vertices — v1 lists this feature but never budgets the work. Precompute it per H3 cell offline and join; computing it per record is far too slow.

Persist feature vectors to a `vessel_features` table — used for both training and serving, which eliminates train/serve skew by construction.

### `detection/train.py`

```python
pipe = Pipeline([("scaler", RobustScaler()),          # AIS features are heavy-tailed
                 ("iforest", IsolationForest(n_estimators=200,
                                             contamination=0.01,
                                             random_state=42))])
pipe.fit(X_train)
joblib.dump({"pipeline": pipe, "feature_names": list(X.columns),
             "trained_at": datetime.utcnow(), "version": "1.0"}, "models/iforest_v1.pkl")
```

Serialise the **whole pipeline plus feature names**, not a bare model — v1's `model.pkl` invites a silent column-order mismatch at serving time. Assert feature-name equality on load.

Train on data **excluding injected anomalies**, then evaluate on the held-out injected set.

### `detection/ml_scorer.py`

Loads the pipeline once, scores completed windows, writes `alert_type='ml_anomaly'` with the raw `decision_function` score. Include the top-3 contributing features (via per-feature isolation depth or a simple SHAP approximation) — an unexplained anomaly score is not actionable, and reviewers will ask.

---

## Phase 8 — Storage & Serving Layer

### `db/init/01_schema.sql`

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- COLD: append-only, partitioned, never queried interactively
CREATE TABLE vessel_positions (
    mmsi BIGINT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    sog REAL, cog REAL, heading REAL,
    vessel_type INT, transceiver_class CHAR(1),
    cell TEXT,
    PRIMARY KEY (mmsi, ts)
) PARTITION BY RANGE (ts);

CREATE TABLE vessel_positions_2024_01 PARTITION OF vessel_positions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX ON vessel_positions USING BRIN (ts);
CREATE INDEX ON vessel_positions USING GIST (geom);

-- HOT: one row per vessel, small, this is what the dashboard reads
CREATE TABLE vessel_latest_state (
    mmsi BIGINT PRIMARY KEY,
    last_seen TIMESTAMPTZ NOT NULL,
    last_geom GEOMETRY(Point, 4326) NOT NULL,
    last_lat DOUBLE PRECISION, last_lon DOUBLE PRECISION,
    last_sog REAL, last_cog REAL,
    vessel_type INT, transceiver_class CHAR(1),
    last_cell TEXT,
    msg_count INT DEFAULT 1,
    status TEXT DEFAULT 'active'          -- active | stale | dark
);
CREATE INDEX ON vessel_latest_state (last_seen);
CREATE INDEX ON vessel_latest_state USING GIST (last_geom);

CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    mmsi BIGINT NOT NULL,
    alert_type TEXT NOT NULL,             -- dark_vessel|spoof|mmsi_collision|loiter|ml_anomaly
    score DOUBLE PRECISION,
    severity TEXT,
    detected_at TIMESTAMPTZ NOT NULL,
    last_lat DOUBLE PRECISION, last_lon DOUBLE PRECISION,
    details JSONB
);
CREATE INDEX ON alerts (detected_at DESC);
CREATE UNIQUE INDEX ON alerts (mmsi, alert_type, date_trunc('hour', detected_at));

CREATE TABLE geofences (
    id SERIAL PRIMARY KEY, name TEXT, zone_type TEXT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX ON geofences USING GIST (geom);

CREATE TABLE coverage_prior (
    cell TEXT, transceiver_class CHAR(1),
    n_obs BIGINT, p50_gap_s REAL, p95_gap_s REAL, p99_gap_s REAL,
    PRIMARY KEY (cell, transceiver_class)
);

CREATE TABLE ground_truth (
    mmsi BIGINT, anomaly_type TEXT,
    t_start TIMESTAMPTZ, t_end TIMESTAMPTZ, params JSONB
);
```

`vessel_latest_state` is typically a few thousand rows regardless of how many millions are in `vessel_positions`. The dashboard reads only this and the last ~200 alerts, so refresh cost stays flat as history grows.

---

## Phase 9 — Dashboard

### `frontend/` (Next.js + Deck.gl + MapLibre GL)

- **Use Deck.gl, not Folium/Leaflet DOM.** Deck.gl's `ScatterplotLayer` and `PathLayer` render tens of thousands of points smoothly on the GPU via WebGL at 60 FPS without DOM thrashing or camera reset.
- **Direct Route Handlers:** Next.js Route Handlers (`app/api/*`) query PostgreSQL/PostGIS using a connection pool (`pg`), serving JSON data without an extra web server.
- **Query only the hot tables** (`vessel_latest_state`, recent `alerts`). Never `SELECT` from `vessel_positions` on the interactive path.
- **In-place client updates:** The client polls or streams data updates, refreshing Deck.gl layers in-place without reloading the map or losing user zoom/pan state.
- Colour by `status`: active green, stale amber, dark red; alert markers sized by score.

Views & Tabs:
1. **Live map** — vessels + geofence overlays + active alerts.
2. **Alert feed** — sortable table, click-through to a vessel's track (this one query *may* hit `vessel_positions`, scoped to a single MMSI and time range).
3. **Coverage** — the Phase 3 heatmap, with suppressed cells shaded. Explains *why* certain regions produce no alerts.
4. **System health** — throughput, consumer lag, DLQ rate, end-to-end latency (Phase 12).

---

## Phase 10 — Batch Analytics (Spark)

`analysis/batch_analysis.py` (script, re-runnable) **+** `analysis/batch_report.ipynb` (visualisation only). v1 puts everything in a notebook, which makes the results irreproducible for a report.

Analyses:
- Gap-density hotspots, coverage-normalised (raw hotspots are just receiver maps).
- Traffic volume by vessel type over time.
- Distribution of gap durations by transceiver class — the figure that justifies per-class thresholds.
- MMSI collision census across the full year.
- Alert rate vs coverage density, demonstrating the prior actually works.

Run with `--profile batch` while the stream is stopped.

---

## Phase 11 — Evaluation

### `tests/` (pytest)
- `test_validate.py` — every sentinel value, MMSI edge cases, coordinate bounds.
- `test_haversine.py` — known distances, antimeridian crossing, identical points.
- `test_processor.py` — pure-function tests on the core: exact threshold boundaries, out-of-order arrival, duplicate records.
- `test_sweeper.py` — against a `testcontainers` Postgres with fixture geofences and priors.
- `test_dedup.py` — a persistently dark vessel produces exactly one alert per dedup window.

### `evaluation/evaluate.py`

Join `alerts` against `ground_truth` on `(mmsi, time-overlap)`:

| Metric | Reported per alert type |
|---|---|
| Precision / Recall / F1 | ✅ |
| Detection latency (injection start → alert) | ✅ |
| Alerts per 1000 vessel-hours | ✅ |
| **Ablation: with vs without coverage prior** | ✅ **← the headline result** |

That ablation is the strongest single number in the report. Expect the naive flat-threshold detector to show dramatically worse precision, which is exactly the point.

Secondary: GFW AIS-disabling events as external validation *where the coverage overlaps*, reported honestly with its limitations.

---

## Phase 12 — Observability — **NEW**

`monitoring/metrics.py` writes to a `pipeline_metrics` table (or exposes a Prometheus endpoint):

| Metric | Why it matters |
|---|---|
| Messages/sec (produced, consumed) | Throughput story for the report |
| Kafka consumer lag | Shows whether you actually keep up |
| DLQ rate by reason | Data-quality canary |
| End-to-end latency (event ts → alert ts) | The "real-time" claim needs a number |
| DB insert batch duration p50/p95 | Finds the bottleneck |
| Active vessels / dark vessels | Domain-level health |

Even the simple table-plus-tab version is a meaningful differentiator — most course projects have no numbers at all for how the pipeline behaved under load.

---

## Phase 13 — Documentation

### `README.md`
Mermaid architecture diagram, quickstart (`make up && make seed && make demo`), the Compose-profile explanation, troubleshooting.

### `docs/final_report.md`
Add these sections beyond v1's outline:
- **Why AIS gaps ≠ dark vessels** — the coverage-bias problem and your mitigation. This is the intellectual contribution.
- **Data quality findings** — quantified from the DLQ.
- **Evaluation methodology** — synthetic injection, and why you didn't rely solely on GFW.
- **Limitations** — 1-minute downsampling floor, no SAR corroboration, US-coastal scope, synthetic labels are a proxy for real disabling behaviour.
- **What SAR fusion would add** — Sentinel-1 unmatched-detection correlation is the actual state of the art; naming it shows you know where your system sits.

---

## Suggested Schedule

| Week | Focus | Demonstrable output |
|---|---|---|
| 1 | Phase 0–1 | Dots on a map |
| 2 | Phase 2 | Clean Parquet, DLQ metrics, labelled anomalies |
| 3 | Phase 3 | Coverage heatmap |
| 4 | Phase 4–5 | Live stream, state, batched writes |
| 5 | Phase 6 | Working alerts with coverage gating |
| 6 | Phase 7 | ML scores alongside rules |
| 7 | Phase 9 + 12 | Full dashboard with health tab |
| 8 | Phase 10–11 | Batch analytics + evaluation table |
| 9 | Phase 13 | Report and buffer |

**MVP cut-line** (if time runs short, ship through here): Phases 0–6, 8, 9. That is a complete, defensible, demonstrable system. ML (7), batch analytics (10), and observability (12) are enhancements, in that order of expendability.

---

## Summary of Fixes Applied

| # | v1 problem | v2 fix |
|---|---|---|
| 1 | Flat gap threshold ignores receiver coverage | Coverage prior, per-cell thresholds, suppression of unobserved cells |
| 2 | Gap detection computed on arrival — can never fire | Absence-triggered sweeper over hot state table |
| 3 | `mapGroupsWithState` unavailable in PySpark | Plain stateful consumer; Spark reserved for batch |
| 4 | Unpartitioned position table + dashboard polling it | Hot/cold split, time partitioning, BRIN + GIST indexes |
| 5 | No labels; GFW overlap assumed | Synthetic anomaly injection with `ground_truth` table |
| 6 | No data validation; AIS sentinels corrupt distance math | Shared `validate()` + dead-letter topic |
| 7 | Naive implied-speed spoofing rule | Jump-and-return pattern; separate MMSI-collision class |
| 8 | Loitering flags every anchored vessel | Port/anchorage and NavStatus exclusions |
| 9 | GeoPandas joins in the streaming path | PostGIS GIST joins / broadcast STRtree |
| 10 | IsolationForest scored per message | Explicit 1-hour windowing; persisted feature table |
| 11 | Bare `model.pkl` | Full pipeline + feature names + version, asserted on load |
| 12 | No Kafka keying or partitioning strategy | MMSI keys, 6 partitions, documented topic layout |
| 13 | Strictly ordered producer hides the hard problem | Configurable late-arrival injection |
| 14 | No alert deduplication | Dedup window + unique index |
| 15 | Zookeeper container | KRaft mode |
| 16 | Folium / Streamlit for live rendering | Next.js + Deck.gl |
| 17 | Dual Spark/minimal stack fork | Pure processing core + thin adapters |
| 18 | No observability | Metrics table + health dashboard tab |
| 19 | Nothing works until Phase 5 | Phase 0 vertical slice |
| 20 | No MVP cut-line or schedule | Week-by-week plan with explicit cut-line |