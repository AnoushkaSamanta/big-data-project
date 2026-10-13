import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export interface VesselState {
  mmsi: number;
  vessel_name?: string | null;
  last_seen: string;
  lat: number;
  lon: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  vessel_type: number | null;
  transceiver_class: string | null;
  cell: string | null;
  msg_count: number;
  status: "active" | "stale" | "dark";
}

// Fallback sample vessels in coastal California (Marine Cadastre scope)
const SAMPLE_VESSELS: VesselState[] = [
  {
    mmsi: 367123456,
    last_seen: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    lat: 37.8201,
    lon: -122.4206,
    sog: 0.2,
    cog: 180.0,
    heading: 182.0,
    vessel_type: 70, // Cargo
    transceiver_class: "A",
    cell: "85283473fffffff",
    msg_count: 342,
    status: "dark", // Dark vessel anomaly!
  },
  {
    mmsi: 368987654,
    last_seen: new Date(Date.now() - 1000 * 45).toISOString(),
    lat: 37.795,
    lon: -122.385,
    sog: 12.8,
    cog: 95.0,
    heading: 96.0,
    vessel_type: 80, // Tanker
    transceiver_class: "A",
    cell: "85283473fffffff",
    msg_count: 812,
    status: "active",
  },
  {
    mmsi: 369456123,
    last_seen: new Date(Date.now() - 1000 * 30).toISOString(),
    lat: 37.8105,
    lon: -122.477,
    sog: 14.1,
    cog: 240.0,
    heading: 238.0,
    vessel_type: 70,
    transceiver_class: "A",
    cell: "85283473fffffff",
    msg_count: 1045,
    status: "active",
  },
  {
    mmsi: 366234890,
    last_seen: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    lat: 37.75,
    lon: -122.53,
    sog: 6.5,
    cog: 190.0,
    heading: 188.0,
    vessel_type: 30, // Fishing
    transceiver_class: "B",
    cell: "85283473fffffff",
    msg_count: 188,
    status: "stale",
  },
  {
    mmsi: 338112994,
    last_seen: new Date(Date.now() - 1000 * 12).toISOString(),
    lat: 37.84,
    lon: -122.37,
    sog: 9.2,
    cog: 320.0,
    heading: 322.0,
    vessel_type: 52, // Tug
    transceiver_class: "A",
    cell: "85283473fffffff",
    msg_count: 450,
    status: "active",
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minLonStr = searchParams.get("minLon");
  const minLatStr = searchParams.get("minLat");
  const maxLonStr = searchParams.get("maxLon");
  const maxLatStr = searchParams.get("maxLat");
  const sinceStr = searchParams.get("since");
  const limitParam = parseInt(searchParams.get("limit") || "2500", 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 2500 : limitParam), 10000);

  const serverTime = new Date().toISOString();

  try {
    const conditions: string[] = [];
    const values: any[] = [];

    // 1. Delta filter (records updated after 'since')
    if (sinceStr) {
      const sinceDate = new Date(sinceStr);
      if (!isNaN(sinceDate.getTime())) {
        values.push(sinceDate.toISOString());
        conditions.push(`last_seen > $${values.length}`);
      }
    }

    // 2. Spatial bounding box filter (using GIST spatial index on last_geom)
    if (minLonStr && minLatStr && maxLonStr && maxLatStr) {
      const minLon = parseFloat(minLonStr);
      const minLat = parseFloat(minLatStr);
      const maxLon = parseFloat(maxLonStr);
      const maxLat = parseFloat(maxLatStr);

      if (
        !isNaN(minLon) &&
        !isNaN(minLat) &&
        !isNaN(maxLon) &&
        !isNaN(maxLat) &&
        minLat >= -90 &&
        maxLat <= 90
      ) {
        values.push(minLon, minLat, maxLon, maxLat);
        const idx = values.length - 3;
        // Include any vessel within bounding envelope OR any dark vessel anywhere
        conditions.push(
          `(last_geom && ST_MakeEnvelope($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, 4326) OR status = 'dark')`
        );
      }
    }

    let queryText = `
      SELECT 
        mmsi,
        vessel_name,
        last_seen,
        last_lat as lat,
        last_lon as lon,
        last_sog as sog,
        last_cog as cog,
        last_heading as heading,
        vessel_type,
        transceiver_class,
        last_cell as cell,
        msg_count,
        status
      FROM vessel_latest_state
    `;

    if (conditions.length > 0) {
      queryText += ` WHERE ` + conditions.join(" AND ");
    }

    // Prioritize high-threat/dark vessels first, then most recently observed
    queryText += `
      ORDER BY 
        CASE WHEN status = 'dark' THEN 0 WHEN status = 'stale' THEN 1 ELSE 2 END,
        last_seen DESC
      LIMIT $${values.length + 1};
    `;
    values.push(limit);

    const res = await pool.query(queryText, values);

    if (res.rows && res.rows.length > 0) {
      return NextResponse.json({
        source: "database",
        server_time: serverTime,
        is_delta: Boolean(sinceStr),
        count: res.rows.length,
        vessels: res.rows,
      });
    }

    // If this was a delta poll with 0 new updates, return empty delta array rather than mock
    if (sinceStr) {
      return NextResponse.json({
        source: "database",
        server_time: serverTime,
        is_delta: true,
        count: 0,
        vessels: [],
      });
    }

    // Return sample demonstration data if DB is empty
    return NextResponse.json({
      source: "mock",
      server_time: serverTime,
      is_delta: false,
      count: SAMPLE_VESSELS.length,
      vessels: SAMPLE_VESSELS,
    });
  } catch (err: any) {
    return NextResponse.json({
      source: "mock (db offline)",
      server_time: serverTime,
      is_delta: false,
      count: SAMPLE_VESSELS.length,
      vessels: SAMPLE_VESSELS,
      error: err.message,
    });
  }
}
