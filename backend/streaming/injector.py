"""
Real-Time AIS Anomaly Injector.

Generates and publishes realistic, live-timestamped anomalous AIS messages
directly to Kafka (topic: ais.positions.raw) to demonstrate real-time
stream detection and alerting in the surveillance console.

Supported Scenarios:
1. 'spoof': GPS teleportation / Jump-and-Return (MMSI 369888777 jumps 150 km at 4,800 kn then returns).
2. 'collision': MMSI Transponder Duplication / Cloned identity (MMSI 368111222 in SF and LA simultaneously).
3. 'loiter': Marine Protected Area (MPA) Illegal Loitering (MMSI 366234890 idling inside Farallones MPA).
4. 'rendezvous': Ship-to-Ship (STS) Transshipment Encounter (MMSIs 367111001 & 367222002 meeting at sea).
5. 'dark': AIS Transponder Disabling (MMSI 367999888 goes dark in high-confidence coastal cell).
6. 'ml_anomaly': Trajectory Isolation Forest Outlier (MMSI 369555444 erratic zig-zag trajectory).
"""

import argparse
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from confluent_kafka import Producer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def create_producer(bootstrap_servers: str) -> Producer:
    return Producer(
        {
            "bootstrap.servers": bootstrap_servers,
            "client.id": "ais-anomaly-injector",
            "queue.buffering.max.messages": 10000,
        }
    )


def delivery_callback(err, msg):
    if err is not None:
        logger.error(f"Failed to deliver message: {err}")


def publish_pings(producer: Producer, topic: str, pings: list[dict[str, Any]], delay_between_pings: float = 0.05):
    """Publish a list of AIS records to Kafka with strict per-MMSI keying."""
    for ping in pings:
        mmsi_key = str(ping["MMSI"]).encode("utf-8")
        payload = json.dumps(ping).encode("utf-8")
        producer.produce(topic, key=mmsi_key, value=payload, on_delivery=delivery_callback)
        producer.poll(0)
        if delay_between_pings > 0:
            time.sleep(delay_between_pings)
    producer.flush(5)
    logger.info(f"✓ Published {len(pings)} message(s) to topic '{topic}'.")


# ---------------------------------------------------------------------------
# Scenario Generators
# ---------------------------------------------------------------------------

def generate_spoof_scenario(base_time: datetime | None = None) -> list[dict[str, Any]]:
    """
    Scenario 1: GPS Teleportation / Jump-and-Return.
    Vessel cruising near Golden Gate teleports 150 km to Monterey Bay at 4,800 knots,
    then returns to normal transit course in next ping.
    """
    t0 = base_time or datetime.now(timezone.utc)
    mmsi = 369888777
    vessel_name = "GHOST_PHANTOM"

    return [
        # Normal transit ping 1
        {
            "MMSI": mmsi,
            "BaseDateTime": (t0 - timedelta(seconds=120)).isoformat(),
            "LAT": 37.8112,
            "LON": -122.4230,
            "SOG": 12.4,
            "COG": 250.0,
            "Heading": 252.0,
            "VesselName": vessel_name,
            "VesselType": 70,  # Cargo
            "TransceiverClass": "A",
        },
        # Normal transit ping 2
        {
            "MMSI": mmsi,
            "BaseDateTime": (t0 - timedelta(seconds=60)).isoformat(),
            "LAT": 37.8136,
            "LON": -122.4290,
            "SOG": 12.4,
            "COG": 250.0,
            "Heading": 252.0,
            "VesselName": vessel_name,
            "VesselType": 70,
            "TransceiverClass": "A",
        },
        # TELEPORTATION JUMP: jumps 150 km away to Monterey Bay (implied speed ~4,800 kn)
        {
            "MMSI": mmsi,
            "BaseDateTime": (t0 - timedelta(seconds=30)).isoformat(),
            "LAT": 36.6000,
            "LON": -121.9000,
            "SOG": 102.3,  # Sentinels often accompany spoofing
            "COG": 280.0,
            "Heading": 280.0,
            "VesselName": vessel_name,
            "VesselType": 70,
            "TransceiverClass": "A",
        },
        # RETURN PING: jumps back to expected SF transit route
        {
            "MMSI": mmsi,
            "BaseDateTime": t0.isoformat(),
            "LAT": 37.8160,
            "LON": -122.4350,
            "SOG": 12.5,
            "COG": 250.0,
            "Heading": 250.0,
            "VesselName": vessel_name,
            "VesselType": 70,
            "TransceiverClass": "A",
        },
    ]


def generate_collision_scenario(base_time: datetime | None = None) -> list[dict[str, Any]]:
    """
    Scenario 2: MMSI Collision / Identity Cloning.
    The same MMSI broadcasts simultaneously from San Francisco Bay and Long Beach (~550 km away).
    """
    t0 = base_time or datetime.now(timezone.utc)
    mmsi = 368111222
    vessel_name = "TWIN_BEACON"

    return [
        # Position 1 in San Francisco Bay
        {
            "MMSI": mmsi,
            "BaseDateTime": t0.isoformat(),
            "LAT": 37.8000,
            "LON": -122.4000,
            "SOG": 14.2,
            "COG": 90.0,
            "Heading": 92.0,
            "VesselName": vessel_name,
            "VesselType": 80,  # Tanker
            "TransceiverClass": "A",
        },
        # Position 2 in Long Beach / Los Angeles Harbor (550 km away within 15 seconds)
        {
            "MMSI": mmsi,
            "BaseDateTime": t0.isoformat(),
            "LAT": 33.7200,
            "LON": -118.2500,
            "SOG": 13.8,
            "COG": 180.0,
            "Heading": 180.0,
            "VesselName": vessel_name,
            "VesselType": 80,
            "TransceiverClass": "A",
        },
    ]


def generate_loiter_scenario(base_time: datetime | None = None) -> list[dict[str, Any]]:
    """
    Scenario 3: Marine Protected Area (MPA) Loitering.
    Fishing vessel loitering at 0.5-0.8 knots inside Farallon Islands Marine Sanctuary.
    """
    t0 = base_time or datetime.now(timezone.utc)
    mmsi = 366234890
    vessel_name = "SEA_HARVEST"

    pings = []
    # 6 pings over 3 hours (30-min intervals) in a tight 200m circle inside the MPA
    center_lat, center_lon = 37.7500, -122.5300
    for i in range(6):
        t = t0 - timedelta(minutes=(5 - i) * 30)
        pings.append(
            {
                "MMSI": mmsi,
                "BaseDateTime": t.isoformat(),
                "LAT": round(center_lat + (0.001 * (i % 2)), 4),
                "LON": round(center_lon + (0.001 * ((i + 1) % 2)), 4),
                "SOG": 0.6,
                "COG": float(i * 60.0),
                "Heading": float(i * 60.0),
                "VesselName": vessel_name,
                "VesselType": 30,  # Fishing
                "TransceiverClass": "B",
            }
        )
    return pings


def generate_rendezvous_scenario(base_time: datetime | None = None) -> list[dict[str, Any]]:
    """
    Scenario 4: Ship-to-Ship (STS) Rendezvous / Transshipment Encounter.
    Two vessels meet in open ocean 20 km offshore, drifting side-by-side (80m apart) at 0.8 knots.
    """
    t0 = base_time or datetime.now(timezone.utc)
    mmsi_a, name_a = 367111001, "BLACK_PEARL"
    mmsi_b, name_b = 367222002, "DEEP_HORIZON"

    pings = []
    base_lat, base_lon = 37.6000, -122.8000

    # 4 contemporaneous pings for both vessels drifting together
    for i in range(4):
        t = t0 - timedelta(minutes=(3 - i) * 10)
        # Vessel A
        pings.append(
            {
                "MMSI": mmsi_a,
                "BaseDateTime": t.isoformat(),
                "LAT": round(base_lat + (i * 0.0002), 5),
                "LON": round(base_lon + (i * 0.0002), 5),
                "SOG": 0.8,
                "COG": 120.0,
                "Heading": 120.0,
                "VesselName": name_a,
                "VesselType": 70,
                "TransceiverClass": "A",
            }
        )
        # Vessel B (within ~80m of Vessel A)
        pings.append(
            {
                "MMSI": mmsi_b,
                "BaseDateTime": t.isoformat(),
                "LAT": round(base_lat + (i * 0.0002) + 0.0006, 5),
                "LON": round(base_lon + (i * 0.0002) + 0.0005, 5),
                "SOG": 0.9,
                "COG": 122.0,
                "Heading": 120.0,
                "VesselName": name_b,
                "VesselType": 80,
                "TransceiverClass": "A",
            }
        )
    return pings


def generate_dark_scenario(base_time: datetime | None = None) -> list[dict[str, Any]]:
    """
    Scenario 5: Dark Vessel (AIS Disabling).
    A cargo vessel in a high-coverage cell broadcasts 3 normal pings, then goes completely silent.
    """
    t0 = base_time or datetime.now(timezone.utc)
    mmsi = 367999888
    vessel_name = "SHADOW_TRADER"

    return [
        {
            "MMSI": mmsi,
            "BaseDateTime": (t0 - timedelta(minutes=15)).isoformat(),
            "LAT": 37.7810,
            "LON": -122.6525,
            "SOG": 11.5,
            "COG": 290.0,
            "Heading": 290.0,
            "VesselName": vessel_name,
            "VesselType": 80,
            "TransceiverClass": "A",
        },
        {
            "MMSI": mmsi,
            "BaseDateTime": (t0 - timedelta(minutes=10)).isoformat(),
            "LAT": 37.7820,
            "LON": -122.6550,
            "SOG": 11.5,
            "COG": 290.0,
            "Heading": 290.0,
            "VesselName": vessel_name,
            "VesselType": 80,
            "TransceiverClass": "A",
        },
        {
            "MMSI": mmsi,
            "BaseDateTime": (t0 - timedelta(minutes=5)).isoformat(),
            "LAT": 37.7830,
            "LON": -122.6575,
            "SOG": 11.5,
            "COG": 290.0,
            "Heading": 290.0,
            "VesselName": vessel_name,
            "VesselType": 80,
            "TransceiverClass": "A",
        },
    ]


def generate_ml_scenario(base_time: datetime | None = None) -> list[dict[str, Any]]:
    """
    Scenario 6: ML Trajectory Anomaly (Isolation Forest Outlier).
    Generates 12 pings with high tortuosity, sudden speed surges, and acute course deviations.
    """
    t0 = base_time or datetime.now(timezone.utc)
    mmsi = 369555444
    vessel_name = "ERRATIC_DRIFTER"

    pings = []
    lat, lon = 37.8500, -122.5000
    # Wild zig-zag course with high tortuosity and speed swings
    offsets = [
        (0.00, 0.00, 8.0, 90.0, 90.0),
        (0.02, 0.01, 24.0, 30.0, 110.0),   # Heading-COG divergence
        (0.01, 0.03, 3.0, 190.0, 40.0),    # Sharp direction reversal
        (0.04, 0.02, 28.0, 20.0, 180.0),
        (0.02, 0.04, 5.0, 260.0, 20.0),
        (0.05, 0.03, 31.0, 10.0, 240.0),
        (0.01, 0.06, 2.0, 180.0, 90.0),
        (0.06, 0.05, 33.0, 350.0, 180.0),
        (0.02, 0.08, 4.0, 270.0, 20.0),
        (0.07, 0.06, 30.0, 20.0, 190.0),
        (0.03, 0.09, 3.0, 250.0, 30.0),
        (0.08, 0.08, 29.0, 40.0, 200.0),
    ]

    for i, (dlat, dlon, sog, cog, hdg) in enumerate(offsets):
        t = t0 - timedelta(minutes=(12 - i) * 4)
        pings.append(
            {
                "MMSI": mmsi,
                "BaseDateTime": t.isoformat(),
                "LAT": round(lat + dlat, 4),
                "LON": round(lon + dlon, 4),
                "SOG": sog,
                "COG": cog,
                "Heading": hdg,
                "VesselName": vessel_name,
                "VesselType": 70,
                "TransceiverClass": "A",
            }
        )
    return pings


SCENARIOS = {
    "spoof": ("GPS Teleportation / Jump-and-Return", generate_spoof_scenario),
    "collision": ("MMSI Cloned Transponder Collision", generate_collision_scenario),
    "loiter": ("Marine Protected Area Illegal Loitering", generate_loiter_scenario),
    "rendezvous": ("Ship-to-Ship Transshipment Encounter", generate_rendezvous_scenario),
    "dark": ("Coverage-Gated AIS Disabling", generate_dark_scenario),
    "ml_anomaly": ("Erratic Trajectory Isolation Forest Outlier", generate_ml_scenario),
}


def inject_scenario(
    scenario_name: str,
    bootstrap_servers: str = "localhost:9092",
    topic: str = "ais.positions.raw",
) -> dict[str, Any]:
    """Inject scenario by name and return execution metadata."""
    if scenario_name not in SCENARIOS:
        raise ValueError(f"Unknown scenario '{scenario_name}'. Available: {list(SCENARIOS.keys())}")

    desc, generator = SCENARIOS[scenario_name]
    logger.info(f"Injecting scenario '{scenario_name}': {desc}...")

    pings = generator()
    producer = create_producer(bootstrap_servers)
    publish_pings(producer, topic, pings)

    return {
        "status": "success",
        "scenario": scenario_name,
        "description": desc,
        "pings_count": len(pings),
        "target_mmsis": list({p["MMSI"] for p in pings}),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Inject labeled anomaly scenarios directly into Kafka stream")
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIOS.keys()) + ["all"],
        default="spoof",
        help="Anomaly scenario to inject (or 'all')",
    )
    parser.add_argument(
        "--bootstrap-servers",
        default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
        help="Kafka bootstrap servers",
    )
    parser.add_argument(
        "--topic",
        default=os.getenv("KAFKA_TOPIC", "ais.positions.raw"),
        help="Target Kafka topic",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    if args.scenario == "all":
        for sc in SCENARIOS:
            inject_scenario(sc, args.bootstrap_servers, args.topic)
            time.sleep(0.5)
    else:
        inject_scenario(args.scenario, args.bootstrap_servers, args.topic)


if __name__ == "__main__":
    main()
