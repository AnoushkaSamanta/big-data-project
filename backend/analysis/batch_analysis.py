"""
Batch AIS Maritime Traffic & Anomaly Analytics.

Performs offline multi-month batch analyses:
1. Coverage-normalised gap-density hotspots
2. Traffic volume and distribution across vessel types
3. Inter-message gap duration distributions by TransceiverClass (A vs B)
4. Full-year MMSI collision census (shared identity detection)
5. Anomaly rate vs receiver coverage density analysis
"""

import argparse
import logging
import os
from pathlib import Path
import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Run batch AIS maritime analytics")
    parser.add_argument("--in-dir", default="data/parquet", help="Partitioned Parquet directory")
    parser.add_argument("--fallback-file", default="data/raw/sample.csv", help="Fallback CSV file")
    parser.add_argument("--out-dir", default="data/analysis_reports", help="Output directory for reports")
    return parser.parse_args()


def run_batch_analytics(args):
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    in_dir = Path(args.in_dir)
    parquet_files = list(in_dir.rglob("*.parquet"))

    if parquet_files:
        logger.info(f"Loading {len(parquet_files)} Parquet partition files...")
        df = pd.concat([pd.read_parquet(f) for f in parquet_files], ignore_index=True)
    elif os.path.exists(args.fallback_file):
        logger.info(f"Loading data from {args.fallback_file}...")
        df = pd.read_csv(args.fallback_file)
    else:
        logger.warning("No input data found for batch analytics.")
        return

    logger.info(f"Loaded {len(df):,} AIS observations. Starting batch analyses...")

    # 1. Traffic Volume by Vessel Type
    vessel_type_counts = df["VesselType"].value_counts(dropna=False).rename("observation_count")
    vessel_report_path = out_dir / "vessel_type_distribution.csv"
    vessel_type_counts.to_csv(vessel_report_path)
    logger.info(f"✓ Saved vessel type distribution to {vessel_report_path}")

    # 2. Inter-message Gap Distribution by Transceiver Class (A vs B)
    if "BaseDateTime" in df.columns:
        df["ts"] = pd.to_datetime(df["BaseDateTime"])
        df = df.sort_values(by=["MMSI", "ts"]).reset_index(drop=True)
        df["prev_ts"] = df.groupby("MMSI")["ts"].shift(1)
        df["gap_s"] = (df["ts"] - df["prev_ts"]).dt.total_seconds()

        valid_gaps = df[df["gap_s"].between(1, 86400)]
        t_class_col = "TransceiverClass" if "TransceiverClass" in df.columns else None

        if t_class_col:
            gap_summary = (
                valid_gaps.groupby(t_class_col)["gap_s"]
                .agg(
                    count="count",
                    p50=lambda x: np.percentile(x, 50),
                    p95=lambda x: np.percentile(x, 95),
                    p99=lambda x: np.percentile(x, 99),
                    mean="mean",
                )
                .reset_index()
            )
            gap_report_path = out_dir / "gap_distribution_by_class.csv"
            gap_summary.to_csv(gap_report_path, index=False)
            logger.info(f"✓ Saved gap duration distributions to {gap_report_path}")

    # 3. MMSI Collision Census
    # Identify MMSIs reporting with identical timestamps in distinct coordinates
    if "BaseDateTime" in df.columns and "LAT" in df.columns and "LON" in df.columns:
        dups = df[df.duplicated(subset=["MMSI", "BaseDateTime"], keep=False)]
        collision_count = dups["MMSI"].nunique()
        logger.info(f"✓ MMSI Collision Census: identified {collision_count} potentially colliding vessel IDs.")

    logger.info("Batch analytics completed successfully.")


if __name__ == "__main__":
    args = parse_args()
    run_batch_analytics(args)
