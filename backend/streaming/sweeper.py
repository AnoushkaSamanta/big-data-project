"""
Dark Vessel Absence Sweeper.

CENTRAL DESIGN PRINCIPLE:
  A dark vessel stops broadcasting AIS messages. Therefore, NO arriving message
  can trigger a dark vessel alert. The detection must be driven by an absence-triggered
  timer that periodically scans the hot table (vessel_latest_state).

Coverage Gating:
  Observed reporting gap is compared against the H3 cell's historical p99 gap
  from coverage_prior. Cells with low confidence (n_obs < 500) are suppressed
  to prevent alerting on receiver geometry boundaries.
"""

import argparse
import logging
import os
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Absence-triggered Dark Vessel Sweeper")
    parser.add_argument("--interval", type=int, default=60, help="Sweep interval in seconds")
    parser.add_argument("--min-score", type=float, default=2.0, help="Minimum gap/p99 ratio to alert")
    return parser.parse_args()


def run_sweeper(args):
    """
    Periodic absence sweep loop.
    # TODO (Phase 6):
    # 1. Query vessel_latest_state joining coverage_prior on cell + transceiver_class.
    # 2. Filter: where now - last_seen > p99_gap_s and n_obs >= 500.
    # 3. Calculate anomaly score = observed_gap_s / p99_gap_s.
    # 4. Insert into alerts table with structured details (cell, p99, observed_gap, etc.).
    # 5. Deduplicate: only 1 alert per vessel per alert_type per 6-hour window.
    """
    logger.info(f"Sweeper initialized. Running every {args.interval}s...")
    print("Sweeper ready for absence detection query implementation.")


if __name__ == "__main__":
    args = parse_args()
    run_sweeper(args)
