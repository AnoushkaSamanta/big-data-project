"""
Geospatial math and rule-based detectors for in-data AIS anomalies.
Includes:
- Great-circle (Haversine) distance
- Implied speed calculation
- Position spoofing detection (jump-and-return pattern)
- MMSI collision detection (simultaneous distant transmissions)
- Loitering detection (lingering at slow speed inside protected marine zones)
"""

import math
from datetime import datetime
from typing import Any

try:
    import h3
except ImportError:
    h3 = None

# WGS-84 volumetric mean earth radius in kilometers
EARTH_RADIUS_KM = 6371.0088

# Nautical speed thresholds by vessel category (ITU / Marine Cadastre specifications)
# Speeds exceeding 2x these baselines are kinematically impossible for conventional hulls.
DEFAULT_SPEED_CEILING = 60.0  # knots: extreme upper bound (fast ferries/interceptors)
MAX_SPEED_BY_TYPE: dict[int, float] = {
    70: 28.0,  # Cargo vessels: typical service speed 16-24 kn
    80: 26.0,  # Tankers (crude/chemical): typical service speed 13-17 kn
    60: 40.0,  # Passenger/Ro-Pax: up to 35-40 kn
    30: 45.0,  # Fishing vessels: up to 25-35 kn
}


def lat_lon_to_h3(lat: float, lon: float, res: int = 5) -> str:
    """
    Convert a WGS-84 coordinate to an H3 hexagonal cell index string.
    Supports both h3 v3 (geo_to_h3) and v4 (latlng_to_cell) API contracts.
    Returns empty string if coordinates are out of bounds or h3 is uninstalled.
    """
    if h3 is None:
        return ""
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        return ""
    try:
        if hasattr(h3, "geo_to_h3"):
            return h3.geo_to_h3(lat, lon, res)
        return h3.latlng_to_cell(lat, lon, res)
    except Exception:
        return ""



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
    pings: list[tuple[datetime, float, float]],
    vessel_type: int | None = None,
) -> tuple[bool, float | None]:
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
    ping_a: tuple[datetime, float, float],
    ping_b: tuple[datetime, float, float],
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
    pings: list[tuple[datetime, float, float]],
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


def is_rendezvous(
    pings_a: list[tuple[datetime, float, float, float | None]],
    pings_b: list[tuple[datetime, float, float, float | None]],
    max_dist_m: float = 500.0,
    max_speed_knots: float = 3.0,
    min_duration_minutes: float = 30.0,
) -> tuple[bool, dict[str, Any] | None]:
    """
    Detect Ship-to-Ship (STS) rendezvous / transshipment between two vessels.
    Flags pairs of vessels maintaining close proximity (<= max_dist_m)
    at slow speed (<= max_speed_knots) for an extended duration (>= min_duration_minutes).

    Args:
        pings_a: List of (timestamp, lat, lon, sog) for vessel A.
        pings_b: List of (timestamp, lat, lon, sog) for vessel B.
        max_dist_m: Proximity ceiling in meters (default: 500m).
        max_speed_knots: Speed ceiling in knots (default: 3.0 kn).
        min_duration_minutes: Minimum duration in minutes (default: 30m).

    Returns:
        (is_rendezvous, metrics_dict)
    """
    if len(pings_a) < 3 or len(pings_b) < 3:
        return False, None

    # Find temporally overlapping window
    t_start = max(pings_a[0][0], pings_b[0][0])
    t_end = min(pings_a[-1][0], pings_b[-1][0])
    duration_s = (t_end - t_start).total_seconds()
    if duration_s < min_duration_minutes * 60:
        return False, None

    # Filter to overlapping window
    a_in_win = [p for p in pings_a if t_start <= p[0] <= t_end]
    b_in_win = [p for p in pings_b if t_start <= p[0] <= t_end]
    if not a_in_win or not b_in_win:
        return False, None

    # Check speeds
    for p in a_in_win:
        sog = p[3]
        if sog is not None and sog > max_speed_knots:
            return False, None
    for p in b_in_win:
        sog = p[3]
        if sog is not None and sog > max_speed_knots:
            return False, None

    # Compare distances for closest contemporaneous pings (within 5 minutes)
    distances_m = []
    idx_b = 0
    for p_a in a_in_win:
        t_a, lat_a, lon_a = p_a[0], p_a[1], p_a[2]
        while idx_b < len(b_in_win) - 1 and abs((b_in_win[idx_b + 1][0] - t_a).total_seconds()) < abs(
            (b_in_win[idx_b][0] - t_a).total_seconds()
        ):
            idx_b += 1

        p_b = b_in_win[idx_b]
        dt_s = abs((p_b[0] - t_a).total_seconds())
        if dt_s <= 300.0:
            dist_km = haversine_km(lat_a, lon_a, p_b[1], p_b[2])
            distances_m.append(dist_km * 1000.0)

    if not distances_m:
        return False, None

    mean_dist = sum(distances_m) / len(distances_m)
    max_observed_dist = max(distances_m)
    if mean_dist <= max_dist_m and max_observed_dist <= (max_dist_m * 1.5):
        return True, {
            "mean_dist_m": round(mean_dist, 1),
            "min_dist_m": round(min(distances_m), 1),
            "max_dist_m": round(max_observed_dist, 1),
            "duration_minutes": round(duration_s / 60.0, 1),
            "points_compared": len(distances_m),
        }

    return False, None


def project_destination_point(
    lat: float, lon: float, bearing_deg: float, dist_km: float
) -> tuple[float, float]:
    """Calculate destination point given start point, bearing, and distance."""
    phi1 = math.radians(lat)
    lambda1 = math.radians(lon)
    theta = math.radians(bearing_deg)
    delta = dist_km / EARTH_RADIUS_KM

    phi2 = math.asin(
        math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta)
    )
    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2),
    )
    res_lat = math.degrees(phi2)
    res_lon = (math.degrees(lambda2) + 540.0) % 360.0 - 180.0
    return res_lat, res_lon


def calculate_dead_reckoning_cone(
    last_lat: float,
    last_lon: float,
    sog_knots: float | None,
    cog_degrees: float | None,
    elapsed_hours: float,
    course_spread_deg: float = 30.0,
    steps: int = 16,
) -> dict[str, Any]:
    """
    Calculate forward dead-reckoning search uncertainty polygon for dark vessels.

    Returns:
        GeoJSON Feature (Polygon) representing the search zone.
    """
    speed_kn = max(0.5, float(sog_knots)) if sog_knots is not None else 0.5
    hours = max(0.05, float(elapsed_hours))
    # 1 knot = 1.852 km/h
    dist_km = max(1.0, speed_kn * 1.852 * hours)
    cog = float(cog_degrees) if cog_degrees is not None else 0.0

    coordinates = []

    if speed_kn <= 1.0 or cog_degrees is None:
        # Stationary or unknown heading: circular uncertainty boundary
        radius_km = max(2.0, dist_km)
        for i in range(steps + 1):
            angle = (360.0 / steps) * i
            pt_lat, pt_lon = project_destination_point(last_lat, last_lon, angle, radius_km)
            coordinates.append([round(pt_lon, 5), round(pt_lat, 5)])
    else:
        # Moving vessel: directional uncertainty cone / sector
        coordinates.append([round(last_lon, 5), round(last_lat, 5)])
        start_bearing = cog - course_spread_deg
        end_bearing = cog + course_spread_deg
        for i in range(steps + 1):
            bearing = start_bearing + ((end_bearing - start_bearing) / steps) * i
            pt_lat, pt_lon = project_destination_point(last_lat, last_lon, bearing, dist_km)
            coordinates.append([round(pt_lon, 5), round(pt_lat, 5)])
        coordinates.append([round(last_lon, 5), round(last_lat, 5)])

    # Center projected coordinate
    proj_lat, proj_lon = project_destination_point(last_lat, last_lon, cog, dist_km)

    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [coordinates],
        },
        "properties": {
            "origin_lat": round(last_lat, 5),
            "origin_lon": round(last_lon, 5),
            "projected_lat": round(proj_lat, 5),
            "projected_lon": round(proj_lon, 5),
            "distance_km": round(dist_km, 2),
            "elapsed_hours": round(hours, 2),
            "sog_knots": round(speed_kn, 1),
            "cog_degrees": round(cog, 1),
        },
    }
