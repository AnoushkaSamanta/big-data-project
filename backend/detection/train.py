"""
Machine Learning Training Pipeline: Vessel Trajectory Isolation Forest.

Trains an unsupervised Isolation Forest model on historical trajectory feature vectors.
Uses RobustScaler to handle heavy-tailed maritime movement distributions.
Serializes the full pipeline together with feature names and version metadata
to eliminate train/serve skew.
"""

import argparse
import logging
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

from detection.features import FEATURE_NAMES, compute_trajectory_features

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args(args=None):
    parser = argparse.ArgumentParser(description="Train trajectory anomaly model (Spark MLlib / Isolation Forest)")
    parser.add_argument("--in-file", default="data/raw/sample.csv", help="Input training dataset")
    parser.add_argument("--out-model", default="models/iforest_v1.pkl", help="Output model bundle pickle path")
    parser.add_argument("--spark-model-dir", default="models/spark_mllib_pipeline", help="Directory to save fitted Spark MLlib pipeline")
    parser.add_argument("--engine", choices=["mllib", "sklearn"], default="mllib", help="ML training engine (default: mllib)")
    parser.add_argument("--k-clusters", type=int, default=5, help="Number of clusters for Spark MLlib KMeans")
    parser.add_argument("--contamination", type=float, default=0.01, help="Expected outlier contamination rate")
    parser.add_argument("--n-estimators", type=int, default=200, help="Number of trees in IsolationForest fallback")
    parser.add_argument("--seed", type=int, default=42, help="Random state seed")
    return parser.parse_args(args)


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


def get_training_features(in_path: Path, seed: int) -> pd.DataFrame:
    """Load or synthesize training feature matrix."""
    if in_path.exists():
        logger.info(f"Loading training data from {in_path}...")
        if in_path.suffix == ".parquet":
            df = pd.read_parquet(in_path)
        else:
            df = pd.read_csv(in_path)
        feat_df = extract_window_features_from_df(df)
    else:
        feat_df = pd.DataFrame()

    if feat_df.empty or len(feat_df) < 5:
        logger.warning(
            "Insufficient windowed observations in input file. Generating synthetic baseline feature set for training."
        )
        np.random.seed(seed)
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
        return pd.DataFrame(synth_data)[FEATURE_NAMES]

    return feat_df[FEATURE_NAMES].fillna(0.0)


def train_mllib_pipeline(X: pd.DataFrame, args) -> dict:
    """Train distributed Spark MLlib trajectory anomaly pipeline."""
    try:
        from pyspark.ml import Pipeline
        from pyspark.ml.clustering import KMeans
        from pyspark.ml.feature import StandardScaler, VectorAssembler
        from pyspark.sql import SparkSession
    except ImportError:
        logger.warning("PySpark MLlib not available. Falling back to scikit-learn.")
        return train_sklearn_pipeline(X, args)

    logger.info("Initializing PySpark session for Spark MLlib training...")
    spark = (
        SparkSession.builder.appName("DarkVessel-MLlib-Training")
        .config("spark.driver.memory", "2g")
        .config("spark.executor.memory", "2g")
        .config("spark.hadoop.fs.defaultFS", "file:///")
        .getOrCreate()
    )

    # Convert pandas DataFrame to Spark DataFrame
    df_spark = spark.createDataFrame(X.astype(float))

    assembler = VectorAssembler(inputCols=FEATURE_NAMES, outputCol="raw_features")
    scaler = StandardScaler(inputCol="raw_features", outputCol="features", withMean=True, withStd=True)
    kmeans = KMeans(k=args.k_clusters, seed=args.seed, featuresCol="features", predictionCol="cluster")

    pipeline = Pipeline(stages=[assembler, scaler, kmeans])
    logger.info(f"Fitting Spark MLlib pipeline (k={args.k_clusters} clusters) across {len(X)} trajectory vectors...")
    model = pipeline.fit(df_spark)

    # Save fitted Spark MLlib pipeline to disk
    spark_dir = Path(args.spark_model_dir).resolve()
    spark_dir.parent.mkdir(parents=True, exist_ok=True)
    try:
        model.write().overwrite().save(f"file://{spark_dir}")
        logger.info(f"✓ Saved distributed Spark MLlib pipeline to {spark_dir}")
    except Exception as e:
        logger.warning(f"Could not persist native Spark pipeline directory: {e}")

    # Extract fitted parameters
    scaler_model = model.stages[1]
    kmeans_model = model.stages[2]
    cluster_centers = [c.tolist() if hasattr(c, "tolist") else list(c) for c in kmeans_model.clusterCenters()]
    scaler_mean = scaler_model.mean.toArray().tolist() if hasattr(scaler_model.mean, "toArray") else list(scaler_model.mean)
    scaler_std = scaler_model.std.toArray().tolist() if hasattr(scaler_model.std, "toArray") else list(scaler_model.std)

    # Compute training distances to establish anomaly threshold
    mean_arr = np.array(scaler_mean)
    std_arr = np.maximum(np.array(scaler_std), 1e-4)
    centers_arr = np.array(cluster_centers)

    scaled_X = (X.to_numpy() - mean_arr) / std_arr
    distances = []
    for row in scaled_X:
        dists = np.linalg.norm(centers_arr - row, axis=1)
        distances.append(np.min(dists))

    threshold_distance = float(np.percentile(distances, (1.0 - args.contamination) * 100))
    logger.info(f"Spark MLlib anomaly distance threshold (p{int((1.0 - args.contamination)*100)}): {threshold_distance:.4f}")

    spark.stop()

    # Also fit companion IsolationForest for dual-scoring fallback
    sklearn_bundle = train_sklearn_pipeline(X, args)

    return {
        "model_type": "spark_mllib_kmeans",
        "spark_pipeline_dir": str(spark_dir),
        "cluster_centers": cluster_centers,
        "scaler_mean": scaler_mean,
        "scaler_std": scaler_std,
        "threshold_distance": threshold_distance,
        "pipeline": sklearn_bundle["pipeline"],
        "feature_names": FEATURE_NAMES,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "version": "spark-mllib-3.5.1",
        "contamination": args.contamination,
        "n_samples": len(X),
        "k_clusters": args.k_clusters,
    }


def train_sklearn_pipeline(X: pd.DataFrame, args) -> dict:
    """Train single-node scikit-learn IsolationForest pipeline."""
    logger.info(f"Fitting scikit-learn IsolationForest on {len(X)} feature windows...")
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
    return {
        "model_type": "sklearn_iforest",
        "pipeline": pipeline,
        "feature_names": FEATURE_NAMES,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "version": "sklearn-1.4",
        "contamination": args.contamination,
        "n_samples": len(X),
    }


def train_model(args):
    in_path = Path(args.in_file)
    out_path = Path(args.out_model)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    X = get_training_features(in_path, args.seed)

    if getattr(args, "engine", "mllib") == "mllib":
        model_bundle = train_mllib_pipeline(X, args)
    else:
        model_bundle = train_sklearn_pipeline(X, args)

    joblib.dump(model_bundle, out_path)
    logger.info(f"✓ Model successfully trained with [{model_bundle['model_type']}] and saved to {out_path}")


if __name__ == "__main__":
    args = parse_args()
    train_model(args)
