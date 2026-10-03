from datetime import datetime, timezone

from data_pipeline.validate import (
    normalize_sentinels,
    parse_iso_timestamp,
    validate_record,
)


def test_valid_record():
    record = {
        "MMSI": 367123456,
        "BaseDateTime": "2024-01-15T08:00:00Z",
        "LAT": 37.8021,
        "LON": -122.4056,
        "SOG": 12.4,
        "COG": 180.0,
        "Heading": 182.0
    }
    ok, reason = validate_record(record)
    assert ok is True
    assert reason is None


def test_bad_mmsi():
    # 8 digits (too short)
    ok, reason = validate_record({"MMSI": 12345678, "BaseDateTime": "2024-01-15", "LAT": 30.0, "LON": -120.0})
    assert ok is False
    assert reason == "bad_mmsi"

    # MMSI = 0
    ok, reason = validate_record({"MMSI": 0, "BaseDateTime": "2024-01-15", "LAT": 30.0, "LON": -120.0})
    assert ok is False
    assert reason == "bad_mmsi"


def test_sentinel_lat_lon():
    # LAT 91 is unavailable
    ok, reason = validate_record({"MMSI": 367123456, "BaseDateTime": "2024-01-15", "LAT": 91.0, "LON": -120.0})
    assert ok is False
    assert reason == "position_unavailable"

    # LON 181 is unavailable
    ok, reason = validate_record({"MMSI": 367123456, "BaseDateTime": "2024-01-15", "LAT": 35.0, "LON": 181.0})
    assert ok is False
    assert reason == "position_unavailable"


def test_coord_out_of_range():
    ok, reason = validate_record({"MMSI": 367123456, "BaseDateTime": "2024-01-15", "LAT": 95.0, "LON": -120.0})
    assert ok is False
    assert reason == "coord_out_of_range"


def test_normalize_sentinels():
    record = {
        "MMSI": 367123456,
        "SOG": 102.3,
        "COG": 360.0,
        "Heading": 511.0
    }
    cleaned = normalize_sentinels(record)
    assert cleaned["sog"] is None
    assert cleaned["cog"] is None
    assert cleaned["heading"] is None


def test_parse_iso_timestamp():
    # ISO string with trailing Z
    dt1 = parse_iso_timestamp("2024-01-15T08:00:00Z")
    assert dt1.year == 2024 and dt1.month == 1 and dt1.day == 15
    assert dt1.tzinfo == timezone.utc

    # ISO string with +00:00 offset
    dt2 = parse_iso_timestamp("2024-01-15T08:00:00+00:00")
    assert dt2 == dt1

    # Native datetime object without timezone (assigned UTC by parser)
    naive = datetime(2024, 1, 15, 8, 0, 0)  # noqa: DTZ001
    dt3 = parse_iso_timestamp(naive)
    assert dt3 == dt1

