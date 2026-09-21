"""
Geospatial math and rule-based detectors for in-data AIS anomalies.
Includes:
- Great-circle (Haversine) distance
- Implied speed calculation
- Position spoofing detection (jump-and-return pattern)
- MMSI collision detection (simultaneous distant transmissions)
- Loitering detection (lingering at slow speed inside protected marine zones)
"""

from datetime import datetime
import math
from typing import Any, Dict, List, Optional, Tuple

EARTH_RADIUS_KM = 6371.0088

# Standard speed ceilings by vessel type (knots)
MAX_SPEED_BY_TYPE = {
    70: 28.0,  # Cargo
    80: 26.0,  # Tanker
    60: 40.0,  # Passenger
    30: 45.0,  # Fishing
}
DEFAULT_SPEED_CEILING = 60.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great-circle distance between two points on Earth in kilometers.
    Handles antimeridian crossings properly via spherical trigonometric formula.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (
        math.sin(delta_lambda / 2.0) ** 2
    )

    # Clip a to [0.0, 1.0] to guard against floating-point inaccuracies
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return EARTH_RADIUS_KM * c


def calculate_implied_speed_knots(dist_km: float, dt_seconds: float) -> float:
    """
    Calculate implied speed in knots (nautical miles per hour).
    1 knot = 1.852 km/h.
    """
    if dt_seconds <= 0:
        return 0.0
    speed_kmh = (dist_km / dt_seconds) * 3600.0
    return speed_kmh / 1.852


def is_jump_and_return(
    pings: List[Tuple[datetime, float, float]],
    vessel_type: Optional[int] = None,
) -> Tuple[bool, Optional[float]]:
    """
    Detect GPS teleportation spoofing using the jump-and-return pattern.

    A single outlier ping is often a sensor error; a jump-and-return pattern
    (jumping >50 km away at impossible speed and returning to the legitimate
    transit path in the next ping) is characteristic of synthetic or spoofed positions.

    Args:
        pings: Chronologically ordered list of (timestamp, lat, lon). Must have >= 3 pings.
        vessel_type: Optional AIS vessel type code.

    Returns:
        (is_spoof, implied_speed_knots)
    """
    if len(pings) < 3:
        return False, None

    speed_ceiling = MAX_SPEED_BY_TYPE.get(vessel_type, DEFAULT_SPEED_CEILING)

    # Consider the last 3 pings: p0 (origin), p1 (jump), p2 (return)
    t0, lat0, lon0 = pings[-3]
    t1, lat1, lon1 = pings[-2]
    t2, lat2, lon2 = pings[-1]

    dt01 = (t1 - t0).total_seconds()
    dt12 = (t2 - t1).total_seconds()
    dt02 = (t2 - t0).total_seconds()

    if dt01 <= 0 or dt12 <= 0 or dt02 <= 0:
        return False, None

    dist01 = haversine_km(lat0, lon0, lat1, lon1)
    dist12 = haversine_km(lat1, lon1, lat2, lon2)
    dist02 = haversine_km(lat0, lon0, lat2, lon2)

    speed01 = calculate_implied_speed_knots(dist01, dt01)
    speed12 = calculate_implied_speed_knots(dist12, dt12)
    speed02 = calculate_implied_speed_knots(dist02, dt02)

    # Criteria:
    # 1. Jump distance is significant (> 30 km)
    # 2. Both leg 0->1 and leg 1->2 exceed speed ceiling by 2x
    # 3. Direct leg 0->2 is normal transit speed
    if dist01 > 30.0 and speed01 > (speed_ceiling * 2.0) and speed12 > (speed_ceiling * 2.0) and speed02 <= speed_ceiling:
        return True, max(speed01, speed12)

    return False, None


def is_mmsi_collision(
    ping_a: Tuple[datetime, float, float],
    ping_b: Tuple[datetime, float, float],
    min_dist_km: float = 50.0,
    max_dt_seconds: float = 120.0,
) -> bool:
    """
    Detect MMSI collision: the same MMSI appearing at two geographically distant
    locations with overlapping or near-simultaneous timestamps.
    """
    t_a, lat_a, lon_a = ping_a
    t_b, lat_b, lon_b = ping_b

    dt = abs((t_a - t_b).total_seconds())
    if dt > max_dt_seconds:
        return False

    dist_km = haversine_km(lat_a, lon_a, lat_b, lon_b)
    return dist_km >= min_dist_km


def is_loitering(
    pings: List[Tuple[datetime, float, float]],
    min_duration_hours: float = 3.0,
    max_radius_km: float = 5.0,
    max_avg_speed_knots: float = 2.0,
) -> bool:
    """
    Detect loitering: vessel remaining in a tight radius for an extended duration
    at slow speed. Used when evaluating behavior inside Marine Protected Areas (MPAs).
    """
    if len(pings) < 5:
        return False

    t_start = pings[0][0]
    t_end = pings[-1][0]
    duration_hours = (t_end - t_start).total_seconds() / 3600.0

    if duration_hours < min_duration_hours:
        return False

    # Check maximum bounding displacement from starting point
    lat0, lon0 = pings[0][1], pings[0][2]
    max_disp = max(haversine_km(lat0, lon0, p[1], p[2]) for p in pings)

    if max_disp > max_radius_km:
        return False

    # Calculate average displacement speed
    total_dist = sum(
        haversine_km(pings[i][1], pings[i][2], pings[i + 1][1], pings[i + 1][2])
        for i in range(len(pings) - 1)
    )
    avg_speed_knots = calculate_implied_speed_knots(total_dist, (t_end - t_start).total_seconds())

    return avg_speed_knots <= max_avg_speed_knots
