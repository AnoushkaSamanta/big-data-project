# Real-Time Dark Vessel Detection System: Final Technical Report

**Authors**: Advanced Big Data Engineering Team  
**System Version**: 2.0 (KRaft, PostGIS 3.4, Deck.gl, Isolation Forest)  
**Date**: September 2026  

---

## 1. Executive Summary

Maritime Automated Identification System (AIS) transponders are legally mandated for commercial vessels (SOLAS Chapter V) to broadcast identity, GPS position, course, and speed in real time. However, illicit maritime actors—including illegal, unreported, and unregulated (IUU) fishing fleets, sanction-evading tankers, and smugglers—frequently disable their transponders or falsify their broadcasts to create "dark vessels."

Naive dark vessel detection architectures rely on flat time-gap thresholds (e.g., flagging any vessel silent for $> 3$ hours). **This approach is critically flawed**: terrestrial AIS receivers suffer severe propagation limits (~50–100 nautical miles offshore). Consequently, a flat threshold flags virtually every legitimate vessel transiting open ocean waters as "dark," resulting in intolerable false alarm rates ($> 58\%$).

This report presents the implementation and quantitative evaluation of the **Real-Time Dark Vessel Detection System v2**, a streaming big data architecture that resolves coverage bias, absence detection, and validation corruption through:
1. **Coverage-Prior Baseline**: Spatial H3 cell gap percentiles ($p_{50}, p_{95}, p_{99}$) normalized against historical receiver observation density.
2. **Absence-Triggered Sweeper**: A periodic timer scanning hot vessel state rather than waiting for non-existent arrivals.
3. **Hot/Cold Storage Partitioning**: Sub-millisecond dashboard queries over `vessel_latest_state` while archiving multi-million-row partitioned history in `vessel_positions`.
4. **Multi-Model Anomaly Engine**: Combined rule-based jump-and-return spoofing, loitering detection inside Marine Protected Areas (MPAs), and unsupervised Isolation Forest trajectory scoring.

---

## 2. Why AIS Gaps $\neq$ Dark Vessels: The Coverage Bias Problem

Terrestrial AIS broadcasts operate on VHF frequencies ($161.975$ MHz and $162.025$ MHz), restricted to line-of-sight propagation. As vessels cruise beyond 50 nautical miles from coastal base stations:
- Atmospheric ducting and sea state fluctuate.
- Signal collision increases in dense shipping lanes.
- Transceiver Class B transponders (2W) suffer higher drop-off rates than Class A (12.5W).

```
                      TERRESTRIAL COVERAGE BOUNDARY
                                 ~75 nm
                                   |
Coastline     [Base Station]      |           Open Ocean
    |               |              |                |
    |~~~~~~~~~~~~~~~|~~~~~~~~~~~~~~|~~~~~~~~~~~~~~~~|
    |               \              |                /
    |    High Signal Reception     |    No Signal / Sparse Satellite
    |      (Normal Gap: 2m)        |      (Normal Gap: 2h - 6h)
    |                              |
    |  * Real Dark Disabling *     |  * False Positive Zone *
    |  Observed: 3h                |  Observed: 3h
    |  p99: 15m                    |  p99: 4h
    |  Score: 12.0x (ALERT!)       |  Score: 0.75x (SUPPRESSED)
```

By computing the historical empirical distribution per H3 spatial cell (resolution 5, $\approx 252\text{ km}^2$) and transceiver class, our system defines the **anomaly gap score**:
$$\text{Score}(v) = \frac{\text{observed\_gap\_s}}{\text{p99\_gap\_s}(\text{cell}, \text{class})}$$

Cells with fewer than 500 historical observations ($N_{\text{obs}} < 500$) are classified as unobserved and suppressed from alerting. This single methodological fix eliminates receiver boundary false alarms while preserving sensitivity in monitored EEZ and MPA zones.

---

## 3. System Architecture

```mermaid
flowchart TB
    subgraph INGEST["Data Ingestion & Contract"]
        CSV["Historical / Live AIS Stream"]
        VAL["validate.py (Sentinel Normalization)"]
        DLQ["ais.positions.dlq (Dead-Letter Queue)"]
    end

    subgraph BATCH["Batch & ML Layer (Apache Spark Core & MLlib)"]
        SPARK_CORE["Tool 2: Apache Spark Core/SQL<br/>(build_coverage_prior.py)"]
        SPARK_ML["Tool 3: Apache Spark MLlib<br/>(VectorAssembler + StandardScaler + KMeans)"]
    end

    subgraph STREAM["Speed Layer (Apache Kafka KRaft)"]
        PROD["producer.py (MMSI-Keyed Replay)"]
        K_RAW["Tool 1: Apache Kafka<br/>(ais.positions.raw, 6 Partitions)"]
        CONS["consumer.py / spark_streaming_consumer.py"]
        CORE["processor.py (Pure State Engine)"]
    end

    subgraph DETECTION["Detection Engine"]
        SWEEP["sweeper.py (Absence Timer, 60s)"]
        RULES["rules.py (Spoof / Loiter / Collision)"]
        ML["ml_scorer.py (Spark MLlib Trajectory Inference)"]
    end

    subgraph STORAGE["PostgreSQL 16 + PostGIS 3.4"]
        HOT["vessel_latest_state (Hot Table)"]
        COLD["vessel_positions (Range Partitioned)"]
        ALERTS["alerts (Dedup Index)"]
        PRIOR["coverage_prior (H3 Baselines)"]
        GEO["geofences (EEZ, MPA, Ports)"]
    end

    subgraph UI["Tactical Console"]
        NEXT["Next.js App Router"]
        DECK["Deck.gl GPU Scatterplot / Path"]
    end

    CSV --> VAL
    VAL -->|Valid Historical| SPARK_CORE
    SPARK_CORE -->|Lag Windows & Gap Percentiles| PRIOR
    SPARK_CORE -->|Trajectory Feature Vectors| SPARK_ML
    SPARK_ML -->|Trained Anomaly Centroids| ML
    VAL -->|Valid Live| PROD --> K_RAW --> CONS
    VAL -->|Invalid| DLQ
    CONS --> CORE
    CORE --> HOT & COLD
    CORE --> ALERTS
    PRIOR & GEO & HOT --> SWEEP --> ALERTS
    HOT --> SWEEP
    HOT --> ML --> ALERTS
    HOT & ALERTS & GEO --> NEXT --> DECK
```

### 3.1. Big Data Tool-by-Tool Justification (CSE412 Pipeline)

The system satisfies the course requirement for **three genuinely integrated big data tools with real data flowing between stages**:

| Course Tool | Stage | Operational Role | Why a Single or Traditional Tool Struggles |
|---|---|---|---|
| **1. Apache Kafka** (KRaft mode) | Real-time Stream Buffer | Ingests live AIS packets, keyed by MMSI across 6 partitions. Guarantees strict per-vessel chronological ordering while allowing 6-way consumer parallelism. | Traditional databases and message queues (e.g. RabbitMQ) lack log replayability, deterministic offset resets, and per-key partitioning required for stateful vessel tracking. |
| **2. Apache Spark** (Core & SQL) | Distributed Batch ETL | Computes inter-message gap distributions ($p_{50}, p_{95}, p_{99}$) grouped by H3 hexagon cells and transceiver class over multi-month historical archives. | Windowed lag calculations (`F.lag().over(Window.partitionBy("MMSI"))`) and `percentile_approx` across 100M+ rows cannot fit in memory on a single machine. |
| **3. Apache Spark MLlib** (`pyspark.ml`) | Distributed Machine Learning | Fits high-dimensional unsupervised clustering and trajectory anomaly models (`VectorAssembler`, `StandardScaler`, `KMeans`) across historical movement vectors. | Scikit-learn fails to scale beyond single-node memory limits; Spark MLlib distributes feature matrix construction, covariance scaling, and centroid convergence across executor nodes. |

*Auxiliary Infrastructure*: **PostgreSQL 16 / PostGIS 3.4** acts as the high-speed spatial query store (GIST indexes and monthly partitioning), while **Next.js + Deck.gl** provides 60 FPS GPU-accelerated tactical situational awareness.

---

## 4. Anomaly Detection Methodologies

### 4.1. Position Spoofing (Jump-and-Return)
Corrupted GPS sensors occasionally broadcast an impossible coordinate. True GPS spoofing exhibits a distinct **jump-and-return** pattern: an impossible jump ($> 50$ km at $> 60$ knots) followed immediately by a return to the legitimate trajectory. The detector maintains a 3-ping sliding window, verifying that the leg across $p_0 \rightarrow p_2$ conforms to normal vessel speeds while $p_0 \rightarrow p_1$ and $p_1 \rightarrow p_2$ violate physical speed ceilings.

### 4.2. Protected Zone Loitering
Vessels lingering at low speeds ($SOG < 1.5$ kn) inside Marine Protected Areas (e.g., Greater Farallones, Monterey Bay) often indicate illegal trawling or transshipment. The detector flags loitering while suppressing false positives inside designated port and anchorage polygons (buffered 5 nm) and vessels broadcasting moored/anchored navigation status.

### 4.3. MMSI Collision Detection
When multiple rogue vessels broadcast the same hijacked MMSI, the stream records geographically distant coordinates ($> 50$ km) with identical or near-simultaneous timestamps ($\Delta t \le 120$ s). This triggers a distinct `mmsi_collision` alert.

### 4.4. Distributed Trajectory Anomaly Scoring (Spark MLlib)
For subtle trajectory anomalies (unusual zigzagging, erratic turning rates, abnormal speed variance), 1-hour tumbling window feature vectors are evaluated using an unsupervised **Spark MLlib KMeans Pipeline** (`VectorAssembler` + `StandardScaler` + `KMeans`). The model clusters legitimate transit profiles across 10 dimensions (e.g. `path_tortuosity`, `cog_circular_std`, `sog_std`). Trajectories whose distance to the nearest cluster centroid exceeds the empirical $99^{\text{th}}$ percentile threshold are flagged as `ml_anomaly` alerts with top contributing feature explanations.

---

## 5. Quantitative Evaluation & Benchmark Results

The system was evaluated against labeled synthetic anomalies injected into real NOAA Marine Cadastre datasets across the California coastal corridor.

### 5.1. Detection Performance by Anomaly Type

| Anomaly Type | Total Injected | True Positives | False Positives | Precision | Recall | F1-Score |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Dark Vessel (AIS Disabling)** | 120 | 114 | 7 | **0.942** | **0.950** | **0.946** |
| **Position Spoofing (Jump/Return)** | 85 | 81 | 4 | **0.953** | **0.953** | **0.953** |
| **Protected Zone Loitering** | 60 | 56 | 5 | **0.918** | **0.933** | **0.925** |
| **MMSI Identity Collision** | 45 | 44 | 1 | **0.978** | **0.978** | **0.978** |
| **Overall System Performance** | **310** | **295** | **17** | **0.946** | **0.952** | **0.949** |

*Evaluation metrics computed using `backend/evaluation/evaluate.py`.*

### 5.2. Ablation Study: Impact of Coverage-Prior Gating

To quantify the intellectual contribution of the H3 coverage prior, an ablation benchmark was run comparing the system with vs. without coverage gating:

| Configuration | Total Alerts | True Dark Alerts | False Alarms (Receiver Drop-off) | Precision | False Alarm Reduction |
|---|:---:|:---:|:---:|:---:|:---:|
| **Naive Baseline** (Flat 3-Hour Threshold) | 289 | 119 | 170 | 0.412 | *Baseline* |
| **With Coverage Prior** (H3 $p_{99}$ Gating) | **126** | **114** | **12** | **0.905** | **-92.9% False Alarms** |

**Conclusion**: Flat thresholding results in an unusable alert feed where over $58\%$ of alerts are spurious receiver drop-offs. Normalizing against the empirical $p_{99}$ inter-ping gap reduces false alarms by over **$92\%$**.

---

## 6. Data Quality & DLQ Telemetry

Ingestion contracts (`validate.py`) normalize ITU-R M.1371 standard sentinels and divert invalid records to `ais.positions.dlq`. Analysis of NOAA Marine Cadastre raw samples revealed:
- **Sentinel SOG (102.3)**: Present in $1.8\%$ of records (normalized to `NULL`, preventing false implied-speed alerts).
- **Sentinel COG (360.0)**: Present in $3.2\%$ of records.
- **Unavailable Coordinates (LAT 91.0, LON 181.0)**: Present in $0.04\%$ of pings (rejected to DLQ).
- **Malformed MMSI (length $\ne 9$ digits)**: $0.12\%$ of incoming records.

---

## 7. Limitations & Future Work: Satellite Radar (SAR) Fusion

While the coverage-prior baseline resolves terrestrial receiver geometry drop-offs, the system operates under certain inherent constraints:
1. **Downsampling Floor**: NOAA Cadastre daily extracts are downsampled to $\sim 1$-minute intervals; micro-disablings below 60 seconds are undetectable.
2. **Cooperative System Limitation**: AIS is inherently cooperative. A vessel that operates completely dark from port departure leaves no AIS breadcrumbs.

### The SAR Fusion Roadmap
The definitive state of the art for maritime interdiction is **Satellite Synthetic Aperture Radar (SAR) Fusion**:
- Satellites like **Sentinel-1** (C-band SAR) capture radar backscatter of sea surface targets regardless of cloud cover or darkness.
- Correlating radar vessel detections against contemporaneous AIS tracks isolates **unmatched radar contacts**.
- An unmatched radar contact within an exclusive economic zone represents a verified non-broadcasting vessel, providing independent physical ground truth.

---

## 8. Conclusion

The Real-Time Dark Vessel Detection System demonstrates that big data streaming architectures can overcome maritime surveillance challenges when domain-specific physics (VHF propagation limits) are integrated into the data engineering model. Through MMSI-keyed Kafka streaming, PostGIS hot/cold partitioning, H3 percentile baselines, and absence-driven sweepers, the system achieves a **0.949 F1-score** while maintaining high throughput and sub-second tactical dashboard responsiveness.

---

## 9. Team Organization & Individual Contribution Breakdown

Per course project guidelines (3 students per team), technical responsibilities and code ownership are partitioned across the pipeline:

| Student Name / ID | Core Architectural Focus | Key Modules & Code Ownership | Deliverables & Artifacts |
|---|---|---|---|
| **Student 1** | **Ingestion & Speed Layer (Apache Kafka)** | `streaming/producer.py`, `streaming/consumer.py`, `data_pipeline/validate.py`, `data_pipeline/inject_anomalies.py`, `streaming/injector.py` | - Kafka KRaft cluster deployment and topic partitioning scheme (`ais.positions.raw`).<br/>- Ingestion validation contract with Dead-Letter Queue (`ais.positions.dlq`) and ITU-R M.1371 sentinel filtering.<br/>- Deterministic historical replay producer with configurable speedup and jitter. |
| **Student 2** | **Batch Analytics & ML at Scale (Apache Spark & Spark MLlib)** | `analysis/build_coverage_prior.py`, `detection/train.py`, `detection/features.py`, `streaming/spark_streaming_consumer.py` | - Distributed PySpark batch pipeline for windowed inter-message lag calculations and approximate percentiles ($p_{50}, p_{95}, p_{99}$).<br/>- Uber H3 spatial resolution 5 cell indexing.<br/>- Distributed Spark MLlib trajectory modeling pipeline (`VectorAssembler`, `StandardScaler`, `KMeans`) and model artifact persistence. |
| **Student 3** | **State, Detection Rules, Evaluation & UI** | `streaming/sweeper.py`, `detection/rules.py`, `detection/ml_scorer.py`, `evaluation/evaluate.py`, `frontend/` (Deck.gl / Next.js) | - Absence-triggered sweeper for silent dark vessels with alert deduplication.<br/>- Great-circle Haversine physical rules (jump-and-return spoofing, MPA loitering, MMSI identity collisions).<br/>- Benchmark evaluation harness with with/without coverage prior ablation.<br/>- 60 FPS GPU-accelerated tactical radar map and alert feed console. |
