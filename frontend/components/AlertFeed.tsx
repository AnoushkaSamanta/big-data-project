"use client";

import React, { useState } from "react";
import { AlertRecord } from "@/app/api/alerts/route";
import { AlertTriangle, ShieldCheck, Radio, ChevronRight } from "lucide-react";

interface AlertFeedProps {
  alerts: AlertRecord[];
  onSelectMmsi: (mmsi: number) => void;
  selectedMmsi: number | null;
}

export default function AlertFeed({
  alerts,
  onSelectMmsi,
  selectedMmsi,
}: AlertFeedProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const filtered = alerts.filter((a) => {
    if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
                    {alert.alert_type.replace("_", " ")}
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
