import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Fallback sample EEZ / Marine Protected Area polygons off California
const SAMPLE_GEOFENCES = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: 1,
        name: "Greater Farallones National Marine Sanctuary",
        zone_type: "mpa",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-123.05, 37.95],
            [-122.85, 37.95],
            [-122.85, 37.65],
            [-123.15, 37.65],
            [-123.05, 37.95],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: 2,
        name: "US EEZ Boundary (Sector 12)",
        zone_type: "eez",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-124.5, 38.5],
            [-122.0, 38.5],
            [-122.0, 36.5],
            [-124.5, 36.5],
            [-124.5, 38.5],
          ],
        ],
      },
    },
  ],
};

export async function GET() {
  try {
    const res = await pool.query(`
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'id', id,
              'properties', jsonb_build_object('id', id, 'name', name, 'zone_type', zone_type),
              'geometry', ST_AsGeoJSON(geom)::jsonb
            )
          ), '[]'::jsonb
        )
      ) as geojson
      FROM geofences;
    `);

    const geojson = res.rows[0]?.geojson;
    if (geojson && geojson.features && geojson.features.length > 0) {
      return NextResponse.json({
        source: "database",
        data: geojson,
      });
    }

    return NextResponse.json({
      source: "mock",
      data: SAMPLE_GEOFENCES,
    });
  } catch (err: any) {
    return NextResponse.json({
      source: "mock (db offline)",
      data: SAMPLE_GEOFENCES,
      error: err.message,
    });
  }
}
