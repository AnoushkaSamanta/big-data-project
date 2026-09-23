"use client";

import React, { useState, useMemo } from "react";
import { AlertRecord } from "@/app/api/alerts/route";
import { ShieldCheck, ChevronRight, Search, X } from "lucide-react";

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

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
      if (filterType !== "all" && a.alert_type !== filterType) return false;
      if (searchMmsi.trim()) {
        const query = searchMmsi.trim();
        const mmsiStr = String(a.mmsi);
        const partnerStr = a.details?.partner_mmsi ? String(a.details.partner_mmsi) : "";
        if (!mmsiStr.includes(query) && !partnerStr.includes(query)) return false;
      }
      return true;
    });
  }, [alerts, filterSeverity, filterType, searchMmsi]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Quick Search Input */}
      <div style={{ position: "relative", marginBottom: "8px" }}>
        <input
          type="text"
          value={searchMmsi}
          onChange={(e) => setSearchMmsi(e.target.value)}
          placeholder="Filter by MMSI..."
          style={{
            width: "100%",
            background: "rgba(10, 15, 26, 0.8)",
            border: "1px solid var(--silver-border-subtle)",
            borderRadius: "4px",
            padding: "6px 28px 6px 26px",
            fontSize: "11px",
            color: "var(--silver-100)",
            fontFamily: "var(--font-mono)",
            outline: "none",
          }}
        />
        <Search
          size={12}
          color="var(--silver-400)"
          style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }}
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

      {/* Anomaly Type Filter Pills (Horizontal scrollable) */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "8px",
          overflowX: "auto",
          paddingBottom: "2px",
        }}
      >
        {ANOMALY_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterType(t.id)}
            className={`tab-btn ${filterType === t.id ? "active" : ""}`}
            style={{ fontSize: "10px", padding: "3px 7px", whiteSpace: "nowrap" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Severity Filter pills */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        {["all", "high", "medium", "low"].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`tab-btn ${filterSeverity === sev ? "active" : ""}`}
            style={{ textTransform: "uppercase" }}
          >
            {sev}
          </button>
        ))}
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
              (Date.now() - new Date(alert.detected_at).getTime()) / 60000
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="alert-mmsi">MMSI {alert.mmsi}</span>
                    <span style={{ fontSize: "11px", color: "var(--silver-500)", fontFamily: "var(--font-mono)" }}>
                      {timeAgo > 0 ? `${timeAgo}m ago` : "just now"}
                    </span>
                  </div>

                  {alert.details?.zone && (
                    <div className="alert-reason">
                      Region: <span style={{ color: "var(--silver-100)" }}>{alert.details.zone}</span>
                    </div>
                  )}

                  {alert.details?.partner_mmsi && (
                    <div className="alert-reason">
                      Encounter Partner: <span style={{ color: "var(--color-stale)", fontWeight: 700 }}>MMSI {alert.details.partner_mmsi}</span>
                    </div>
                  )}
                </div>

                {/* Evidence audit card */}
                {alert.details && (
                  <div className="evidence-grid">
                    {alert.details.gap_s !== undefined && (
                      <div className="evidence-cell">
                        <span>Observed Gap</span>
                        <span style={{ color: "var(--color-dark)" }}>
                          {(alert.details.gap_s / 3600).toFixed(1)} hrs
                        </span>
                      </div>
                    )}

                    {alert.details.p99_gap_s !== undefined && (
                      <div className="evidence-cell">
                        <span>Expected p99</span>
                        <span>{(alert.details.p99_gap_s / 60).toFixed(0)} min</span>
                      </div>
                    )}

                    {alert.details.distance_m !== undefined && (
                      <div className="evidence-cell">
                        <span>STS Distance</span>
                        <span style={{ color: "var(--color-stale)" }}>{alert.details.distance_m} m</span>
                      </div>
                    )}

                    {alert.details.coverage_n !== undefined && (
                      <div className="evidence-cell">
                        <span>Coverage Obs</span>
                        <span>{alert.details.coverage_n.toLocaleString()}</span>
                      </div>
                    )}

                    {alert.details.transceiver_class && (
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
