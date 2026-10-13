"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw, Zap, ChevronDown, CheckCircle2 } from "lucide-react";

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  activeCount?: number;
  darkCount?: number;
  onInjectSuccess?: (data: any) => void;
}

const INJECTION_OPTIONS = [
  { id: "spoof", label: "GPS Teleportation (Spoof)", mmsi: 369888777, desc: "Jump-and-return 150 km at 4,800 kn" },
  { id: "collision", label: "MMSI Identity Collision", mmsi: 368111222, desc: "Cloned transponder in SF & LA" },
  { id: "loiter", label: "MPA Protected Loitering", mmsi: 366234890, desc: "Lingering in Farallones sanctuary at 0.6 kn" },
  { id: "rendezvous", label: "Ship-to-Ship Rendezvous", mmsi: 367111001, desc: "Offshore transshipment meeting <85m apart" },
  { id: "dark", label: "Coverage-Gated Dark Vessel", mmsi: 367999888, desc: "AIS transponder disabled at sea" },
  { id: "ml_anomaly", label: "ML Trajectory Outlier", mmsi: 369555444, desc: "High tortuosity & heading divergence (Isolation Forest)" },
];

export default function Header({
  onRefresh,
  isRefreshing = false,
  activeCount = 0,
  darkCount = 0,
  onInjectSuccess,
}: HeaderProps) {
  const [timeStr, setTimeStr] = useState<string>("");
  const [injectOpen, setInjectOpen] = useState<boolean>(false);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [injectToast, setInjectToast] = useState<string | null>(null);
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

  const handleInject = async (scenarioId: string) => {
    try {
      setIsInjecting(true);
      setInjectOpen(false);
      const res = await fetch("/api/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenarioId }),
      });
      const data = await res.json();
      if (res.ok) {
        setInjectToast(`✓ Injected ${data.alert_type.toUpperCase()} on MMSI ${data.mmsi}`);
        setTimeout(() => setInjectToast(null), 4000);
        if (onRefresh) onRefresh();
        if (onInjectSuccess) onInjectSuccess(data);
      } else {
        alert(`Injection failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Injection request error: ${err.message}`);
    } finally {
      setIsInjecting(false);
    }
  };

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

      {/* Clean Flat Navigation */}
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

      {/* Tactical Injection and Telemetry Controls */}
      <div className="header-telemetry-zone">
        {/* Anomaly Injection Trigger */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setInjectOpen((prev) => !prev)}
            disabled={isInjecting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: injectOpen ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#fca5a5",
              fontSize: "11px",
              fontWeight: 700,
              padding: "5px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.5px",
              transition: "all 0.15s ease",
            }}
            title="Inject real-time maritime anomaly scenario into stream"
          >
            <Zap size={13} color="#ef4444" className={isInjecting ? "animate-pulse" : ""} />
            <span>{isInjecting ? "INJECTING..." : "INJECT SCENARIO"}</span>
            <ChevronDown size={11} />
          </button>

          {injectOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: "280px",
                background: "rgba(10, 15, 26, 0.96)",
                border: "1px solid var(--silver-border)",
                borderRadius: "6px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
                backdropFilter: "blur(12px)",
                padding: "6px",
                zIndex: 9999,
              }}
            >
              <div
                style={{
                  fontSize: "9.5px",
                  fontWeight: 700,
                  letterSpacing: "0.8px",
                  color: "var(--silver-400)",
                  padding: "6px 8px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                  marginBottom: "4px",
                }}
              >
                LIVE STREAM ANOMALY INJECTION
              </div>
              {INJECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleInject(opt.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--silver-100)" }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--silver-400)" }}>
                      MMSI {opt.mmsi}
                    </span>
                  </div>
                  <span style={{ fontSize: "9.5px", color: "var(--silver-400)" }}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {injectToast && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#6ee7b7",
              fontSize: "11px",
              padding: "4px 9px",
              borderRadius: "4px",
              fontFamily: "var(--font-mono)",
            }}
          >
            <CheckCircle2 size={12} color="#10b981" />
            <span>{injectToast}</span>
          </div>
        )}

        <div className="telemetry-divider" />

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
