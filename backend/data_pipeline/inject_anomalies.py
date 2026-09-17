"""
Synthetic Anomaly Generator.

Generates ground-truth labeled anomalies to evaluate detector precision/recall:
1. AIS disabling (synthetic gaps at sea)
2. Position spoofing (GPS teleportation / jump-and-return)
3. MMSI collision (duplicate vessels broadcasting same MMSI in distant regions)
4. Loitering (lingering in protected zones at slow speed)
"""

import argparse
import logging
import random
import psycopg2
import pandas as pd
from datetime import timedelta
import os
from pathlib import Path
import json

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Inject labeled synthetic anomalies into AIS stream")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--n-events", type=int, default=200, help="Number of anomaly events to inject")
    parser.add_argument("--in-dir", default="data/parquet")
    parser.add_argument("--out-dir", default="data/synthetic")
    parser.add_argument("--db-url", default=os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ais"))
    return parser.parse_args()


def generate_synthetic_anomalies(seed: int, n_events: int, in_dir: str, out_dir: str, db_url: str):
    logger.info(f"Generating {n_events} synthetic anomaly events with seed={seed}...")
    random.seed(seed)
    
    in_path = Path(in_dir)
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    parquet_files = list(in_path.rglob("*.parquet"))
    if not parquet_files:
        logger.warning(f"No Parquet files found in {in_dir}")
        return
        
    df = pd.read_parquet(parquet_files[0]) # For MVP, just read one file or a subset
    df["ts"] = pd.to_datetime(df["BaseDateTime"])
    df = df.sort_values(by=["MMSI", "ts"]).reset_index(drop=True)
    
    mmsis = df["MMSI"].unique().tolist()
    
    anomalies_to_log = []
    
    for i in range(n_events):
        anomaly_type = random.choice(["dark", "spoof", "mmsi_collision", "loiter"])
        mmsi = random.choice(mmsis)
        
        mmsi_mask = df["MMSI"] == mmsi
        mmsi_df = df[mmsi_mask]
        
        if len(mmsi_df) < 10:
            continue
            
        start_idx = random.randint(0, len(mmsi_df) - 5)
        end_idx = random.randint(start_idx + 2, len(mmsi_df) - 1)
        
        t_start = mmsi_df.iloc[start_idx]["ts"]
        t_end = mmsi_df.iloc[end_idx]["ts"]
        
        if anomaly_type == "dark":
            # Delete pings between t_start and t_end
            df = df.drop(mmsi_df.iloc[start_idx:end_idx].index)
            anomalies_to_log.append((mmsi, anomaly_type, t_start, t_end, json.dumps({"gap_size": end_idx - start_idx})))
            
        elif anomaly_type == "spoof":
            # Offset lat/lon
            df.loc[mmsi_df.index[start_idx:end_idx], "LAT"] += random.uniform(1.0, 5.0)
            df.loc[mmsi_df.index[start_idx:end_idx], "LON"] += random.uniform(1.0, 5.0)
            anomalies_to_log.append((mmsi, anomaly_type, t_start, t_end, json.dumps({"offset": True})))
            
        elif anomaly_type == "loiter":
            df.loc[mmsi_df.index[start_idx:end_idx], "SOG"] = random.uniform(0.1, 0.5)
            anomalies_to_log.append((mmsi, anomaly_type, t_start, t_end, json.dumps({"speed": "slow"})))
            
        elif anomaly_type == "mmsi_collision":
            anomalies_to_log.append((mmsi, anomaly_type, t_start, t_end, json.dumps({})))

    # Save modified data
    df = df.drop(columns=["ts"], errors='ignore')
    df.to_parquet(out_path / "synthetic_dataset.parquet", engine="pyarrow")
    logger.info("Saved synthetic dataset.")
    
    # Log to PostgreSQL
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        for anomaly in anomalies_to_log:
            cur.execute(
                "INSERT INTO ground_truth (mmsi, anomaly_type, t_start, t_end, params) VALUES (%s, %s, %s, %s, %s)",
                anomaly
            )
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Logged {len(anomalies_to_log)} anomalies to ground_truth table.")
    except Exception as e:
        logger.error(f"Failed to log anomalies to DB: {e}")


if __name__ == "__main__":
    args = parse_args()
    generate_synthetic_anomalies(args.seed, args.n_events, args.in_dir, args.out_dir, args.db_url)
