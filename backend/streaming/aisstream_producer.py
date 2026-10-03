"""
Live Real-Time AIS Stream Producer (aisstream.io).

Connects to the aisstream.io global WebSocket API, subscribes to live real-time
vessel position reports, transforms them into the standard AIS pipeline contract,
and streams them into Apache Kafka topic 'ais.positions.raw' (keyed by MMSI).
"""

import argparse
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import websockets
from confluent_kafka import Producer
from dotenv import load_dotenv

from data_pipeline.validate import parse_iso_timestamp

# Load environment variables from .env
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

AISSTREAM_WS_URL = "wss://stream.aisstream.io/v0/stream"

# Default bounding box: US West Coast / California surveillance corridor (lat, lon)
DEFAULT_BBOX = [[[32.0, -125.5], [42.0, -117.0]]]


def parse_args():
    parser = argparse.ArgumentParser(description="Live real-time AISStream.io producer")
    parser.add_argument(
        "--api-key",
        default=os.getenv("AISSTREAM_DATA_KEY") or os.getenv("AISSTREAM_API_KEY"),
        help="AISStream.io API key (or set AISSTREAM_DATA_KEY in .env)",
    )
    parser.add_argument(
        "--bootstrap-servers",
        default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
        help="Kafka broker address",
    )
    parser.add_argument("--topic", default="ais.positions.raw", help="Target Kafka topic")
    parser.add_argument(
        "--west-coast",
        action="store_true",
        help="Subscribe only to US West Coast bounding box instead of global feed",
    )
    parser.add_argument(
        "--global-feed",
        action="store_true",
        default=True,
        help="Subscribe to global worldwide feed (default: True)",
    )
    return parser.parse_args()


def parse_aisstream_timestamp(time_utc_str: str) -> str:
    """Normalize AISStream time_utc (e.g. '2024-01-15 08:00:00.000 +0000 UTC') to ISO format."""
    try:
        clean_str = time_utc_str.replace(" +0000 UTC", "").strip()
        return parse_iso_timestamp(clean_str).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def transform_aisstream_message(data: dict[str, Any]) -> dict[str, Any] | None:
    """Transform raw AISStream JSON object into our standard pipeline schema."""
    msg_type = data.get("MessageType")
    meta = data.get("MetaData", {})
    msg_body = data.get("Message", {}).get(msg_type, {})

    mmsi = meta.get("MMSI")
    if not mmsi:
        return None

    lat = meta.get("latitude")
    lon = meta.get("longitude")
    if lat is None or lon is None:
        lat = msg_body.get("Latitude")
        lon = msg_body.get("Longitude")

    if lat is None or lon is None:
        return None

    sog = msg_body.get("Sog")
    cog = msg_body.get("Cog")
    heading = msg_body.get("TrueHeading")
    vessel_name = (msg_body.get("Name") or meta.get("ShipName", "")).strip()
    vessel_type = msg_body.get("Type")
    nav_status = msg_body.get("NavigationalStatus")
    time_utc = meta.get("time_utc", "")

    # Class A vs Class B
    transceiver_class = "A" if msg_type in ("PositionReport", "ShipStaticData") else "B"

    return {
        "MMSI": int(mmsi),
        "BaseDateTime": parse_aisstream_timestamp(time_utc),
        "LAT": float(lat),
        "LON": float(lon),
        "SOG": float(sog) if sog is not None else None,
        "COG": float(cog) if cog is not None else None,
        "Heading": float(heading) if heading is not None and heading != 511 else None,
        "VesselName": vessel_name,
        "VesselType": int(vessel_type) if vessel_type is not None else None,
        "TransceiverClass": transceiver_class,
        "NavigationalStatus": int(nav_status) if nav_status is not None else None,
    }


async def stream_ais_live(args):
    api_key = args.api_key
    if not api_key:
        logger.error(
            "Missing AISStream API key! Set AISSTREAM_DATA_KEY in .env or pass --api-key <KEY>"
        )
        return

    logger.info(f"Connecting to Kafka broker at {args.bootstrap_servers}...")
    producer = Producer(
        {
            "bootstrap.servers": args.bootstrap_servers,
            "queue.buffering.max.messages": 100000,
            "client.id": "aisstream-live-producer",
        }
    )

    if args.west_coast:
        bboxes = DEFAULT_BBOX
        bbox_desc = f"US West Coast ({DEFAULT_BBOX[0]})"
    else:
        bboxes = [[[-90.0, -180.0], [90.0, 180.0]]]
        bbox_desc = "Global Worldwide Feed ([[[-90.0, -180.0], [90.0, 180.0]]])"

    subscription_msg = {
        "APIKey": api_key,
        "BoundingBoxes": bboxes,
        "FilterMessageTypes": [
            "PositionReport",
            "StandardClassBPositionReport",
            "ExtendedClassBPositionReport",
            "ShipStaticData",
        ],
    }

    logger.info(f"Targeting live bounding box: {bbox_desc}")

    retry_delay = 3
    while True:
        try:
            logger.info(f"Connecting to AISStream WebSocket ({AISSTREAM_WS_URL})...")
            async with websockets.connect(
                AISSTREAM_WS_URL,
                ping_interval=20,
                ping_timeout=20,
                max_size=2**24,
            ) as ws:
                logger.info("✓ Connected to AISStream! Sending subscription parameters...")
                await ws.send(json.dumps(subscription_msg))
                logger.info("✓ Live real-time AIS feed active. Streaming positions to Kafka...")
                retry_delay = 3

                msg_count = 0
                while True:
                    raw_msg = await ws.recv()
                    data = json.loads(raw_msg)

                    record = transform_aisstream_message(data)
                    if record is not None:
                        mmsi_key = str(record["MMSI"]).encode("utf-8")
                        producer.produce(
                            topic=args.topic,
                            key=mmsi_key,
                            value=json.dumps(record).encode("utf-8"),
                        )
                        producer.poll(0)
                        msg_count += 1

                        if msg_count % 25 == 0:
                            logger.info(
                                f"📡 Live Streamed {msg_count} vessels | Latest: MMSI {record['MMSI']} "
                                f"({record['VesselName'] or 'Unknown'}) at ({record['LAT']:.4f}, {record['LON']:.4f}) "
                                f"SOG: {record['SOG']} kn"
                            )

        except websockets.ConnectionClosed as e:
            logger.warning(f"AISStream connection closed: {e}. Reconnecting in {retry_delay}s...")
        except Exception as e:
            logger.error(f"Streaming error: {e}. Reconnecting in {retry_delay}s...")

        await asyncio.sleep(retry_delay)
        retry_delay = min(60, retry_delay * 2)


def main():
    args = parse_args()
    try:
        asyncio.run(stream_ais_live(args))
    except KeyboardInterrupt:
        logger.info("Stopping AISStream live producer...")


if __name__ == "__main__":
    main()
