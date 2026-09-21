"""
AIS Stream Producer.

Replays historical AIS data to Kafka topics at accelerated wall-clock speeds.
CRITICAL DESIGN RULES:
  - Every message is keyed by MMSI to guarantee strict per-vessel partition ordering.
  - Realistic out-of-order delivery simulation via jitter buffer (--late-fraction, --max-lateness).
  - Configurable wall-clock speedup factor (--speedup) while preserving true event timestamps.
"""

import argparse
import csv
from datetime import datetime, timedelta
import json
import logging
import random
import time
from typing import Any, Dict, List, Optional
from confluent_kafka import Producer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Replay AIS records into Kafka")
    parser.add_argument("--bootstrap-servers", default="localhost:9092", help="Kafka broker address")
    parser.add_argument("--topic", default="ais.positions.raw", help="Target topic")
    parser.add_argument(
        "--speedup",
        type=float,
        default=720.0,
        help="Wall-clock acceleration factor (e.g. 720 = 24h in 2min; 0 = max throughput)",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducible replays")
    parser.add_argument(
        "--late-fraction",
        type=float,
        default=0.05,
        help="Fraction of messages injected with artificial lateness (0.0 - 1.0)",
    )
    parser.add_argument(
        "--max-lateness",
        type=float,
        default=90.0,
        help="Maximum artificial lateness in event seconds",
    )
    parser.add_argument("--input-file", type=str, default="data/raw/sample.csv", help="Source AIS file")
    return parser.parse_args()


def delivery_callback(err, msg):
    if err is not None:
        logger.error(f"Kafka message delivery failed: {err}")


def run_producer(args):
    random.seed(args.seed)
    logger.info(
        f"Starting producer replay to topic '{args.topic}' with speedup {args.speedup}x, "
        f"late_fraction={args.late_fraction}, max_lateness={args.max_lateness}s..."
    )

    producer = Producer(
        {
            "bootstrap.servers": args.bootstrap_servers,
            "queue.buffering.max.messages": 100000,
            "queue.buffering.max.ms": 50,
            "client.id": "ais-replay-producer",
        }
    )

    # 1. Read and parse records
    records: List[Dict[str, Any]] = []
    with open(args.input_file, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                records.append(
                    {
                        "MMSI": int(row["MMSI"]),
                        "BaseDateTime": row["BaseDateTime"],
                        "LAT": float(row["LAT"]),
                        "LON": float(row["LON"]),
                        "SOG": float(row["SOG"]) if row.get("SOG") else None,
                        "COG": float(row["COG"]) if row.get("COG") else None,
                        "Heading": float(row["Heading"]) if row.get("Heading") else None,
                        "VesselName": row.get("VesselName", ""),
                        "VesselType": int(row["VesselType"]) if row.get("VesselType") else None,
                        "TransceiverClass": row.get("TransceiverClass", "A"),
                    }
                )
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping malformed CSV row: {e}")

    if not records:
        logger.warning(f"No records found in {args.input_file}")
        return

    # 2. Sort chronologically by event timestamp
    records.sort(key=lambda r: datetime.fromisoformat(r["BaseDateTime"].replace("Z", "+00:00")))
    logger.info(f"Loaded {len(records)} records. Replaying...")

    # 3. Stream loop with out-of-order delay buffer
    prev_event_ts = None
    # Jitter buffer holds: (emit_after_event_time, record)
    jitter_buffer: List[tuple[datetime, Dict[str, Any]]] = []

    total_emitted = 0
    total_delayed = 0

    for r in records:
        curr_event_ts = datetime.fromisoformat(r["BaseDateTime"].replace("Z", "+00:00"))

        # Wall-clock pacing
        if prev_event_ts is not None and args.speedup > 0:
            time_gap = (curr_event_ts - prev_event_ts).total_seconds()
            if time_gap > 0:
                time.sleep(time_gap / args.speedup)
        prev_event_ts = curr_event_ts

        # Check jitter buffer: emit any buffered messages whose delay threshold has passed
        ready_to_emit = []
        remaining_buffer = []
        for emit_time, delayed_rec in jitter_buffer:
            if curr_event_ts >= emit_time:
                ready_to_emit.append(delayed_rec)
            else:
                remaining_buffer.append((emit_time, delayed_rec))
        jitter_buffer = remaining_buffer

        # Emit ready delayed messages first
        for d_rec in ready_to_emit:
            producer.produce(
                topic=args.topic,
                key=str(d_rec["MMSI"]).encode("utf-8"),
                value=json.dumps(d_rec).encode("utf-8"),
                on_delivery=delivery_callback,
            )
            total_emitted += 1

        # Determine if this message should be delayed to simulate out-of-order arrival
        if args.late_fraction > 0 and random.random() < args.late_fraction:
            delay_sec = random.uniform(10.0, args.max_lateness)
            emit_at = curr_event_ts + timedelta(seconds=delay_sec)
            jitter_buffer.append((emit_at, r))
            total_delayed += 1
        else:
            # Emit in-order message immediately (KEYED BY MMSI!)
            producer.produce(
                topic=args.topic,
                key=str(r["MMSI"]).encode("utf-8"),
                value=json.dumps(r).encode("utf-8"),
                on_delivery=delivery_callback,
            )
            total_emitted += 1

        producer.poll(0)

    # Flush remaining jitter buffer at the end
    for _, d_rec in jitter_buffer:
        producer.produce(
            topic=args.topic,
            key=str(d_rec["MMSI"]).encode("utf-8"),
            value=json.dumps(d_rec).encode("utf-8"),
            on_delivery=delivery_callback,
        )
        total_emitted += 1

    producer.flush(timeout=30)
    logger.info(
        f"✓ Replay finished. Total emitted: {total_emitted} records "
        f"({total_delayed} artificially delayed out-of-order)."
    )


if __name__ == "__main__":
    args = parse_args()
    run_producer(args)
