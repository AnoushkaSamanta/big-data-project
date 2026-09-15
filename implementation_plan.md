# Real-Time Dark Vessel Detection System - Implementation Plan

This document outlines the detailed, phase-by-phase implementation plan for building a real-time dark vessel detection system using big data and streaming technologies. 

> [!NOTE]
> This system leverages Apache Kafka for real-time message brokering, PySpark for stream and batch processing, PostgreSQL with PostGIS for spatial data storage, and Streamlit for real-time visualization.

## User Review Required

> [!IMPORTANT]
> Please review the chosen datasets and the overall tech stack constraints before we begin. 
> 
> Specifically, we need to ensure your machine has sufficient resources (RAM/CPU) to run Kafka, Zookeeper, Spark, PostgreSQL, and Streamlit concurrently via Docker Compose. The "Minimal Viable Stack" (skipping Spark) is an option if resources are constrained. Please confirm which stack you'd like to pursue.

## Open Questions

> [!WARNING]
> 1. **Resource Constraints:** Do you have at least 16GB RAM available for the full stack (Kafka, Spark, Postgres, Docker)? Or should we fallback to the Minimal Viable Stack?
> 2. **Geofence Boundaries:** Do you have specific shapefiles or GeoJSONs for Marine Protected Areas (MPAs) or Exclusive Economic Zones (EEZs), or should we use standard bounding boxes?

## Datasets Recommended

1. **Primary Streaming & Batch Data:** 
   - **Source:** [Marine Cadastre AIS Data](https://marinecadastre.gov/ais/)
   - **Details:** Contains vessel positions, MMSI (Maritime Mobile Service Identity), timestamp, Speed Over Ground (SOG), Course Over Ground (COG), Vessel Type, etc. We will use a subset (e.g., 1 month for streaming simulation) and a larger set (1 year) for batch analytics.
2. **Ground Truth / Anomaly Labels (Optional but recommended for ML):**
   - **Source:** [Global Fishing Watch (GFW)](https://globalfishingwatch.org/data-download/)
   - **Details:** Provides datasets on apparent fishing efforts, loitering events, and AIS disabling events. Useful for training and validating the ML models (Isolation Forest).

## Proposed Changes

---

### Phase 1: Environment Setup & Infrastructure
We will containerize the entire infrastructure to ensure reproducibility.

#### [NEW] `docker-compose.yml`
- Services:
  - `zookeeper`: For Kafka cluster coordination.
  - `kafka`: The streaming message broker.
  - `postgres`: PostgreSQL database with the PostGIS extension for spatial queries.
  - `spark-master` & `spark-worker` (Optional based on resource limits): For distributed stream and batch processing.
- Volumes and network setups.

#### [NEW] `requirements.txt`
- Core Python dependencies: `kafka-python`, `pyspark`, `psycopg2-binary`, `geopandas`, `scikit-learn`, `streamlit`, `folium`, `plotly`, `pandas`, `sqlalchemy`, `geoalchemy2`.

---

### Phase 2: Data Ingestion & Streaming Simulation
We will build a producer to read static CSV files and stream them to Kafka, simulating a real-time AIS feed.

#### [NEW] `data_pipeline/load_historical.py`
- Downloads and pre-processes Marine Cadastre data.
- Handles missing values, standardizes column names (MMSI, BaseDateTime, LAT, LON, SOG, COG, VesselType).
- Outputs clean CSV or Parquet files.

#### [NEW] `streaming/producer.py`
- Connects to Kafka topic `ais_stream`.
- Reads the cleaned historical data.
- Emits records sequentially ordered by timestamp, using a controllable sleep mechanism to simulate real-time (e.g., 1 day of data played over 10 minutes).

---

### Phase 3: Stream Processing & State Management
This phase processes the incoming Kafka stream and maintains the state of each vessel.

#### [NEW] `streaming/consumer.py`
- Utilizes PySpark Structured Streaming (or raw `kafka-python` if using the minimal stack).
- Consumes from `ais_stream`.
- Implements stateful streaming (using `mapGroupsWithState` in Spark) to track the last known state per MMSI: `last_seen_timestamp`, `last_lat`, `last_lon`, `last_sog`.
- Calculates `time_since_last_seen` for every new message.
- Writes the processed/enriched records to the PostgreSQL database in real-time, casting lat/lon to PostGIS GEOMETRY types.

---

### Phase 4: Dark Vessel & Anomaly Detection Logic
The core detection engine using both rule-based heuristics and unsupervised ML.

#### [NEW] `detection/gap_detector.py` (Rule-Based)
- **Dark Vessel:** Triggers an alert if `time_since_last_seen` exceeds a threshold (e.g., 3 hours) and the last known location was within a sensitive geofenced zone (using GeoPandas/PostGIS spatial joins).
- **Spoofing/Jumping:** Calculates the Haversine distance between the last and current location. If the implied speed (distance / time difference) exceeds the physical limits of the vessel type (e.g., > 50 knots for a cargo ship), it flags as spoofing.
- **Loitering:** Flags if the vessel remains within a tight radius (e.g., 2 nm) for an extended period inside a restricted zone, not at a port.

#### [NEW] `detection/ml_detector.py` (ML-Based)
- Extracts features: `speed_variance`, `course_variance`, `gap_frequency`, `distance_to_coast`.
- Trains an `IsolationForest` model to detect multidimensional anomalies in vessel trajectories.
- Serializes the trained model (`model.pkl`) and scores streaming batches to flag outliers.

#### [NEW] `db/init.sql` (Database Schema)
- Creates tables: `vessel_positions`, `dark_vessel_alerts`, `geofences`.

---

### Phase 5: Interactive Dashboard
A real-time visualization layer to monitor the system.

#### [NEW] `dashboard/app.py` (Streamlit)
- **Live Map:** Uses `Folium` or `deck.gl` to render vessels based on the latest Postgres data. Normal vessels are green, flagged anomalies are red.
- **Alerts Feed:** A live-updating data table showing recent dark vessel events, MMSIs, and the triggered rule/ML score.
- **Filters:** Interactive widgets to filter by vessel type, alert severity, and time range.
- Implements an auto-refresh loop querying Postgres.

---

### Phase 6: Big-Data Batch Analysis
Historical analytics to understand long-term trends.

#### [NEW] `analysis/batch_analysis.ipynb`
- A Jupyter Notebook utilizing PySpark to analyze the full-year Marine Cadastre dataset.
- Computes aggregated metrics: total unique vessels, average gap duration, gap density hotspots (heatmaps).
- Generates visualizations (Plotly/Matplotlib) to be included in the final report.

---

### Phase 7: Testing & Validation
Ensuring system accuracy and reliability.

#### [NEW] `tests/test_gap_detector.py`
- Pytest suite.
- Mocks Kafka streams and tests edge cases: exact threshold boundaries, impossible speed calculations, and correct spatial intersection with geofences.
- Validates precision/recall if ground truth from GFW is available.

---

### Phase 8: Documentation & Delivery

#### [NEW] `README.md`
- System architecture diagram (Mermaid.js).
- Step-by-step setup and run instructions (Docker, Python venv).

#### [NEW] `docs/final_report.md`
- Comprehensive report detailing problem statement, architecture, dataset, methodology (ML vs. Heuristics), limitations, and results.

## Verification Plan

### Automated Tests
- `pytest tests/` to verify detection logic (speed spoofing, time gaps).

### Manual Verification
1. Run `docker-compose up -d`. Verify all containers are healthy.
2. Start `producer.py` and ensure Kafka receives messages (check via Kafka CLI).
3. Start `consumer.py` and verify `vessel_positions` table in Postgres is populating.
4. Run `app.py` (Streamlit) and visually confirm vessels moving on the map and alerts appearing when gaps are simulated.
