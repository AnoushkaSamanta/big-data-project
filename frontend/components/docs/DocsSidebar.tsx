"use client";

import { Cpu, Radio, ChevronDown } from "lucide-react";

export interface DocCategory {
  title: string;
  items: {
    id: string;
    label: string;
    badge?: string;
  }[];
}

export const DOC_CATEGORIES: DocCategory[] = [
  {
    title: "Getting Started",
    items: [
      { id: "introduction", label: "What is Dark Vessel Detection?" },
      { id: "quickstart", label: "Installation & Quickstart" },
      { id: "architecture", label: "System Architecture" },
      { id: "ingestion-contract", label: "Data Contract & Sentinels" },
    ],
  },
  {
    title: "Detection Engines",
    items: [
      { id: "coverage-bias", label: "Coverage Prior & VHF Physics", badge: "CORE" },
      { id: "absence-sweeper", label: "Adaptive Absence Sweeper" },
      { id: "gps-spoofing", label: "Jump-and-Return GPS Spoofing" },
      { id: "mpa-loitering", label: "Protected Zone Loitering" },
      { id: "mmsi-collision", label: "MMSI Collision Engine" },
      { id: "isolation-forest", label: "Isolation Forest ML Anomaly" },
    ],
  },
  {
    title: "Streaming Infrastructure",
    items: [
      { id: "kafka-kraft", label: "Kafka KRaft & MMSI Keying" },
      { id: "consumer-dlq", label: "Consumer & Dead-Letter Queue" },
      { id: "postgis-tables", label: "PostGIS Hot/Cold Table Split" },
      { id: "sweeper-daemon", label: "Periodic Sweeper Daemon" },
    ],
  },
  {
    title: "Batch & Analytics",
    items: [
      { id: "prior-pipeline", label: "Empirical Prior Generation" },
      { id: "h3-indexing", label: "H3 Hexagonal Indexing" },
      { id: "feature-engineering", label: "Trajectory Feature Extraction" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { id: "api-vessels", label: "GET /api/vessels" },
      { id: "api-alerts", label: "GET /api/alerts" },
      { id: "api-geofences", label: "GET /api/geofences" },
      { id: "api-metrics", label: "GET /api/metrics" },
      { id: "api-track", label: "GET /api/vessels/[mmsi]/track" },
    ],
  },
  {
    title: "Benchmarks & Interdiction",
    items: [
      { id: "ablation-study", label: "92.9% False Alarm Reduction", badge: "BENCHMARK" },
      { id: "f1-scoreboard", label: "Precision, Recall & F1" },
      { id: "sar-fusion", label: "Satellite SAR Radar Fusion" },
    ],
  },
];

interface DocsSidebarProps {
  activeDocId: string;
  onSelectDoc: (id: string) => void;
}

export default function DocsSidebar({ activeDocId, onSelectDoc }: DocsSidebarProps) {
  return (
    <aside className="docs-sidebar">
      {/* Framework Style Version & Mode Pills */}
      <div className="docs-pill-selector">
        <div className="docs-pill">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Radio size={14} color="#f26522" />
            <span style={{ fontWeight: 600 }}>Streaming KRaft Pipeline</span>
          </div>
          <ChevronDown size={14} color="#64748b" />
        </div>

        <div className="docs-pill">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Cpu size={14} color="#10b981" />
            <span>Latest Engine v1.0.0</span>
          </div>
          <span
            style={{
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            PROD
          </span>
        </div>
      </div>

      {/* Navigation Groups */}
      {DOC_CATEGORIES.map((cat) => (
        <div key={cat.title} className="docs-nav-group">
          <div className="docs-nav-group-title">{cat.title}</div>
          <ul className="docs-nav-list">
            {cat.items.map((item) => {
              const isActive = activeDocId === item.id;
              return (
                <li key={item.id}>
                  <div
                    onClick={() => onSelectDoc(item.id)}
                    className={`docs-nav-item ${isActive ? "active" : ""}`}
                  >
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          fontFamily: "var(--font-mono)",
                          background:
                            item.badge === "CORE"
                              ? "rgba(242, 101, 34, 0.18)"
                              : "rgba(239, 68, 68, 0.18)",
                          color: item.badge === "CORE" ? "#f26522" : "#f87171",
                          padding: "1px 5px",
                          borderRadius: "3px",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
