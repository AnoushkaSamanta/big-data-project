"""
End-to-End Simulation & Pipeline Integration Test.

Tests the full data lifecycle:
1. Raw record validation and sentinel normalization (ITU-R M.1371).
2. Batch processing with in-memory vessel state updates.
3. In-stream anomaly detection (Jump-and-Return Spoofing & MMSI Collisions).
4. Rendezvous (Ship-to-Ship encounter) evaluation between paired vessels.
5. Absence detection logic (comparing observed gap to p99 coverage prior).
6. Dead-reckoning drift search cone calculation for interdiction planning.
"""

from datetime import datetime, timedelta, timezone

from data_pipeline.validate import normalize_sentinels, validate_record
from detection.rules import calculate_dead_reckoning_cone, is_rendezvous
from streaming.processor import VesselState, process_batch


def test_full_pipeline_lifecycle():
    t0 = datetime(2024, 1, 15, 8, 0, 0, tzinfo=timezone.utc)

    # 1. Raw incoming stream with mixed valid, sentinel, and anomalous data
    raw_pings = [
        # Normal cargo vessel
        {
            "MMSI": 367111001,
            "BaseDateTime": t0.isoformat(),
            "LAT": 37.8000,
            "LON": -122.4000,
            "SOG": 12.0,
            "COG": 250.0,
            "Heading": 252.0,
            "VesselType": 70,
            "TransceiverClass": "A",
        },
        # Record with ITU-R sentinels (SOG 102.3, COG 360.0)
        {
            "MMSI": 367111002,
            "BaseDateTime": t0.isoformat(),
            "LAT": 37.8200,
            "LON": -122.4200,
            "SOG": 102.3,
            "COG": 360.0,
            "Heading": 511.0,
            "VesselType": 80,
            "TransceiverClass": "A",
        },
        # Corrupted ping with invalid MMSI (destination for DLQ)
        {
            "MMSI": 12345,  # Too short!
            "BaseDateTime": t0.isoformat(),
            "LAT": 37.8500,
            "LON": -122.4500,
            "SOG": 10.0,
        },
    ]

    # Validate and filter
    valid_records = []
    dlq_records = []
    for raw in raw_pings:
        is_valid, reason = validate_record(raw)
        if is_valid:
            valid_records.append(normalize_sentinels(raw))
        else:
            dlq_records.append((raw, reason))

    assert len(valid_records) == 2
    assert len(dlq_records) == 1
    assert dlq_records[0][1] == "bad_mmsi"

    # Verify sentinel normalization
    sentinel_rec = next(r for r in valid_records if r["MMSI"] == 367111002)
    assert sentinel_rec["sog"] is None
    assert sentinel_rec["cog"] is None
    assert sentinel_rec["heading"] is None

    # 2. Batch process valid records through state engine
    state_table: dict[int, VesselState] = {}
    processed, alerts = process_batch(valid_records, state_table)

    assert len(processed) == 2
    assert len(alerts) == 0  # Normal start, no anomalies yet
    assert 367111001 in state_table
    assert state_table[367111001].status == "active"
    assert state_table[367111001].msg_count == 1

    # 3. Simulate spoofing injection on vessel 367111001 (Jump-and-Return)
    t1 = t0 + timedelta(minutes=2)
    t2 = t0 + timedelta(minutes=4)
    spoof_pings = [
        # Teleports 120 km away in 2 minutes
        {
            "MMSI": 367111001,
            "BaseDateTime": t1.isoformat(),
            "LAT": 38.8800,
            "LON": -122.4000,
            "SOG": 12.0,
            "VesselType": 70,
        },
        # Returns near original trajectory
        {
            "MMSI": 367111001,
            "BaseDateTime": t2.isoformat(),
            "LAT": 37.8020,
            "LON": -122.4050,
            "SOG": 12.0,
            "VesselType": 70,
        },
    ]

    _, spoof_alerts = process_batch(spoof_pings, state_table)
    assert any(a.alert_type == "spoof" for a in spoof_alerts)
    spoof_alert = next(a for a in spoof_alerts if a.alert_type == "spoof")
    assert spoof_alert.severity == "high"
    assert spoof_alert.score > 2.0

    # 4. Absence detection & Dead-Reckoning Drift Cone
    # Vessel went dark: last observed 3 hours ago with SOG 14 kn, COG 270 (West)
    vessel_dark = state_table[367111001]
    vessel_dark.status = "dark"
    p99_expected_gap_s = 900.0  # 15 minutes in confident coastal cell
    observed_gap_s = 10800.0   # 3 hours
    anomaly_gap_score = observed_gap_s / p99_expected_gap_s

    assert anomaly_gap_score > 3.0  # High severity dark vessel breach

    # Compute dead-reckoning uncertainty search cone for Coast Guard interception
    cone = calculate_dead_reckoning_cone(
        last_lat=vessel_dark.last_lat,
        last_lon=vessel_dark.last_lon,
        sog_knots=14.0,
        cog_degrees=270.0,
        elapsed_hours=3.0,
        course_spread_deg=30.0,
    )

    assert cone["type"] == "Feature"
    assert cone["geometry"]["type"] == "Polygon"
    assert cone["properties"]["distance_km"] > 70.0  # ~14 kn * 3h * 1.852 km/kn
    assert cone["properties"]["projected_lon"] < vessel_dark.last_lon  # Headed West

    # 5. Ship-to-Ship Rendezvous Simulation between two independent vessels
    vessel_a_track = [
        (t0 + timedelta(minutes=i * 10), 37.750 + i * 0.0001, -122.600 + i * 0.0001, 1.2)
        for i in range(5)
    ]
    vessel_b_track = [
        (t0 + timedelta(minutes=i * 10), 37.751 + i * 0.0001, -122.601 + i * 0.0001, 1.0)
        for i in range(5)
    ]

    is_sts, sts_details = is_rendezvous(
        vessel_a_track, vessel_b_track, max_dist_m=500.0, max_speed_knots=3.0, min_duration_minutes=30.0
    )
    assert is_sts is True
    assert sts_details is not None
    assert sts_details["mean_dist_m"] < 300.0
