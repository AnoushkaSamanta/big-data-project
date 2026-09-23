"use client";

import React, { useMemo, useState, useEffect } from "react";
import { VesselState } from "@/app/api/vessels/route";
import { X, Navigation, ShieldAlert, Download, Radar, Camera, ExternalLink, Ship, Globe } from "lucide-react";
import { computeDriftCone } from "@/lib/drift";
import {
  getVesselCountry,
  getVesselTypeName,
  getMarineTrafficUrl,
  getVesselFinderUrl,
  getVesselPhoto,
  getMotionState,
  getNavStatusName,
  getVoyageDetails,
} from "@/lib/mmsi";

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
  const [realPhoto, setRealPhoto] = useState<string | null>(null);
  const [isRealPhoto, setIsRealPhoto] = useState<boolean>(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  useEffect(() => {
    if (!vessel) return;
    setRealPhoto(null);
    setIsRealPhoto(false);
    setResolvedName(null);

    let isMounted = true;
    fetch(`/api/vessels/${vessel.mmsi}/photo`)
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.photo_url && data.is_real_photo) {
          setRealPhoto(data.photo_url);
          setIsRealPhoto(true);
        }
        if (data.vessel_name && !vessel.vessel_name) {
          setResolvedName(data.vessel_name);
        }
      })
      .catch((err) => console.debug("Photo fetch error:", err));

    return () => {
      isMounted = false;
    };
  }, [vessel?.mmsi]);

  if (!vessel) return null;

  const country = getVesselCountry(vessel.mmsi);
  const vesselTypeName = getVesselTypeName(vessel.vessel_type);
  const photo = getVesselPhoto(vessel.vessel_type, vessel.mmsi);
  const motion = getMotionState(vessel.sog, vessel.status);
  const navStatus = getNavStatusName(null, vessel.sog);
  const voyage = getVoyageDetails(vessel.mmsi, vessel.vessel_type, vessel.last_seen);
  const activeName = vessel.vessel_name || resolvedName || `VESSEL ${vessel.mmsi}`;
  const activePhotoUrl = realPhoto || photo.url;

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
          vessel_name: activeName !== `VESSEL ${vessel.mmsi}` ? activeName : null,
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
            name: `Last Known Position - ${activeName}`,
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
              {activeName}
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
        {/* 1. Hero Vessel Photography Banner (MarineTraffic-Style) */}
        <div className="vessel-photo-banner">
          <img
            src={activePhotoUrl}
            alt={activeName}
            className="vessel-photo-img"
          />
          <div className="vessel-photo-overlay">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(10, 15, 26, 0.88)",
                    backdropFilter: "blur(6px)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    border: "1px solid var(--silver-border-subtle)",
                  }}
                >
                  <span className={`motion-beacon ${motion.statusClass}`} />
                  <span style={{ color: motion.color }}>{motion.label}</span>
                </span>

                {isRealPhoto ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "rgba(16, 185, 129, 0.25)",
                      backdropFilter: "blur(6px)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      color: "#34d399",
                      border: "1px solid rgba(52, 211, 153, 0.6)",
                      boxShadow: "0 0 8px rgba(16, 185, 129, 0.3)",
                    }}
                    title="Verified real photograph of this specific ship from maritime spotter registry"
                  >
                    <Camera size={11} />
                    <span>VERIFIED SHIP PHOTO</span>
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "rgba(10, 15, 26, 0.85)",
                      backdropFilter: "blur(6px)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--silver-400)",
                      border: "1px solid var(--silver-border-subtle)",
                    }}
                    title="Real maritime photography for this vessel class (specific spotter photo pending)"
                  >
                    <Camera size={11} />
                    <span>CLASS PHOTO</span>
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <a
                  href={getVesselFinderUrl(vessel.mmsi)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "rgba(10, 15, 26, 0.88)",
                    backdropFilter: "blur(6px)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    color: "#34d399",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    textDecoration: "none",
                    border: "1px solid rgba(52, 211, 153, 0.3)",
                    fontFamily: "var(--font-mono)",
                  }}
                  title="View hull in VesselFinder Spotter Database"
                >
                  <span>VesselFinder</span>
                  <ExternalLink size={10} />
                </a>

                <a
                  href={getMarineTrafficUrl(vessel.mmsi)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "rgba(10, 15, 26, 0.88)",
                    backdropFilter: "blur(6px)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    color: "#38bdf8",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    textDecoration: "none",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    fontFamily: "var(--font-mono)",
                  }}
                  title="View hull in MarineTraffic AIS Fleet Database"
                >
                  <span>MarineTraffic</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>

            <div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.02em", textShadow: "0 2px 8px rgba(0,0,0,0.85)" }}>
                {activeName}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--silver-300)", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
                <span>{country.flag} {country.country}</span>
                <span>•</span>
                <span>{vesselTypeName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. MarineTraffic Voyage Corridor & Progress Timeline */}
        <div className="voyage-timeline">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
            <div>
              <div style={{ color: "var(--silver-500)", fontSize: "10px", textTransform: "uppercase" }}>Origin (ATD)</div>
              <div style={{ fontWeight: 700, color: "var(--silver-100)", fontSize: "13px" }}>{voyage.originCode}</div>
              <div style={{ color: "var(--silver-400)", fontSize: "10px" }}>{voyage.originName}</div>
            </div>
            <div style={{ textAlign: "center", color: "#38bdf8", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", padding: "0 8px" }}>
              <span>───</span>
              <Ship size={14} />
              <span>───➔</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--silver-500)", fontSize: "10px", textTransform: "uppercase" }}>Destination (ETA)</div>
              <div style={{ fontWeight: 700, color: "var(--silver-100)", fontSize: "13px" }}>{voyage.destCode}</div>
              <div style={{ color: "var(--silver-400)", fontSize: "10px" }}>{voyage.destName}</div>
            </div>
          </div>

          {/* Voyage Progress Track */}
          <div className="voyage-progress-track">
            <div className="voyage-progress-fill" style={{ width: `${voyage.progressPercent}%` }} />
            <div className="voyage-ship-marker" style={{ left: `${voyage.progressPercent}%` }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--silver-400)", fontFamily: "var(--font-mono)" }}>
            <span>ATD: {voyage.atd}</span>
            <span>ETA: {voyage.eta}</span>
          </div>
        </div>

        {/* 3. Live Moving & Navigational Status Banner */}
        <div
          style={{
            background: motion.isMoving ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
            border: `1px solid ${motion.isMoving ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
            borderRadius: "6px",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className={`motion-beacon ${motion.statusClass}`} />
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: motion.color, fontFamily: "var(--font-mono)" }}>
                NAV STATUS: {navStatus.toUpperCase()}
              </div>
              <div style={{ fontSize: "10px", color: "var(--silver-400)" }}>
                {motion.isMoving
                  ? `Vessel underway at ${Number(vessel.sog).toFixed(1)} kn along course ${Number(vessel.cog).toFixed(0)}°`
                  : "Vessel stationary / moored in harbor or anchorage"}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
            <div style={{ color: "var(--silver-500)", fontSize: "10px", textTransform: "uppercase" }}>DRAUGHT</div>
            <div style={{ fontWeight: 700, color: "var(--silver-100)", fontSize: "12px" }}>{voyage.draughtMeters} m</div>
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
              Navigational Status
            </div>
            <div style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--silver-100)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "4px" }} title={navStatus}>
              {navStatus}
            </div>
          </div>

          <div className="alert-card" style={{ padding: "10px" }}>
            <div style={{ fontSize: "10px", color: "var(--silver-500)", textTransform: "uppercase" }}>
              Vessel Type
            </div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: "var(--silver-100)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginTop: "4px",
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
