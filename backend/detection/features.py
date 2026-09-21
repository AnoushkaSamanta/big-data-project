"""
Feature Engineering for Vessel Trajectory Anomaly Detection.

Extracts numerical feature vectors over 1-hour tumbling windows for Isolation Forest scoring.
Handles circular statistics (course over ground), trajectory tortuosity, speed distributions,
and reporting regularity.
"""

from datetime import datetime
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from detection.rules import haversine_km

# Minimum pings required in a 1-hour window to compute reliable features
MIN_PINGS_PER_WINDOW = 8


def circular_std_degrees(angles_deg: np.ndarray) -> float:
    """
    Calculate circular standard deviation in degrees.
    Prevents 359° and 1° from incorrectly registering as 180° variance.
    """
    if len(angles_deg) == 0:
        return 0.0

    rads = np.radians(angles_deg)
    sin_mean = np.mean(np.sin(rads))
    cos_mean = np.mean(np.cos(rads))
    r = np.hypot(sin_mean, cos_mean)

    if r <= 0.0:
        return 180.0
    if r >= 1.0:
        return 0.0

    # Circular standard deviation formula
    circ_std_rad = np.sqrt(-2.0 * np.log(min(1.0, r)))
    return float(np.degrees(circ_std_rad))


def compute_trajectory_features(df_window: pd.DataFrame) -> Optional[Dict[str, float]]:
    """
    Compute feature vector from a DataFrame of pings for a single MMSI in a 1-hour window.

    Expected columns: ts, LAT, LON, SOG, COG, Heading, VesselType
    """
    if len(df_window) < MIN_PINGS_PER_WINDOW:
        return None

    df_sorted = df_window.sort_values("ts").reset_index(drop=True)

    # 1. Speed over ground (SOG) statistics
    sog_vals = df_sorted["SOG"].dropna().values
    if len(sog_vals) == 0:
        sog_mean = 0.0
        sog_std = 0.0
        sog_max = 0.0
    else:
        sog_mean = float(np.mean(sog_vals))
        sog_std = float(np.std(sog_vals))
        sog_max = float(np.max(sog_vals))

    # 2. Course over ground (COG) circular dispersion
    cog_vals = df_sorted["COG"].dropna().values
    cog_circular_std = circular_std_degrees(cog_vals) if len(cog_vals) > 0 else 0.0

    # 3. Heading vs COG alignment
    if "Heading" in df_sorted.columns and len(df_sorted["Heading"].dropna()) > 0:
        valid_mask = df_sorted["Heading"].notna() & df_sorted["COG"].notna()
        diffs = np.abs(df_sorted.loc[valid_mask, "Heading"] - df_sorted.loc[valid_mask, "COG"])
        diffs = np.minimum(diffs, 360.0 - diffs)
        heading_cog_diff_mean = float(np.mean(diffs)) if len(diffs) > 0 else 0.0
    else:
        heading_cog_diff_mean = 0.0

    # 4. Trajectory Tortuosity (Path length / Net displacement)
    lats = df_sorted["LAT"].values
    lons = df_sorted["LON"].values

    total_path_km = 0.0
    for i in range(len(lats) - 1):
        total_path_km += haversine_km(lats[i], lons[i], lats[i + 1], lons[i + 1])

    net_disp_km = haversine_km(lats[0], lons[0], lats[-1], lons[-1])
    tortuosity = (total_path_km / max(0.1, net_disp_km)) if net_disp_km > 0.05 else 1.0

    # 5. Reporting Gaps
    timestamps = pd.to_datetime(df_sorted["ts"]).values
    diffs_s = np.diff(timestamps) / np.timedelta64(1, "s")

    max_gap_s = float(np.max(diffs_s)) if len(diffs_s) > 0 else 0.0
    gap_count_gt_5m = int(np.sum(diffs_s > 300.0)) if len(diffs_s) > 0 else 0

    return {
        "sog_mean": sog_mean,
        "sog_std": sog_std,
        "sog_max": sog_max,
        "cog_circular_std": cog_circular_std,
        "heading_cog_diff_mean": heading_cog_diff_mean,
        "path_tortuosity": tortuosity,
        "total_path_km": total_path_km,
        "max_gap_s": max_gap_s,
        "gap_count_gt_5m": float(gap_count_gt_5m),
        "ping_count": float(len(df_sorted)),
    }


FEATURE_NAMES = [
    "sog_mean",
    "sog_std",
    "sog_max",
    "cog_circular_std",
    "heading_cog_diff_mean",
    "path_tortuosity",
    "total_path_km",
    "max_gap_s",
    "gap_count_gt_5m",
    "ping_count",
]
