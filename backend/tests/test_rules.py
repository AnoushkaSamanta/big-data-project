"""
Unit tests for detection rules: jump-and-return spoofing, loitering, and MMSI collisions.
"""

from datetime import datetime, timezone, timedelta
import pytest
from detection.rules import (
    haversine_km,
    calculate_implied_speed_knots,
    is_jump_and_return,
    is_mmsi_collision,
    is_loitering,
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
