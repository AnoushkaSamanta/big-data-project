"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Radio, Activity, RefreshCw, Radar, BookOpen } from "lucide-react";

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  activeCount?: number;
  darkCount?: number;
}

export default function Header({
  onRefresh,
  isRefreshing = false,
  activeCount = 0,
  darkCount = 0,
}: HeaderProps) {
  const [timeStr, setTimeStr] = useState<string>("");
  const pathname = usePathname();

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
          <ShieldAlert size={20} color="#e2e8f0" />
          <span>DARK VESSEL DETECTION</span>
          <span className="brand-subtitle">// LIVE INTELLIGENCE</span>
        </div>

        {/* Primary Navigation */}
        <nav className="header-nav">
          <Link
            href="/"
            className={`nav-link-btn ${pathname === "/" ? "active" : ""}`}
          >
            <Radar size={14} />
            <span>RADAR CONSOLE</span>
          </Link>

          <Link
            href="/docs"
            className={`nav-link-btn ${pathname.startsWith("/docs") || pathname === "/architecture" ? "active" : ""}`}
          >
            <BookOpen size={14} />
            <span>DOCS & ARCHITECTURE</span>
          </Link>
        </nav>
      </div>

      <div className="header-status-group">
        <div className="status-pill">
          <span className={`pulse-dot ${darkCount > 0 ? "alert" : ""}`} />
          <span>
            {darkCount > 0
              ? `${darkCount} ANOMALIES ACTIVE`
              : "RADAR SURVEILLANCE OK"}
          </span>
        </div>

        <div className="status-pill">
          <Radio size={14} color="#10b981" />
          <span>KAFKA: LIVE</span>
        </div>

        <div className="status-pill">
          <Activity size={14} color="#cbd5e1" />
          <span>{timeStr || "SYNCING..."}</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="toggle-btn"
            title="Force refresh database snapshot"
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? "animate-spin" : ""}
            />
            <span>REFRESH</span>
          </button>
        )}
      </div>
    </header>
  );
}
