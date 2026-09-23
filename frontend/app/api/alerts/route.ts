import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export interface AlertRecord {
  id: number;
  mmsi: number;
  vessel_name?: string | null;
  alert_type: string;
  score: number;
  severity: "low" | "medium" | "high";
  detected_at: string;
  last_lat: number | null;
  last_lon: number | null;
  details: {
    gap_s?: number;
    p99_gap_s?: number;
    p50_gap_s?: number;
    cell?: string;
    coverage_n?: number;
    zone?: string;
    zone_type?: string;
    transceiver_class?: string;
    implied_speed_knots?: number;
    speed_ceiling_knots?: number;
    dist_km?: number;
    jump_dist_km?: number;
    pattern?: string;
    partner_mmsi?: number;
    distance_m?: number;
    distance_km?: number;
    sog_1_knots?: number;
    sog_2_knots?: number;
    reason?: string;
    loiter_hours?: number;
    avg_speed_knots?: number;
    reconstruction_error?: number;
    threshold?: number;
    [key: string]: any;
  } | null;
}

const SAMPLE_ALERTS: AlertRecord[] = [
  {
    id: 1,
    mmsi: 367123456,
    alert_type: "dark_vessel",
    score: 3.7,
    severity: "high",
    detected_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    last_lat: 37.8201,
    last_lon: -122.4206,
    details: {
      gap_s: 11340,
      p99_gap_s: 3065,
      cell: "85283473fffffff",
      coverage_n: 8421,
      zone: "Greater Farallones NMS",
      transceiver_class: "A",
    },
  },
  {
    id: 2,
    mmsi: 366234890,
    alert_type: "loiter",
    score: 2.4,
    severity: "medium",
    detected_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    last_lat: 37.75,
    last_lon: -122.53,
    details: {
      zone: "Monterey Bay NMS (Protected)",
      transceiver_class: "B",
      implied_speed_knots: 0.8,
    },
  },
  {
    id: 3,
    mmsi: 369888777,
    alert_type: "spoof",
    score: 6.2,
    severity: "high",
    detected_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    last_lat: 37.65,
    last_lon: -122.75,
    details: {
      implied_speed_knots: 84.5,
      transceiver_class: "A",
    },
  },
  {
    id: 4,
    mmsi: 367123456,
    alert_type: "rendezvous_sts",
    score: 4.8,
    severity: "high",
    detected_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    last_lat: 37.785,
    last_lon: -122.62,
    details: {
      partner_mmsi: 368987654,
      distance_m: 120,
      sog_1_knots: 0.8,
      sog_2_knots: 1.1,
      reason: "slow_speed_close_proximity_outside_port",
      zone: "Offshore Farallones Corridor",
    },
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const severity = searchParams.get("severity");
  const alertType = searchParams.get("type");

  try {
    let query = `
      SELECT 
        a.id, 
        a.mmsi, 
        a.alert_type, 
        a.score, 
        a.severity, 
        a.detected_at, 
        a.last_lat, 
        a.last_lon, 
        a.details,
        v.vessel_name
      FROM alerts a
      LEFT JOIN vessel_latest_state v ON a.mmsi = v.mmsi
    `;
    const conditions: string[] = [];
    const values: any[] = [];

    if (severity) {
      values.push(severity);
      conditions.push(`a.severity = $${values.length}`);
    }
    if (alertType) {
      values.push(alertType);
      conditions.push(`a.alert_type = $${values.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY a.detected_at DESC LIMIT 200;`;

    const res = await pool.query(query, values);

    if (res.rows && res.rows.length > 0) {
      return NextResponse.json({
        source: "database",
        count: res.rows.length,
        alerts: res.rows,
      });
    }

    return NextResponse.json({
      source: "mock",
      count: SAMPLE_ALERTS.length,
      alerts: SAMPLE_ALERTS,
    });
  } catch (err: any) {
    return NextResponse.json({
      source: "mock (db offline)",
      count: SAMPLE_ALERTS.length,
      alerts: SAMPLE_ALERTS,
      error: err.message,
    });
  }
}
