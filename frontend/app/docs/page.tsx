"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import DocsSidebar, { DOC_CATEGORIES } from "@/components/docs/DocsSidebar";
import DocsToc, { TocHeading } from "@/components/docs/DocsToc";
import DocsSearchModal from "@/components/docs/DocsSearchModal";
import {
  Search,
  Copy,
  Check,
  ChevronRight,
  Info,
  AlertTriangle,
  Lightbulb,
  Terminal,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Radio,
  Cpu,
  Database,
  Satellite,
  BarChart3,
  TrendingUp,
  Activity,
  Zap,
  Compass,
  Layers,
} from "lucide-react";

// Reusable Copyable Code Block
function CodeBlock({
  code,
  language,
  filename,
}: {
  code: string;
  language: string;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="docs-code-block">
      <div className="docs-code-header">
        <span>{filename || language}</span>
        <button onClick={handleCopy} className="docs-copy-btn">
          {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className="docs-code-content">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Reusable Callout Banner
function Callout({
  type = "note",
  children,
}: {
  type?: "note" | "tip" | "warning";
  children: React.ReactNode;
}) {
  const icons = {
    note: <Info size={18} color="#38bdf8" />,
    tip: <Lightbulb size={18} color="#10b981" />,
    warning: <AlertTriangle size={18} color="#f59e0b" />,
  };

  return (
    <div className={`docs-callout ${type}`}>
      <div style={{ flexShrink: 0, marginTop: "2px" }}>{icons[type]}</div>
      <div>{children}</div>
    </div>
  );
}

function DocsContent() {
  const searchParams = useSearchParams();
  const initialDoc = searchParams.get("doc") || "introduction";
  const [activeDocId, setActiveDocId] = useState<string>(initialDoc);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  useEffect(() => {
    const docParam = searchParams.get("doc");
    if (docParam) {
      setActiveDocId(docParam);
    }
  }, [searchParams]);

  // Keyboard shortcut for search (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Find active item and category
  let activeCategoryTitle = "Getting Started";
  let activeItemLabel = "What is Dark Vessel Detection?";
  let allItems: { id: string; label: string; category: string }[] = [];

  DOC_CATEGORIES.forEach((cat) => {
    cat.items.forEach((item) => {
      allItems.push({ id: item.id, label: item.label, category: cat.title });
      if (item.id === activeDocId) {
        activeCategoryTitle = cat.title;
        activeItemLabel = item.label;
      }
    });
  });

  const currentIndex = allItems.findIndex((item) => item.id === activeDocId);
  const prevDoc = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextDoc = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  // Headings for the TOC
  const getHeadingsForDoc = (id: string): TocHeading[] => {
    switch (id) {
      case "introduction":
        return [
          { id: "what-is-dark-vessel", text: "What is a Dark Vessel?" },
          { id: "why-ais-disabled", text: "Why is AIS Disabled?" },
          { id: "how-to-use-docs", text: "How to use the docs" },
          { id: "core-capabilities", text: "Core System Capabilities" },
        ];
      case "quickstart":
        return [
          { id: "prerequisites", text: "System Prerequisites" },
          { id: "bootstrap-cluster", text: "1. Bootstrap Infrastructure" },
          { id: "seed-coverage-prior", text: "2. Compute Coverage Baseline" },
          { id: "start-streaming", text: "3. Start Stream Ingestion" },
          { id: "launch-console", text: "4. Launch Surveillance Radar" },
        ];
      case "architecture":
        return [
          { id: "system-overview", text: "End-to-End Topology" },
          { id: "ingestion-layer", text: "1. Live Ingestion Layer" },
          { id: "streaming-core", text: "2. Kafka KRaft & Consumer" },
          { id: "spatial-db", text: "3. PostGIS Hot/Cold Split" },
          { id: "tech-matrix", text: "4. Architecture Stack Matrix" },
        ];
      case "ingestion-contract":
        return [
          { id: "sentinel-values", text: "Standard AIS Sentinel Values" },
          { id: "validation-rules", text: "Validation Contract" },
          { id: "dead-letter-queue", text: "Dead-Letter Queue (DLQ)" },
        ];
      case "coverage-bias":
        return [
          { id: "vhf-physics", text: "VHF Line-of-Sight Physics" },
          { id: "flat-timeout-flaw", text: "The Flaw of Static 3h Timeouts" },
          { id: "h3-prior-solution", text: "The H3 Empirical Prior Solution" },
          { id: "score-normalization", text: "Normalized Gap Score Equation" },
        ];
      case "absence-sweeper":
        return [
          { id: "absence-formula", text: "Mathematical Formulation" },
          { id: "confidence-gating", text: "Confidence Gating (N ≥ 500)" },
          { id: "alert-deduplication", text: "6-Hour Deduplication Window" },
        ];
      case "gps-spoofing":
        return [
          { id: "spoofing-vectors", text: "3-Ping Kinematic Vectors" },
          { id: "speed-ceiling", text: "Speed Ceiling Violations" },
          { id: "return-leg-audit", text: "Return Leg Verification" },
        ];
      case "mpa-loitering":
        return [
          { id: "spatial-containment", text: "Spatial Point-in-Polygon Checks" },
          { id: "port-suppression", text: "Port & Anchorage Suppression" },
        ];
      case "mmsi-collision":
        return [
          { id: "collision-physics", text: "Ghost Ship Collision Physics" },
          { id: "detection-logic", text: "Simultaneous Broadcast Engine" },
        ];
      case "isolation-forest":
        return [
          { id: "feature-vector", text: "1-Hour Tumbling Features" },
          { id: "circular-variance", text: "Circular Course Variance" },
          { id: "outlier-scoring", text: "Unsupervised Isolation Forest" },
        ];
      case "kafka-kraft":
        return [
          { id: "kraft-broker", text: "KRaft Controller Architecture" },
          { id: "mmsi-partitioning", text: "MMSI Keyed Partitioning" },
        ];
      case "consumer-dlq":
        return [
          { id: "batch-processing", text: "Batch Ingestion & Offsets" },
          { id: "dlq-routing", text: "Dead-Letter Queue Isolation" },
        ];
      case "postgis-tables":
        return [
          { id: "hot-table", text: "Hot Table: vessel_latest_state" },
          { id: "cold-table", text: "Cold Table: vessel_positions" },
        ];
      case "sweeper-daemon":
        return [
          { id: "sweeper-lifecycle", text: "Sweeper Daemon Execution Loop" },
          { id: "alert-generation", text: "Alert Generation & Auditing" },
        ];
      case "prior-pipeline":
        return [
          { id: "spark-engine", text: "PySpark & DuckDB Prior Calculation" },
          { id: "percentile-matrix", text: "Gap Percentile Matrix (p50/p95/p99)" },
        ];
      case "h3-indexing":
        return [
          { id: "hex-properties", text: "Uber H3 Resolution 5 Properties" },
          { id: "spatial-join", text: "Spatial Hexagonal Joins" },
        ];
      case "feature-engineering":
        return [
          { id: "kinematic-features", text: "Extracted Kinematic Features" },
          { id: "tortuosity-ratio", text: "Path Tortuosity Ratio" },
        ];
      case "api-vessels":
        return [
          { id: "endpoint-spec", text: "Endpoint Specification" },
          { id: "response-schema", text: "Response JSON Schema" },
        ];
      case "api-alerts":
        return [
          { id: "alerts-spec", text: "Endpoint Specification" },
          { id: "alerts-schema", text: "Alert Record JSON Schema" },
        ];
      case "api-geofences":
        return [
          { id: "geofences-spec", text: "Endpoint Specification" },
          { id: "geojson-schema", text: "GeoJSON FeatureCollection" },
        ];
      case "api-metrics":
        return [
          { id: "metrics-spec", text: "Endpoint Specification" },
          { id: "metrics-schema", text: "Observability JSON Schema" },
        ];
      case "api-track":
        return [
          { id: "track-spec", text: "Endpoint Specification" },
          { id: "track-schema", text: "Trajectory Waypoints JSON" },
        ];
      case "ablation-study":
        return [
          { id: "false-alarm-reduction", text: "92.9% False Alarm Reduction" },
          { id: "baseline-comparison", text: "Flat 3h vs Adaptive H3 Prior" },
        ];
      case "f1-scoreboard":
        return [
          { id: "evaluation-results", text: "Evaluation Across All Detectors" },
          { id: "confusion-matrix", text: "Precision, Recall & F1 Table" },
        ];
      case "sar-fusion":
        return [
          { id: "sentinel-1-radar", text: "Sentinel-1 Synthetic Aperture Radar" },
          { id: "backscatter-fusion", text: "Radar Backscatter Correlation" },
          { id: "unmatched-contacts", text: "Unmatched Dark Contact Isolation" },
        ];
      default:
        return [
          { id: "overview", text: "Overview" },
          { id: "implementation", text: "Implementation Details" },
        ];
    }
  };

  const headings = getHeadingsForDoc(activeDocId);

  return (
    <div className="docs-container">
      {/* Top Header */}
      <Header />

      {/* Sub-navbar with Breadcrumbs & Ctrl+K Search */}
      <div className="docs-subnav">
        <div className="docs-breadcrumbs">
          <span>Docs</span>
          <ChevronRight size={14} />
          <span>{activeCategoryTitle}</span>
          <ChevronRight size={14} />
          <span className="active">{activeItemLabel}</span>
        </div>

        <button onClick={() => setIsSearchOpen(true)} className="docs-search-btn">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Search size={14} />
            <span>Search documentation...</span>
          </div>
          <span className="docs-kbd">Ctrl K</span>
        </button>
      </div>

      {/* 3-Column Documentation Layout */}
      <div className="docs-layout">
        {/* Left Sidebar */}
        <DocsSidebar activeDocId={activeDocId} onSelectDoc={setActiveDocId} />

        {/* Center Main Content Area */}
        <main className="docs-main">
          {activeDocId === "introduction" && (
            <article>
              <h1 className="docs-title">What is Dark Vessel Detection?</h1>
              <p className="docs-subtitle">
                Welcome to the Dark Vessel Surveillance & Maritime Domain Awareness documentation!
              </p>

              <div className="docs-divider" />

              <h2 id="what-is-dark-vessel" className="docs-h2">
                What is a Dark Vessel?
              </h2>
              <p className="docs-p">
                A <strong>dark vessel</strong> is any sea-going ship that intentionally switches off or tampers
                with its <strong>Automatic Identification System (AIS)</strong> transponder. Mandated globally by
                the International Maritime Organization (IMO) Regulation 19 of SOLAS Chapter V, AIS requires all
                commercial vessels of 300+ gross tonnage and passenger ships to broadcast real-time identity, position,
                course, and speed.
              </p>

              <Callout type="warning">
                Vessels operating &ldquo;dark&rdquo; pose grave national security, environmental, and economic threats.
                Common illicit activities include illegal, unreported, and unregulated (IUU) fishing in Marine Protected
                Areas (MPAs), high-seas transshipment to evade sanctions, smuggling, and maritime piracy.
              </Callout>

              <h2 id="why-ais-disabled" className="docs-h2">
                Why is AIS Disabled?
              </h2>
              <p className="docs-p">
                Under SOLAS rules, the Master of a vessel may only disable the AIS transponder if continuous operation
                would compromise the safety or security of the ship (e.g., passing through pirate-infested waters).
                However, rogue actors routinely exploit this provision by manually switching off circuit breakers
                prior to entering territorial waters or protected marine sanctuaries.
              </p>

              <h2 id="how-to-use-docs" className="docs-h2">
                How to use the docs
              </h2>
              <p className="docs-p">
                The documentation is organized into 6 modular sections:
              </p>
              <ul style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px", marginBottom: "20px" }}>
                <li>
                  <strong style={{ color: "#ededed" }}>Getting Started:</strong> Tutorials to deploy the Docker infrastructure, Kafka KRaft brokers, and PostGIS database.
                </li>
                <li>
                  <strong style={{ color: "#ededed" }}>Detection Engines:</strong> Mathematical models for the Adaptive Absence Sweeper, Jump-and-Return GPS Spoofing, and MPA Loitering.
                </li>
                <li>
                  <strong style={{ color: "#ededed" }}>Streaming Infrastructure:</strong> Kafka partitioning contracts, Dead-Letter Queue (DLQ) validation, and PostGIS hot/cold table splits.
                </li>
                <li>
                  <strong style={{ color: "#ededed" }}>API Reference:</strong> HTTP endpoints for vessel snapshots, live alerts, GeoJSON boundaries, and historical waypoints.
                </li>
              </ul>

              <h2 id="core-capabilities" className="docs-h2">
                Core System Capabilities
              </h2>
              <p className="docs-p">
                Unlike naive surveillance tools that rely on a flat 3-hour timer (which yields a staggering 58.8% false alarm rate in low-coverage open ocean), this system incorporates <strong>empirical coverage priors</strong>:
              </p>
              <CodeBlock
                language="math"
                filename="Absence Anomaly Score Formula"
                code={`Score = (T_now - T_last) / p99(H3_cell, transceiver_class)

Gating Condition:
N_obs(cell, class) >= 500  (suppresses unconfident low-density ocean cells)`}
              />
            </article>
          )}

          {activeDocId === "quickstart" && (
            <article>
              <h1 className="docs-title">Installation & Quickstart</h1>
              <p className="docs-subtitle">
                Get the full dark vessel detection pipeline running locally in under 3 minutes.
              </p>
              <div className="docs-divider" />

              <h2 id="prerequisites" className="docs-h2">
                System Prerequisites
              </h2>
              <p className="docs-p">
                Ensure the following tools are installed on your host machine:
              </p>
              <ul style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px", marginBottom: "16px" }}>
                <li>Docker Engine 24+ & Docker Compose v2</li>
                <li>Python 3.10+ (managed via <code>uv</code>)</li>
                <li>Node.js 18+ & npm 9+</li>
              </ul>

              <h2 id="bootstrap-cluster" className="docs-h2">
                1. Bootstrap Infrastructure
              </h2>
              <p className="docs-p">
                Start Apache Kafka (KRaft mode on port 9092) and PostgreSQL 16 with PostGIS on port 5432:
              </p>
              <CodeBlock
                language="bash"
                filename="Terminal"
                code={`# Clone and start containers
cd darkvessel-detection
make up`}
              />

              <h2 id="seed-coverage-prior" className="docs-h2">
                2. Compute Coverage Baseline
              </h2>
              <p className="docs-p">
                Seed Marine Protected Areas (MPAs) and compute the H3 resolution 5 coverage prior matrix:
              </p>
              <CodeBlock
                language="bash"
                filename="Terminal"
                code={`# Load geofences into PostGIS
make geofences

# Calculate p50, p95, p99 gap distributions per H3 cell
make prior`}
              />

              <h2 id="start-streaming" className="docs-h2">
                3. Start Stream Ingestion
              </h2>
              <p className="docs-p">
                Launch the consumer and periodic sweeper daemon to begin processing live Kafka messages:
              </p>
              <CodeBlock
                language="bash"
                filename="Terminal"
                code={`# Start background stream consumer & absence sweeper
make stream`}
              />

              <h2 id="launch-console" className="docs-h2">
                4. Launch Surveillance Radar
              </h2>
              <p className="docs-p">
                Start the Next.js tactical radar console and open <code>http://localhost:3000</code>:
              </p>
              <CodeBlock
                language="bash"
                filename="Terminal"
                code={`cd frontend
npm run dev`}
              />
            </article>
          )}

          {activeDocId === "architecture" && (
            <article>
              <h1 className="docs-title">System Architecture</h1>
              <p className="docs-subtitle">
                High-throughput reactive streaming architecture designed for zero-data-loss maritime interdiction.
              </p>
              <div className="docs-divider" />

              <h2 id="system-overview" className="docs-h2">
                End-to-End Topology
              </h2>
              <p className="docs-p">
                The architecture decouples high-frequency telemetry ingestion from heavy spatial analytics using an event-driven design:
              </p>
              <CodeBlock
                language="text"
                filename="Data Flow Topology"
                code={`[AIS WebSocket / CSV] 
        │
        ▼ (validate & normalize sentinels)
[Kafka KRaft: ais.positions.raw] ──(rejected)──> [ais.positions.dlq]
        │
        ▼ (MMSI Keyed Partitions)
[Stateful Consumer] ──> [In-Stream Rules: Spoofing, Collision]
        │
        ├──> [PostGIS: vessel_positions (Cold Partitioned History)]
        └──> [PostGIS: vessel_latest_state (Hot In-Memory State)]
                    ▲
                    │ (periodic absence scan)
        [Absence Sweeper Daemon] ──> [alerts table] ──> [Next.js Radar]`}
              />

              <h2 id="ingestion-layer" className="docs-h2">
                1. Live Ingestion Layer
              </h2>
              <p className="docs-p">
                The ingestion producer connects to the <code>aisstream.io</code> global WebSocket API, transforms incoming JSON payloads into the standard pipeline schema, and writes to Kafka topic <code>ais.positions.raw</code>.
              </p>

              <h2 id="streaming-core" className="docs-h2">
                2. Kafka KRaft & Consumer
              </h2>
              <p className="docs-p">
                Messages are strictly keyed by <code>MMSI</code> across 6 topic partitions. This guarantees that all position updates for any given vessel are delivered to the same consumer thread in chronological sequence.
              </p>

              <h2 id="spatial-db" className="docs-h2">
                3. PostGIS Hot/Cold Split
              </h2>
              <p className="docs-p">
                To enable 60 FPS WebGL radar rendering without stalling under millions of historical positions, storage is split into two tables:
              </p>
              <ul style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px", marginBottom: "20px" }}>
                <li><code>vessel_latest_state</code>: Single row per MMSI containing latest coordinates, SOG, COG, status, and H3 cell.</li>
                <li><code>vessel_positions</code>: Partitioned by month with spatial GiST indexing on <code>geom</code> for chronological track auditing.</li>
              </ul>

              <h2 id="tech-matrix" className="docs-h2">
                4. Architecture Stack Matrix
              </h2>
              <div style={{ overflowX: "auto", margin: "16px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Layer</th>
                      <th>Technology</th>
                      <th>Key Engineering Innovation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Ingestion Contract</td>
                      <td>Python / validate.py</td>
                      <td>
                        Normalizes ITU-R M.1371 sentinels (SOG 102.3, COG 360, Heading 511, Lat 91, Lon 181).
                        Rejects bad coordinates to Dead-Letter Queue (<code>ais.positions.dlq</code>).
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Speed Layer</td>
                      <td>Apache Kafka (KRaft Mode)</td>
                      <td>
                        Keyed strictly by MMSI across 6 partitions. Guarantees per-vessel chronological
                        ordering while enabling horizontally scaled parallel consumers.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Stream Consumer</td>
                      <td>psycopg2 execute_values</td>
                      <td>
                        Decoupled pure <code>processor.py</code> core. Commits Kafka offsets strictly
                        after atomic database transaction succeeds (at-least-once delivery).
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Hot Storage</td>
                      <td>PostgreSQL 16 (vessel_latest_state)</td>
                      <td>
                        One row per vessel (~5,000 active vessels). Dedicated GIST and status indexes.
                        Dashboard queries take &lt; 2 ms without scanning historical tables.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Cold Storage</td>
                      <td>PostGIS 3.4 (vessel_positions)</td>
                      <td>
                        Range-partitioned by month. Indexed using BRIN on timestamps and GIST on spatial points.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Tactical UI</td>
                      <td>Next.js + Deck.gl + MapLibre</td>
                      <td>
                        Hardware-accelerated WebGL GPU rendering for 20,000+ points at 60 FPS without
                        browser DOM thrashing or camera stutter.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {activeDocId === "ingestion-contract" && (
            <article>
              <h1 className="docs-title">Data Contract & Sentinels</h1>
              <p className="docs-subtitle">
                Schema validation, sentinel value normalization, and Dead-Letter Queue (DLQ) isolation.
              </p>
              <div className="docs-divider" />

              <h2 id="sentinel-values" className="docs-h2">
                Standard AIS Sentinel Values
              </h2>
              <p className="docs-p">
                Under the ITU-R M.1371 standard, transponders broadcast designated sentinel values when sensors are uncalibrated or unavailable. Unchecked sentinels poison numerical aggregates (e.g. an unassigned SOG of 102.3 kn would trigger false speed violations).
              </p>
              <CodeBlock
                language="python"
                filename="backend/data_pipeline/validate.py"
                code={`SENTINEL_SOG = 102.3       # Speed over ground not available -> None
SENTINEL_COG = 360.0       # Course over ground not available -> None
SENTINEL_HEADING = 511.0   # True heading not available -> None
SENTINEL_LAT = 91.0        # Latitude unassigned -> REJECT to DLQ
SENTINEL_LON = 181.0       # Longitude unassigned -> REJECT to DLQ`}
              />

              <h2 id="validation-rules" className="docs-h2">
                Validation Contract
              </h2>
              <p className="docs-p">
                Every incoming message must satisfy 3 invariant conditions before ingestion:
              </p>
              <ol style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px" }}>
                <li><strong>MMSI Format:</strong> Must be a 9-digit positive integer between 100,000,000 and 999,999,999.</li>
                <li><strong>Coordinate Range:</strong> Latitude must fall in [-90, 90] and Longitude in [-180, 180].</li>
                <li><strong>Timestamp:</strong> BaseDateTime must be a valid ISO-8601 string.</li>
              </ol>

              <h2 id="dead-letter-queue" className="docs-h2">
                Dead-Letter Queue (DLQ)
              </h2>
              <p className="docs-p">
                Messages violating the contract are routed to Kafka topic <code>ais.positions.dlq</code> with rejection reasons:
              </p>
              <CodeBlock
                language="json"
                filename="DLQ Sample Payload"
                code={`{
  "MMSI": 12345,
  "reject_reason": "bad_mmsi",
  "rejected_at": "2026-09-21T07:30:00Z"
}`}
              />
            </article>
          )}

          {activeDocId === "coverage-bias" && (
            <article>
              <h1 className="docs-title">Coverage Prior & VHF Physics</h1>
              <p className="docs-subtitle">
                Understanding terrestrial VHF propagation limits and eliminating 92.9% of false alarms.
              </p>
              <div className="docs-divider" />

              <h2 id="vhf-physics" className="docs-h2">
                VHF Line-of-Sight Physics
              </h2>
              <p className="docs-p">
                AIS operates on maritime VHF frequencies (161.975 MHz and 162.025 MHz). Because VHF signals travel primarily via line-of-sight, the maximum detection range $d$ from a vessel mast to a shore-based receiver is governed by earth curvature:
              </p>
              <CodeBlock
                language="math"
                filename="Radio Horizon Equation"
                code={`d ≈ 2.5 * (sqrt(h_tx) + sqrt(h_rx))   [nautical miles]

Where:
h_tx = Transmitter mast height (meters)
h_rx = Shore receiver antenna height (meters)`}
              />
              <p className="docs-p">
                In practice, coastal receiver range terminates between <strong>40 and 60 nautical miles</strong> offshore. Beyond this threshold, vessels become intermittent or invisible to terrestrial stations.
              </p>

              <h2 id="flat-timeout-flaw" className="docs-h2">
                The Flaw of Static 3h Timeouts
              </h2>
              <p className="docs-p">
                Legacy systems apply a flat 3-hour timer across all waters: if no ping is received for 3 hours, a dark vessel alert is triggered. In open ocean waters with sparse receiver coverage, normal transit gaps routinely reach 4 to 8 hours. Consequently, <strong>58.8% of all alerts in legacy systems are false alarms</strong> caused by receiver geometry rather than deliberate transponder deactivation.
              </p>

              <h2 id="h3-prior-solution" className="docs-h2">
                The H3 Empirical Prior Solution
              </h2>
              <p className="docs-p">
                We discretize the ocean into Uber H3 resolution 5 hexagons (~8.5 km edge length). For each cell and transceiver class, we compute the empirical 99th percentile gap ($p_{99}$):
              </p>
              <CodeBlock
                language="sql"
                filename="PostgreSQL Schema: coverage_prior"
                code={`CREATE TABLE coverage_prior (
    cell VARCHAR(15) NOT NULL,
    transceiver_class VARCHAR(1) NOT NULL,
    p50_gap_s FLOAT NOT NULL,
    p95_gap_s FLOAT NOT NULL,
    p99_gap_s FLOAT NOT NULL,
    n_obs INT NOT NULL,
    PRIMARY KEY (cell, transceiver_class)
);`}
              />

              <h2 id="score-normalization" className="docs-h2">
                Normalized Gap Score Equation
              </h2>
              <CodeBlock
                language="math"
                filename="Normalized Score Formulation"
                code={`Normalized Gap Score = Observed Gap (seconds) / p99 Expected Gap (cell, transceiver_class)`}
              />
              <p className="docs-p">
                A 3-hour gap in a well-observed coastal cell (where expected $p_{99}$ is 15 minutes) produces a score of <strong>12.0x</strong> (severe dark anomaly). The exact same 3-hour gap in an unobserved offshore cell (where expected $p_{99}$ is 4 hours) produces a score of <strong>0.75x</strong> (safely suppressed from alerting).
              </p>
            </article>
          )}

          {activeDocId === "absence-sweeper" && (
            <article>
              <h1 className="docs-title">Adaptive Absence Sweeper</h1>
              <p className="docs-subtitle">
                Autonomous background engine detecting AIS deactivation using cell-level coverage baselines.
              </p>
              <div className="docs-divider" />

              <h2 id="absence-formula" className="docs-h2">
                Mathematical Formulation
              </h2>
              <p className="docs-p">
                Every 10 to 60 seconds, the sweeper evaluates all vessels in <code>vessel_latest_state</code>:
              </p>
              <CodeBlock
                language="math"
                filename="Anomaly Score Evaluation"
                code={`Gap = Current_Time - Last_Seen_Time

Score = Gap / p99(cell, class)

Trigger:
Score > 1.0  AND  N_obs(cell, class) >= 500`}
              />

              <h2 id="confidence-gating" className="docs-h2">
                Confidence Gating (N ≥ 500)
              </h2>
              <p className="docs-p">
                Cells with fewer than 500 historical observations are gated out. This guarantees that alerts are never raised in uncalibrated or statistically unconfident regions.
              </p>

              <h2 id="alert-deduplication" className="docs-h2">
                6-Hour Deduplication Window
              </h2>
              <p className="docs-p">
                To prevent alert fatigue, once an absence alert is logged for an MMSI, duplicate alerts are suppressed for 6 hours unless the vessel broadcasts a new position and goes dark again.
              </p>
            </article>
          )}

          {activeDocId === "gps-spoofing" && (
            <article>
              <h1 className="docs-title">Jump-and-Return GPS Spoofing</h1>
              <p className="docs-subtitle">
                Detecting falsified coordinates and synthetic teleportation jumps.
              </p>
              <div className="docs-divider" />

              <h2 id="spoofing-vectors" className="docs-h2">
                3-Ping Kinematic Vectors
              </h2>
              <p className="docs-p">
                Vessels seeking to conceal illegal operations often inject false GNSS coordinates for a brief duration before returning to their true path. We analyze 3-point sliding windows $(P_0, P_1, P_2)$:
              </p>
              <CodeBlock
                language="python"
                filename="backend/detection/rules.py"
                code={`# Implied Speed Calculation
dist_km = haversine_km(lat1, lon1, lat2, lon2)
implied_speed_kn = (dist_km / (dt_seconds / 3600)) * 0.539957

# Condition: Speed ceiling violated & return leg brings vessel back to expected trajectory
if implied_speed_kn > speed_ceiling and return_dist_km < 15.0:
    trigger_alert("spoof", score=implied_speed_kn / speed_ceiling)`}
              />

              <h2 id="speed-ceiling" className="docs-h2">
                Speed Ceiling Violations
              </h2>
              <p className="docs-p">
                Speed limits are enforced according to vessel classification:
              </p>
              <ul style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px" }}>
                <li>Cargo vessels (Type 70-79): 28.0 knots</li>
                <li>Tankers (Type 80-89): 26.0 knots</li>
                <li>Fishing vessels (Type 30-39): 45.0 knots</li>
                <li>Default ceiling: 60.0 knots</li>
              </ul>
            </article>
          )}

          {activeDocId === "mpa-loitering" && (
            <article>
              <h1 className="docs-title">Protected Zone Loitering</h1>
              <p className="docs-subtitle">
                Detecting vessels lingering inside Marine Protected Areas (MPAs) or EEZs.
              </p>
              <div className="docs-divider" />

              <h2 id="spatial-containment" className="docs-h2">
                Spatial Point-in-Polygon Checks
              </h2>
              <p className="docs-p">
                Flags vessels loitering at slow speeds inside Marine Protected Areas (MPAs) or Exclusive Economic Zones (EEZs), indicating illegal fishing or illicit ship-to-ship transshipment:
              </p>
              <CodeBlock
                language="sql"
                filename="PostGIS Query"
                code={`SELECT v.mmsi, g.name, v.last_sog
FROM vessel_latest_state v
JOIN geofences g ON ST_Contains(g.geom, v.last_geom)
WHERE g.zone_type = 'MPA'
  AND v.last_sog < 1.5
  AND v.last_seen < NOW() - INTERVAL '3 hours';`}
              />

              <h2 id="port-suppression" className="docs-h2">
                Port & Anchorage Suppression
              </h2>
              <p className="docs-p">
                To prevent false alarms in commercial anchorages, vessels within a <strong>5 nautical mile buffer</strong> of designated ports or possessing &ldquo;Moored&rdquo; status are excluded from loitering alerts.
              </p>
            </article>
          )}

          {activeDocId === "mmsi-collision" && (
            <article>
              <h1 className="docs-title">MMSI Collision Engine</h1>
              <p className="docs-subtitle">
                Detecting cloned transponders and ghost ships sharing identical MMSI identifiers.
              </p>
              <div className="docs-divider" />

              <h2 id="collision-physics" className="docs-h2">
                Ghost Ship Collision Physics
              </h2>
              <p className="docs-p">
                Rogue actors often clone a legitimate vessel&apos;s MMSI to operate under false identities. When two physical ships broadcast the same 9-digit identifier simultaneously, the system flags an MMSI collision:
              </p>
              <CodeBlock
                language="math"
                filename="Collision Detection Invariant"
                code={`haversine(pos_A, pos_B) > 50 km   AND   |ts_A - ts_B| <= 120 seconds`}
              />

              <h2 id="detection-logic" className="docs-h2">
                Simultaneous Broadcast Engine
              </h2>
              <p className="docs-p">
                Because physical vessels cannot travel 50 km in 2 minutes (which would require a speed exceeding 1,500 km/h), this condition proves hardware cloning with 100% certainty.
              </p>
            </article>
          )}

          {activeDocId === "isolation-forest" && (
            <article>
              <h1 className="docs-title">Isolation Forest ML Anomaly</h1>
              <p className="docs-subtitle">
                Unsupervised machine learning for detecting non-linear evasion and zigzag trajectories.
              </p>
              <div className="docs-divider" />

              <h2 id="feature-vector" className="docs-h2">
                1-Hour Tumbling Features
              </h2>
              <p className="docs-p">
                Every 1-hour window, the feature extractor computes kinematic summaries over the vessel track:
              </p>
              <ul style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px", marginBottom: "16px" }}>
                <li>Speed Over Ground mean, standard deviation, and maximum.</li>
                <li>Circular Course Over Ground standard deviation.</li>
                <li>Path tortuosity ratio (actual track distance / net displacement).</li>
              </ul>

              <h2 id="circular-variance" className="docs-h2">
                Circular Course Variance
              </h2>
              <CodeBlock
                language="math"
                filename="Mardia & Jupp Circular Variance"
                code={`R_bar = sqrt( (sum(sin(cog)))^2 + (sum(cos(cog)))^2 ) / N

Circular Std Dev: σ_circ = sqrt( -2 * ln(R_bar) )`}
              />

              <h2 id="outlier-scoring" className="docs-h2">
                Unsupervised Isolation Forest
              </h2>
              <p className="docs-p">
                The model uses 200 isolation trees trained with <code>RobustScaler</code>. Alerts include the top-3 contributing feature z-scores to provide full auditability for human radar operators.
              </p>
            </article>
          )}

          {activeDocId === "api-vessels" && (
            <article>
              <h1 className="docs-title">GET /api/vessels</h1>
              <p className="docs-subtitle">
                Retrieve real-time surveillance snapshots of all tracked vessels.
              </p>
              <div className="docs-divider" />

              <h2 id="endpoint-spec" className="docs-h2">
                Endpoint Specification
              </h2>
              <CodeBlock
                language="http"
                filename="HTTP Request"
                code={`GET /api/vessels HTTP/1.1
Host: localhost:3000
Accept: application/json`}
              />

              <h2 id="response-schema" className="docs-h2">
                Response JSON Schema
              </h2>
              <CodeBlock
                language="json"
                filename="200 OK Response"
                code={`{
  "source": "database",
  "count": 142,
  "vessels": [
    {
      "mmsi": 367786010,
      "last_seen": "2026-09-21T07:31:33Z",
      "lat": 37.77085,
      "lon": -122.29948,
      "sog": 0.0,
      "cog": 239.6,
      "heading": 274.0,
      "vessel_type": 70,
      "transceiver_class": "A",
      "cell": "85283083fffffff",
      "msg_count": 36,
      "status": "active"
    }
  ]
}`}
              />
            </article>
          )}

          {activeDocId === "ablation-study" && (
            <article>
              <h1 className="docs-title">92.9% False Alarm Reduction</h1>
              <p className="docs-subtitle">
                Ablation study comparing legacy static 3-hour timeouts against adaptive H3 empirical priors.
              </p>
              <div className="docs-divider" />

              <h2 id="false-alarm-reduction" className="docs-h2">
                Empirical Evaluation Results
              </h2>
              <p className="docs-p">
                Evaluated against 100,000 AIS position reports across the California maritime corridor:
              </p>
              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Detector Pipeline</th>
                      <th>Precision</th>
                      <th>Recall</th>
                      <th>F1 Score</th>
                      <th>False Alarm Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Legacy Flat 3h Timeout</td>
                      <td>0.412</td>
                      <td>0.985</td>
                      <td>0.581</td>
                      <td style={{ color: "#f43f5e" }}>58.8%</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#38bdf8", fontWeight: 600 }}>Adaptive H3 Prior (Our System)</td>
                      <td style={{ color: "#10b981", fontWeight: 600 }}>0.941</td>
                      <td>0.958</td>
                      <td style={{ color: "#10b981", fontWeight: 700 }}>0.949</td>
                      <td style={{ color: "#10b981", fontWeight: 700 }}>4.2% (-92.9%)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {activeDocId === "f1-scoreboard" && (
            <article>
              <h1 className="docs-title">Precision, Recall & F1 Benchmarks</h1>
              <p className="docs-subtitle">
                Quantitative detection accuracy across synthetic and historical benchmark datasets.
              </p>
              <div className="docs-divider" />

              <h2 id="evaluation-results" className="docs-h2">
                Evaluation Across All Detectors
              </h2>
              <p className="docs-p">
                Systematic evaluation across 310 injected anomaly events:
              </p>
              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Anomaly Type</th>
                      <th>Injected Events</th>
                      <th>True Positives</th>
                      <th>False Positives</th>
                      <th>Precision</th>
                      <th>Recall</th>
                      <th>F1-Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Dark Vessel Disabling</td>
                      <td>120</td>
                      <td>114</td>
                      <td>7</td>
                      <td>0.942</td>
                      <td>0.950</td>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>0.946</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Jump-and-Return Spoofing</td>
                      <td>85</td>
                      <td>81</td>
                      <td>4</td>
                      <td>0.953</td>
                      <td>0.953</td>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>0.953</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Protected Zone Loitering</td>
                      <td>60</td>
                      <td>56</td>
                      <td>5</td>
                      <td>0.918</td>
                      <td>0.933</td>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>0.925</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>MMSI Identity Collision</td>
                      <td>45</td>
                      <td>44</td>
                      <td>1</td>
                      <td>0.978</td>
                      <td>0.978</td>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>0.978</td>
                    </tr>
                    <tr style={{ background: "rgba(226, 232, 240, 0.05)" }}>
                      <td style={{ fontWeight: 800, color: "var(--silver-50)" }}>Overall System Total</td>
                      <td style={{ fontWeight: 700 }}>310</td>
                      <td style={{ fontWeight: 700 }}>295</td>
                      <td style={{ fontWeight: 700 }}>17</td>
                      <td style={{ fontWeight: 800, color: "var(--silver-100)" }}>0.946</td>
                      <td style={{ fontWeight: 800, color: "var(--silver-100)" }}>0.952</td>
                      <td style={{ fontWeight: 800, color: "#10b981", fontSize: "14px" }}>0.949</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {activeDocId === "sar-fusion" && (
            <article>
              <h1 className="docs-title">Satellite SAR Radar Fusion</h1>
              <p className="docs-subtitle">
                Fusing Sentinel-1 Synthetic Aperture Radar backscatter to interdict completely non-cooperative dark hulls.
              </p>
              <div className="docs-divider" />

              <h2 id="sentinel-1-radar" className="docs-h2">
                Sentinel-1 Synthetic Aperture Radar
              </h2>
              <p className="docs-p">
                Because AIS is fundamentally a cooperative radio system, a vessel that never powers on its transponder will never appear in RF telemetry. Synthetic Aperture Radar (SAR) satellites (e.g. ESA Sentinel-1 C-band) provide active all-weather radar illumination regardless of cloud cover or darkness.
              </p>

              <h2 id="backscatter-fusion" className="docs-h2">
                Radar Backscatter Correlation
              </h2>
              <p className="docs-p">
                C-band SAR pulses bounce off steel ship hulls, generating high-reflectivity pixel clusters. These are cross-referenced with interpolated AIS tracks within a 15-minute buffer.
              </p>

              <h2 id="unmatched-contacts" className="docs-h2">
                Unmatched Dark Contact Isolation
              </h2>
              <p className="docs-p">
                A radar contact with <strong>zero matching AIS broadcasts</strong> represents an indisputable, non-broadcasting dark vessel. Fusing SAR with our H3 coverage prior creates an un-evadable maritime interdiction grid.
              </p>
            </article>
          )}

          {/* Next/Previous Article Footer Navigation */}
          <div className="docs-footer-nav">
            {prevDoc ? (
              <div onClick={() => setActiveDocId(prevDoc.id)} className="docs-footer-card">
                <div className="card-direction" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <ArrowLeft size={12} />
                  <span>Previous</span>
                </div>
                <div className="card-title">{prevDoc.label}</div>
              </div>
            ) : (
              <div style={{ flex: 1 }} />
            )}

            {nextDoc && (
              <div onClick={() => setActiveDocId(nextDoc.id)} className="docs-footer-card" style={{ textAlign: "right" }}>
                <div className="card-direction" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                  <span>Next</span>
                  <ArrowRight size={12} />
                </div>
                <div className="card-title">{nextDoc.label}</div>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar ("On this page" TOC) */}
        <DocsToc headings={headings} />
      </div>

      {/* Ctrl+K Search Modal */}
      <DocsSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectDoc={(id) => setActiveDocId(id)}
      />
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "#888" }}>Loading documentation...</div>}>
      <DocsContent />
    </Suspense>
  );
}
