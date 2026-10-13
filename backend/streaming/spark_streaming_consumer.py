"""
Spark Structured Streaming Consumer Adapter.

Demonstrates distributed micro-batch streaming from Apache Kafka (ais.positions.raw)
into PostgreSQL/PostGIS, showcasing Course Track D (Kafka -> Spark Streaming -> Sink).
"""

import argparse
import json
import logging
import os

import psycopg2
from psycopg2.extras import execute_values

from data_pipeline.validate import normalize_sentinels, validate_record

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Spark Structured Streaming consumer for AIS data")
    parser.add_argument("--bootstrap-servers", default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    parser.add_argument("--topic", default="ais.positions.raw")
    parser.add_argument(
        "--db-url",
        default=os.getenv("DATABASE_URL", "postgresql://postgres:ais_dev_password@localhost:5432/ais"),
    )
    return parser.parse_args()


def process_micro_batch(batch_df, batch_id, db_url: str):
    """Process a micro-batch of AIS Kafka events and write to PostGIS."""
    rows = batch_df.collect()
    if not rows:
        return

    logger.info(f"[Spark Streaming] Processing micro-batch {batch_id} ({len(rows)} records)...")
    valid_records = []

    for r in rows:
        try:
            payload = json.loads(r["value"])
            is_valid, _ = validate_record(payload)
            if is_valid:
                clean = normalize_sentinels(payload)
                valid_records.append(clean)
        except Exception as e:
            logger.debug(f"Skipping malformed streaming record: {e}")
            continue

    if not valid_records:
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    positions_tuples = []
    latest_tuples = []

    for item in valid_records:
        mmsi = item["MMSI"]
        ts_str = item["BaseDateTime"]
        lat = item["LAT"]
        lon = item["LON"]
        sog = item.get("SOG")
        cog = item.get("COG")
        heading = item.get("Heading")
        vessel_type = item.get("VesselType", 0)

        positions_tuples.append((mmsi, ts_str, lon, lat, sog, cog, heading, vessel_type))
        latest_tuples.append((mmsi, ts_str, lon, lat, sog, cog, heading, vessel_type, False))

    pos_sql = """
    INSERT INTO vessel_positions (mmsi, ts, geom, sog, cog, heading, vessel_type)
    VALUES %s
    ON CONFLICT (mmsi, ts) DO NOTHING;
    """
    execute_values(
        cur,
        pos_sql,
        positions_tuples,
        template="(%s, %s::timestamptz, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s)",
    )

    state_sql = """
    INSERT INTO vessel_latest_state (mmsi, ts, geom, sog, cog, heading, vessel_type, is_dark)
    VALUES %s
    ON CONFLICT (mmsi) DO UPDATE SET
        ts = EXCLUDED.ts,
        geom = EXCLUDED.geom,
        sog = EXCLUDED.sog,
        cog = EXCLUDED.cog,
        heading = EXCLUDED.heading,
        vessel_type = EXCLUDED.vessel_type,
        updated_at = now()
    WHERE EXCLUDED.ts >= vessel_latest_state.ts;
    """
    execute_values(
        cur,
        state_sql,
        latest_tuples,
        template="(%s, %s::timestamptz, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, %s)",
    )

    conn.commit()
    cur.close()
    conn.close()
    logger.info(f"[Spark Streaming] ✓ Committed {len(valid_records)} records to PostGIS.")


def run_spark_streaming(args):
    """Run Spark Structured Streaming query."""
    from pyspark.sql import SparkSession

    logger.info("Starting Spark Structured Streaming session...")
    spark = (
        SparkSession.builder.appName("DarkVessel-SparkStreaming")
        .config("spark.driver.memory", "2g")
        .getOrCreate()
    )

    df_stream = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", args.bootstrap_servers)
        .option("subscribe", args.topic)
        .option("startingOffsets", "latest")
        .load()
        .selectExpr("CAST(key AS STRING) as key", "CAST(value AS STRING) as value")
    )

    query = (
        df_stream.writeStream.foreachBatch(
            lambda batch_df, batch_id: process_micro_batch(batch_df, batch_id, args.db_url)
        )
        .start()
    )

    logger.info(f"Spark Structured Streaming active on topic '{args.topic}'...")
    query.awaitTermination()


if __name__ == "__main__":
    args = parse_args()
    run_spark_streaming(args)
