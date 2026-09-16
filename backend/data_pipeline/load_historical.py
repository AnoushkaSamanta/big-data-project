"""
Historical AIS Data Loader.
Downloads or converts raw NOAA Marine Cadastre CSV files into date-partitioned Parquet.
Validates records using data_pipeline.validate.validate_record.
"""

import argparse
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Convert raw AIS CSV to partitioned Parquet")
    parser.add_argument("--in-dir", default="data/raw", help="Input directory containing CSVs")
    parser.add_argument("--out-dir", default="data/parquet", help="Output directory for Parquet")
    return parser.parse_args()


def convert_csv_to_parquet(in_dir: str, out_dir: str):
    """
    # TODO (Phase 2):
    # 1. Scan in_dir for .csv or .zip files.
    # 2. Read in chunks with pandas/pyarrow.
    # 3. Apply validate_record and normalize_sentinels.
    # 4. Write rejected rows to DLQ log / parquet partition.
    # 5. Write valid rows partitioned by date: out_dir/year=YYYY/month=MM/day=DD.
    """
    logger.info(f"Scanning {in_dir} for historical AIS records...")
    print("Historical loader stub ready for implementation.")


if __name__ == "__main__":
    args = parse_args()
    convert_csv_to_parquet(args.in_dir, args.out_dir)
