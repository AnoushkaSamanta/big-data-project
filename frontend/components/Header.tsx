"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";

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
      setTimeStr(now.toISOString().substring(11, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="tactical-header">
      {/* Brand Identity */}
      <div className="header-brand-zone">
        <Link href="/" className="brand-lockup">
          <span className="brand-dot" />
          <span className="brand-title-text">
            DARK <span className="brand-dim">VESSEL</span>
          </span>
        </Link>
      </div>

      {/* Clean Flat Navigation (No pill shape, clean bottom underline on active) */}
      <nav className="header-nav-flat" aria-label="Main Navigation">
        <Link
          href="/"
          className={`nav-flat-link ${pathname === "/" ? "active" : ""}`}
        >
          Radar Console
        </Link>

        <Link
          href="/analytics"
          className={`nav-flat-link ${pathname.startsWith("/analytics") ? "active" : ""}`}
        >
          Analytics
        </Link>

        <Link
          href="/docs"
          className={`nav-flat-link ${pathname.startsWith("/docs") || pathname === "/architecture" ? "active" : ""}`}
        >
          Docs & Architecture
        </Link>
      </nav>

      {/* Clean Inline Telemetry (No pill badges, no blinking animations) */}
      <div className="header-telemetry-zone">
        <div className="telemetry-item">
          <span className="static-dot green" />
          <span className="telemetry-text">Kafka Live</span>
        </div>

        <div className="telemetry-divider" />

        {darkCount > 0 ? (
          <div className="telemetry-item alert">
            <span className="static-dot red" />
            <span className="telemetry-value text-red">{darkCount}</span>
            <span className="telemetry-label">Anomalies</span>
          </div>
        ) : (
          <div className="telemetry-item nominal">
            <span className="static-dot green" />
            <span className="telemetry-text">Nominal</span>
          </div>
        )}

        {activeCount > 0 && (
          <>
            <div className="telemetry-divider" />
            <div className="telemetry-item">
              <span className="telemetry-value">{activeCount.toLocaleString()}</span>
              <span className="telemetry-label">Tracked</span>
            </div>
          </>
        )}

        <div className="telemetry-divider" />

        <div className="telemetry-item clock">
          <span className="telemetry-text mono">{timeStr || "SYNCING..."}</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="header-refresh-btn"
            title="Force refresh database snapshot"
            aria-label="Refresh surveillance data"
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        )}
      </div>
    </header>
  );
}
