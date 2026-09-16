# Product Requirements Document

**Project:** Real-Time Dark Vessel Detection System
**Type:** Academic big data systems project
**Status:** Planning complete, implementation pending

---

## 1. Problem Statement

Vessels are required to broadcast identity and position over AIS. Some switch it off — to conceal illegal fishing, sanctions evasion, unauthorised transshipment, or incursion into protected waters. A vessel that stops broadcasting while remaining at sea is a *dark vessel*.

The obvious detection approach — flag any vessel that stops transmitting — fails badly in practice, and understanding why is the substance of this project.

AIS reception is not uniform. Terrestrial receivers, which supply most of the Marine Cadastre dataset, have an effective range of roughly 50–100 nautical miles. Class B transponders transmit at lower power and much longer intervals than Class A. Both facts mean that **the majority of AIS gaps are artifacts of reception geometry, not vessel behaviour**. A naive threshold detector produces an alert feed that is essentially a map of receiver coverage boundaries.

> [!IMPORTANT]
> The core problem this project solves is not "detect AIS gaps" — that is trivial. It is **separating gaps caused by vessel behaviour from gaps caused by observation limits**, and doing so in a streaming context where the triggering event is the absence of data.

---

## 2. Goals

| # | Goal | Success looks like |
|---|---|---|
| G1 | Detect AIS reporting gaps that are anomalous *relative to local observation conditions* | Precision materially exceeds a flat-threshold baseline on labelled data |
| G2 | Operate on a live stream, not just batch history | Alerts appear within one sweep interval of a gap crossing threshold |
| G3 | Detect in-data anomalies: position spoofing, MMSI collision, loitering | Each has a distinct alert class with auditable evidence |
| G4 | Quantify performance honestly | Precision/recall table with a with/without-coverage-prior ablation |
| G5 | Be reproducible end to end | Clean machine → working demo via documented commands |
| G6 | Demonstrate genuine big-data processing | Multi-GB Spark aggregation that produces something the system actually depends on |

---

## 3. Non-Goals

Stating these explicitly prevents scope creep and pre-empts the obvious reviewer questions.

| # | Not doing | Why |
|---|---|---|
| N1 | Confirming dark vessels via satellite imagery | SAR fusion (Sentinel-1) is the real state of the art but is a project in itself |
| N2 | Live AIS feed ingestion | Commercial feeds are paid; replay of historical data is functionally equivalent for this purpose |
| N3 | Vessel identity resolution or registry lookup | Requires commercial registry data |
| N4 | Predicting *future* dark events | Detection, not forecasting |
| N5 | Global coverage | US coastal waters (Marine Cadastre scope) |
| N6 | Multi-user deployment, auth, RBAC | Single-analyst local tool |
| N7 | Sub-minute gap detection | Source data is downsampled to ~1-minute intervals; claiming finer resolution would be false |

---

## 4. Users

**Primary — the maritime domain analyst.** Monitors a region, needs to know which vessels warrant attention right now and why. Cares about false-positive rate above almost everything: an alert feed with poor precision gets ignored entirely, which is worse than no feed.

**Secondary — the evaluator.** Wants to see that the system works, understand the methodology, and verify the claims. Needs reproducibility and honest metrics more than polish.

---

## 5. User Stories

### Live monitoring
- As an analyst, I want a live map of vessel positions with anomalies visually distinct, so I can assess the current picture at a glance.
- As an analyst, I want alerts ranked by score rather than time, so the most anomalous case is at the top rather than the most recent.
- As an analyst, I want each alert to show the evidence behind it — the observed gap, the expected gap, the zone, the coverage confidence — so I can judge it rather than trust it.
- As an analyst, I want one alert per event, not one per polling interval, so the feed stays readable.

### Investigation
- As an analyst, I want to click an alert and see that vessel's recent track, so I can see the behaviour leading up to the anomaly.
- As an analyst, I want to filter by vessel type, alert class, severity, and time window.
- As an analyst, I want to see where the system is *not* confident, so I know which quiet regions mean "nothing there" versus "we cannot see there."

### Operation
- As an operator, I want to reset and replay deterministically, so a demo behaves identically every time.
- As an operator, I want throughput, lag, and latency visible, so I can tell whether the pipeline is keeping up.
- As an operator, I want rule-based detection to keep working if the ML component fails.

---

## 6. Functional Requirements

### 6.1 Ingestion

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | Convert Marine Cadastre CSV dailies to date-partitioned Parquet | Must |
| FR-1.2 | Validate every record against a single shared contract; route rejects to a DLQ with a reason code | Must |
| FR-1.3 | Normalise AIS sentinel values (SOG 102.3, COG 360, heading 511, LAT 91, LON 181) to null or rejection | Must |
| FR-1.4 | Reject MMSI values that are zero or not nine digits | Must |
| FR-1.5 | Replay historical data to Kafka at a configurable wall-clock speedup, preserving event timestamps | Must |
| FR-1.6 | Key all messages by MMSI | Must |
| FR-1.7 | Inject a configurable fraction of late-arriving records | Should |
| FR-1.8 | Support deterministic replay via seed | Should |

### 6.2 Coverage baseline

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Compute per-cell, per-transceiver-class inter-message gap distributions (p50/p95/p99) over ≥3 months of history | Must |
| FR-2.2 | Mark cells with fewer than 500 observations as low-confidence and suppress them from alerting | Must |
| FR-2.3 | Expose the coverage map as a dashboard layer | Must |
| FR-2.4 | Recompute on demand as the historical window extends | Should |

### 6.3 Stream processing

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Maintain per-MMSI state: last seen, last position, last speed, message count, transceiver class | Must |
| FR-3.2 | Persist positions to partitioned cold storage using batched inserts | Must |
| FR-3.3 | Upsert hot state in the same transaction as the position insert | Must |
| FR-3.4 | Commit Kafka offsets only after the database transaction succeeds | Must |
| FR-3.5 | Make position inserts idempotent on `(mmsi, ts)` | Must |
| FR-3.6 | Checkpoint in-memory state so restart resumes rather than cold-starts | Should |
| FR-3.7 | Handle out-of-order arrival without corrupting state | Must |

### 6.4 Detection

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | Detect dark vessels via a periodic sweep over hot state, not on message arrival | Must |
| FR-4.2 | Score gaps as a ratio against the cell-and-class-specific p99, not a flat threshold | Must |
| FR-4.3 | Suppress alerts in low-confidence coverage cells | Must |
| FR-4.4 | Deduplicate: at most one alert per vessel per type per 6-hour window | Must |
| FR-4.5 | Detect position spoofing via a jump-and-return pattern, not a single implied-speed violation | Must |
| FR-4.6 | Detect MMSI collision (same MMSI, overlapping timestamps, distant positions) as a separate class | Must |
| FR-4.7 | Detect loitering, excluding port/anchorage polygons and at-anchor navigation status | Must |
| FR-4.8 | Apply speed limits conditioned on vessel type, with a conservative default for unknown types | Must |
| FR-4.9 | Attach full evidence to every alert as structured detail | Must |
| FR-4.10 | Score 1-hour trajectory windows with IsolationForest and emit an anomaly class | Should |
| FR-4.11 | Report the top contributing features for each ML anomaly | Could |

### 6.5 Dashboard

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | Live map rendering ≥10,000 vessels without degradation | Must |
| FR-5.2 | Overlay geofences and colour vessels by status | Must |
| FR-5.3 | Alert feed sortable by score and time, filterable by type and severity | Must |
| FR-5.4 | Vessel drill-down showing recent track | Should |
| FR-5.5 | Coverage tab with suppressed cells visibly distinct | Must |
| FR-5.6 | System health tab: throughput, consumer lag, DLQ rate, end-to-end latency | Should |
| FR-5.7 | Auto-refresh without a full recompute of cached queries | Must |

### 6.6 Evaluation

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | Generate labelled synthetic anomalies (disabling, spoofing, identity swap, loitering) with recorded intervals | Must |
| FR-6.2 | Compute precision, recall, F1 and detection latency per alert class | Must |
| FR-6.3 | Report the with/without-coverage-prior ablation | Must |
| FR-6.4 | Cross-check against GFW AIS-disabling events where coverage overlaps | Could |

---

## 7. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Ingest throughput | ≥ 5,000 msg/s sustained |
| NFR-2 | End-to-end latency (event time → alert persisted) | p95 < 90 s |
| NFR-3 | Dashboard refresh | < 2 s |
| NFR-4 | Peak memory, streaming profile | < 4 GB |
| NFR-5 | Peak memory, batch profile | < 8 GB |
| NFR-6 | Cold start to working demo | < 10 min on a clean machine |
| NFR-7 | Test coverage of detection logic | > 80% |
| NFR-8 | Deterministic replay | Identical alerts for identical seed |

---

## 8. Success Metrics

### Primary

| Metric | Target | Notes |
|---|---|---|
| Dark-vessel precision on synthetic labels | > 0.70 | Against injected disabling events |
| Dark-vessel recall | > 0.80 | Recall is cheaper to buy than precision here |
| **Precision improvement over flat-threshold baseline** | **> 2×** | The headline result |
| Spoofing precision | > 0.85 | Should be high; the signal is strong once sentinels are removed |
| Alert rate | < 5 per 1,000 vessel-hours | Above this, an analyst stops reading the feed |

### Secondary

| Metric | Target |
|---|---|
| DLQ rate | < 2% of ingested records |
| Consumer lag at 500× replay | < 30 s |
| Coverage prior cells meeting confidence threshold | > 60% of cells with any traffic |

> [!NOTE]
> The ablation in row three is the single most important number in the project. It is the empirical demonstration that the coverage prior — the main methodological contribution — actually does something. A high absolute precision with no baseline comparison proves far less.

---

## 9. Scope and Milestones

| Milestone | Phases | Output |
|---|---|---|
| M1 — Vertical slice | 0–1 | Data flows end to end; dots on a map |
| M2 — Clean data + labels | 2 | Parquet, DLQ metrics, `ground_truth` populated |
| M3 — Coverage baseline | 3 | Coverage heatmap; prior in Postgres |
| M4 — Live pipeline | 4–5 | Stateful consumer keeping up at target throughput |
| M5 — Detection | 6 | Coverage-gated alerts with evidence |
| M6 — Dashboard | 9 | All tabs functional |
| M7 — ML + analytics | 7, 10 | IsolationForest scores; batch findings |
| M8 — Evaluation + report | 11–13 | Metrics table, ablation, written report |

**MVP cut-line: M1–M6.** That is a complete and defensible system. M7 is the first thing to cut, then the observability tab within M6.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Coverage prior is sparse in the region of interest | Most cells suppressed; few alerts | Widen the historical window; choose a high-traffic region for the demo |
| Synthetic anomalies are too easy to detect | Metrics look good but mean little | Inject only into high-coverage cells; vary durations; report the injection parameters so results are interpretable |
| Spark batch job exceeds memory | Phase 3 blocked | Process month-by-month, union the partial aggregates |
| Marine Cadastre schema differs by year | Loader breaks | Pin to one year; validate columns explicitly on load |
| Time budget overruns | Incomplete deliverable | MVP cut-line defined above; ML and analytics are expendable in that order |
| GFW labels do not overlap the chosen region | No external validation | Already mitigated — synthetic injection is the primary evaluation, GFW is secondary |
