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
    // 1. Fetch latest state
    const vesselRes = await pool.query(
      `
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
        last_cell,
        msg_count,
        status
      FROM vessel_latest_state
      WHERE mmsi = $1;
      `,
      [mmsiNum]
    );

    // 2. Fetch alerts for this vessel
    const alertsRes = await pool.query(
      `
      SELECT 
        id,
        alert_type,
        score,
        severity,
        detected_at,
        details
      FROM alerts
      WHERE mmsi = $1
      ORDER BY detected_at DESC
      LIMIT 10;
      `,
      [mmsiNum]
    );

    // 3. Fetch recent track
    const trackRes = await pool.query(
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
      LIMIT 100;
      `,
      [mmsiNum]
    );

    if (vesselRes.rows.length === 0) {
      // Fallback synthetic vessel state if viewing demo / offline vessel
      const fallbackVessel = {
        mmsi: mmsiNum,
        vessel_name: `VESSEL-${mmsiNum}`,
        last_seen: new Date().toISOString(),
        lat: 37.82,
        lon: -122.42,
        sog: 11.4,
        cog: 182.0,
        heading: 180.0,
        vessel_type: 70,
        transceiver_class: "A",
        last_cell: "85283473fffffff",
        msg_count: 42,
        status: "active",
      };

      return NextResponse.json({
        vessel: fallbackVessel,
        alerts: alertsRes.rows || [],
        track: trackRes.rows || [],
      });
    }

    return NextResponse.json({
      vessel: vesselRes.rows[0],
      alerts: alertsRes.rows || [],
      track: trackRes.rows || [],
    });
  } catch (err: any) {
    console.error("Error fetching vessel details:", err);
    return NextResponse.json(
      { error: "Database error", details: err.message },
      { status: 500 }
    );
  }
}
