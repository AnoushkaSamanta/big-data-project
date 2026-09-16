"""
AIS Stream Producer.

Replays historical AIS data to Kafka topics at accelerated wall-clock speeds.
CRITICAL DESIGN RULE:
  - Every message must be keyed by MMSI.
  - This ensures all records for a given vessel land in the same Kafka partition,
    guaranteeing strict per-vessel ordering while allowing parallel consumers.
"""

import argparse
import json
import logging
import time
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Replay AIS records into Kafka")
    parser.add_argument("--bootstrap-servers", default="localhost:9092", help="Kafka broker address")
    parser.add_argument("--topic", default="ais.positions.raw", help="Target topic")
    parser.add_argument("--speedup", type=float, default=720.0, help="Wall-clock acceleration factor (e.g. 720 = 24h in 2min)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducible replays")
    parser.add_argument("--late-fraction", type=float, default=0.05, help="Fraction of messages injected with artificial lateness")
    parser.add_argument("--input-file", type=str, default="data/raw/sample.csv", help="Source AIS file")
    return parser.parse_args()


def run_producer(args):
    """
    Main replay loop.
    # TODO (Phase 0 / 1):
    # 1. Initialize confluent_kafka.Producer with bootstrap_servers.
    # 2. Iterate through AIS records ordered by timestamp.
    # 3. Simulate delay relative to event time divided by speedup factor.
    # 4. Produce message with key=str(mmsi).encode('utf-8') and value=json.dumps(record).
    """
    logger.info(f"Starting producer replay to topic '{args.topic}' with speedup {args.speedup}x...")
    print("Producer initialized. Ready for record stream implementation.")


if __name__ == "__main__":
    args = parse_args()
    run_producer(args)
