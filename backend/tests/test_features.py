"""
Unit tests for feature engineering (circular standard deviation, trajectory tortuosity).
"""

import numpy as np
import pandas as pd
import pytest

from detection.features import circular_std_degrees, compute_trajectory_features


def test_circular_std_degrees():
    # Angles close across 360/0 boundary: [359, 0, 1]
    # Traditional linear std would see huge variance ~170; circular std should be very low ~1 degree
    angles = np.array([359.0, 0.0, 1.0])
    std = circular_std_degrees(angles)
    assert std < 5.0

    # Identical angles
    assert circular_std_degrees(np.array([90.0, 90.0, 90.0])) == pytest.approx(0.0, abs=1e-3)


def test_compute_trajectory_features():
    # Generate 10 pings of a vessel moving in a straight line
    data = []
    base_t = pd.Timestamp("2024-01-15 12:00:00")
    for i in range(12):
        data.append(
            {
                "ts": base_t + pd.Timedelta(minutes=5 * i),
                "LAT": 37.8 + (i * 0.01),
                "LON": -122.4,
                "SOG": 12.0,
                "COG": 0.0,
                "Heading": 0.0,
                "VesselType": 70,
            }
        )

    df = pd.DataFrame(data)
    feats = compute_trajectory_features(df)

    assert feats is not None
    assert feats["sog_mean"] == pytest.approx(12.0, abs=0.1)
    assert feats["path_tortuosity"] == pytest.approx(1.0, abs=0.05)  # Straight line tortuosity is ~1.0
    assert feats["ping_count"] == 12
