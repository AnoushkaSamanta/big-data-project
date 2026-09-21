"""
Dark Vessel Absence Sweeper.

CENTRAL DESIGN PRINCIPLE:
  A dark vessel deliberately stops broadcasting AIS messages. Therefore, NO arriving
  message can trigger a dark vessel alert. The detection MUST be driven by an
  absence-triggered timer that periodically scans the hot table (vessel_latest_state).

Coverage Gating:
  Observed reporting gap is compared against the H3 cell's historical p99 gap
  from coverage_prior. Cells with low confidence (n_obs < 500) are suppressed
  to prevent alerting on receiver geometry boundaries.

Alert Deduplication:
  Suppresses duplicate alerts for the same vessel within a 6-hour sliding window.
"""

import argparse
from datetime import datetime, timezone
import json
import logging
import os
import time
import psycopg2
from psycopg2.extras import RealDictCursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Absence-triggered Dark Vessel Sweeper")
    parser.add_argument("--interval", type=int, default=60, help="Sweep interval in seconds")
    parser.add_argument("--min-score", type=float, default=1.0, help="Minimum gap/p99 ratio to alert (e.g. 1.0 = gap > p99)")
    parser.add_argument("--min-obs", type=int, default=500, help="Minimum coverage observations required to consider cell confident")
    parser.add_argument("--dedup-hours", type=int, default=6, help="Deduplication window in hours per vessel")
    parser.add_argument(
        "--db-url",
        default=os.getenv("DATABASE_URL", "postgresql://postgres:ais_dev_password@localhost:5432/ais"),
    )
    return parser.parse_args()


SWEEP_SQL = """
WITH candidate_gaps AS (
    SELECT
        v.mmsi,
        v.last_seen,
        v.last_lat,
        v.last_lon,
        v.last_geom,
        v.transceiver_class,
        v.last_cell,
        EXTRACT(EPOCH FROM (now() - v.last_seen)) AS observed_gap_s,
        cp.p50_gap_s,
        cp.p95_gap_s,
        cp.p99_gap_s,
        cp.n_obs,
        COALESCE(g.name, 'Open Ocean') AS zone_name,
        COALESCE(g.zone_type, 'none') AS zone_type
    FROM vessel_latest_state v
    JOIN coverage_prior cp
      ON cp.cell = v.last_cell AND cp.transceiver_class = v.transceiver_class
    LEFT JOIN geofences g
      ON ST_Contains(g.geom, v.last_geom) AND g.zone_type IN ('mpa', 'eez')
    WHERE cp.n_obs >= %(min_obs)s
      AND EXTRACT(EPOCH FROM (now() - v.last_seen)) > (cp.p99_gap_s * %(min_score)s)
      AND v.status != 'dark'
      AND NOT EXISTS (
          SELECT 1 FROM alerts a
          WHERE a.mmsi = v.mmsi
            AND a.alert_type = 'dark_vessel'
            AND a.detected_at > now() - (%(dedup_hours)s || ' hours')::interval
      )
)
INSERT INTO alerts (mmsi, alert_type, score, severity, detected_at, last_lat, last_lon, details)
SELECT
    cg.mmsi,
    'dark_vessel',
    ROUND((cg.observed_gap_s / NULLIF(cg.p99_gap_s, 0))::numeric, 2) AS score,
    CASE
        WHEN cg.observed_gap_s > (cg.p99_gap_s * 3.0) OR cg.zone_type = 'mpa' THEN 'high'
        WHEN cg.observed_gap_s > (cg.p99_gap_s * 1.5) THEN 'medium'
        ELSE 'low'
    END AS severity,
    now(),
    cg.last_lat,
    cg.last_lon,
    jsonb_build_object(
        'gap_s', ROUND(cg.observed_gap_s::numeric, 0),
        'p99_gap_s', ROUND(cg.p99_gap_s::numeric, 0),
        'p50_gap_s', ROUND(cg.p50_gap_s::numeric, 0),
        'cell', cg.last_cell,
        'coverage_n', cg.n_obs,
        'zone', cg.zone_name,
        'zone_type', cg.zone_type,
        'transceiver_class', cg.transceiver_class
    )
FROM candidate_gaps cg
ON CONFLICT (mmsi, alert_type, date_trunc('hour', detected_at AT TIME ZONE 'UTC')) DO NOTHING
RETURNING mmsi, score, severity, details;
"""

UPDATE_STATUS_SQL = """
UPDATE vessel_latest_state v
SET status = 'dark'
WHERE v.mmsi IN %s;
"""


def perform_sweep(cursor, conn, args) -> int:
    """Execute one absence detection sweep and return count of new alerts."""
    params = {
        "min_obs": args.min_obs,
        "min_score": args.min_score,
        "dedup_hours": args.dedup_hours,
    }

    cursor.execute(SWEEP_SQL, params)
    new_alerts = cursor.fetchall()

    if new_alerts:
        dark_mmsis = tuple(row["mmsi"] for row in new_alerts)
        cursor.execute(UPDATE_STATUS_SQL, (dark_mmsis,))
        conn.commit()

        for alert in new_alerts:
            details = alert["details"]
            logger.warning(
                f"🚨 [DARK VESSEL ALERT] MMSI {alert['mmsi']} | Score: {alert['score']}x | "
                f"Gap: {details.get('gap_s', 0)/3600:.1f}h (expected p99: {details.get('p99_gap_s', 0)/60:.0f}m) | "
                f"Zone: {details.get('zone')} | Coverage Obs: {details.get('coverage_n')}"
            )
        return len(new_alerts)

    conn.commit()
    return 0


def run_sweeper(args):
    logger.info(
        f"Absence Sweeper initialized. Running every {args.interval}s "
        f"(min_obs={args.min_obs}, min_score={args.min_score}x, dedup={args.dedup_hours}h)..."
    )

    conn = psycopg2.connect(args.db_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        while True:
            t0 = time.time()
            try:
                alert_count = perform_sweep(cursor, conn, args)
                duration = time.time() - t0
                if alert_count > 0:
                    logger.info(f"Sweep completed in {duration:.2f}s: generated {alert_count} new dark vessel alert(s).")
            except Exception as e:
                logger.error(f"Error during absence sweep: {e}")
                conn.rollback()

            time.sleep(args.interval)

    except KeyboardInterrupt:
        logger.info("Stopping absence sweeper...")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    args = parse_args()
    run_sweeper(args)
