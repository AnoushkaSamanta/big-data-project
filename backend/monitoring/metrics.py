"""
Pipeline Health & Observability Telemetry Collector.

Periodically computes:
- Kafka consumer group lag
- Ingestion throughput (messages/sec)
- Dead-Letter Queue (DLQ) rejection count and rate
- Active vs dark vessel counts
- End-to-end detection latency
- DB batch write response time

Persists snapshots into the 'pipeline_metrics' table for live Next.js HUD consumption.
"""

import argparse
import logging
import os
import time

import psycopg2
from confluent_kafka import Consumer, TopicPartition
from confluent_kafka.admin import AdminClient
from psycopg2.extras import RealDictCursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# State tracking for delta rate calculations across ticks
_metrics_state = {
    "last_ts": None,
    "last_consumed_msgs": None,
    "last_produced_msgs": None,
    "last_dlq_count": None,
}


def parse_args():
    parser = argparse.ArgumentParser(description="Pipeline telemetry collector")
    parser.add_argument("--interval", type=int, default=10, help="Metrics collection interval in seconds")
    parser.add_argument("--bootstrap-servers", default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    parser.add_argument("--group-id", default="detector")
    parser.add_argument(
        "--db-url",
        default=os.getenv("DATABASE_URL", "postgresql://postgres:ais_dev_password@localhost:5432/ais"),
    )
    return parser.parse_args()


def collect_vessel_counts(cur) -> dict[str, int]:
    """Query current active, stale, and dark vessel counts and total messages from hot table."""
    cur.execute(
        """
        SELECT
            COUNT(*) FILTER (WHERE status = 'active') as active_count,
            COUNT(*) FILTER (WHERE status = 'dark') as dark_count,
            COUNT(*) FILTER (WHERE status = 'stale') as stale_count,
            COALESCE(SUM(msg_count), 0) as total_msgs
        FROM vessel_latest_state;
        """
    )
    row = cur.fetchone()
    return {
        "active": row["active_count"] or 0,
        "dark": row["dark_count"] or 0,
        "stale": row["stale_count"] or 0,
        "total_msgs": int(row["total_msgs"] or 0),
    }


def query_kafka_metrics(bootstrap_servers: str, group_id: str = "detector") -> dict:
    """Query Kafka topics, high watermarks, and group lag across partitions."""
    telemetry = {
        "raw_high_watermark": 0,
        "dlq_count": 0,
        "consumer_lag": 0,
        "connected": False,
    }
    consumer = None
    try:
        consumer = Consumer({
            "bootstrap.servers": bootstrap_servers,
            "group.id": f"telemetry-probe-{os.getpid()}",
            "enable.auto.commit": False,
            "auto.offset.reset": "latest",
        })
        metadata = consumer.list_topics(timeout=3.0)

        # 1. Total produced messages from high watermark of ais.positions.raw
        raw_topic = "ais.positions.raw"
        if raw_topic in metadata.topics:
            raw_parts = metadata.topics[raw_topic].partitions
            for p_id in raw_parts.keys():
                tp = TopicPartition(raw_topic, p_id)
                _, high = consumer.get_watermark_offsets(tp, timeout=2.0)
                if high >= 0:
                    telemetry["raw_high_watermark"] += high

        # 2. Total DLQ messages from ais.positions.dlq
        dlq_topic = "ais.positions.dlq"
        if dlq_topic in metadata.topics:
            dlq_parts = metadata.topics[dlq_topic].partitions
            for p_id in dlq_parts.keys():
                tp = TopicPartition(dlq_topic, p_id)
                _, high = consumer.get_watermark_offsets(tp, timeout=2.0)
                if high >= 0:
                    telemetry["dlq_count"] += high

        # 3. Consumer group lag
        admin = AdminClient({"bootstrap.servers": bootstrap_servers})
        future = admin.list_consumer_group_offsets([group_id])
        group_offsets = future[group_id].result()
        lag = 0
        for tp, offset_info in group_offsets.items():
            if tp.topic == raw_topic and offset_info.offset >= 0:
                _, high = consumer.get_watermark_offsets(tp, timeout=2.0)
                if high >= 0:
                    lag += max(0, high - offset_info.offset)
        telemetry["consumer_lag"] = lag
        telemetry["connected"] = True
    except Exception as e:
        logger.debug(f"Kafka telemetry probe notice: {e}")
    finally:
        if consumer:
            try:
                consumer.close()
            except Exception:
                pass

    return telemetry


def collect_e2e_latency(cur) -> float:
    """Estimate p95 latency from alert detection timestamps."""
    cur.execute(
        """
        SELECT COALESCE(
            PERCENTILE_CONT(0.95) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (now() - detected_at))
            ),
            0.0
        ) as p95_latency
        FROM alerts
        WHERE detected_at >= now() - interval '1 hour';
        """
    )
    row = cur.fetchone()
    return float(row["p95_latency"]) if row and row["p95_latency"] is not None else 0.0


def record_metrics_snapshot(conn, bootstrap_servers: str, group_id: str):
    """Collect and persist one telemetry snapshot with real metrics."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    now_ts = time.time()
    dt = (now_ts - _metrics_state["last_ts"]) if _metrics_state["last_ts"] else None

    # 1. Vessel counts and DB message progress
    counts = collect_vessel_counts(cur)
    total_msgs = counts["total_msgs"]

    if dt and dt > 0 and _metrics_state["last_consumed_msgs"] is not None:
        consumed_s = max(0.0, (total_msgs - _metrics_state["last_consumed_msgs"]) / dt)
    else:
        consumed_s = 0.0

    # 2. Database batch query round-trip latency
    t_start = time.perf_counter()
    cur.execute("SELECT 1;")
    db_batch_ms = (time.perf_counter() - t_start) * 1000.0

    # 3. Kafka telemetry
    kafka_metrics = query_kafka_metrics(bootstrap_servers, group_id)
    lag = kafka_metrics["consumer_lag"]
    dlq_count = kafka_metrics["dlq_count"]
    raw_high = kafka_metrics["raw_high_watermark"]

    if dt and dt > 0 and _metrics_state["last_produced_msgs"] is not None:
        delta_prod = max(0, raw_high - _metrics_state["last_produced_msgs"])
        produced_s = delta_prod / dt
        delta_dlq = max(0, dlq_count - (_metrics_state["last_dlq_count"] or 0))
        dlq_rate = (delta_dlq / delta_prod) if delta_prod > 0 else 0.0
    else:
        produced_s = consumed_s
        dlq_rate = (dlq_count / max(1, raw_high)) if raw_high > 0 else 0.0

    # 4. Latency
    e2e_lat = collect_e2e_latency(cur)

    # Update state for next tick
    _metrics_state["last_ts"] = now_ts
    _metrics_state["last_consumed_msgs"] = total_msgs
    _metrics_state["last_produced_msgs"] = raw_high
    _metrics_state["last_dlq_count"] = dlq_count

    insert_sql = """
    INSERT INTO pipeline_metrics (
        recorded_at,
        msgs_produced_per_s,
        msgs_consumed_per_s,
        consumer_lag,
        dlq_count,
        dlq_rate,
        db_batch_ms_p95,
        e2e_latency_s_p95,
        active_vessels,
        dark_vessels
    )
    VALUES (
        now(),
        %(produced_s)s,
        %(consumed_s)s,
        %(lag)s,
        %(dlq_count)s,
        %(dlq_rate)s,
        %(batch_ms)s,
        %(e2e_latency)s,
        %(active)s,
        %(dark)s
    );
    """

    params = {
        "produced_s": round(produced_s, 1),
        "consumed_s": round(consumed_s, 1),
        "lag": lag,
        "dlq_count": dlq_count,
        "dlq_rate": round(dlq_rate, 5),
        "batch_ms": round(db_batch_ms, 2),
        "e2e_latency": round(e2e_lat, 2),
        "active": counts["active"],
        "dark": counts["dark"],
    }

    cur.execute(insert_sql, params)
    conn.commit()
    cur.close()

    logger.info(
        f"📊 Telemetry Snapshot | Active: {counts['active']} | Dark: {counts['dark']} | "
        f"Consumed: {params['consumed_s']}/s | Lag: {lag} | DLQ Rate: {params['dlq_rate']:.4f} | "
        f"DB Ping: {params['batch_ms']:.1f}ms | p95 Latency: {e2e_lat:.2f}s"
    )


def run_metrics_collector(args):
    logger.info(f"Starting pipeline metrics collector (interval={args.interval}s)...")
    conn = psycopg2.connect(args.db_url)

    try:
        while True:
            try:
                record_metrics_snapshot(conn, args.bootstrap_servers, args.group_id)
            except Exception as e:
                logger.error(f"Failed to record telemetry snapshot: {e}")
                conn.rollback()
            time.sleep(args.interval)
    except KeyboardInterrupt:
        logger.info("Stopping metrics collector...")
    finally:
        conn.close()


if __name__ == "__main__":
    args = parse_args()
    run_metrics_collector(args)

