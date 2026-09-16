import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mmsi: string }> }
) {
  const { mmsi } = await params;
  const mmsiNum = parseInt(mmsi, 10);

  if (isNaN(mmsiNum)) {
    return NextResponse.json({ error: "Invalid MMSI" }, { status: 400 });
  }

  try {
    const res = await pool.query(
      `
      SELECT 
        ts,
        ST_Y(geom) as lat,
        ST_X(geom) as lon,
        sog,
        cog,
        heading
      FROM vessel_positions
      WHERE mmsi = $1
      ORDER BY ts ASC
      LIMIT 1000;
    `,
      [mmsiNum]
    );

    if (res.rows && res.rows.length > 0) {
      return NextResponse.json({
        source: "database",
        mmsi: mmsiNum,
        points: res.rows,
      });
    }

    // Return synthesized track for demo vessel
    const baseLat = 37.8201;
    const baseLon = -122.4206;
    const samplePoints = Array.from({ length: 12 }, (_, i) => ({
      ts: new Date(Date.now() - (12 - i) * 1000 * 60 * 15).toISOString(),
      lat: baseLat - (12 - i) * 0.015 + Math.sin(i) * 0.005,
      lon: baseLon - (12 - i) * 0.02 + Math.cos(i) * 0.005,
      sog: i === 11 ? 0.2 : 12.5,
      cog: 180.0,
      heading: 182.0,
    }));

    return NextResponse.json({
      source: "mock",
      mmsi: mmsiNum,
      points: samplePoints,
    });
  } catch (err: any) {
    return NextResponse.json({
      source: "mock (db offline)",
      mmsi: mmsiNum,
      points: [],
      error: err.message,
    });
  }
}
