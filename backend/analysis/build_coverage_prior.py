"""
Coverage Prior Builder (Apache Spark / PySpark).

Computes historical inter-message gap distributions (p50, p95, p99)
per H3 spatial cell and per transceiver class (A vs B).
Saves results into the 'coverage_prior' table in PostGIS.
"""

import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Build H3 cell coverage prior using Spark")
    parser.add_argument("--months", default="2024-01,2024-02,2024-03", help="Comma-separated month partitions")
    parser.add_argument("--h3-resolution", type=int, default=5, help="H3 cell resolution (5 ~ 250 km²)")
    return parser.parse_args()


def build_coverage_prior(args):
    """
    # TODO (Phase 3):
    # 1. Initialize SparkSession with Postgres JDBC driver.
    # 2. Read Parquet partitions for specified months.
    # 3. Map (lat, lon) -> H3 index at specified resolution.
    # 4. Window by MMSI ordered by ts to calculate gap_s = ts - lag(ts).
    # 5. Group by (h3_cell, transceiver_class):
    #    - count(*) as n_obs
    #    - percentile_approx(gap_s, array(0.50, 0.95, 0.99))
    # 6. Write results to coverage_prior table.
    """
    logger.info(f"Building coverage prior for months={args.months} at H3 res={args.h3_resolution}...")
    print("Spark coverage prior job stub ready.")


if __name__ == "__main__":
    args = parse_args()
    build_coverage_prior(args)
