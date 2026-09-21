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
          <Navigation size={18} color="var(--silver-200)" />
          <span>VESSEL DRILLDOWN // {vessel.mmsi}</span>
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

      <div className="drawer-content">
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
              Vessel Type Code
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--silver-100)" }}>
              {vessel.vessel_type || "Unknown"}
            </div>
          </div>
        </div>

        {/* Position details */}
        <div className="alert-card" style={{ marginTop: "8px" }}>
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
        <div style={{ marginTop: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--silver-200)" }}>
            RECENT TRACK HISTORY ({trackPoints.length} WAYPOINTS)
          </div>
          <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
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
      </div>
    </div>
  );
}
