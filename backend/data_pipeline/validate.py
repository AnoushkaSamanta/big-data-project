"""
Data validation contract for raw AIS records.

Every AIS message (from CSV, streaming Kafka, or batch jobs) passes through
this contract before downstream processing. Normalizing sentinel values and
rejecting invalid records here prevents corrupting spatial math and false alerts.
"""

from datetime import datetime
from typing import Any, Dict, Optional, Tuple

# AIS Standard Sentinel Values (ITU-R M.1371)
# When transponders have no valid sensor data, they broadcast standard sentinels.
SENTINEL_SOG = 102.3       # Speed over ground: 102.3 = not available
SENTINEL_COG = 360.0       # Course over ground: 360.0 = not available
SENTINEL_HEADING = 511.0   # True heading: 511 = not available
SENTINEL_LAT = 91.0        # Latitude: 91.0 = default / unassigned
SENTINEL_LON = 181.0       # Longitude: 181.0 = default / unassigned


def validate_record(r: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate an incoming AIS record against contract rules.

    Returns:
        (True, None) if valid.
        (False, reason_code) if rejected (destined for DLQ).
    """
    # 1. MMSI Validation: Must be 9-digit positive integer
    mmsi = r.get("MMSI") or r.get("mmsi")
    if not isinstance(mmsi, int) or not (100_000_000 <= mmsi <= 999_999_999):
        return False, "bad_mmsi"

    # 2. Timestamp Validation: BaseDateTime must exist and be parseable
    ts = r.get("BaseDateTime") or r.get("ts")
    if not ts:
        return False, "missing_timestamp"

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


def normalize_sentinels(r: Dict[str, Any]) -> Dict[str, Any]:
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
