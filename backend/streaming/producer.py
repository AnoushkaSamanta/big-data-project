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
import csv
from confluent_kafka import Producer
from datetime import datetime

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
    logger.info(f"Starting producer replay to topic '{args.topic}' with speedup {args.speedup}x...")

    # 1. Initialize the Kafka Producer
    producer = Producer({"bootstrap.servers": args.bootstrap_servers})

    # 2. Read and parse the CSV rows
    records = []
    with open(args.input_file, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append({
                "MMSI": int(row["MMSI"]),
                "BaseDateTime": row["BaseDateTime"],
                "LAT": float(row["LAT"]),
                "LON": float(row["LON"]),
                "SOG": float(row["SOG"]) if row["SOG"] else None,
                "COG": float(row["COG"]) if row["COG"] else None,
                "Heading": float(row["Heading"]) if row["Heading"] else None,
                "VesselName": row["VesselName"],
                "VesselType": int(row["VesselType"]) if row["VesselType"] else None,
                "TransceiverClass": row["TransceiverClass"],
            })

    # 3. Sort chronologically by event timestamp
    records.sort(key=lambda r: datetime.fromisoformat(r["BaseDateTime"]))

    # 4. Stream loop with wall-clock speedup
    prev_ts = None
    for r in records:
        curr_ts = datetime.fromisoformat(r["BaseDateTime"])
        if prev_ts is not None and args.speedup > 0:
            gap = (curr_ts - prev_ts).total_seconds()
            if gap > 0:
                time.sleep(gap / args.speedup)
        prev_ts = curr_ts

        # 5. Broadcast to Kafka (KEY BY MMSI!)
        producer.produce(
            topic=args.topic,
            key=str(r["MMSI"]).encode("utf-8"),
            value=json.dumps(r).encode("utf-8"),
        )
        producer.poll(0)
        logger.info(f"Broadcast MMSI {r['MMSI']} at {r['BaseDateTime']} ({r['LAT']}, {r['LON']})")

    producer.flush()
    logger.info("Sample replay finished.")
 


if __name__ == "__main__":
    args = parse_args()
    run_producer(args)
