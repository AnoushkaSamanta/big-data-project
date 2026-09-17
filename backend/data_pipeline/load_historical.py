"""
Historical AIS Data Loader.
Downloads or converts raw NOAA Marine Cadastre CSV files into date-partitioned Parquet.
Validates records using data_pipeline.validate.validate_record.
"""

import argparse
import logging
import os
from pathlib import Path
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from data_pipeline.validate import validate_record, normalize_sentinels

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Convert raw AIS CSV to partitioned Parquet")
    parser.add_argument("--in-dir", default="data/raw", help="Input directory containing CSVs")
    parser.add_argument("--out-dir", default="data/parquet", help="Output directory for Parquet")
    parser.add_argument("--dlq-dir", default="data/dlq", help="Output directory for rejected records")
    return parser.parse_args()


def convert_csv_to_parquet(in_dir: str, out_dir: str, dlq_dir: str):
    logger.info(f"Scanning {in_dir} for historical AIS records...")
    
    in_path = Path(in_dir)
    out_path = Path(out_dir)
    dlq_path = Path(dlq_dir)
    
    out_path.mkdir(parents=True, exist_ok=True)
    dlq_path.mkdir(parents=True, exist_ok=True)
    
    files = list(in_path.glob("*.csv")) + list(in_path.glob("*.zip"))
    if not files:
        logger.warning(f"No CSV or ZIP files found in {in_dir}")
        return

    for file_path in files:
        logger.info(f"Processing file: {file_path}")
        
        # Read in chunks to handle large files
        chunk_iter = pd.read_csv(file_path, chunksize=100_000)
        
        for i, chunk in enumerate(chunk_iter):
            valid_records = []
            rejected_records = []
            
            # Convert chunk to list of dicts for validation
            records = chunk.to_dict(orient="records")
            
            for r in records:
                is_valid, reason = validate_record(r)
                if is_valid:
                    clean_r = normalize_sentinels(r)
                    valid_records.append(clean_r)
                else:
                    r["reject_reason"] = reason
                    rejected_records.append(r)
                    
            if valid_records:
                df_valid = pd.DataFrame(valid_records)
                # Parse BaseDateTime to extract year, month, day for partitioning
                df_valid["ts"] = pd.to_datetime(df_valid["BaseDateTime"])
                df_valid["year"] = df_valid["ts"].dt.year
                df_valid["month"] = df_valid["ts"].dt.month
                df_valid["day"] = df_valid["ts"].dt.day
                
                # Drop ts if we don't want to keep it, but keeping it is fine
                df_valid.to_parquet(
                    out_path, 
                    engine="pyarrow", 
                    partition_cols=["year", "month", "day"],
                    compression="snappy"
                )
                
            if rejected_records:
                df_rejected = pd.DataFrame(rejected_records)
                dlq_file = dlq_path / f"dlq_{file_path.stem}_chunk_{i}.parquet"
                df_rejected.to_parquet(dlq_file, engine="pyarrow", compression="snappy")
                
        logger.info(f"Finished processing {file_path}")


if __name__ == "__main__":
    args = parse_args()
    convert_csv_to_parquet(args.in_dir, args.out_dir, args.dlq_dir)
