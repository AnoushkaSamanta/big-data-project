"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Radio, Activity, RefreshCw } from "lucide-react";

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  activeCount: number;
  darkCount: number;
}

export default function Header({
  onRefresh,
  isRefreshing,
  activeCount,
  darkCount,
}: HeaderProps) {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="tactical-header">
      <div className="brand-section">
        <span className="brand-badge">MDA SEC-04</span>
        <div className="brand-title">
          <ShieldAlert size={20} color="#38bdf8" />
          <span>DARK VESSEL DETECTION SYSTEM</span>
          <span className="brand-subtitle">// REAL-TIME SURVEILLANCE</span>
        </div>
      </div>

      <div className="header-status-group">
        <div className="status-pill">
          <span className={`pulse-dot ${darkCount > 0 ? "alert" : ""}`} />
          <span>
            {darkCount > 0
              ? `${darkCount} ANOMALIES DETECTED`
              : "MONITORING ACTIVE"}
          </span>
        </div>

        <div className="status-pill">
          <Radio size={14} color="#10b981" />
          <span>KAFKA: INGESTING</span>
        </div>

        <div className="status-pill">
          <Activity size={14} color="#38bdf8" />
          <span>TIME: {timeStr || "SYNCING..."}</span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="toggle-btn"
          title="Force refresh database snapshot"
        >
          <RefreshCw
            size={14}
            className={isRefreshing ? "animate-spin" : ""}
          />
          <span>REFRESH</span>
        </button>
      </div>
    </header>
  );
}
