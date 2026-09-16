"use client";

import React from "react";
import { VesselState } from "@/app/api/vessels/route";
import { X, Navigation, Anchor, Compass, Clock, Radio, ShieldAlert } from "lucide-react";

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

  return (
    <div className="side-drawer" style={{ position: "absolute", right: 0, top: 0, bottom: 0 }}>
      <div className="drawer-header">
        <div className="drawer-title">
          <Navigation size={18} color="#38bdf8" />
          <span>VESSEL DRILLDOWN // {vessel.mmsi}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="drawer-content">
        {/* Status header banner */}
        <div
          style={{
            background:
              vessel.status === "dark"
                ? "rgba(239, 68, 68, 0.15)"
                : vessel.status === "stale"
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(16, 185, 129, 0.15)",
            border: `1px solid ${
              vessel.status === "dark"
                ? "#ef4444"
                : vessel.status === "stale"
                ? "#f59e0b"
                : "#10b981"
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
                ? "#ef4444"
                : vessel.status === "stale"
                ? "#f59e0b"
                : "#10b981"
            }
          />
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                textTransform: "uppercase",
                fontFamily: "var(--font-mono)",
              }}
            >
              STATUS: {vessel.status}
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              {vessel.status === "dark"
                ? "AIS broadcast halted while remaining at sea"
                : "Normal reporting activity detected"}
            </div>
          </div>
        </div>

        {/* Telemetry specs grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "10px",
            marginTop: "8px",
          }}
        >
          <div className="alert-card" style={{ padding: "10px" }}>
            <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>
              Speed Over Ground
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#38bdf8" }}>
              {vessel.sog !== null ? `${vessel.sog} kn` : "N/A"}
            </div>
          </div>

          <div className="alert-card" style={{ padding: "10px" }}>
            <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>
              Course Over Ground
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#38bdf8" }}>
              {vessel.cog !== null ? `${vessel.cog}°` : "N/A"}
            </div>
          </div>

          <div className="alert-card" style={{ padding: "10px" }}>
            <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>
              Transceiver Class
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#f8fafc" }}>
              Class {vessel.transceiver_class || "A"}
            </div>
          </div>

          <div className="alert-card" style={{ padding: "10px" }}>
            <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>
              Vessel Type Code
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#f8fafc" }}>
              {vessel.vessel_type || "Unknown"}
            </div>
          </div>
        </div>

        {/* Position details */}
        <div className="alert-card" style={{ marginTop: "8px" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px", fontWeight: 600 }}>
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
        <div style={{ marginTop: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#38bdf8" }}>
            RECENT TRACK HISTORY ({trackPoints.length} WAYPOINTS)
          </div>
          <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            {trackPoints.length === 0 ? (
              <div style={{ fontSize: "11px", color: "#64748b" }}>No track history recorded.</div>
            ) : (
              trackPoints.map((pt, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    background: "rgba(4, 9, 20, 0.6)",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>{new Date(pt.ts).toISOString().substring(11, 19)} UTC</span>
                  <span>{pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}</span>
                  <span>{pt.sog !== undefined ? `${pt.sog} kn` : ""}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
