"""
Machine Learning Scorer: Trajectory Isolation Forest Inference.

Loads trained Isolation Forest pipeline, scores completed vessel trajectory windows,
and records 'ml_anomaly' alerts with top contributing feature explanations.
"""

import argparse
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

from detection.features import FEATURE_NAMES, compute_trajectory_features

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Score vessel trajectory windows with Isolation Forest")
    parser.add_argument("--model-path", default="models/iforest_v1.pkl", help="Path to trained model bundle")
    parser.add_argument(
        "--db-url",
        default=os.getenv("DATABASE_URL", "postgresql://postgres:ais_dev_password@localhost:5432/ais"),
    )
    parser.add_argument("--hours", type=int, default=2, help="Lookback window in hours from database")
    parser.add_argument("--loop", action="store_true", help="Run continuously in a loop")
    parser.add_argument("--interval", type=int, default=60, help="Loop interval in seconds (default: 60)")
    return parser.parse_args()


def load_model_bundle(model_path: str):
    """Load serialized model bundle and verify feature name integrity."""
    p = Path(model_path)
    if not p.exists():
        logger.warning(f"Model file {model_path} not found. Running training on sample data first...")
        from detection.train import parse_args as train_parse_args
        from detection.train import train_model

        train_model(train_parse_args(["--allow-synthetic"]))

    bundle = joblib.load(model_path)
    assert bundle["feature_names"] == FEATURE_NAMES, "Feature name mismatch in loaded model!"
    model_type = bundle.get("model_type", "sklearn_iforest")
    logger.info(f"Loaded [{model_type}] model version {bundle.get('version')} (trained at {bundle.get('trained_at')})")
    return bundle


def get_top_contributing_features(scaler, feature_names, x_raw: np.ndarray, top_k: int = 3) -> list[dict[str, Any]]:
    """Estimate top anomalous features based on robust z-score magnitude."""
    # RobustScaler center is median, scale is IQR
    medians = getattr(scaler, "center_", np.zeros(len(x_raw)))
    iqrs = getattr(scaler, "scale_", np.ones(len(x_raw)))
    z_scores = np.abs((x_raw - medians) / np.maximum(iqrs, 1e-4))

    top_indices = np.argsort(z_scores)[::-1][:top_k]
    contributions = []
    for idx in top_indices:
        feat_name = feature_names[idx]
        val = float(x_raw[idx])
        z = float(z_scores[idx])
        contributions.append({"feature": feat_name, "value": round(val, 2), "z_score": round(z, 2)})
    return contributions


def score_database_windows(model_bundle, db_url: str, hours: int):
    """Query recent vessel positions, extract trajectory window features, and score with Spark MLlib / Isolation Forest."""
    feature_names = model_bundle["feature_names"]
    model_type = model_bundle.get("model_type", "sklearn_iforest")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    query = """
    SELECT mmsi, ts, ST_Y(geom) as lat, ST_X(geom) as lon, sog, cog, heading, vessel_type
    FROM vessel_positions
    WHERE ts >= COALESCE((SELECT MAX(ts) FROM vessel_positions), now()) - (%s || ' hours')::interval
    ORDER BY mmsi, ts;
    """
    cur.execute(query, (hours,))
    rows = cur.fetchall()

    if not rows:
        logger.info(f"No vessel positions found in the last {hours} hours.")
        cur.close()
        conn.close()
        return

    df = pd.DataFrame(rows, columns=["MMSI", "ts", "LAT", "LON", "SOG", "COG", "Heading", "VesselType"])
    logger.info(f"Extracted {len(df)} pings across {df['MMSI'].nunique()} vessels. Extracting window features...")

    valid_trajectories = []
    for mmsi, mmsi_df in df.groupby("MMSI"):
        feats = compute_trajectory_features(mmsi_df)
        if feats is not None:
            valid_trajectories.append((mmsi, feats, mmsi_df.iloc[-1], len(mmsi_df)))

    if not valid_trajectories:
        logger.info("No valid vessel trajectory windows for scoring.")
        cur.close()
        conn.close()
        return

    logger.info(f"Scoring {len(valid_trajectories)} vessel trajectory windows with [{model_type}]...")

    features_df = pd.DataFrame([item[1] for item in valid_trajectories])[feature_names]
    alerts_to_insert = []
    detected_at = datetime.now(timezone.utc)

    if model_type == "spark_mllib_kmeans":
        cluster_centers = np.array(model_bundle["cluster_centers"])
        scaler_mean = np.array(model_bundle["scaler_mean"])
        scaler_std = np.maximum(np.array(model_bundle["scaler_std"]), 1e-4)
        threshold_dist = float(model_bundle["threshold_distance"])

        for i, (mmsi, feats, last_ping, window_len) in enumerate(valid_trajectories):
            x_raw = features_df.iloc[i].to_numpy().astype(float)
            scaled_x = (x_raw - scaler_mean) / scaler_std
            distances = np.linalg.norm(cluster_centers - scaled_x, axis=1)
            min_dist = float(np.min(distances))

            if min_dist > threshold_dist:
                z_scores = np.abs(scaled_x)
                top_indices = np.argsort(z_scores)[::-1][:3]
                top_feats = [
                    {"feature": feature_names[idx], "value": round(float(x_raw[idx]), 2), "z_score": round(float(z_scores[idx]), 2)}
                    for idx in top_indices
                ]

                severity = "high" if min_dist > threshold_dist * 1.5 else ("medium" if min_dist > threshold_dist * 1.2 else "low")
                anomaly_score = round((min_dist / max(1e-4, threshold_dist)) * 2.0, 2)

                details = {
                    "model_engine": "spark_mllib_kmeans",
                    "centroid_distance": round(min_dist, 4),
                    "threshold": round(threshold_dist, 4),
                    "top_contributing_features": top_feats,
                    "window_pings": window_len,
                    "sog_mean": round(feats["sog_mean"], 1),
                    "tortuosity": round(feats["path_tortuosity"], 2),
                }

                alerts_to_insert.append(
                    (
                        int(mmsi),
                        "ml_anomaly",
                        anomaly_score,
                        severity,
                        detected_at,
                        float(last_ping["LAT"]),
                        float(last_ping["LON"]),
                        json.dumps(details),
                    )
                )
    else:
        pipeline = model_bundle["pipeline"]
        scaler = pipeline.named_steps["scaler"]
        raw_scores = pipeline.decision_function(features_df)
        predictions = pipeline.predict(features_df)

        for i, (mmsi, feats, last_ping, window_len) in enumerate(valid_trajectories):
            score_raw = float(raw_scores[i])
            prediction = int(predictions[i])

            if prediction == -1 or score_raw < 0:
                x_raw = features_df.iloc[i].to_numpy()
                top_feats = get_top_contributing_features(scaler, feature_names, x_raw)

                severity = "high" if score_raw < -0.15 else ("medium" if score_raw < -0.05 else "low")
                anomaly_score = round(abs(min(0.0, score_raw)) * 10.0 + 1.0, 2)

                details = {
                    "model_engine": "sklearn_iforest",
                    "raw_decision_score": round(score_raw, 4),
                    "top_contributing_features": top_feats,
                    "window_pings": window_len,
                    "sog_mean": round(feats["sog_mean"], 1),
                    "tortuosity": round(feats["path_tortuosity"], 2),
                }

                alerts_to_insert.append(
                    (
                        int(mmsi),
                        "ml_anomaly",
                        anomaly_score,
                        severity,
                        detected_at,
                        float(last_ping["LAT"]),
                        float(last_ping["LON"]),
                        json.dumps(details),
                    )
                )

    if alerts_to_insert:
        insert_sql = """
        INSERT INTO alerts (mmsi, alert_type, score, severity, detected_at, last_lat, last_lon, details)
        VALUES %s
        ON CONFLICT (mmsi, alert_type, date_trunc('hour', detected_at AT TIME ZONE 'UTC')) DO NOTHING;
        """
        execute_values(cur, insert_sql, alerts_to_insert, template="(%s, %s, %s, %s, %s, %s, %s, %s::jsonb)")
        conn.commit()
        logger.info(f"✓ Recorded {len(alerts_to_insert)} ML trajectory anomaly alert(s).")
    else:
        logger.info("No ML trajectory anomalies detected in current window.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    args = parse_args()
    bundle = load_model_bundle(args.model_path)
    if args.loop:
        logger.info(f"Starting ML Scorer loop (interval={args.interval}s, lookback={args.hours}h)...")
        import time
        try:
            while True:
                try:
                    score_database_windows(bundle, args.db_url, args.hours)
                except Exception as e:
                    logger.error(f"Error during ML score sweep: {e}")
                time.sleep(args.interval)
        except KeyboardInterrupt:
            logger.info("Stopping ML Scorer loop.")
    else:
        score_database_windows(bundle, args.db_url, args.hours)
