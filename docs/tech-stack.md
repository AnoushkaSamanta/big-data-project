# Tech Stack

Every component, the version it is pinned to, why it was chosen, and what was rejected. Version pins are exact — this system is a reproducible research artifact, not a service that benefits from floating dependencies.

---

## 1. Selection Principles

1. **Reproducibility over currency.** Exact pins everywhere. A reviewer running this in six months must get identical results.
2. **Justify every container.** Each service costs memory on a single development machine. Anything that can be removed without losing a capability is removed.
3. **One implementation per concern.** No parallel Spark/non-Spark forks, no two ways to do a spatial join.
4. **Boring where it doesn't matter.** Novel technology is spent on the parts of the project that are actually novel — the coverage prior and the detection logic — not on infrastructure.

---

## 2. Component Summary

| Layer | Technology | Version | Role |
|---|---|---|---|
| Message broker | Apache Kafka (KRaft) | `confluentinc/cp-kafka:7.6.0` | Ingest buffer, replay, decoupling |
| Stream processing | Python + `confluent-kafka` | `2.3.0` | Live stateful processing |
| Batch processing | Apache Spark (PySpark) | `3.5.1` | Coverage prior, historical analytics |
| Storage | PostgreSQL + PostGIS | `postgis/postgis:16-3.4` | Positions, state, alerts, geofences |
| Spatial indexing | H3 | `h3==3.7.7` | Grid cells for the coverage prior |
| ML at scale | Apache Spark MLlib (`pyspark.ml`) | `3.5.1` | Distributed VectorAssembler, StandardScaler, KMeans clustering |
| Dashboard | Next.js + Deck.gl | `15` / `9.x` | Tactical radar map, alert feed, health |
| Columnar storage | Parquet (PyArrow) | `15.0.2` | Cleaned historical data |
| Orchestration | Docker Compose | v2 spec | Local reproducible stack |
| Testing | pytest + testcontainers | `8.1.1` / `4.4.0` | Unit + integration |

---

## 3. Rationale and Rejected Alternatives

### 3.1 Kafka in KRaft mode

**Chosen because** the project needs three specific properties: replayable ingest (demos break; you must be able to reset offsets and re-run deterministically), decoupling of producer speed from consumer speed, and per-key ordering.

That third property is the one that matters most. Messages are keyed by MMSI, which guarantees all records for a vessel land in the same partition and therefore arrive in order relative to each other, while still allowing parallel consumption across six partitions.

**KRaft rather than Zookeeper:** removes an entire container and roughly 500 MB of resident memory, with no functional loss at this scale. Zookeeper-based Kafka is legacy as of Kafka 3.5+.

| Rejected | Why |
|---|---|
| RabbitMQ | No log replay. Once consumed, a message is gone — fatal for iterating on detector logic against the same data. |
| Redis Streams | Replay is possible but retention and partitioning semantics are weaker; no natural per-key ordering guarantee. |
| Direct file reads | Eliminates the entire streaming dimension of the project. |

### 3.2 `confluent-kafka` rather than `kafka-python`

`confluent-kafka` wraps librdkafka (C) and is substantially faster, with correct handling of manual offset commits and transactional semantics. `kafka-python` is pure Python and has known issues with consumer group rebalancing under load. The performance difference is material at replay speedups of 500×+.

### 3.3 Spark for batch only

**Chosen because** the coverage prior (Phase 3) is a genuine distributed-computation problem: windowed lag computation across hundreds of millions of rows, grouped aggregation with approximate percentiles, over multi-GB Parquet. This is what Spark is for.

**Not used for streaming** for two reasons. First, PySpark does not expose `mapGroupsWithState` — that API is Scala/Java only. The Python equivalents (`applyInPandasWithState`, Spark 3.4+) are considerably more awkward and would consume disproportionate development time. Second, the live path's throughput requirement is a few thousand messages per second, which a single Python process handles comfortably. Spark Structured Streaming here would add ~3 GB of resident memory and significant operational complexity to solve a problem that does not exist.

The processing core is written as a pure function, so a `foreachBatch` Spark adapter can be added later to demonstrate horizontal scaling without rewriting the logic.

| Rejected | Why |
|---|---|
| Flink | Better streaming semantics than Spark, but PyFlink's ecosystem is thinner and the batch story is weaker. One engine for batch is simpler. |
| Dask | Good Python ergonomics, but weaker windowed-aggregation performance and no equivalent of `percentile_approx`. |
| Pandas alone for batch | Will not fit a year of AIS data in memory on a development machine. |

### 3.4 PostgreSQL + PostGIS

**Chosen because** the workload is genuinely spatial — point-in-polygon against geofences, distance-to-port, spatial indexing — and PostGIS is the reference implementation. It also serves as the alert store, the state store, and the dashboard's read source, avoiding three separate systems.

Critical configuration:
- `vessel_positions` is **range-partitioned by month** with a BRIN index on `ts` (append-only time-series: BRIN is dramatically smaller than B-tree here) and GIST on `geom`.
- `vessel_latest_state` is a small, heavily-updated table with one row per MMSI. The dashboard reads only this.
- `shared_buffers=512MB`, `max_wal_size=2GB` to survive batched inserts.

| Rejected | Why |
|---|---|
| TimescaleDB | Genuinely better for the time-series half, and compatible with PostGIS. Rejected only because native partitioning is sufficient at this data volume and it avoids an extension dependency. Worth revisiting if the dataset grows past ~500M rows. |
| MongoDB | Has geospatial indexes, but no equivalent to PostGIS's polygon operations, and joining alerts to geofences to priors would become application-level work. |
| InfluxDB | Excellent time-series, essentially no spatial support. Would require a second store. |
| Elasticsearch | Good at both, but heavy (JVM) and the query model is a poor fit for the relational joins in the sweeper. |

### 3.5 H3 for spatial gridding

The coverage prior needs to bucket the ocean into cells. H3's hexagonal cells have uniform neighbour distance (unlike a lat/lon grid, where cell area collapses toward the poles and diagonal neighbours are further than orthogonal ones). Resolution 5 gives cells of roughly 250 km² — tune against traffic density.

**Rejected:** raw 0.1° lat/lon grid (area distortion, awkward neighbour logic), S2 (comparable, but weaker Python tooling).

### 3.6 Spark MLlib (`pyspark.ml`) for Machine Learning at Scale

**Chosen because** trajectory anomaly detection across multi-gigabyte maritime datasets requires distributed feature extraction and scalable clustering. Using `pyspark.ml.Pipeline` (`VectorAssembler` + `StandardScaler` + `KMeans`), feature matrices and distance centroid computations scale horizontally across worker nodes. 

Fitted cluster centroids and variance bounds are exported to the scoring runtime, guaranteeing train/serve consistency and enabling sub-millisecond streaming inference against the PostGIS live state.

| Rejected | Why |
|---|---|
| Scikit-learn alone | Restricted to single-node memory and CPU cores; cannot scale across hundreds of millions of historical pings. |
| LSTM autoencoder | Would be a better trajectory model, but needs far more data, far more tuning, and would dominate the project's time budget for uncertain gain. |
| One-Class SVM | Scales poorly past ~10k samples; kernel choice is another tuning axis. |
| DBSCAN | Clustering, not scoring — no anomaly score to threshold or rank. |
| Supervised classifier | No real labels exist in wild maritime data. Training on synthetic injections alone would only learn the injection function. |

### 3.7 Next.js + Deck.gl + MapLibre GL

**Next.js (App Router)** because the surveillance console requires high-fidelity, interactive telemetry and a clean decoupled client-server architecture. Direct Route Handlers (`app/api/*`) query PostgreSQL/PostGIS using a connection pool (`pg`), serving parameterized JSON data without requiring an extra intermediate web server.

**Deck.gl rather than Leaflet/Folium** is a hard requirement, not a preference. Leaflet/Folium serialises DOM elements or HTML on updates and becomes unusable past roughly 2,000 markers — a live AIS coastal map routinely exceeds 10,000 vessels. Deck.gl's `ScatterplotLayer` and `PathLayer` render via WebGL directly on the GPU, handling 50,000+ points smoothly at 60 FPS without resetting camera coordinates or flickering during data refreshes.

Key architectural patterns:
- Decoupled API Route Handlers in Next.js querying only `vessel_latest_state`, recent `alerts`, and `geofences`.
- Client-side data updates in-place via Deck.gl without remounting the canvas or interrupting active user interaction.
- Bespoke tactical naval command center theme with Vanilla CSS design tokens (radar grid, glassmorphic HUD telemetry, status color accents).
- Client components (`'use client'`) for WebGL canvas and interactive drawer inspection.

### 3.8 Parquet for cleaned historical data

Columnar, compressed, predicate-pushdown-friendly, partitioned by date. Spark reads a date range without touching other files. CSV would make the batch phase roughly an order of magnitude slower and is the single most common cause of "my Spark job takes forever" in projects of this shape.

---

## 4. `requirements.txt`

```
# --- streaming ---
confluent-kafka==2.3.0

# --- batch ---
pyspark==3.5.1

# --- storage ---
psycopg2-binary==2.9.9
SQLAlchemy==2.0.30
GeoAlchemy2==0.15.1

# --- geospatial ---
geopandas==0.14.4
shapely==2.0.4
pyproj==3.6.1
h3==3.7.7

# --- data ---
pandas==2.2.2
numpy==1.26.4
pyarrow==15.0.2

# --- ml ---
scikit-learn==1.4.2
joblib==1.4.2

# --- frontend (managed in frontend/package.json) ---
# next@15.x, react@19.x, @deck.gl/react@9.x, maplibre-gl@4.x, pg@8.x

# --- ops ---
python-dotenv==1.0.1
structlog==24.1.0
tenacity==8.2.3

# --- dev ---
pytest==8.1.1
pytest-cov==5.0.0
testcontainers[postgres]==4.4.0
ruff==0.4.4
```

> [!NOTE]
> `pyspark==3.5.1` must match the Spark version in the container image exactly. A mismatch produces confusing serialisation errors at job submission rather than a clear version error.

---

## 5. Python and Runtime Versions

| | Version | Note |
|---|---|---|
| Python | 3.11 | 3.12 has incomplete wheel coverage for `h3` 3.7.x |
| Java (for Spark) | OpenJDK 17 | Spark 3.5 supports 8/11/17; 17 is the current default |
| Docker Engine | ≥ 24.0 | Compose v2 spec, `profiles` support |

---

## 6. Resource Budget

Compose profiles mean Spark and the live stream never run simultaneously.

| Profile | Services | Peak RAM |
|---|---|---|
| `stream` (default) | Kafka, Postgres, consumer, sweeper, Next.js dashboard | ~2.5 GB |
| `batch` | Kafka (idle), Postgres, Spark master + 1 worker | ~5.5 GB |

Hard `mem_limit` is set on every service so a runaway Spark job cannot take down the host.

---

## 7. Data Sources

| Source | Use | Licence |
|---|---|---|
| Marine Cadastre AIS (NOAA) | Primary positions, streaming and batch | US Government work, public domain |
| Marine Regions World EEZ v12 | EEZ geofences | CC BY-NC-SA 4.0 — **non-commercial**, attribution required |
| NOAA MPA Inventory | Protected-area geofences | Public domain |
| NGA World Port Index | Port/anchorage exclusion zones | Public domain |
| Global Fishing Watch | Secondary external validation | CC BY-NC 4.0 — non-commercial, attribution required |

> [!IMPORTANT]
> The Marine Regions and GFW licences are non-commercial. This is fine for academic work but must be stated in the report, and it constrains any future use of the artifact.
