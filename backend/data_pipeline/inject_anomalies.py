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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Inject labeled synthetic anomalies into AIS stream")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--n-events", type=int, default=200, help="Number of anomaly events to inject")
    parser.add_argument("--out-dir", default="data/synthetic")
    return parser.parse_args()


def generate_synthetic_anomalies(seed: int, n_events: int, out_dir: str):
    """
    # TODO (Phase 2 / 11):
    # 1. Sample active vessels from Parquet dataset.
    # 2. Inject target anomaly profiles into copy of records.
    # 3. Log exact start, end, and parameters into ground_truth table.
    """
    logger.info(f"Generating {n_events} synthetic anomaly events with seed={seed}...")
    print("Synthetic anomaly generator ready.")


if __name__ == "__main__":
    args = parse_args()
    generate_synthetic_anomalies(args.seed, args.n_events, args.out_dir)
