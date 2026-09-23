"use client";

import React, { useMemo } from "react";
import { VesselState } from "@/app/api/vessels/route";
import { X, Navigation, ShieldAlert, Download, Radar, Camera, ExternalLink, Ship, Globe } from "lucide-react";
import { computeDriftCone } from "@/lib/drift";
import { getVesselCountry, getVesselTypeName, getMarineTrafficUrl, getVesselFinderUrl } from "@/lib/mmsi";

interface VesselDrawerProps {
  vessel: VesselState | null;
  onClose: () => void;
  trackPoints: Array<{ lat: number; lon: number; ts: string; sog?: number }>;
}

export default function VesselDrawer({
  vessel,
  onClose,
  trackPoints,
}: VesselDrawerProps) {
  if (!vessel) return null;

  const country = getVesselCountry(vessel.mmsi);
  const vesselTypeName = getVesselTypeName(vessel.vessel_type);

  // Compute tactical dead-reckoning search zone if vessel is dark
  const driftZone = useMemo(() => {
    if (vessel.status !== "dark") return null;
    return computeDriftCone(
      vessel.mmsi,
      vessel.lat,
      vessel.lon,
      vessel.sog,
      vessel.cog,
      vessel.last_seen
    );
  }, [vessel]);

  // Handle Exporting Evidence Dossier as downloadable GeoJSON
  const handleExportDossier = () => {
    const dossier = {
      type: "FeatureCollection",
      metadata: {
        title: `Maritime Surveillance Incident Dossier - MMSI ${vessel.mmsi}`,
        generated_at: new Date().toISOString(),
        vessel: {
          mmsi: vessel.mmsi,
          vessel_name: vessel.vessel_name || null,
          country: country.country,
          flag: country.flag,
          status: vessel.status,
          vessel_type: vessel.vessel_type,
          vessel_type_name: vesselTypeName,
          transceiver_class: vessel.transceiver_class,
          msg_count: vessel.msg_count,
          last_observed: vessel.last_seen,
          last_sog_knots: vessel.sog,
          last_cog_degrees: vessel.cog,
          last_heading: vessel.heading,
          h3_cell: vessel.cell,
        },
      },
      features: [
        // 1. Last Known Position Point
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [vessel.lon, vessel.lat],
          },
          properties: {
            name: `Last Known Position - ${vessel.vessel_name || `MMSI ${vessel.mmsi}`}`,
            timestamp: vessel.last_seen,
            status: vessel.status,
            sog_knots: vessel.sog,
            cog_degrees: vessel.cog,
          },
        },
        // 2. Trajectory Track LineString
        ...(trackPoints.length > 1
          ? [
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: trackPoints.map((p) => [p.lon, p.lat]),
                },
                properties: {
                  name: `AIS Waypoint Track (${trackPoints.length} points)`,
                  waypoints: trackPoints,
                },
              },
            ]
          : []),
        // 3. Projected Drift Cone if Dark
        ...(driftZone ? [driftZone] : []),
      ],
    };

    const blob = new Blob([JSON.stringify(dossier, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dossier_mmsi_${vessel.mmsi}_${new Date().toISOString().substring(0, 10)}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="side-drawer" style={{ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 40 }}>
      <div className="drawer-header">
        <div className="drawer-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }} title={`${country.country} (${country.code})`}>
            {country.flag}
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 700, letterSpacing: "0.02em", color: "var(--silver-100)" }}>
              {vessel.vessel_name || `VESSEL ${vessel.mmsi}`}
            </span>
            <span style={{ fontSize: "11px", color: "var(--silver-400)", fontFamily: "var(--font-mono)" }}>
              {country.country} ({country.code}) • MMSI {vessel.mmsi}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--silver-400)",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="drawer-content" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Status header banner */}
        <div
          style={{
            background:
              vessel.status === "dark"
                ? "rgba(244, 63, 94, 0.12)"
                : vessel.status === "stale"
                ? "rgba(245, 158, 11, 0.12)"
                : "rgba(16, 185, 129, 0.12)",
            border: `1px solid ${
              vessel.status === "dark"
                ? "var(--border-alert)"
                : vessel.status === "stale"
                ? "rgba(245, 158, 11, 0.4)"
                : "rgba(16, 185, 129, 0.4)"
            }`,
            borderRadius: "6px",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <ShieldAlert
            size={24}
            color={
              vessel.status === "dark"
                ? "var(--color-dark)"
                : vessel.status === "stale"
                ? "var(--color-stale)"
                : "var(--color-active)"
            }
          />
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                textTransform: "uppercase",
                fontFamily: "var(--font-mono)",
                color:
                  vessel.status === "dark"
                    ? "var(--color-dark)"
                    : vessel.status === "stale"
                    ? "var(--color-stale)"
                    : "var(--color-active)",
              }}
            >
              STATUS: {vessel.status}
            </div>
            <div style={{ fontSize: "11px", color: "var(--silver-400)" }}>
              {vessel.status === "dark"
                ? "AIS broadcast halted while remaining at sea"
                : "Normal reporting activity detected"}
            </div>
          </div>
        </div>

        {/* Tactical Search Zone (if Dark Vessel) */}
        {driftZone && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(248, 113, 113, 0.35)",
              borderRadius: "6px",
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#f87171",
                fontFamily: "var(--font-mono)",
                marginBottom: "6px",
              }}
            >
              <Radar size={14} />
              <span>DEAD-RECKONING SEARCH ZONE</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
              <div>
                <span style={{ color: "var(--silver-500)" }}>Elapsed Silent: </span>
                <span style={{ color: "var(--silver-200)", fontWeight: 600 }}>{driftZone.properties.elapsed_hours}h</span>
              </div>
              <div>
                <span style={{ color: "var(--silver-500)" }}>Search Radius: </span>
                <span style={{ color: "#f87171", fontWeight: 600 }}>{driftZone.properties.distance_km} km</span>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ color: "var(--silver-500)" }}>Projected Center: </span>
                <span style={{ color: "var(--silver-200)" }}>
                  {driftZone.properties.projected_lat}° N, {driftZone.properties.projected_lon}° W
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Telemetry specs grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "10px",
          }}
        >
          <div className="alert-card" style={{ padding: "10px" }}>
            <div style={{ fontSize: "10px", color: "var(--silver-500)", textTransform: "uppercase" }}>
              Speed Over Ground
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--silver-100)" }}>
              {vessel.sog !== null && vessel.sog !== undefined ? `${Number(vessel.sog).toFixed(1)} kn` : "0.0 kn"}
            </div>
          </div>

          <div className="alert-card" style={{ padding: "10px" }}>
            <div style={{ fontSize: "10px", color: "var(--silver-500)", textTransform: "uppercase" }}>
              Course Over Ground
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--silver-100)" }}>
              {vessel.cog !== null && vessel.cog !== undefined ? `${Number(vessel.cog).toFixed(1)}°` : "N/A"}
            </div>
          </div>

          <div className="alert-card" style={{ padding: "10px" }}>
            <div style={{ fontSize: "10px", color: "var(--silver-500)", textTransform: "uppercase" }}>
              Transceiver Class
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--silver-100)" }}>
              Class {vessel.transceiver_class || "A"}
            </div>
          </div>

          <div className="alert-card" style={{ padding: "10px" }}>
            <div style={{ fontSize: "10px", color: "var(--silver-500)", textTransform: "uppercase" }}>
              Vessel Type
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: "var(--silver-100)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginTop: "2px",
              }}
              title={vesselTypeName}
            >
              {vesselTypeName}
            </div>
            <div style={{ fontSize: "10px", color: "var(--silver-400)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
              {vessel.vessel_type ? `AIS Code: ${vessel.vessel_type}` : "Standard AIS"}
            </div>
          </div>
        </div>

        {/* Vessel Registry & Photography Section */}
        <div className="alert-card" style={{ padding: "12px", border: "1px solid var(--silver-border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--silver-200)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Camera size={14} color="var(--color-active)" />
              <span>VESSEL REGISTRY & PHOTOGRAPHY</span>
            </div>
            <span style={{ fontSize: "10px", color: "var(--silver-400)", fontFamily: "var(--font-mono)" }}>
              {country.flag} {country.code}
            </span>
          </div>

          <div style={{ fontSize: "11px", color: "var(--silver-400)", marginBottom: "10px", lineHeight: "1.4" }}>
            Real-time AIS broadcasts stream telemetry only (no media payloads). Direct links to ship photography galleries and verified global registry:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <a
              href={getMarineTrafficUrl(vessel.mmsi)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: "rgba(14, 165, 233, 0.08)",
                border: "1px solid rgba(14, 165, 233, 0.25)",
                borderRadius: "4px",
                color: "var(--silver-100)",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Ship size={16} color="#0ea5e9" />
                <span>MarineTraffic Photos & Registry</span>
              </div>
              <ExternalLink size={13} color="var(--silver-400)" />
            </a>

            <a
              href={getVesselFinderUrl(vessel.mmsi)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                borderRadius: "4px",
                color: "var(--silver-100)",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Globe size={16} color="#3b82f6" />
                <span>VesselFinder Ship Gallery</span>
              </div>
              <ExternalLink size={13} color="var(--silver-400)" />
            </a>
          </div>
        </div>

        {/* Position details */}
        <div className="alert-card">
          <div style={{ fontSize: "11px", color: "var(--silver-300)", marginBottom: "6px", fontWeight: 600 }}>
            LAST BROADCAST METRICS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
            <div>Coordinates: {vessel.lat.toFixed(5)}° N, {vessel.lon.toFixed(5)}° W</div>
            <div>H3 Cell ID: {vessel.cell || "85283473fffffff"}</div>
            <div>Total Ingested Messages: {vessel.msg_count.toLocaleString()}</div>
            <div>Last Observed: {new Date(vessel.last_seen).toUTCString()}</div>
          </div>
        </div>

        {/* Trajectory Track History */}
        <div>
          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--silver-200)" }}>
            RECENT TRACK HISTORY ({trackPoints.length} WAYPOINTS)
          </div>
          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            {trackPoints.length === 0 ? (
              <div style={{ fontSize: "11px", color: "var(--silver-500)" }}>No track history recorded.</div>
            ) : (
              trackPoints.map((pt, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    background: "rgba(6, 8, 12, 0.75)",
                    border: "1px solid var(--silver-border-subtle)",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>{new Date(pt.ts).toISOString().substring(11, 19)} UTC</span>
                  <span>{pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}</span>
                  <span>{pt.sog !== null && pt.sog !== undefined ? `${Number(pt.sog).toFixed(1)} kn` : "0.0 kn"}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Button: Export Evidence Dossier */}
        <button
          onClick={handleExportDossier}
          className="toggle-btn active"
          style={{
            marginTop: "6px",
            width: "100%",
            justifyContent: "center",
            padding: "8px 12px",
            background: "rgba(30, 41, 59, 0.9)",
            border: "1px solid var(--silver-border-glow)",
          }}
          title="Download complete GeoJSON incident dossier for regulatory or Coast Guard interdiction"
        >
          <Download size={14} />
          <span>EXPORT EVIDENCE DOSSIER (GEOJSON)</span>
        </button>
      </div>
    </div>
  );
}
