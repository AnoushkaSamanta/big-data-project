-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. COLD STORE: vessel_positions (range-partitioned by month)
CREATE TABLE IF NOT EXISTS vessel_positions (
    mmsi BIGINT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    sog REAL,
    cog REAL,
    heading REAL,
    vessel_type INT,
    transceiver_class CHAR(1),
    cell TEXT,
    PRIMARY KEY (mmsi, ts)
) PARTITION BY RANGE (ts);

-- Partitions for Q1 2024 (and default fallback)
CREATE TABLE IF NOT EXISTS vessel_positions_2024_01 PARTITION OF vessel_positions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS vessel_positions_2024_02 PARTITION OF vessel_positions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE IF NOT EXISTS vessel_positions_2024_03 PARTITION OF vessel_positions
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE IF NOT EXISTS vessel_positions_default PARTITION OF vessel_positions DEFAULT;

CREATE INDEX IF NOT EXISTS idx_vessel_positions_ts ON vessel_positions USING BRIN (ts);
CREATE INDEX IF NOT EXISTS idx_vessel_positions_geom ON vessel_positions USING GIST (geom);

-- 2. HOT STORE: vessel_latest_state (upserted live, queried by dashboard and sweeper)
CREATE TABLE IF NOT EXISTS vessel_latest_state (
    mmsi BIGINT PRIMARY KEY,
    last_seen TIMESTAMPTZ NOT NULL,
    last_geom GEOMETRY(Point, 4326) NOT NULL,
    last_lat DOUBLE PRECISION,
    last_lon DOUBLE PRECISION,
    last_sog REAL,
    last_cog REAL,
    last_heading REAL,
    vessel_type INT,
    transceiver_class CHAR(1),
    last_cell TEXT,
    msg_count INT DEFAULT 1,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'stale', 'dark'))
);

CREATE INDEX IF NOT EXISTS idx_vessel_latest_state_last_seen ON vessel_latest_state (last_seen);
CREATE INDEX IF NOT EXISTS idx_vessel_latest_state_geom ON vessel_latest_state USING GIST (last_geom);
CREATE INDEX IF NOT EXISTS idx_vessel_latest_state_status ON vessel_latest_state (status);

-- 3. ALERTS: detector outputs with structured evidence
CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    mmsi BIGINT NOT NULL,
    alert_type TEXT NOT NULL, -- dark_vessel | spoof | mmsi_collision | loiter | ml_anomaly
    score DOUBLE PRECISION NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    detected_at TIMESTAMPTZ NOT NULL,
    last_lat DOUBLE PRECISION,
    last_lon DOUBLE PRECISION,
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_alerts_detected_at ON alerts (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_mmsi ON alerts (mmsi);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_mmsi_type_hour ON alerts (mmsi, alert_type, date_trunc('hour', detected_at));

-- 4. GEOFENCES: EEZ, MPA, and Port exclusion zones
CREATE TABLE IF NOT EXISTS geofences (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    zone_type TEXT NOT NULL CHECK (zone_type IN ('eez', 'mpa', 'port', 'anchorage')),
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_geofences_geom ON geofences USING GIST (geom);

-- 5. COVERAGE PRIOR: H3 spatial cell gap statistics
CREATE TABLE IF NOT EXISTS coverage_prior (
    cell TEXT NOT NULL,
    transceiver_class CHAR(1) NOT NULL,
    n_obs BIGINT NOT NULL,
    p50_gap_s REAL NOT NULL,
    p95_gap_s REAL NOT NULL,
    p99_gap_s REAL NOT NULL,
    PRIMARY KEY (cell, transceiver_class)
);

CREATE INDEX IF NOT EXISTS idx_coverage_prior_cell ON coverage_prior (cell);

-- 6. GROUND TRUTH: synthetic anomaly evaluation labels
CREATE TABLE IF NOT EXISTS ground_truth (
    id BIGSERIAL PRIMARY KEY,
    mmsi BIGINT NOT NULL,
    anomaly_type TEXT NOT NULL,
    t_start TIMESTAMPTZ NOT NULL,
    t_end TIMESTAMPTZ NOT NULL,
    params JSONB
);

CREATE INDEX IF NOT EXISTS idx_ground_truth_mmsi ON ground_truth (mmsi, t_start, t_end);

-- 7. METRICS: pipeline health & observability
CREATE TABLE IF NOT EXISTS pipeline_metrics (
    id BIGSERIAL PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    msgs_produced_per_s REAL,
    msgs_consumed_per_s REAL,
    consumer_lag BIGINT,
    dlq_count BIGINT,
    dlq_rate REAL,
    db_batch_ms_p95 REAL,
    e2e_latency_s_p95 REAL,
    active_vessels INT,
    dark_vessels INT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_recorded_at ON pipeline_metrics (recorded_at DESC);
