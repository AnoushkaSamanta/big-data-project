import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

// Pre-defined realistic anomaly scenarios for direct database ingestion fallback
const SCENARIO_PRESETS: Record<string, {
  alert_type: string;
  mmsi: number;
  vessel_name: string;
  score: number;
  severity: "low" | "medium" | "high";
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  vessel_type: number;
  details: Record<string, any>;
}> = {
  spoof: {
    alert_type: "spoof",
    mmsi: 369888777,
    vessel_name: "GHOST_PHANTOM",
    score: 172.49,
    severity: "high",
    lat: 36.6000,
    lon: -121.9000,
    sog: 102.3,
    cog: 280.0,
    vessel_type: 70,
    details: {
      pattern: "jump_and_return",
      implied_speed_knots: 4829.8,
      speed_ceiling_knots: 28.0,
      jump_dist_km: 149.2,
      origin_lat: 37.8112,
      origin_lon: -122.4230,
      zone: "Monterey Bay Deepwater Trench",
    },
  },
  collision: {
    alert_type: "mmsi_collision",
    mmsi: 368111222,
    vessel_name: "TWIN_BEACON",
    score: 11.0,
    severity: "high",
    lat: 33.7200,
    lon: -118.2500,
    sog: 13.8,
    cog: 180.0,
    vessel_type: 80,
    details: {
      reason: "simultaneous_distant_transmissions",
      distance_km: 552.4,
      dt_seconds: 15.0,
      loc1: "San Francisco Bay (37.80, -122.40)",
      loc2: "Long Beach Harbor (33.72, -118.25)",
    },
  },
  loiter: {
    alert_type: "loiter",
    mmsi: 366234890,
    vessel_name: "SEA_HARVEST",
    score: 3.5,
    severity: "medium",
    lat: 37.7500,
    lon: -122.5300,
    sog: 0.6,
    cog: 190.0,
    vessel_type: 30,
    details: {
      zone: "Farallon Islands Marine Sanctuary (MPA)",
      zone_type: "mpa",
      loiter_hours: 3.2,
      avg_speed_knots: 0.6,
      radius_km: 0.4,
      reason: "lingering_in_protected_marine_reserve",
    },
  },
  rendezvous: {
    alert_type: "rendezvous_sts",
    mmsi: 367111001,
    vessel_name: "BLACK_PEARL",
    score: 5.8,
    severity: "high",
    lat: 37.6000,
    lon: -122.8000,
    sog: 0.8,
    cog: 120.0,
    vessel_type: 70,
    details: {
      partner_mmsi: 367222002,
      partner_name: "DEEP_HORIZON",
      distance_m: 85.0,
      sog_1_knots: 0.8,
      sog_2_knots: 0.9,
      duration_minutes: 42.0,
      reason: "slow_speed_close_proximity_outside_port",
      zone: "High Seas Exclusion Corridor",
    },
  },
  dark: {
    alert_type: "dark_vessel",
    mmsi: 367999888,
    vessel_name: "SHADOW_TRADER",
    score: 4.2,
    severity: "high",
    lat: 37.7830,
    lon: -122.6575,
    sog: 11.5,
    cog: 290.0,
    vessel_type: 80,
    details: {
      gap_s: 14400,
      p99_gap_s: 3420,
      cell: "85283473fffffff",
      coverage_n: 7850,
      zone: "Greater Farallones NMS Approaches",
      transceiver_class: "A",
      reason: "deliberate_transponder_disabling_at_sea",
    },
  },
  ml_anomaly: {
    alert_type: "ml_anomaly",
    mmsi: 369555444,
    vessel_name: "ERRATIC_DRIFTER",
    score: 8.6,
    severity: "high",
    lat: 37.8500,
    lon: -122.5000,
    sog: 31.0,
    cog: 10.0,
    vessel_type: 70,
    details: {
      raw_decision_score: -0.2177,
      window_pings: 12,
      tortuosity: 8.45,
      sog_mean: 21.4,
      top_contributing_features: [
        { feature: "path_tortuosity", value: 8.45, z_score: 94.2 },
        { feature: "heading_cog_diff_mean", value: 72.5, z_score: 16.8 },
        { feature: "sog_std", value: 12.8, z_score: 8.5 },
      ],
      model: "IsolationForest_v1.0",
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scenario = body.scenario || "spoof";

    if (!SCENARIO_PRESETS[scenario]) {
      return NextResponse.json(
        { error: `Unknown scenario '${scenario}'. Options: ${Object.keys(SCENARIO_PRESETS).join(", ")}` },
        { status: 400 }
      );
    }

    const preset = SCENARIO_PRESETS[scenario];
    const now = new Date();

    // 1. Try invoking Kafka injector via Python CLI if environment allows
    let kafkaInjected = false;
    try {
      await execPromise(`python3 -m streaming.injector --scenario ${scenario}`, {
        timeout: 4000,
        env: { ...process.env, PYTHONPATH: "backend" },
      });
      kafkaInjected = true;
    } catch {
      // In Docker container, Python might not be installed, proceed with direct DB write
      kafkaInjected = false;
    }

    // 2. Ensure PostGIS tables reflect the anomaly state immediately
    const insertAlertSql = `
      INSERT INTO alerts (mmsi, alert_type, score, severity, detected_at, last_lat, last_lon, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (mmsi, alert_type, date_trunc('hour', detected_at AT TIME ZONE 'UTC'))
      DO UPDATE SET
        score = EXCLUDED.score,
        severity = EXCLUDED.severity,
        detected_at = EXCLUDED.detected_at,
        details = EXCLUDED.details
      RETURNING id;
    `;

    const alertResult = await pool.query(insertAlertSql, [
      preset.mmsi,
      preset.alert_type,
      preset.score,
      preset.severity,
      now.toISOString(),
      preset.lat,
      preset.lon,
      JSON.stringify(preset.details),
    ]);

    // Upsert latest vessel state so DeckMap positions the vessel
    const vesselStatus = scenario === "dark" ? "dark" : "active";
    const upsertVesselSql = `
      INSERT INTO vessel_latest_state (
        mmsi, vessel_name, last_seen, last_geom, last_lat, last_lon,
        last_sog, last_cog, last_heading, vessel_type, transceiver_class, status, msg_count
      )
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $5, $4, $6, $7, $7, $8, 'A', $9, 100)
      ON CONFLICT (mmsi) DO UPDATE SET
        vessel_name = EXCLUDED.vessel_name,
        last_seen = EXCLUDED.last_seen,
        last_geom = EXCLUDED.last_geom,
        last_lat = EXCLUDED.last_lat,
        last_lon = EXCLUDED.last_lon,
        last_sog = EXCLUDED.last_sog,
        last_cog = EXCLUDED.last_cog,
        status = EXCLUDED.status;
    `;

    await pool.query(upsertVesselSql, [
      preset.mmsi,
      preset.vessel_name,
      now.toISOString(),
      preset.lon,
      preset.lat,
      preset.sog,
      preset.cog,
      preset.vessel_type,
      vesselStatus,
    ]);

    // For STS rendezvous, also upsert partner vessel
    if (scenario === "rendezvous") {
      const partnerMmsi = preset.details.partner_mmsi;
      const partnerName = preset.details.partner_name;
      await pool.query(upsertVesselSql, [
        partnerMmsi,
        partnerName,
        now.toISOString(),
        preset.lon + 0.0006,
        preset.lat + 0.0006,
        0.9,
        122.0,
        80,
        "active",
      ]);
    }

    return NextResponse.json({
      status: "success",
      scenario,
      kafka_injected: kafkaInjected,
      alert_id: alertResult.rows[0]?.id,
      mmsi: preset.mmsi,
      vessel_name: preset.vessel_name,
      alert_type: preset.alert_type,
      severity: preset.severity,
      timestamp: now.toISOString(),
      lat: preset.lat,
      lon: preset.lon,
      details: preset.details,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
