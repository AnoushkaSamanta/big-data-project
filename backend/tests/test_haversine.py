"""
Unit tests for Haversine distance and implied speed calculation.
"""

import pytest

from detection.rules import calculate_implied_speed_knots, haversine_km


def test_identical_points():
    dist = haversine_km(37.7749, -122.4194, 37.7749, -122.4194)
    assert dist == pytest.approx(0.0, abs=1e-5)


def test_known_distance_sf_to_la():
    # San Francisco (37.7749, -122.4194) to Los Angeles (34.0522, -118.2437) is approx 559 km
    dist = haversine_km(37.7749, -122.4194, 34.0522, -118.2437)
    assert 550.0 < dist < 570.0


def test_equatorial_distance():
    # 1 degree of longitude along the equator is approx 111.32 km
    dist = haversine_km(0.0, 0.0, 0.0, 1.0)
    assert dist == pytest.approx(111.19, abs=0.5)


def test_implied_speed():
    # 1.852 km in 3600 seconds = 1 knot
    speed = calculate_implied_speed_knots(1.852, 3600.0)
    assert speed == pytest.approx(1.0, abs=1e-3)
