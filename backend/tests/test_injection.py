"""
Tests for anomaly injection scenarios and their downstream detection.
"""

from datetime import datetime, timezone

from detection.features import compute_trajectory_features
from detection.rules import is_rendezvous
from streaming.injector import (
    SCENARIOS,
    generate_collision_scenario,
    generate_dark_scenario,
    generate_loiter_scenario,
    generate_ml_scenario,
    generate_rendezvous_scenario,
    generate_spoof_scenario,
)
from streaming.processor import VesselState, process_batch


def test_scenario_catalog():
    """Verify all 6 scenarios exist in SCENARIOS mapping."""
    expected = {"spoof", "collision", "loiter", "rendezvous", "dark", "ml_anomaly"}
    assert set(SCENARIOS.keys()) == expected


def test_inject_spoof_scenario():
    """Spoof scenario must trigger 'spoof' alert with high severity."""
    t0 = datetime(2026, 10, 7, 12, 0, 0, tzinfo=timezone.utc)
    pings = generate_spoof_scenario(base_time=t0)
    assert len(pings) == 4

    state_table: dict[int, VesselState] = {}
    _processed, alerts = process_batch(pings, state_table)

    spoof_alerts = [a for a in alerts if a.alert_type == "spoof"]
    assert len(spoof_alerts) >= 1
    assert spoof_alerts[0].severity == "high"
    assert spoof_alerts[0].mmsi == 369888777
    assert spoof_alerts[0].score > 2.0


def test_inject_collision_scenario():
    """Collision scenario must trigger 'mmsi_collision' alert."""
    t0 = datetime(2026, 10, 7, 12, 0, 0, tzinfo=timezone.utc)
    pings = generate_collision_scenario(base_time=t0)
    assert len(pings) == 2

    state_table: dict[int, VesselState] = {}
    _processed, alerts = process_batch(pings, state_table)

    collision_alerts = [a for a in alerts if a.alert_type == "mmsi_collision"]
    assert len(collision_alerts) == 1
    assert collision_alerts[0].mmsi == 368111222
    assert collision_alerts[0].severity == "high"
    assert collision_alerts[0].details["distance_km"] > 400.0


def test_inject_loiter_scenario():
    """Loitering scenario must trigger 'loiter' alert."""
    t0 = datetime(2026, 10, 7, 12, 0, 0, tzinfo=timezone.utc)
    pings = generate_loiter_scenario(base_time=t0)
    assert len(pings) == 6

    state_table: dict[int, VesselState] = {}
    _processed, alerts = process_batch(pings, state_table)

    loiter_alerts = [a for a in alerts if a.alert_type == "loiter"]
    assert len(loiter_alerts) >= 1
    assert loiter_alerts[0].mmsi == 366234890
    assert loiter_alerts[0].details["reason"] == "lingering_at_slow_speed"


def test_inject_rendezvous_scenario():
    """Rendezvous scenario must satisfy pairwise rendezvous heuristic."""
    t0 = datetime(2026, 10, 7, 12, 0, 0, tzinfo=timezone.utc)
    pings = generate_rendezvous_scenario(base_time=t0)
    assert len(pings) == 8

    # Separate into pings_a and pings_b
    pings_a = [
        (datetime.fromisoformat(p["BaseDateTime"]), p["LAT"], p["LON"], p["SOG"])
        for p in pings
        if p["MMSI"] == 367111001
    ]
    pings_b = [
        (datetime.fromisoformat(p["BaseDateTime"]), p["LAT"], p["LON"], p["SOG"])
        for p in pings
        if p["MMSI"] == 367222002
    ]

    is_sts, details = is_rendezvous(pings_a, pings_b, max_dist_m=500.0, max_speed_knots=3.0, min_duration_minutes=20.0)
    assert is_sts is True
    assert details is not None
    assert details["mean_dist_m"] < 150.0


def test_inject_dark_scenario():
    """Dark scenario must yield valid track that leaves state table active before sweeping."""
    t0 = datetime(2026, 10, 7, 12, 0, 0, tzinfo=timezone.utc)
    pings = generate_dark_scenario(base_time=t0)
    assert len(pings) == 3

    state_table: dict[int, VesselState] = {}
    processed, alerts = process_batch(pings, state_table)

    assert len(processed) == 3
    assert len(alerts) == 0
    assert 367999888 in state_table
    assert state_table[367999888].msg_count == 3
    assert state_table[367999888].status == "active"


def test_inject_ml_scenario_features():
    """ML scenario must generate abnormal tortuosity and speed variance."""
    import pandas as pd

    t0 = datetime(2026, 10, 7, 12, 0, 0, tzinfo=timezone.utc)
    pings = generate_ml_scenario(base_time=t0)
    assert len(pings) == 12

    formatted = [
        {
            "ts": pd.Timestamp(p["BaseDateTime"]),
            "LAT": p["LAT"],
            "LON": p["LON"],
            "SOG": p["SOG"],
            "COG": p["COG"],
            "Heading": p["Heading"],
            "VesselType": p["VesselType"],
        }
        for p in pings
    ]

    df = pd.DataFrame(formatted)
    features = compute_trajectory_features(df)
    assert features is not None
    # Erratic zig-zagging produces high tortuosity and speed swings
    assert features["path_tortuosity"] > 1.2
    assert features["sog_std"] > 5.0
