"""
Pure Stream Processing Core.

Decoupled pure functions for processing batches of AIS records and maintaining
per-vessel state. Contains NO Kafka or database calls, allowing 100% deterministic
unit testing of state transitions, watermarks, and in-stream anomaly rules.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from detection.rules import calculate_implied_speed_knots, haversine_km


@dataclass
class VesselState:
    mmsi: int
    last_seen: datetime
    last_lat: float
    last_lon: float
    last_sog: float | None = None
    last_cog: float | None = None
    last_heading: float | None = None
    vessel_type: int | None = None
    vessel_name: str | None = None
    transceiver_class: str | None = "A"
    last_cell: str | None = None
    msg_count: int = 1
    status: str = "active"  # 'active', 'stale', 'dark'
    # History buffer for jump-and-return spoofing detection (stores last 3 positions)
    recent_pings: list[tuple[datetime, float, float]] = field(default_factory=list)


@dataclass
class Alert:
    mmsi: int
    alert_type: str  # 'spoof', 'mmsi_collision', 'loiter', 'dark_vessel'
    score: float
    severity: str  # 'low', 'medium', 'high'
    detected_at: datetime
    last_lat: float
    last_lon: float
    details: dict[str, Any] = field(default_factory=dict)


# Maximum reasonable speeds by vessel type in knots
# Cargo/tankers typically <= 25 kn; high-speed craft <= 55 kn.
MAX_SPEED_KNOTS_DEFAULT = 60.0
MAX_SPEED_BY_TYPE = {
    70: 28.0,  # Cargo
    80: 26.0,  # Tanker
    60: 40.0,  # Passenger
    30: 45.0,  # Fishing
}


def parse_iso_timestamp(ts_val: Any) -> datetime:
    """Safely parse timestamp into timezone-aware datetime."""
    if isinstance(ts_val, datetime):
        return ts_val if ts_val.tzinfo else ts_val.replace(tzinfo=timezone.utc)
    # Handle ISO format string
    cleaned = str(ts_val).replace("Z", "+00:00")
    dt = datetime.fromisoformat(cleaned)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def detect_in_stream_anomalies(
    record: dict[str, Any],
    curr_state: VesselState | None,
) -> list[Alert]:
    """
    Evaluate in-stream rules on arrival of a new ping:
    1. Implied speed violations
    2. Jump-and-return spoofing patterns
    """
    alerts: list[Alert] = []
    if curr_state is None:
        return alerts

    curr_ts = parse_iso_timestamp(record["BaseDateTime"])
    curr_lat = float(record["LAT"])
    curr_lon = float(record["LON"])
    vessel_type = record.get("VesselType") or curr_state.vessel_type
    speed_ceiling = MAX_SPEED_BY_TYPE.get(vessel_type, MAX_SPEED_KNOTS_DEFAULT)

    # Calculate time delta to previous ping
    dt_seconds = (curr_ts - curr_state.last_seen).total_seconds()

    # Out-of-order or duplicate timestamp check
    if dt_seconds <= 0:
        # If timestamps match or are within 1s but coordinates are > 100 km apart, MMSI collision!
        dist_km = haversine_km(curr_state.last_lat, curr_state.last_lon, curr_lat, curr_lon)
        if dist_km > 50.0:
            alerts.append(
                Alert(
                    mmsi=curr_state.mmsi,
                    alert_type="mmsi_collision",
                    score=min(10.0, dist_km / 50.0),
                    severity="high",
                    detected_at=curr_ts,
                    last_lat=curr_lat,
                    last_lon=curr_lon,
                    details={
                        "reason": "simultaneous_distant_transmissions",
                        "distance_km": round(dist_km, 1),
                        "dt_seconds": dt_seconds,
                    },
                )
            )
        return alerts

    dist_km = haversine_km(curr_state.last_lat, curr_state.last_lon, curr_lat, curr_lon)
    implied_speed = calculate_implied_speed_knots(dist_km, dt_seconds)

    # 1. Check for Jump-and-Return Spoofing
    # A vessel jumps to a distant coordinate (> 50 km) at impossible speed,
    # then in the next ping jumps back to near its original trajectory.
    if len(curr_state.recent_pings) >= 2:
        t_prev2, lat_prev2, lon_prev2 = curr_state.recent_pings[-2]
        dist_back_to_orig = haversine_km(curr_lat, curr_lon, lat_prev2, lon_prev2)
        total_dt = (curr_ts - t_prev2).total_seconds()
        speed_across_2 = calculate_implied_speed_knots(dist_back_to_orig, total_dt)

        # If it returned to the expected trajectory (speed_across_2 is normal)
        # while the intermediate ping was an extreme outlier:
        if speed_across_2 <= speed_ceiling and implied_speed > speed_ceiling * 2.0:
            alerts.append(
                Alert(
                    mmsi=curr_state.mmsi,
                    alert_type="spoof",
                    score=round(implied_speed / speed_ceiling, 2),
                    severity="high",
                    detected_at=curr_ts,
                    last_lat=curr_lat,
                    last_lon=curr_lon,
                    details={
                        "pattern": "jump_and_return",
                        "implied_speed_knots": round(implied_speed, 1),
                        "speed_ceiling_knots": speed_ceiling,
                        "jump_dist_km": round(dist_km, 1),
                    },
                )
            )
            return alerts

    # 2. Extreme Implied Speed Alert
    if implied_speed > speed_ceiling:
        severity = "high" if implied_speed > speed_ceiling * 2.0 else "medium"
        alerts.append(
            Alert(
                mmsi=curr_state.mmsi,
                alert_type="spoof",
                score=round(implied_speed / speed_ceiling, 2),
                severity=severity,
                detected_at=curr_ts,
                last_lat=curr_lat,
                last_lon=curr_lon,
                details={
                    "pattern": "speed_exceeded",
                    "implied_speed_knots": round(implied_speed, 1),
                    "speed_ceiling_knots": speed_ceiling,
                    "dist_km": round(dist_km, 1),
                    "dt_seconds": round(dt_seconds, 1),
                },
            )
        )

    return alerts


def process_batch(
    records: list[dict[str, Any]],
    state_table: dict[int, VesselState],
) -> tuple[list[dict[str, Any]], list[Alert]]:
    """
    Pure batch processor.

    Args:
        records: Normalized, valid AIS records.
        state_table: Current in-memory state dictionary (mmsi -> VesselState).

    Returns:
        (updated_records, generated_alerts)
    """
    generated_alerts: list[Alert] = []
    processed_records: list[dict[str, Any]] = []

    for r in records:
        mmsi = int(r["MMSI"])
        ts = parse_iso_timestamp(r["BaseDateTime"])
        lat = float(r["LAT"])
        lon = float(r["LON"])
        sog = r.get("sog") if "sog" in r and r.get("sog") is not None else r.get("SOG")
        cog = r.get("cog") if "cog" in r and r.get("cog") is not None else r.get("COG")
        heading = r.get("heading") if "heading" in r and r.get("heading") is not None else r.get("Heading")
        vessel_type = r.get("VesselType")
        vessel_name = r.get("VesselName") or r.get("vessel_name")
        t_class = r.get("TransceiverClass") or "A"

        curr_state = state_table.get(mmsi)
        cell = r.get("cell")
        if not cell:
            try:
                import h3
                cell = h3.geo_to_h3(lat, lon, 5) if hasattr(h3, "geo_to_h3") else h3.latlng_to_cell(lat, lon, 5)
                r["cell"] = cell
            except Exception:
                cell = None

        # 1. Run in-stream anomaly detection rules
        alerts = detect_in_stream_anomalies(r, curr_state)
        generated_alerts.extend(alerts)

        # 2. Update state
        if curr_state is None:
            curr_state = VesselState(
                mmsi=mmsi,
                last_seen=ts,
                last_lat=lat,
                last_lon=lon,
                last_sog=sog,
                last_cog=cog,
                last_heading=heading,
                vessel_type=vessel_type,
                vessel_name=vessel_name,
                transceiver_class=t_class,
                last_cell=cell,
                msg_count=1,
                status="active",
                recent_pings=[(ts, lat, lon)],
            )
        else:
            # Only advance latest state if incoming timestamp is newer
            if ts >= curr_state.last_seen:
                curr_state.last_seen = ts
                curr_state.last_lat = lat
                curr_state.last_lon = lon
                curr_state.last_sog = sog if sog is not None else curr_state.last_sog
                curr_state.last_cog = cog if cog is not None else curr_state.last_cog
                curr_state.last_heading = heading if heading is not None else curr_state.last_heading
                curr_state.vessel_type = vessel_type or curr_state.vessel_type
                curr_state.vessel_name = vessel_name or curr_state.vessel_name
                curr_state.transceiver_class = t_class or curr_state.transceiver_class
                curr_state.last_cell = cell or curr_state.last_cell
                curr_state.msg_count += 1
                curr_state.status = "active"

                # Update recent ping buffer (keep max 5 pings)
                curr_state.recent_pings.append((ts, lat, lon))
                if len(curr_state.recent_pings) > 5:
                    curr_state.recent_pings.pop(0)

        state_table[mmsi] = curr_state
        processed_records.append(r)

    return processed_records, generated_alerts
