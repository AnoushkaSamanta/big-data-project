"""
Data validation contract for raw AIS records.

Every AIS message (from CSV, streaming Kafka, or batch jobs) passes through
this contract before downstream processing. Normalizing sentinel values and
rejecting invalid records here prevents corrupting spatial math and false alerts.
"""

from datetime import datetime, timezone
from typing import Any

# AIS Standard Sentinel Values (ITU-R M.1371)
# When transponders lack valid sensor telemetry, they emit specification sentinels:
SENTINEL_SOG = 102.3       # Speed over ground: 102.3 = not available
SENTINEL_COG = 360.0       # Course over ground: 360.0 = not available
SENTINEL_HEADING = 511.0   # True heading: 511 = not available
SENTINEL_LAT = 91.0        # Latitude: 91.0 = default / unassigned
SENTINEL_LON = 181.0       # Longitude: 181.0 = default / unassigned


def parse_iso_timestamp(ts_val: Any) -> datetime:
    """
    Safely parse an ISO-8601 timestamp string or datetime object into a UTC timezone-aware datetime.
    Replaces trailing 'Z' with '+00:00' to maintain compatibility across Python datetime parsers.
    """
    if isinstance(ts_val, datetime):
        return ts_val if ts_val.tzinfo else ts_val.replace(tzinfo=timezone.utc)
    cleaned = str(ts_val).replace("Z", "+00:00").strip()
    dt = datetime.fromisoformat(cleaned)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def validate_record(r: dict[str, Any]) -> tuple[bool, str | None]:
    """
    Validate an incoming AIS record against contract rules before downstream consumption.

    Returns:
        (True, None) if valid.
        (False, reason_code) if rejected (destined for Dead-Letter Queue).
    """
    # 1. MMSI Validation: Must be 9-digit positive integer
    mmsi = r.get("MMSI") or r.get("mmsi")
    if not isinstance(mmsi, int) or not (100_000_000 <= mmsi <= 999_999_999):
        return False, "bad_mmsi"

    # 2. Timestamp Validation: BaseDateTime must exist and be parseable
    ts = r.get("BaseDateTime") or r.get("ts")
    if not ts:
        return False, "missing_timestamp"
    try:
        parse_iso_timestamp(ts)
    except (ValueError, TypeError):
        return False, "malformed_timestamp"

    # 3. Position Availability & Range
    lat = r.get("LAT") if "LAT" in r else r.get("lat")
    lon = r.get("LON") if "LON" in r else r.get("lon")

    if lat is None or lon is None:
        return False, "position_unavailable"

    if lat == SENTINEL_LAT or lon == SENTINEL_LON:
        return False, "position_unavailable"

    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        return False, "coord_out_of_range"

    return True, None


def normalize_sentinels(r: dict[str, Any]) -> dict[str, Any]:
    """
    Convert AIS sentinel sensor values to None (null in database).
    This ensures sentinels don't poison downstream numerical aggregates.
    """
    clean = dict(r)

    # SOG normalization (0.0 is valid speed, do not use `or` which treats 0.0 as falsy)
    sog = clean.get("SOG") if "SOG" in clean and clean.get("SOG") is not None else clean.get("sog")
    if sog is not None and abs(float(sog) - SENTINEL_SOG) < 1e-4:
        clean["sog"] = None
    else:
        clean["sog"] = float(sog) if sog is not None else None

    # COG normalization (0.0 is valid course true north)
    cog = clean.get("COG") if "COG" in clean and clean.get("COG") is not None else clean.get("cog")
    if cog is not None and abs(float(cog) - SENTINEL_COG) < 1e-4:
        clean["cog"] = None
    else:
        clean["cog"] = float(cog) if cog is not None else None

    # Heading normalization (0 is valid heading true north)
    heading = clean.get("Heading") if "Heading" in clean and clean.get("Heading") is not None else clean.get("heading")
    if heading is not None and abs(float(heading) - SENTINEL_HEADING) < 1e-4:
        clean["heading"] = None
    else:
        clean["heading"] = float(heading) if heading is not None else None

    return clean
