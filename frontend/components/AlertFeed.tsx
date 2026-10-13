"use client";

import React, { useState, useMemo, useEffect } from "react";
import { AlertRecord } from "@/app/api/alerts/route";
import { ShieldCheck, ChevronRight, Search, X } from "lucide-react";
import { getVesselCountry } from "@/lib/mmsi";

interface AlertFeedProps {
  alerts: AlertRecord[];
  onSelectMmsi: (mmsi: number) => void;
  selectedMmsi: number | null;
}

const ANOMALY_TYPES = [
  { id: "all", label: "ALL" },
  { id: "dark_vessel", label: "DARK" },
  { id: "rendezvous_sts", label: "RENDEZVOUS" },
  { id: "spoof", label: "SPOOF" },
  { id: "loiter", label: "LOITER" },
  { id: "mmsi_collision", label: "COLLISION" },
  { id: "ml_anomaly", label: "ML" },
];

export default function AlertFeed({
  alerts,
  onSelectMmsi,
  selectedMmsi,
}: AlertFeedProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchMmsi, setSearchMmsi] = useState<string>("");
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
      if (filterType !== "all" && a.alert_type !== filterType) return false;
      if (searchMmsi.trim()) {
        const query = searchMmsi.trim().toLowerCase();
        const mmsiStr = String(a.mmsi);
        const nameStr = (a.vessel_name || "").toLowerCase();
        const country = getVesselCountry(a.mmsi);
        const countryStr = country.country.toLowerCase();
        const partnerStr = a.details?.partner_mmsi ? String(a.details.partner_mmsi) : "";
        if (
          !mmsiStr.includes(query) &&
          !nameStr.includes(query) &&
          !countryStr.includes(query) &&
          !partnerStr.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, filterSeverity, filterType, searchMmsi]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: alerts.length };
    for (const a of alerts) {
      counts[a.alert_type] = (counts[a.alert_type] || 0) + 1;
    }
    return counts;
  }, [alerts]);

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { all: alerts.length };
    for (const a of alerts) {
      counts[a.severity] = (counts[a.severity] || 0) + 1;
    }
    return counts;
  }, [alerts]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Quick Search Input */}
      <div style={{ position: "relative", marginBottom: "10px" }}>
        <input
          type="text"
          value={searchMmsi}
          onChange={(e) => setSearchMmsi(e.target.value)}
          placeholder="Filter alerts by MMSI or country..."
          style={{
            width: "100%",
            background: "rgba(10, 15, 26, 0.8)",
            border: "1px solid var(--silver-border-subtle)",
            borderRadius: "4px",
            padding: "7px 28px 7px 28px",
            fontSize: "11px",
            color: "var(--silver-100)",
            fontFamily: "var(--font-mono)",
            outline: "none",
          }}
        />
        <Search
          size={13}
          color="var(--silver-400)"
          style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)" }}
        />
        {searchMmsi && (
          <button
            onClick={() => setSearchMmsi("")}
            style={{
              position: "absolute",
              right: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--silver-400)",
              padding: "2px",
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Detection Engine / Anomaly Type Filter Pills (Wrap so none are hidden) */}
      <div style={{ marginBottom: "10px" }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--silver-400)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "6px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Detection Engine / Category</span>
          <span style={{ color: "var(--silver-300)", fontFamily: "var(--font-mono)" }}>
            {filtered.length} visible
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "5px",
          }}
        >
          {ANOMALY_TYPES.map((t) => {
            const count = typeCounts[t.id] || 0;
            const isSelected = filterType === t.id;
            const isML = t.id === "ml_anomaly";

            return (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id)}
                className={`tab-btn ${isSelected ? "active" : ""}`}
                style={{
                  fontSize: "10.5px",
                  padding: "4px 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  borderRadius: "4px",
                  background: isSelected
                    ? isML
                      ? "rgba(168, 85, 247, 0.25)"
                      : "var(--bg-card)"
                    : isML
                    ? "rgba(168, 85, 247, 0.1)"
                    : "rgba(255, 255, 255, 0.03)",
                  border: isSelected
                    ? isML
                      ? "1px solid #c084fc"
                      : "1px solid var(--silver-border)"
                    : isML
                    ? "1px solid rgba(168, 85, 247, 0.4)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  color: isSelected
                    ? isML
                      ? "#f3e8ff"
                      : "var(--silver-100)"
                    : isML
                    ? "#d8b4fe"
                    : "var(--silver-400)",
                  cursor: "pointer",
                }}
              >
                <span>{t.label}</span>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "8px",
                    background: isSelected
                      ? isML
                        ? "#9333ea"
                        : "rgba(255, 255, 255, 0.18)"
                      : "rgba(255, 255, 255, 0.07)",
                    color: isSelected ? "#ffffff" : isML ? "#e9d5ff" : "var(--silver-400)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Severity Filter pills */}
      <div style={{ marginBottom: "12px" }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--silver-400)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "6px",
          }}
        >
          <span>Severity Filter</span>
        </div>
        <div style={{ display: "flex", gap: "5px" }}>
          {["all", "high", "medium", "low"].map((sev) => {
            const count = severityCounts[sev] || 0;
            const isSelected = filterSeverity === sev;
            return (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`tab-btn ${isSelected ? "active" : ""}`}
                style={{
                  textTransform: "uppercase",
                  flex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  padding: "5px 6px",
                  fontSize: "10px",
                }}
              >
                <span>{sev}</span>
                <span style={{ fontSize: "9px", opacity: 0.7, fontFamily: "var(--font-mono)" }}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: "#64748b", textAlign: "center", padding: "30px 0", fontSize: "13px" }}>
          <ShieldCheck size={32} color="#10b981" style={{ margin: "0 auto 8px" }} />
          <div>No active alerts in this category.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>
          {filtered.map((alert) => {
            const isSelected = selectedMmsi === alert.mmsi;
            const timeAgo = Math.round(
              (now - new Date(alert.detected_at).getTime()) / 60000
            );
            const country = getVesselCountry(alert.mmsi);
            const hasEvidence = Boolean(
              alert.details &&
                (alert.details.implied_speed_knots !== undefined ||
                  alert.details.speed_ceiling_knots !== undefined ||
                  alert.details.dist_km !== undefined ||
                  alert.details.jump_dist_km !== undefined ||
                  alert.details.pattern ||
                  alert.details.gap_s !== undefined ||
                  alert.details.p99_gap_s !== undefined ||
                  alert.details.distance_m !== undefined ||
                  alert.details.distance_km !== undefined ||
                  alert.details.loiter_hours !== undefined ||
                  alert.details.avg_speed_knots !== undefined ||
                  alert.details.reconstruction_error !== undefined ||
                  alert.details.raw_decision_score !== undefined ||
                  alert.details.tortuosity !== undefined ||
                  alert.details.top_contributing_features !== undefined ||
                  alert.details.coverage_n !== undefined ||
                  alert.details.transceiver_class)
            );

            return (
              <div
                key={alert.id}
                onClick={() => onSelectMmsi(alert.mmsi)}
                className="alert-card"
                style={{
                  borderColor: isSelected ? "var(--silver-200)" : undefined,
                  boxShadow: isSelected ? "0 0 16px rgba(226, 232, 240, 0.22)" : undefined,
                }}
              >
                <div className="alert-top">
                  <span className={`alert-badge ${alert.severity}`}>
                    {alert.alert_type.replace(/_/g, " ")}
                  </span>
                  <span className="alert-score">SCORE: {alert.score.toFixed(1)}x</span>
                </div>

                <div className="alert-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "15px", lineHeight: 1 }} title={`${country.country} (${country.code})`}>
                          {country.flag}
                        </span>
                        <span className="alert-mmsi" style={{ fontWeight: 700 }}>
                          {alert.vessel_name || `MMSI ${alert.mmsi}`}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--silver-400)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                        {country.country} • MMSI {alert.mmsi}
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--silver-500)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                      {timeAgo > 0 ? `${timeAgo}m ago` : "just now"}
                    </span>
                  </div>

                  {alert.details?.zone && (
                    <div className="alert-reason" style={{ marginTop: "4px" }}>
                      Region: <span style={{ color: "var(--silver-100)" }}>{alert.details.zone}</span>
                    </div>
                  )}

                  {alert.details?.partner_mmsi && (
                    <div className="alert-reason" style={{ marginTop: "4px" }}>
                      Encounter Partner: <span style={{ color: "var(--color-stale)", fontWeight: 700 }}>MMSI {alert.details.partner_mmsi}</span>
                    </div>
                  )}
                </div>

                {/* Evidence audit card */}
                {hasEvidence && (
                  <div className="evidence-grid">
                    {/* Spoofing telemetry */}
                    {alert.details?.implied_speed_knots !== undefined && (
                      <div className="evidence-cell">
                        <span>Implied Speed</span>
                        <span style={{ color: "var(--color-dark)", fontWeight: 700 }}>
                          {Number(alert.details.implied_speed_knots).toFixed(1)} kn
                        </span>
                      </div>
                    )}

                    {alert.details?.speed_ceiling_knots !== undefined && (
                      <div className="evidence-cell">
                        <span>Speed Ceiling</span>
                        <span>{Number(alert.details.speed_ceiling_knots).toFixed(0)} kn</span>
                      </div>
                    )}

                    {alert.details?.dist_km !== undefined && (
                      <div className="evidence-cell">
                        <span>Displacement</span>
                        <span>{Number(alert.details.dist_km).toFixed(1)} km</span>
                      </div>
                    )}

                    {alert.details?.jump_dist_km !== undefined && (
                      <div className="evidence-cell">
                        <span>Jump Distance</span>
                        <span style={{ color: "var(--color-stale)" }}>
                          {Number(alert.details.jump_dist_km).toFixed(1)} km
                        </span>
                      </div>
                    )}

                    {alert.details?.pattern && (
                      <div className="evidence-cell">
                        <span>Pattern</span>
                        <span style={{ textTransform: "capitalize", color: "var(--silver-200)" }}>
                          {String(alert.details.pattern).replace(/_/g, " ")}
                        </span>
                      </div>
                    )}

                    {/* Dark Vessel gap */}
                    {alert.details?.gap_s !== undefined && (
                      <div className="evidence-cell">
                        <span>Observed Gap</span>
                        <span style={{ color: "var(--color-dark)" }}>
                          {(alert.details.gap_s / 3600).toFixed(1)} hrs
                        </span>
                      </div>
                    )}

                    {alert.details?.p99_gap_s !== undefined && (
                      <div className="evidence-cell">
                        <span>Expected p99</span>
                        <span>{(alert.details.p99_gap_s / 60).toFixed(0)} min</span>
                      </div>
                    )}

                    {/* Rendezvous / STS */}
                    {alert.details?.distance_m !== undefined && (
                      <div className="evidence-cell">
                        <span>STS Distance</span>
                        <span style={{ color: "var(--color-stale)" }}>{alert.details.distance_m} m</span>
                      </div>
                    )}

                    {/* MMSI Collision */}
                    {alert.details?.distance_km !== undefined && alert.details?.dist_km === undefined && (
                      <div className="evidence-cell">
                        <span>Separation</span>
                        <span style={{ color: "var(--color-dark)" }}>
                          {Number(alert.details.distance_km).toFixed(1)} km
                        </span>
                      </div>
                    )}

                    {/* Loitering */}
                    {alert.details?.loiter_hours !== undefined && (
                      <div className="evidence-cell">
                        <span>Loiter Time</span>
                        <span style={{ color: "var(--color-stale)" }}>
                          {Number(alert.details.loiter_hours).toFixed(1)} hrs
                        </span>
                      </div>
                    )}

                    {/* ML Anomaly */}
                    {alert.details?.raw_decision_score !== undefined && (
                      <div className="evidence-cell">
                        <span>Decision Score</span>
                        <span style={{ color: "var(--color-dark)" }}>
                          {Number(alert.details.raw_decision_score).toFixed(3)}
                        </span>
                      </div>
                    )}

                    {alert.details?.tortuosity !== undefined && (
                      <div className="evidence-cell">
                        <span>Tortuosity</span>
                        <span>{Number(alert.details.tortuosity).toFixed(2)}</span>
                      </div>
                    )}

                    {alert.details?.window_pings !== undefined && (
                      <div className="evidence-cell">
                        <span>Window Pings</span>
                        <span>{alert.details.window_pings} pings</span>
                      </div>
                    )}

                    {alert.details?.top_contributing_features && alert.details.top_contributing_features.length > 0 && (
                      <div className="evidence-cell" style={{ gridColumn: "span 2" }}>
                        <span>Top Feature Anomaly</span>
                        <span style={{ color: "var(--color-stale)" }}>
                          {alert.details.top_contributing_features[0].feature} ({alert.details.top_contributing_features[0].z_score}σ)
                        </span>
                      </div>
                    )}

                    {alert.details?.reconstruction_error !== undefined && (
                      <div className="evidence-cell">
                        <span>Recon Error</span>
                        <span style={{ color: "var(--color-dark)" }}>
                          {Number(alert.details.reconstruction_error).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {alert.details?.coverage_n !== undefined && (
                      <div className="evidence-cell">
                        <span>Coverage Obs</span>
                        <span>{alert.details.coverage_n.toLocaleString()}</span>
                      </div>
                    )}

                    {alert.details?.transceiver_class && (
                      <div className="evidence-cell">
                        <span>Class</span>
                        <span>Class {alert.details.transceiver_class}</span>
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "4px",
                    fontSize: "11px",
                    color: "var(--silver-300)",
                    marginTop: "4px",
                    fontWeight: 500,
                  }}
                >
                  <span>Inspect Vessel Track</span>
                  <ChevronRight size={13} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
