"""
Generate a rich, realistic AIS live demonstration dataset.

Contains:
1. Normal vessels sailing in San Francisco Bay / Pacific corridor
2. Dark vessel (abruptly disabling AIS inside Greater Farallones MPA)
3. GPS Spoofing vessel (exhibiting jump-and-return GPS teleportation)
4. Loitering vessel (lingering at 0.5 kn in protected marine sanctuary)
"""

import csv
from datetime import datetime, timezone, timedelta

def generate_demo_dataset():
    start_time = datetime(2024, 1, 15, 8, 0, 0, tzinfo=timezone.utc)
    records = []

    # 1. Normal Cargo Vessel: PACIFIC_EXPLORER (367123456)
    # Cruising out of SF Bay at 12 knots heading 250°
    lat, lon = 37.810, -122.420
    for i in range(30):
        t = start_time + timedelta(minutes=i)
        lat += 0.0012
        lon -= 0.0030
        records.append({
            "MMSI": 367123456,
            "BaseDateTime": t.isoformat(),
            "LAT": round(lat, 5),
            "LON": round(lon, 5),
            "SOG": 12.4,
            "COG": 250.0,
            "Heading": 252.0,
            "VesselName": "PACIFIC_EXPLORER",
            "VesselType": 70,
            "TransceiverClass": "A"
        })

    # 2. Normal Tanker: GOLDEN_GATE_NAV (368987654)
    # Inbound transit at 14 knots heading 70°
    lat, lon = 37.750, -122.580
    for i in range(30):
        t = start_time + timedelta(minutes=i)
        lat += 0.0015
        lon += 0.0035
        records.append({
            "MMSI": 368987654,
            "BaseDateTime": t.isoformat(),
            "LAT": round(lat, 5),
            "LON": round(lon, 5),
            "SOG": 14.2,
            "COG": 70.0,
            "Heading": 69.0,
            "VesselName": "GOLDEN_GATE_NAV",
            "VesselType": 80,
            "TransceiverClass": "A"
        })

    # 3. Dark Vessel: SHADOW_TRADER (367999888)
    # Enters Greater Farallones MPA, broadcasts for 8 minutes, then CEASES ALL BROADCASTS
    lat, lon = 37.780, -122.650
    for i in range(8):
        t = start_time + timedelta(minutes=i)
        lat += 0.0010
        lon -= 0.0025
        records.append({
            "MMSI": 367999888,
            "BaseDateTime": t.isoformat(),
            "LAT": round(lat, 5),
            "LON": round(lon, 5),
            "SOG": 11.5,
            "COG": 290.0,
            "Heading": 290.0,
            "VesselName": "SHADOW_TRADER",
            "VesselType": 80,
            "TransceiverClass": "A"
        })

    # 4. GPS Spoofing Vessel: GHOST_PHANTOM (369888777)
    # Normal transit for 10 minutes, jumps 180 km away at minute 11, jumps back at minute 12
    lat, lon = 37.850, -122.450
    for i in range(25):
        t = start_time + timedelta(minutes=i)
        if i == 11:
            # JUMP coordinate: Teleports to Monterey Bay at 1,500 knots!
            curr_lat = 36.600
            curr_lon = -121.900
            sog = 102.3 # sentinel or extreme
        else:
            lat += 0.0010
            lon -= 0.0020
            curr_lat = lat
            curr_lon = lon
            sog = 13.0

        records.append({
            "MMSI": 369888777,
            "BaseDateTime": t.isoformat(),
            "LAT": round(curr_lat, 5),
            "LON": round(curr_lon, 5),
            "SOG": 13.0 if i != 11 else 102.3,
            "COG": 280.0,
            "Heading": 280.0,
            "VesselName": "GHOST_PHANTOM",
            "VesselType": 70,
            "TransceiverClass": "A"
        })

    # Sort all pings chronologically
    records.sort(key=lambda r: r["BaseDateTime"])

    out_file = "data/raw/demo_stream.csv"
    with open(out_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "MMSI", "BaseDateTime", "LAT", "LON", "SOG", "COG", "Heading",
            "VesselName", "VesselType", "TransceiverClass"
        ])
        writer.writeheader()
        writer.writerows(records)

    print(f"Generated {len(records)} demo records in {out_file}")

if __name__ == "__main__":
    generate_demo_dataset()
