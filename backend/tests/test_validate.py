"""
Unit tests for AIS record validation and sentinel normalization.
"""

import pytest
from data_pipeline.validate import validate_record, normalize_sentinels


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
