"""
Unit tests for detection rules: jump-and-return spoofing, loitering, and MMSI collisions.
"""

from datetime import datetime, timedelta, timezone

from detection.rules import (
    calculate_dead_reckoning_cone,
    is_jump_and_return,
    is_loitering,
    is_mmsi_collision,
    is_rendezvous,
)


def test_is_jump_and_return_true():
    t0 = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    # p0: (37.8, -122.4)
    # p1: jumps 100 km away in 2 minutes
    # p2: jumps back near origin (37.81, -122.4) in 2 minutes
    pings = [
        (t0, 37.80, -122.40),
        (t0 + timedelta(minutes=2), 38.70, -122.40),
        (t0 + timedelta(minutes=4), 37.81, -122.40),
    ]

    is_spoof, speed = is_jump_and_return(pings, vessel_type=70)
    assert is_spoof is True
    assert speed is not None and speed > 1000.0


def test_is_jump_and_return_false_for_straight_transit():
    t0 = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    # Steady 12 knot transit
    pings = [
        (t0, 37.80, -122.40),
        (t0 + timedelta(minutes=10), 37.83, -122.40),
        (t0 + timedelta(minutes=20), 37.86, -122.40),
    ]

    is_spoof, speed = is_jump_and_return(pings, vessel_type=70)
    assert is_spoof is False
    assert speed is None


def test_is_mmsi_collision():
    t0 = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    ping1 = (t0, 37.8, -122.4)  # San Francisco
    ping2 = (t0 + timedelta(seconds=30), 34.0, -118.2)  # Los Angeles (500 km away)

    assert is_mmsi_collision(ping1, ping2, min_dist_km=100.0, max_dt_seconds=60.0) is True


def test_is_loitering():
    t0 = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    # Vessel slowly drifting in 1 km radius for 4 hours
    pings = [
        (t0, 37.800, -122.400),
        (t0 + timedelta(hours=1), 37.803, -122.402),
        (t0 + timedelta(hours=2), 37.805, -122.401),
        (t0 + timedelta(hours=3), 37.802, -122.403),
        (t0 + timedelta(hours=4), 37.801, -122.401),
    ]

    assert is_loitering(pings, min_duration_hours=3.0, max_radius_km=3.0, max_avg_speed_knots=2.0) is True


def test_is_rendezvous_detected():
    t0 = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    # Two vessels drifting within 150m of each other for 45 minutes at 1.0 knot
    pings_a = [
        (t0 + timedelta(minutes=0), 37.8000, -122.5000, 1.0),
        (t0 + timedelta(minutes=15), 37.8002, -122.5002, 1.2),
        (t0 + timedelta(minutes=30), 37.8003, -122.5003, 0.8),
        (t0 + timedelta(minutes=45), 37.8005, -122.5005, 0.9),
    ]
    pings_b = [
        (t0 + timedelta(minutes=0), 37.8010, -122.5010, 1.1),
        (t0 + timedelta(minutes=15), 37.8012, -122.5011, 1.0),
        (t0 + timedelta(minutes=30), 37.8013, -122.5012, 0.7),
        (t0 + timedelta(minutes=45), 37.8014, -122.5013, 0.8),
    ]

    is_sts, details = is_rendezvous(pings_a, pings_b, max_dist_m=500.0, max_speed_knots=3.0, min_duration_minutes=30.0)
    assert is_sts is True
    assert details is not None
    assert details["mean_dist_m"] < 300.0
    assert details["duration_minutes"] >= 45.0


def test_is_rendezvous_rejected_for_high_speed():
    t0 = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    # Vessels are close but moving at 15 knots (overtaking in channel)
    pings_a = [
        (t0 + timedelta(minutes=0), 37.8000, -122.5000, 15.0),
        (t0 + timedelta(minutes=20), 37.8500, -122.5000, 15.0),
        (t0 + timedelta(minutes=40), 37.9000, -122.5000, 15.0),
    ]
    pings_b = [
        (t0 + timedelta(minutes=0), 37.8010, -122.5010, 15.0),
        (t0 + timedelta(minutes=20), 37.8510, -122.5010, 15.0),
        (t0 + timedelta(minutes=40), 37.9010, -122.5010, 15.0),
    ]

    is_sts, _ = is_rendezvous(pings_a, pings_b, max_dist_m=500.0, max_speed_knots=3.0)
    assert is_sts is False


def test_calculate_dead_reckoning_cone():
    # Vessel going dark at (37.8, -122.4), SOG 12 knots, COG 270 (West), elapsed 2 hours
    cone = calculate_dead_reckoning_cone(
        last_lat=37.8,
        last_lon=-122.4,
        sog_knots=12.0,
        cog_degrees=270.0,
        elapsed_hours=2.0,
        course_spread_deg=30.0,
    )
    assert cone["type"] == "Feature"
    assert cone["geometry"]["type"] == "Polygon"
    coords = cone["geometry"]["coordinates"][0]
    # Polygon must be closed (first == last)
    assert coords[0] == coords[-1]
    # Projected latitude should remain ~37.8, projected longitude should be further west (more negative)
    assert cone["properties"]["projected_lon"] < -122.4
    assert cone["properties"]["distance_km"] > 40.0
