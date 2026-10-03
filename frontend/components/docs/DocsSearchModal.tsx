"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  category: string;
  snippet: string;
}

const SEARCH_INDEX: SearchResult[] = [
  {
    id: "introduction",
    title: "What is Dark Vessel Detection?",
    category: "Getting Started",
    snippet: "Overview of illegal, unreported, and unregulated (IUU) fishing, transshipment, and AIS broadcast suppression.",
  },
  {
    id: "quickstart",
    title: "Installation & Quickstart",
    category: "Getting Started",
    snippet: "Run make up, make stream, and deploy Kafka, PostGIS, and Next.js locally in 3 minutes.",
  },
  {
    id: "architecture",
    title: "System Architecture",
    category: "Getting Started",
    snippet: "End-to-end data pipeline from live WebSocket ingestion to Kafka KRaft, PostGIS, and Deck.gl WebGL maps.",
  },
  {
    id: "ingestion-contract",
    title: "Data Contract & Sentinels",
    category: "Getting Started",
    snippet: "Standard AIS normalization for 102.3 kn SOG, 360° COG, 511° heading, and Dead-Letter Queue (DLQ) routing.",
  },
  {
    id: "coverage-bias",
    title: "Coverage Prior & VHF Physics",
    category: "Detection Engines",
    snippet: "VHF terrestrial horizon limitations, why 3-hour timeouts trigger 58.8% false alarms, and H3 empirical priors.",
  },
  {
    id: "absence-sweeper",
    title: "Adaptive Absence Sweeper",
    category: "Detection Engines",
    snippet: "Periodic sweeper evaluating Score = (T_now - T_last) / p99(cell, class) with 500-observation gating.",
  },
  {
    id: "gps-spoofing",
    title: "Jump-and-Return GPS Spoofing",
    category: "Detection Engines",
    snippet: "3-ping kinematic vectors, speed ceiling violations, and return-leg trajectory validation.",
  },
  {
    id: "mpa-loitering",
    title: "Protected Zone Loitering",
    category: "Detection Engines",
    snippet: "Spatial point-in-polygon checks inside Marine Protected Areas with SOG < 1.5 kn for >3h, excluding 5nm port buffers.",
  },
  {
    id: "mmsi-collision",
    title: "MMSI Collision Engine",
    category: "Detection Engines",
    snippet: "Detecting ghost ships broadcasting the same MMSI simultaneously (>50 km apart within 120 seconds).",
  },
  {
    id: "isolation-forest",
    title: "Isolation Forest ML Anomaly",
    category: "Detection Engines",
    snippet: "1-hour tumbling window kinematic features, circular course variance, and unsupervised outlier scoring.",
  },
  {
    id: "kafka-kraft",
    title: "Kafka KRaft & MMSI Keying",
    category: "Streaming Infrastructure",
    snippet: "Broker configuration, 6-partition parallel streams, and strict MMSI partitioning for in-order vessel state.",
  },
  {
    id: "consumer-dlq",
    title: "Consumer & Dead-Letter Queue",
    category: "Streaming Infrastructure",
    snippet: "Batch inserts with execute_values, state table upserts, and routing malformed pings to ais.positions.dlq.",
  },
  {
    id: "postgis-tables",
    title: "PostGIS Hot/Cold Table Split",
    category: "Streaming Infrastructure",
    snippet: "vessel_latest_state for sub-second radar rendering and partitioned vessel_positions for audit trails.",
  },
  {
    id: "sweeper-daemon",
    title: "Periodic Sweeper Daemon",
    category: "Streaming Infrastructure",
    snippet: "Background absence detector scanning active vessels every 10-60 seconds against H3 p99 thresholds.",
  },
  {
    id: "prior-pipeline",
    title: "Empirical Prior Generation",
    category: "Batch & Analytics",
    snippet: "PySpark and Pandas inter-message gap distributions (p50, p95, p99) per H3 cell and transceiver class.",
  },
  {
    id: "h3-indexing",
    title: "H3 Hexagonal Indexing",
    category: "Batch & Analytics",
    snippet: "Uber H3 resolution 5 spatial discretization (~8.5 km edge) for consistent marine spatial coverage modeling.",
  },
  {
    id: "feature-engineering",
    title: "Trajectory Feature Extraction",
    category: "Batch & Analytics",
    snippet: "Computing circular standard deviation, speed quantiles, and tortuosity ratios over historical AIS tracks.",
  },
  {
    id: "api-vessels",
    title: "GET /api/vessels",
    category: "API Reference",
    snippet: "Returns latest vessel state snapshot including coordinates, SOG, COG, status, and H3 cell ID.",
  },
  {
    id: "api-alerts",
    title: "GET /api/alerts",
    category: "API Reference",
    snippet: "Returns latest anomaly alerts with audit details, observed gap vs p99, and severity scores.",
  },
  {
    id: "api-geofences",
    title: "GET /api/geofences",
    category: "API Reference",
    snippet: "GeoJSON FeatureCollection export of US EEZ and Marine Protected Area surveillance boundaries.",
  },
  {
    id: "api-metrics",
    title: "GET /api/metrics",
    category: "API Reference",
    snippet: "System observability metrics: active vessels, dark alerts, Kafka ingest rate, and consumer lag.",
  },
  {
    id: "api-track",
    title: "GET /api/vessels/[mmsi]/track",
    category: "API Reference",
    snippet: "Chronological trajectory waypoints for a specific vessel for historical breadcrumb rendering.",
  },
  {
    id: "ablation-study",
    title: "92.9% False Alarm Reduction",
    category: "Benchmarks & Interdiction",
    snippet: "Comparison between flat 3-hour timeouts vs adaptive H3 empirical priors in low-coverage zones.",
  },
  {
    id: "f1-scoreboard",
    title: "Precision, Recall & F1",
    category: "Benchmarks & Interdiction",
    snippet: "Evaluation metrics across Absence Sweeper, Spoofing, Loitering, and ML Isolation Forest.",
  },
  {
    id: "sar-fusion",
    title: "Satellite SAR Radar Fusion",
    category: "Benchmarks & Interdiction",
    snippet: "Sentinel-1 C-band synthetic aperture radar correlation for detecting completely silent dark vessels.",
  },
];

interface DocsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (id: string) => void;
}

export default function DocsSearchModal({
  isOpen,
  onClose,
  onSelectDoc,
}: DocsSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        setQuery("");
        setSelectedIndex(0);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = query.trim()
    ? SEARCH_INDEX.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.snippet.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_INDEX.slice(0, 8);

  const handleSelect = (id: string) => {
    onSelectDoc(id);
    onClose();
  };

  return (
    <div className="docs-modal-backdrop" onClick={onClose}>
      <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="docs-modal-search">
          <Search size={18} color="#888888" />
          <input
            ref={inputRef}
            type="text"
            className="docs-modal-input"
            placeholder="Search documentation, API endpoints, or math models..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888888",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="docs-modal-results">
          {filtered.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                className={`docs-modal-item ${idx === selectedIndex ? "selected" : ""}`}
                onClick={() => handleSelect(item.id)}
              >
                <div>
                  <div className="docs-modal-item-title">{item.title}</div>
                  <div className="docs-modal-item-desc">{item.snippet}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="docs-modal-badge">{item.category}</span>
                  <ArrowRight size={14} color="#64748b" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
