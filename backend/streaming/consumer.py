"""
Stateful AIS Stream Consumer.

Consumes validated AIS positions from 'ais.positions.clean', maintains
per-vessel state in 'vessel_latest_state' (hot table), and appends to
'vessel_positions' (cold partitioned storage).
"""

import argparse
import json
import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Stateful AIS Stream Consumer")
    parser.add_argument("--bootstrap-servers", default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    parser.add_argument("--group-id", default="detector")
    parser.add_argument("--topic", default="ais.positions.clean")
    parser.add_argument("--batch-size", type=int, default=500, help="Batch size for Postgres insert")
    return parser.parse_args()


def run_consumer(args):
    """
    Main stateful consumer loop.
    # TODO (Phase 4 / 5):
    # 1. Connect to PostgreSQL using psycopg2.
    # 2. Subscribe to Kafka topic with confluent_kafka.Consumer.
    # 3. Process batches:
    #    - Update vessel_latest_state (upsert last_seen, last_lat, last_lon, sog, cog).
    #    - Batch insert into vessel_positions partition.
    # 4. Commit Kafka offsets ONLY after the database transaction succeeds (at-least-once).
    """
    logger.info(f"Consumer starting for group '{args.group_id}' on topic '{args.topic}'...")
    print("Consumer initialized. Ready for batch upsert loop implementation.")


if __name__ == "__main__":
    args = parse_args()
    run_consumer(args)
