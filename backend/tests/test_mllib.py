"""
Unit tests for distributed Spark MLlib trajectory anomaly pipeline.
"""

from types import SimpleNamespace

import numpy as np
import pandas as pd

from detection.features import FEATURE_NAMES
from detection.train import train_mllib_pipeline


def test_train_mllib_pipeline():
    # Generate small synthetic dataset
    np.random.seed(42)
    n_samples = 40
    data = {
        name: np.random.normal(10.0, 2.0, n_samples).clip(0, 50)
        for name in FEATURE_NAMES
    }
    df = pd.DataFrame(data)

    args = SimpleNamespace(
        k_clusters=3,
        seed=42,
        contamination=0.05,
        spark_model_dir="models/test_mllib_pipeline",
        n_estimators=50,
    )

    bundle = train_mllib_pipeline(df, args)

    assert bundle["model_type"] == "spark_mllib_kmeans"
    assert len(bundle["cluster_centers"]) == 3
    assert len(bundle["scaler_mean"]) == len(FEATURE_NAMES)
    assert len(bundle["scaler_std"]) == len(FEATURE_NAMES)
    assert bundle["threshold_distance"] > 0.0
    assert bundle["feature_names"] == FEATURE_NAMES
