"""
Stateful AIS Stream Consumer.

Consumes AIS positions from Kafka, validates them, maintains
per-vessel state in 'vessel_latest_state' (hot table), and appends to
'vessel_positions' (cold storage).
"""

import argparse
import json
import logging
import os
from confluent_kafka import Consumer, KafkaError
import psycopg2
from backend.data_pipeline.validate import validate_record, normalize_sentinels 

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Stateful AIS Stream Consumer")
    parser.add_argument("--bootstrap-servers", default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    parser.add_argument("--group-id", default="detector")
    parser.add_argument("--topic", default=os.getenv("KAFKA_TOPIC", "ais.positions.raw"))
    parser.add_argument("--pg-host", default=os.getenv("POSTGRES_HOST", "localhost"))
    parser.add_argument("--pg-port", default=int(os.getenv("POSTGRES_PORT", "5432")))
    parser.add_argument("--pg-db", default=os.getenv("POSTGRES_DB", "ais"))
    parser.add_argument("--pg-user", default=os.getenv("POSTGRES_USER", "postgres"))
    parser.add_argument("--pg-password", default=os.getenv("POSTGRES_PASSWORD", "ais_dev_password"))

    return parser.parse_args()


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

    # 2. Configure Kafka Consumer
    conf = {
        "bootstrap.servers": args.bootstrap_servers,
        "group.id": args.group_id,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,  # Manual commit for at-least-once semantics
    }
    consumer = Consumer(conf)
    consumer.subscribe([args.topic])
    logger.info(f"Subscribed to topic '{args.topic}' as consumer group '{args.group_id}'. Waiting for records...")

    # SQL Queries
    sql_upsert_latest = """
    INSERT INTO vessel_latest_state (
        mmsi, last_seen, last_geom, last_lat, last_lon,
        last_sog, last_cog, last_heading, vessel_type, transceiver_class, status
    )
    VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, %s, %s, %s, 'active')
    ON CONFLICT (mmsi) DO UPDATE SET
        last_seen = EXCLUDED.last_seen,
        last_geom = EXCLUDED.last_geom,
        last_lat = EXCLUDED.last_lat,
        last_lon = EXCLUDED.last_lon,
        last_sog = EXCLUDED.last_sog,
        last_cog = EXCLUDED.last_cog,
        last_heading = EXCLUDED.last_heading,
        vessel_type = COALESCE(EXCLUDED.vessel_type, vessel_latest_state.vessel_type),
        transceiver_class = COALESCE(EXCLUDED.transceiver_class, vessel_latest_state.transceiver_class),
        msg_count = vessel_latest_state.msg_count + 1,
        status = 'active';
    """

    sql_insert_positions = """
    INSERT INTO vessel_positions (
        mmsi, ts, geom, sog, cog, heading, vessel_type, transceiver_class
    )
    VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, %s)
    ON CONFLICT (mmsi, ts) DO NOTHING;
    """

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                logger.error(f"Kafka error: {msg.error()}")
                break

            # 3. Parse & Validate Record
            raw_record = json.loads(msg.value().decode("utf-8"))
            is_valid, reason = validate_record(raw_record)
            if not is_valid:
                logger.warning(f"Rejected invalid record MMSI={raw_record.get('MMSI')}: {reason}")
                consumer.commit(msg)
                continue

            record = normalize_sentinels(raw_record)
            mmsi = record["MMSI"]
            ts = record["BaseDateTime"]
            lat = record["LAT"]
            lon = record["LON"]
            sog = record.get("sog")
            cog = record.get("cog")
            heading = record.get("heading")
            vessel_type = record.get("VesselType")
            t_class = record.get("TransceiverClass")

            # 4. Write to Database
            # Note: ST_MakePoint takes (LON, LAT) order!
            cursor.execute(sql_upsert_latest, (mmsi, ts, lon, lat, lat, lon, sog, cog, heading, vessel_type, t_class))
            cursor.execute(sql_insert_positions, (mmsi, ts, lon, lat, sog, cog, heading, vessel_type, t_class))
            conn.commit()

            # 5. Commit Kafka offset AFTER DB write succeeds
            consumer.commit(msg)
            logger.info(f"Ingested MMSI {mmsi} at {ts} ({lat}, {lon})")

    except KeyboardInterrupt:
        logger.info("Stopping consumer...")
    finally:
        consumer.close()
        cursor.close()
        conn.close()


if __name__ == "__main__":
    args = parse_args()
    run_consumer(args)
