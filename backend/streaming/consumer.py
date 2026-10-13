"""
Stateful AIS Stream Consumer & Batch Ingestion Engine.

Consumes AIS positions from Kafka, validates records against the schema contract,
routes invalid messages to the Dead-Letter Queue (ais.positions.dlq),
maintains per-vessel state in 'vessel_latest_state' (hot table),
appends to 'vessel_positions' (cold storage), and records in-stream anomaly alerts.

Uses high-throughput psycopg2 execute_values batch upserts and manual Kafka
offset commits to guarantee at-least-once delivery semantics without data corruption.
"""

import argparse
import json
import logging
import os
import time
from collections import Counter
from datetime import datetime, timezone
from typing import Any

import psycopg2
from confluent_kafka import Consumer, KafkaError, Producer
from psycopg2.extras import execute_values

from data_pipeline.validate import normalize_sentinels, validate_record
from streaming.processor import Alert, VesselState, process_batch

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Stateful AIS Stream Consumer")
    parser.add_argument("--bootstrap-servers", default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    parser.add_argument("--group-id", default="detector")
    parser.add_argument("--topic", default=os.getenv("KAFKA_TOPIC", "ais.positions.raw"))
    parser.add_argument("--dlq-topic", default="ais.positions.dlq")
    parser.add_argument("--alerts-topic", default="ais.alerts")
    parser.add_argument("--batch-size", type=int, default=500, help="DB batch insert size")
    parser.add_argument("--flush-interval-ms", type=int, default=1000, help="Max buffering time before DB flush")
    parser.add_argument("--pg-host", default=os.getenv("POSTGRES_HOST", "localhost"))
    parser.add_argument("--pg-port", default=int(os.getenv("POSTGRES_PORT", "5432")))
    parser.add_argument("--pg-db", default=os.getenv("POSTGRES_DB", "ais"))
    parser.add_argument("--pg-user", default=os.getenv("POSTGRES_USER", "postgres"))
    parser.add_argument("--pg-password", default=os.getenv("POSTGRES_PASSWORD", "ais_dev_password"))
    return parser.parse_args()


def flush_batch_to_postgres(
    cursor,
    conn,
    valid_records: list[dict[str, Any]],
    state_table: dict[int, VesselState],
    alerts: list[Alert],
):
    """Batch insert positions, upsert latest state, and insert in-stream alerts."""
    if not valid_records and not alerts:
        return

    # 1. Batch insert vessel positions into partitioned cold table
    if valid_records:
        pos_values = [
            (
                r["MMSI"],
                r.get("VesselName") or r.get("vessel_name"),
                r["BaseDateTime"],
                r["LON"],  # ST_MakePoint(LON, LAT)
                r["LAT"],
                r.get("sog") if "sog" in r else r.get("SOG"),
                r.get("cog") if "cog" in r else r.get("COG"),
                r.get("heading") if "heading" in r else r.get("Heading"),
                r.get("VesselType"),
                r.get("TransceiverClass", "A"),
                r.get("cell"),
            )
            for r in valid_records
        ]

        sql_insert_positions = """
        INSERT INTO vessel_positions (
            mmsi, vessel_name, ts, geom, sog, cog, heading, vessel_type, transceiver_class, cell
        )
        VALUES %s
        ON CONFLICT (mmsi, ts) DO NOTHING;
        """
        # Format geometry with ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        execute_values(
            cursor,
            sql_insert_positions,
            pos_values,
            template="(%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, %s, %s)",
            page_size=1000,
        )

        # 2. Batch upsert latest state for affected vessels
        affected_mmsis = {r["MMSI"] for r in valid_records}
        batch_counts = Counter(r["MMSI"] for r in valid_records)
        latest_values = []
        for mmsi in affected_mmsis:
            v_state = state_table[mmsi]
            latest_values.append(
                (
                    v_state.mmsi,
                    v_state.vessel_name,
                    v_state.last_seen,
                    v_state.last_lon,
                    v_state.last_lat,
                    v_state.last_lat,
                    v_state.last_lon,
                    v_state.last_sog,
                    v_state.last_cog,
                    v_state.last_heading,
                    v_state.vessel_type,
                    v_state.transceiver_class,
                    v_state.last_cell,
                    batch_counts[mmsi],
                    v_state.status,
                )
            )

        sql_upsert_latest = """
        INSERT INTO vessel_latest_state (
            mmsi, vessel_name, last_seen, last_geom, last_lat, last_lon,
            last_sog, last_cog, last_heading, vessel_type, transceiver_class,
            last_cell, msg_count, status
        )
        VALUES %s
        ON CONFLICT (mmsi) DO UPDATE SET
            vessel_name = COALESCE(EXCLUDED.vessel_name, vessel_latest_state.vessel_name),
            last_seen = EXCLUDED.last_seen,
            last_geom = EXCLUDED.last_geom,
            last_lat = EXCLUDED.last_lat,
            last_lon = EXCLUDED.last_lon,
            last_sog = EXCLUDED.last_sog,
            last_cog = EXCLUDED.last_cog,
            last_heading = EXCLUDED.last_heading,
            vessel_type = COALESCE(EXCLUDED.vessel_type, vessel_latest_state.vessel_type),
            transceiver_class = COALESCE(EXCLUDED.transceiver_class, vessel_latest_state.transceiver_class),
            last_cell = COALESCE(EXCLUDED.last_cell, vessel_latest_state.last_cell),
            msg_count = vessel_latest_state.msg_count + EXCLUDED.msg_count,
            status = EXCLUDED.status;
        """
        execute_values(
            cursor,
            sql_upsert_latest,
            latest_values,
            template="(%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            page_size=500,
        )

    # 3. Batch insert any in-stream alerts generated by rules
    if alerts:
        alert_values = [
            (
                a.mmsi,
                a.alert_type,
                a.score,
                a.severity,
                a.detected_at,
                a.last_lat,
                a.last_lon,
                json.dumps(a.details),
            )
            for a in alerts
        ]

        sql_insert_alerts = """
        INSERT INTO alerts (
            mmsi, alert_type, score, severity, detected_at, last_lat, last_lon, details
        )
        VALUES %s
        ON CONFLICT (mmsi, alert_type, date_trunc('hour', detected_at AT TIME ZONE 'UTC')) DO NOTHING;
        """
        execute_values(
            cursor,
            sql_insert_alerts,
            alert_values,
            template="(%s, %s, %s, %s, %s, %s, %s, %s::jsonb)",
            page_size=200,
        )

    conn.commit()


def run_consumer(args):
    # 1. Connect to PostgreSQL
    logger.info(f"Connecting to PostgreSQL at {args.pg_host}:{args.pg_port}/{args.pg_db}...")
    conn = psycopg2.connect(
        host=args.pg_host,
        port=args.pg_port,
        dbname=args.pg_db,
        user=args.pg_user,
        password=args.pg_password,
    )
    cursor = conn.cursor()

    # 2. Configure Kafka Consumer & Producer (for DLQ + Alerts forwarding)
    consumer = Consumer(
        {
            "bootstrap.servers": args.bootstrap_servers,
            "group.id": args.group_id,
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,  # Strict manual commit after DB write
        }
    )
    producer = Producer({"bootstrap.servers": args.bootstrap_servers})

    consumer.subscribe([args.topic])
    logger.info(f"Subscribed to topic '{args.topic}'. DLQ topic: '{args.dlq_topic}'. Ready...")

    # In-memory vessel state table
    state_table: dict[int, VesselState] = {}

    batch_records: list[dict[str, Any]] = []
    batch_messages: list[Any] = []
    last_flush_time = time.time()

    total_consumed = 0
    total_rejected = 0

    try:
        while True:
            msg = consumer.poll(timeout=0.2)

            if msg is not None:
                if msg.error():
                    if msg.error().code() != KafkaError._PARTITION_EOF:
                        logger.error(f"Kafka error: {msg.error()}")
                    continue

                total_consumed += 1
                raw_bytes = msg.value()
                try:
                    raw_record = json.loads(raw_bytes.decode("utf-8"))
                except Exception as e:
                    logger.warning(f"Failed to decode message JSON: {e}")
                    consumer.commit(msg)
                    continue

                # 3. Validation Contract
                is_valid, reason = validate_record(raw_record)
                if not is_valid:
                    total_rejected += 1
                    # Route to Dead-Letter Queue
                    dlq_payload = dict(raw_record)
                    dlq_payload["reject_reason"] = reason
                    dlq_payload["rejected_at"] = datetime.now(timezone.utc).isoformat()

                    mmsi_key = str(raw_record.get("MMSI", "0")).encode("utf-8")
                    producer.produce(
                        args.dlq_topic,
                        key=mmsi_key,
                        value=json.dumps(dlq_payload).encode("utf-8"),
                    )
                    producer.poll(0)
                    consumer.commit(msg)
                    continue

                # Clean sentinels and queue for batch processing
                clean_record = normalize_sentinels(raw_record)
                batch_records.append(clean_record)
                batch_messages.append(msg)

            # Check if flush threshold reached (batch size or time interval)
            curr_time = time.time()
            time_since_flush = (curr_time - last_flush_time) * 1000

            if len(batch_records) >= args.batch_size or (batch_records and time_since_flush >= args.flush_interval_ms):
                # 4. Process batch through pure processor core
                processed_records, alerts = process_batch(batch_records, state_table)

                # 5. Atomic Batch Write to Database
                flush_batch_to_postgres(cursor, conn, processed_records, state_table, alerts)

                # 6. Commit Kafka offsets across all assigned partitions
                if batch_messages:
                    consumer.commit(asynchronous=False)

                if alerts:
                    logger.info(f"Generated {len(alerts)} in-stream alert(s): {[a.alert_type for a in alerts]}")

                logger.info(
                    f"Flushed batch: {len(processed_records)} records, "
                    f"{len(alerts)} alerts. Total consumed: {total_consumed} ({total_rejected} rejected to DLQ)."
                )

                batch_records.clear()
                batch_messages.clear()
                last_flush_time = curr_time

    except KeyboardInterrupt:
        logger.info("Stopping consumer...")
    finally:
        # Final flush if anything is pending
        if batch_records:
            processed_records, alerts = process_batch(batch_records, state_table)
            flush_batch_to_postgres(cursor, conn, processed_records, state_table, alerts)
            if batch_messages:
                consumer.commit(asynchronous=False)
        consumer.close()
        producer.flush(10)
        cursor.close()
        conn.close()


if __name__ == "__main__":
    args = parse_args()
    run_consumer(args)
