"""
Geospatial math and rule-based detectors for in-data AIS anomalies.
Includes:
- Great-circle (Haversine) distance
- Implied speed calculation
- Position spoofing detection (jump-and-return pattern)
- MMSI collision detection
"""

import math
from typing import Tuple

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great-circle distance between two points on Earth in kilometers.
    Handles antimeridian crossings properly via spherical trigonometric formula.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    
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
