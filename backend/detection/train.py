"""
Machine Learning Training Pipeline: Vessel Trajectory Isolation Forest.

Trains an unsupervised Isolation Forest model on historical trajectory feature vectors.
Uses RobustScaler to handle heavy-tailed maritime movement distributions.
Serializes the full pipeline together with feature names and version metadata
to eliminate train/serve skew.
"""

import argparse
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

from detection.features import compute_trajectory_features, FEATURE_NAMES

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Train Isolation Forest trajectory anomaly model")
    parser.add_argument("--in-file", default="data/raw/sample.csv", help="Input training dataset")
    parser.add_argument("--out-model", default="models/iforest_v1.pkl", help="Output model pickle path")
    parser.add_argument("--contamination", type=float, default=0.01, help="Expected outlier contamination rate")
    parser.add_argument("--n-estimators", type=int, default=200, help="Number of trees in IsolationForest")
    parser.add_argument("--seed", type=int, default=42, help="Random state seed")
    return parser.parse_args()


def extract_window_features_from_df(df: pd.DataFrame) -> pd.DataFrame:
    """Group AIS data by MMSI and 1-hour tumbling windows, then extract features."""
    df["ts"] = pd.to_datetime(df["BaseDateTime"])
    df = df.sort_values(by=["MMSI", "ts"]).reset_index(drop=True)

    feature_rows = []

    # Group by MMSI
    for mmsi, mmsi_df in df.groupby("MMSI"):
        if len(mmsi_df) < 8:
            continue

        # Tumbling 1-hour windows
        mmsi_df = mmsi_df.set_index("ts")
        for window_start, window_df in mmsi_df.resample("1h"):
            if len(window_df) >= 8:
                w_reset = window_df.reset_index()
                feats = compute_trajectory_features(w_reset)
                if feats is not None:
                    feats["mmsi"] = mmsi
                    feats["window_start"] = window_start
                    feature_rows.append(feats)

    if not feature_rows:
        # If dataset is too small for 1h resampling, treat entire vessel track as one window
        for mmsi, mmsi_df in df.groupby("MMSI"):
            feats = compute_trajectory_features(mmsi_df)
            if feats is not None:
                feats["mmsi"] = mmsi
                feats["window_start"] = mmsi_df["ts"].iloc[0]
                feature_rows.append(feats)

    return pd.DataFrame(feature_rows)


def train_model(args):
    in_path = Path(args.in_file)
    out_path = Path(args.out_model)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Loading training data from {in_path}...")
    if in_path.suffix == ".parquet":
        df = pd.read_parquet(in_path)
    else:
        df = pd.read_csv(in_path)

    logger.info(f"Extracting trajectory window features from {len(df)} records...")
    feat_df = extract_window_features_from_df(df)

    if feat_df.empty or len(feat_df) < 5:
        logger.warning(
            "Insufficient windowed observations in input file. Generating synthetic baseline feature set for training."
        )
        # Synthesize baseline normal cargo/tanker feature vectors
        np.random.seed(args.seed)
        n_synth = 500
        synth_data = {
            "sog_mean": np.random.normal(12.0, 3.0, n_synth).clip(0, 25),
            "sog_std": np.random.exponential(1.5, n_synth).clip(0, 5),
            "sog_max": np.random.normal(15.0, 3.0, n_synth).clip(0, 28),
            "cog_circular_std": np.random.exponential(8.0, n_synth).clip(0, 45),
            "heading_cog_diff_mean": np.random.exponential(4.0, n_synth).clip(0, 20),
            "path_tortuosity": np.random.exponential(0.1, n_synth) + 1.0,
            "total_path_km": np.random.normal(20.0, 5.0, n_synth).clip(1, 50),
            "max_gap_s": np.random.exponential(120.0, n_synth).clip(10, 600),
            "gap_count_gt_5m": np.random.poisson(0.2, n_synth),
            "ping_count": np.random.normal(60, 10, n_synth).clip(8, 120),
        }
        X = pd.DataFrame(synth_data)[FEATURE_NAMES]
    else:
        X = feat_df[FEATURE_NAMES].fillna(0.0)

    logger.info(f"Fitting IsolationForest pipeline on {len(X)} feature windows...")
    pipeline = Pipeline(
        [
            ("scaler", RobustScaler()),
            (
                "iforest",
                IsolationForest(
                    n_estimators=args.n_estimators,
                    contamination=args.contamination,
                    random_state=args.seed,
                    n_jobs=-1,
                ),
            ),
        ]
    )

    pipeline.fit(X)

    # Save model bundle with metadata
    model_bundle = {
        "pipeline": pipeline,
        "feature_names": FEATURE_NAMES,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "version": "1.0",
        "contamination": args.contamination,
        "n_samples": len(X),
    }

    joblib.dump(model_bundle, out_path)
    logger.info(f"✓ Model successfully trained and saved to {out_path}")


if __name__ == "__main__":
    args = parse_args()
    train_model(args)
