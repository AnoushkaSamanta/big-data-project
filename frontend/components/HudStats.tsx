"use client";

import React from "react";
import { Ship, AlertTriangle, Cpu, Gauge, Zap, GlobeLock } from "lucide-react";

interface HudStatsProps {
  activeVessels: number;
  darkVessels: number;
  alerts24h: number;
  msgsConsumedPerS: number;
  consumerLag: number;
  dlqRate: number;
}

export default function HudStats({
  activeVessels,
  darkVessels,
  alerts24h,
  msgsConsumedPerS,
  consumerLag,
  dlqRate,
}: HudStatsProps) {
  return (
    <div className="hud-bar">
      <div className="hud-card success">
        <div className="hud-icon">
          <Ship size={18} />
        </div>
        <div className="hud-meta">
          <span className="hud-label">Active Vessels</span>
          <span className="hud-value">{activeVessels.toLocaleString()}</span>
        </div>
      </div>

      <div className={`hud-card ${darkVessels > 0 ? "danger" : ""}`}>
        <div className="hud-icon">
          <AlertTriangle size={18} />
        </div>
        <div className="hud-meta">
          <span className="hud-label">Dark Vessel Alerts</span>
          <span className="hud-value" style={{ color: darkVessels > 0 ? "var(--color-dark)" : "var(--silver-100)" }}>
            {darkVessels}
          </span>
        </div>
      </div>

      <div className="hud-card">
        <div className="hud-icon">
          <Zap size={18} />
        </div>
        <div className="hud-meta">
          <span className="hud-label">Ingest Rate</span>
          <span className="hud-value">
            {msgsConsumedPerS.toLocaleString()} <small style={{ fontSize: "11px", color: "var(--silver-400)" }}>msg/s</small>
          </span>
        </div>
      </div>

      <div className="hud-card">
        <div className="hud-icon">
          <Gauge size={18} />
        </div>
        <div className="hud-meta">
          <span className="hud-label">Consumer Lag</span>
          <span className="hud-value" style={{ color: consumerLag > 5000 ? "var(--color-stale)" : "var(--silver-100)" }}>
            {consumerLag.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="hud-card">
        <div className="hud-icon">
          <Cpu size={18} />
        </div>
        <div className="hud-meta">
          <span className="hud-label">DLQ Reject Rate</span>
          <span className="hud-value">{(dlqRate * 100).toFixed(2)}%</span>
        </div>
      </div>

      <div className="hud-card">
        <div className="hud-icon">
          <GlobeLock size={18} />
        </div>
        <div className="hud-meta">
          <span className="hud-label">Coverage Gate</span>
          <span className="hud-value" style={{ color: "var(--silver-200)", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--silver-200)", boxShadow: "0 0 8px rgba(226, 232, 240, 0.8)" }} />
            H3 RES 5 ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}
