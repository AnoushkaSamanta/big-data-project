from types import SimpleNamespace
from unittest.mock import MagicMock

from streaming.sweeper import (
    get_sweep_rendezvous_sql,
    get_sweep_sql,
    perform_sweep,
)


def test_get_sweep_sql_clock_sources():
    sql_sim = get_sweep_sql("simulated")
    assert "COALESCE((SELECT MAX(last_seen) FROM vessel_latest_state), now())" in sql_sim
    assert "cta.current_ts - v.last_seen" in sql_sim

    sql_sys = get_sweep_sql("system")
    assert "SELECT now() AS current_ts" in sql_sys
    assert "cta.current_ts - v.last_seen" in sql_sys


def test_get_sweep_rendezvous_sql_clock_sources():
    sql_sim = get_sweep_rendezvous_sql("simulated")
    assert "COALESCE((SELECT MAX(last_seen) FROM vessel_latest_state), now())" in sql_sim
    assert "cta.current_ts - interval '45 minutes'" in sql_sim

    sql_sys = get_sweep_rendezvous_sql("system")
    assert "SELECT now() AS current_ts" in sql_sys


def test_perform_sweep_dark_vessels_detected():
    cursor = MagicMock()
    conn = MagicMock()

    # Mock dark vessel query returning 1 alert, and rendezvous returning 0
    alert_row = {
        "mmsi": 367111001,
        "score": 3.5,
        "severity": "high",
        "details": {
            "gap_s": 10800,
            "p99_gap_s": 1800,
            "zone": "Monterey Bay MPA",
            "coverage_n": 1200,
        },
    }
    cursor.fetchall.side_effect = [
        [alert_row],  # First fetchall from SWEEP_SQL
        [],           # Second fetchall from SWEEP_RENDEZVOUS_SQL
    ]

    args = SimpleNamespace(
        min_obs=500,
        min_score=1.0,
        dedup_hours=6,
        clock_source="simulated",
    )

    alert_count = perform_sweep(cursor, conn, args)
    assert alert_count == 1

    # Verify status update query was executed for this MMSI
    assert cursor.execute.call_count >= 2
    update_call_args = cursor.execute.call_args_list[1]
    assert "UPDATE vessel_latest_state" in update_call_args[0][0]
    assert update_call_args[0][1] == ([367111001],)
    assert conn.commit.called
