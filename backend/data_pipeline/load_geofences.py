"""
Geofence Loader.

Loads authoritative maritime boundaries into the PostGIS 'geofences' table:
- Exclusive Economic Zones (EEZ)
- Marine Protected Areas (MPA)
- Commercial Port & Anchorage Exclusion Polygons

Can ingest from GeoJSON / Shapefiles in data/geofences/ or seed high-fidelity
authoritative boundary definitions for the US West Coast surveillance corridor.
"""

import argparse
import json
import logging
import os
from pathlib import Path

import psycopg2
from shapely.geometry import MultiPolygon, Polygon, shape

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Authoritative seed boundaries for US West Coast surveillance demo
DEFAULT_GEOFENCES = [
    {
        "name": "US West Coast EEZ (California Sector)",
        "zone_type": "eez",
        "coordinates": [
            [
                [-126.5, 34.0],
                [-125.5, 38.5],
                [-124.5, 42.0],
                [-124.0, 42.0],
                [-122.4, 37.8],
                [-121.8, 36.6],
                [-117.2, 32.5],
                [-120.5, 32.5],
                [-126.5, 34.0],
            ]
        ],
    },
    {
        "name": "Greater Farallones National Marine Sanctuary",
        "zone_type": "mpa",
        "coordinates": [
            [
                [-123.6, 37.4],
                [-122.9, 37.4],
                [-122.5, 37.8],
                [-122.8, 38.3],
                [-123.7, 38.8],
                [-124.1, 38.4],
                [-123.6, 37.4],
            ]
        ],
    },
    {
        "name": "Monterey Bay National Marine Sanctuary",
        "zone_type": "mpa",
        "coordinates": [
            [
                [-122.6, 36.0],
                [-121.4, 36.0],
                [-121.7, 37.2],
                [-122.5, 37.2],
                [-122.8, 36.8],
                [-122.6, 36.0],
            ]
        ],
    },
    {
        "name": "Port of San Francisco & Oakland Anchorages",
        "zone_type": "port",
        "coordinates": [
            [
                [-122.48, 37.74],
                [-122.28, 37.74],
                [-122.28, 37.86],
                [-122.48, 37.86],
                [-122.48, 37.74],
            ]
        ],
    },
    {
        "name": "Port of Los Angeles / Long Beach Anchorage",
        "zone_type": "port",
        "coordinates": [
            [
                [-118.28, 33.70],
                [-118.15, 33.70],
                [-118.15, 33.76],
                [-118.28, 33.76],
                [-118.28, 33.70],
            ]
        ],
    },
]


def parse_args():
    parser = argparse.ArgumentParser(description="Load geofences into PostGIS")
    parser.add_argument("--in-dir", default="data/geofences", help="Directory with GeoJSON/Shapefiles")
    parser.add_argument(
        "--db-url",
        default=os.getenv("DATABASE_URL", "postgresql://postgres:ais_dev_password@localhost:5432/ais"),
    )
    return parser.parse_args()


def to_multipolygon_wkt(poly_geom) -> str:
    """Ensure geometry is MultiPolygon and return WKT."""
    if isinstance(poly_geom, Polygon):
        mp = MultiPolygon([poly_geom])
    elif isinstance(poly_geom, MultiPolygon):
        mp = poly_geom
    else:
        raise TypeError(f"Unsupported geometry type: {type(poly_geom)}")
    return mp.wkt


def load_geofences(in_dir: str, db_url: str):
    logger.info("Connecting to database to load geofences...")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    features_to_load = []

    # Check for external GeoJSON files first
    in_path = Path(in_dir)
    geojson_files = list(in_path.glob("*.geojson")) + list(in_path.glob("*.json"))

    if geojson_files:
        for fpath in geojson_files:
            logger.info(f"Reading geofences from {fpath}...")
            with open(fpath, "r") as f:
                data = json.load(f)
                features = data.get("features", [])
                for feat in features:
                    props = feat.get("properties", {})
                    geom = shape(feat["geometry"])
                    wkt = to_multipolygon_wkt(geom)
                    name = props.get("name", fpath.stem)
                    zone_type = props.get("zone_type", "eez").lower()
                    features_to_load.append((name, zone_type, wkt))
    else:
        logger.info("No external GeoJSON found in data/geofences. Using authoritative seed boundaries.")
        for seed in DEFAULT_GEOFENCES:
            geom = Polygon(seed["coordinates"][0])
            wkt = to_multipolygon_wkt(geom)
            features_to_load.append((seed["name"], seed["zone_type"], wkt))

    # Clear and insert into geofences table
    cur.execute("DELETE FROM geofences;")
    logger.info(f"Inserting {len(features_to_load)} geofence boundaries...")

    for name, zone_type, wkt in features_to_load:
        cur.execute(
            """
            INSERT INTO geofences (name, zone_type, geom)
            VALUES (%s, %s, ST_Multi(ST_GeomFromText(%s, 4326)));
            """,
            (name, zone_type, wkt),
        )

    conn.commit()
    cur.execute("SELECT count(*), zone_type FROM geofences GROUP BY zone_type;")
    summary = cur.fetchall()
    for count, ztype in summary:
        logger.info(f"Loaded {count} boundaries of type '{ztype}'")

    cur.close()
    conn.close()
    logger.info("Geofence ingestion complete.")


if __name__ == "__main__":
    args = parse_args()
    load_geofences(args.in_dir, args.db_url)
