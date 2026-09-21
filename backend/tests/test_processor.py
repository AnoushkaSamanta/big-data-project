"""
Unit tests for pure stream processor and in-stream rule anomaly detectors.
"""

from datetime import datetime, timezone
import pytest
from streaming.processor import process_batch, VesselState, Alert


def test_process_batch_normal_track():
    state_table = {}
    records = [
        {
            "MMSI": 367000001,
            "BaseDateTime": "2024-01-15T12:00:00Z",
            "LAT": 37.80,
            "LON": -122.40,
            "sog": 12.0,
            "cog": 180.0,
            "heading": 180.0,
            "VesselType": 70,
            "TransceiverClass": "A",
        },
        {
            "MMSI": 367000001,
            "BaseDateTime": "2024-01-15T12:05:00Z",
            "LAT": 37.81,
            "LON": -122.40,
            "sog": 12.0,
            "cog": 180.0,
            "heading": 180.0,
            "VesselType": 70,
            "TransceiverClass": "A",
        },
    ]

    processed, alerts = process_batch(records, state_table)
    assert len(processed) == 2
    assert len(alerts) == 0

    v_state = state_table[367000001]
    assert v_state.msg_count == 2
    assert v_state.last_lat == 37.81
    assert v_state.status == "active"


def test_process_batch_extreme_speed_spoof():
    state_table = {}
    # Vessel teleports 200 km in 60 seconds (speed > 6000 knots)
    records = [
        {
            "MMSI": 367000002,
            "BaseDateTime": "2024-01-15T12:00:00Z",
            "LAT": 37.0,
            "LON": -122.0,
            "sog": 10.0,
            "VesselType": 70,
        },
        {
            "MMSI": 367000002,
            "BaseDateTime": "2024-01-15T12:01:00Z",
            "LAT": 39.0,
            "LON": -122.0,
            "sog": 10.0,
            "VesselType": 70,
        },
    ]

    processed, alerts = process_batch(records, state_table)
    assert len(alerts) >= 1
    assert alerts[0].alert_type == "spoof"
    assert alerts[0].severity == "high"
    assert alerts[0].score > 5.0


def test_process_batch_mmsi_collision():
    state_table = {
        367000003: VesselState(
            mmsi=367000003,
            last_seen=datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc),
            last_lat=37.0,
            last_lon=-122.0,
        )
    }

    # Same MMSI, exactly same timestamp, but 500 km away
    record = {
        "MMSI": 367000003,
        "BaseDateTime": "2024-01-15T12:00:00Z",
        "LAT": 32.0,
        "LON": -118.0,
        "VesselType": 70,
    }

    processed, alerts = process_batch([record], state_table)
    assert len(alerts) == 1
    assert alerts[0].alert_type == "mmsi_collision"
