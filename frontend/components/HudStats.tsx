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
          <span className="hud-value" style={{ color: darkVessels > 0 ? "#ef4444" : undefined }}>
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
            {msgsConsumedPerS.toLocaleString()} <small style={{ fontSize: "11px", color: "#94a3b8" }}>msg/s</small>
          </span>
        </div>
      </div>

      <div className="hud-card">
        <div className="hud-icon">
          <Gauge size={18} />
        </div>
        <div className="hud-meta">
          <span className="hud-label">Consumer Lag</span>
          <span className="hud-value" style={{ color: consumerLag > 5000 ? "#f59e0b" : undefined }}>
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
          <span className="hud-value" style={{ color: "#38bdf8", fontSize: "15px" }}>
            H3 RES 5 ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}
