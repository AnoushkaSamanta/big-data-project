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
  const allItems: { id: string; label: string; category: string }[] = [];

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

          {activeDocId === "kafka-kraft" && (
            <article>
              <h1 className="docs-title">Kafka KRaft & MMSI Keying</h1>
              <p className="docs-subtitle">
                Consensus-driven event streaming broker, partition layout, and strict per-vessel FIFO ordering guarantees.
              </p>
              <div className="docs-divider" />

              <h2 id="kraft-broker" className="docs-h2">
                KRaft Controller Architecture
              </h2>
              <p className="docs-p">
                Modern high-throughput maritime domain awareness systems cannot afford the operational fragility and metadata synchronization latency of external ZooKeeper coordination clusters. The surveillance pipeline operates on <strong>Apache Kafka 3.7+ in KRaft (Kafka Raft Metadata) mode</strong>.
              </p>
              <p className="docs-p">
                In KRaft mode, cluster consensus and topic metadata are managed by an internal Raft quorum, electing a single active controller that writes metadata changes directly to an internal <code>@metadata</code> partition. This delivers sub-second failover times and eliminates metadata desynchronization between broker nodes.
              </p>

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Topic Name</th>
                      <th>Partitions</th>
                      <th>Replication</th>
                      <th>Cleanup Policy</th>
                      <th>Retention</th>
                      <th>Target Workload</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>ais.positions.raw</td>
                      <td>6</td>
                      <td>1</td>
                      <td>delete</td>
                      <td>24 Hours</td>
                      <td>Raw incoming AIS telemetry stream from receivers</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>ais.positions.dlq</td>
                      <td>3</td>
                      <td>1</td>
                      <td>delete</td>
                      <td>7 Days</td>
                      <td>Isolated malformed messages violating data contract</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>ais.alerts</td>
                      <td>3</td>
                      <td>1</td>
                      <td>compact, delete</td>
                      <td>30 Days</td>
                      <td>Deduplicated anomaly detections published for downstream ops</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Callout type="note">
                Our topic partition strategy uses <strong>6 partitions</strong> for <code>ais.positions.raw</code>. This provides linear horizontal scalability for up to 6 parallel consumer workers while keeping partition rebalance overhead under 250 milliseconds.
              </Callout>

              <CodeBlock
                language="yaml"
                filename="docker-compose.yml (KRaft Broker Configuration)"
                code={`services:
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    container_name: mda-kafka-kraft
    ports:
      - "9092:9092"
      - "9093:9093"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: "broker,controller"
      KAFKA_CONTROLLER_QUORUM_VOTERS: "1@kafka:9093"
      KAFKA_LISTENERS: "PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093"
      KAFKA_ADVERTISED_LISTENERS: "PLAINTEXT://localhost:9092"
      KAFKA_CONTROLLER_LISTENER_NAMES: "CONTROLLER"
      KAFKA_INTER_BROKER_LISTENER_NAME: "PLAINTEXT"
      CLUSTER_ID: "4L622nShTUiBenYhRZziAA"
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_LOG_RETENTION_HOURS: 24`}
              />

              <h2 id="mmsi-partitioning" className="docs-h2">
                MMSI Keyed Partitioning
              </h2>
              <p className="docs-p">
                In maritime kinematic anomaly detection, <strong>event ordering is critical</strong>. If two positions for the same vessel are delivered out of order to different parallel consumers, the calculated speed (&Delta;d / &Delta;t) produces astronomical false anomalies (e.g. 800-knot jump artifacts).
              </p>
              <p className="docs-p">
                To eliminate cross-consumer race conditions, every AIS message published to Kafka is explicitly keyed by the vessel's 9-digit Maritime Mobile Service Identity (<code>MMSI</code>). Kafka's default partitioner applies a 32-bit Murmur2 hash to the key:
              </p>

              <CodeBlock
                language="math"
                filename="Kafka Partition Mapping Formula"
                code={`PartitionIndex = (toPositive(murmur2(keyBytes)) % numPartitions)

Where:
  keyBytes = str(record["MMSI"]).encode("utf-8")
  numPartitions = 6`}
              />

              <p className="docs-p">
                Because the hash is deterministic, <strong>100% of telemetry pings for a given MMSI are assigned to the exact same Kafka partition</strong>. This delivers three fundamental mathematical guarantees:
              </p>
              <ul style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px", margin: "12px 0" }}>
                <li><strong>Strict Monotonic Sequencing:</strong> All pings for vessel M_i are consumed sequentially in FIFO order by a single consumer thread.</li>
                <li><strong>Partition-Level Isolation:</strong> Kinematic state tracking for 50,000 concurrent vessels is naturally sharded without distributed locks.</li>
                <li><strong>Replay Determinism:</strong> Historical AIS log playback produces identical state sequences across different test runs.</li>
              </ul>

              <CodeBlock
                language="python"
                filename="backend/streaming/producer.py (Keyed Produce Loop)"
                code={`# High-throughput producer configuration with MMSI keying
producer = Producer({
    "bootstrap.servers": "localhost:9092",
    "queue.buffering.max.messages": 100000,
    "queue.buffering.max.ms": 50,
    "compression.type": "lz4",
    "client.id": "ais-stream-replay",
})

# Crucial: message key MUST be the MMSI byte string
producer.produce(
    topic="ais.positions.raw",
    key=str(record["MMSI"]).encode("utf-8"),
    value=json.dumps(record).encode("utf-8"),
    on_delivery=delivery_callback
)
producer.poll(0)`}
              />

              <Callout type="tip">
                To test system resilience against terrestrial repeater delay and multi-hop satellite relay delay, the producer includes a configurable <strong>jitter buffer</strong> (<code>--late-fraction 0.05 --max-lateness 90.0s</code>). This injects artificial out-of-order latency into 5% of messages to verify that consumers correctly reorder or reject delayed telemetry.
              </Callout>
            </article>
          )}

          {activeDocId === "consumer-dlq" && (
            <article>
              <h1 className="docs-title">Consumer & Dead-Letter Queue</h1>
              <p className="docs-subtitle">
                Stateful stream consumption, high-throughput micro-batching, and malformed telemetry isolation.
              </p>
              <div className="docs-divider" />

              <h2 id="batch-processing" className="docs-h2">
                Batch Ingestion & Offsets
              </h2>
              <p className="docs-p">
                AIS transponders in active maritime channels broadcast position reports every 2 to 10 seconds. Inserting single rows individually into PostgreSQL produces severe connection and transaction overhead, choking throughput below 250 records/second.
              </p>
              <p className="docs-p">
                The <code>consumer.py</code> engine implements an adaptive <strong>micro-batching pipeline</strong> with manual offset commits:
              </p>
              <ul style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px", margin: "12px 0" }}>
                <li><strong>Batch Size Threshold:</strong> Batches accumulate up to 500 valid records in memory.</li>
                <li><strong>Time Interval Threshold:</strong> If traffic is low, batches flush automatically every 1,000 ms to preserve real-time tactical radar responsiveness.</li>
                <li><strong>Vectorized Bulk Insertion:</strong> Uses <code>psycopg2.extras.execute_values</code> to stream multi-row SQL tuples directly into PostGIS.</li>
              </ul>

              <CodeBlock
                language="python"
                filename="backend/streaming/consumer.py (Batch Flush & Manual Commit)"
                code={`# 1. Micro-batching threshold check
curr_time = time.time()
time_since_flush = (curr_time - last_flush_time) * 1000

if len(batch_records) >= args.batch_size or (batch_records and time_since_flush >= args.flush_interval_ms):
    # 2. In-memory kinematic validation & rule checks
    processed_records, alerts = process_batch(batch_records, state_table)

    # 3. Atomic database write (cold positions + hot upsert + alerts)
    flush_batch_to_postgres(cursor, conn, processed_records, state_table, alerts)

    # 4. Strict manual Kafka offset commit ONLY after PostgreSQL transaction succeeds
    if batch_messages:
        consumer.commit(batch_messages[-1])
        last_flush_time = time.time()
        batch_records.clear()
        batch_messages.clear()`}
              />

              <Callout type="warning">
                <strong>At-Least-Once Delivery Guarantees:</strong> <code>enable.auto.commit</code> is explicitly set to <code>False</code>. If the database crashes or network connectivity is severed mid-batch, Kafka offsets remain uncommitted. When the consumer restarts, the partition rewinds to the last committed offset, preventing any unrecorded vessel telemetry.
              </Callout>

              <h2 id="dlq-routing" className="docs-h2">
                Dead-Letter Queue Isolation
              </h2>
              <p className="docs-p">
                Real-world AIS data feeds from coastal receivers and satellite demodulators contain significant noise: uncalibrated transponders broadcasting sentinel coordinates (91&deg; Lat, 181&deg; Lon), malformed GPS payloads, and corrupt vessel MMSI strings. Allowing bad telemetry into the core pipeline causes mathematical exceptions and corrupts PostGIS geometry layers.
              </p>
              <p className="docs-p">
                Rather than silently dropping corrupt pings or crashing the consumer, every message is verified against the <strong>Data Contract</strong>. Messages failing validation are isolated and routed immediately to the <strong>Dead-Letter Queue</strong> topic (<code>ais.positions.dlq</code>).
              </p>

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Rejection Code</th>
                      <th>Validation Condition</th>
                      <th>Root Cause</th>
                      <th>Routing Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#f43f5e" }}>bad_mmsi</td>
                      <td>MMSI &lt; 100000000 or &gt; 999999999</td>
                      <td>Truncated packet or test bench radio</td>
                      <td>Forward to DLQ, increment counter</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#f43f5e" }}>bad_lat_lon</td>
                      <td>|LAT| &gt; 90.0 or |LON| &gt; 180.0</td>
                      <td>GPS lock failure or unassigned sentinel</td>
                      <td>Forward to DLQ, increment counter</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#f43f5e" }}>bad_timestamp</td>
                      <td>Invalid ISO-8601 or future timestamp</td>
                      <td>Drifting onboard vessel clock</td>
                      <td>Forward to DLQ, increment counter</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#f43f5e" }}>corrupt_json</td>
                      <td>JSON decode syntax error</td>
                      <td>TCP packet framing truncation</td>
                      <td>Forward to DLQ, increment counter</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <CodeBlock
                language="json"
                filename="ais.positions.dlq Payload Structure"
                code={`{
  "MMSI": 99999,
  "BaseDateTime": "2024-01-15T08:12:00Z",
  "LAT": 91.0,
  "LON": -122.4194,
  "SOG": 12.4,
  "COG": 180.0,
  "reject_reason": "bad_lat_lon",
  "rejected_at": "2026-09-24T17:45:00.123456Z"
}`}
              />

              <p className="docs-p">
                The Dead-Letter Queue retains rejected payloads for 7 days. Platform operators monitor the DLQ rate in real time via <code>GET /api/metrics</code>. An alert triggers if the DLQ fraction exceeds 1.5% of total ingested message volume, signaling potential receiver demodulation errors.
              </p>
            </article>
          )}

          {activeDocId === "postgis-tables" && (
            <article>
              <h1 className="docs-title">PostGIS Hot/Cold Table Split</h1>
              <p className="docs-subtitle">
                Dual-tier spatial storage architecture separating sub-millisecond tactical radar queries from terabyte-scale historical audit trails.
              </p>
              <div className="docs-divider" />

              <h2 id="hot-table" className="docs-h2">
                Hot Table: vessel_latest_state
              </h2>
              <p className="docs-p">
                Tactical maritime command consoles require real-time map updates (at 30 to 60 FPS) rendering thousands of active vessel icons within a user's viewport. If the map query scans an append-only table containing 50 million historical waypoints, query latency skyrockets to multiple seconds, rendering interactive pan and zoom impossible.
              </p>
              <p className="docs-p">
                To solve this, our schema decouples state tracking into a <strong>Hot Store</strong> (<code>vessel_latest_state</code>) containing exactly <strong>one row per active MMSI</strong>.
              </p>

              <CodeBlock
                language="sql"
                filename="db/init/01_schema.sql (Hot Store Schema)"
                code={`CREATE TABLE IF NOT EXISTS vessel_latest_state (
    mmsi BIGINT PRIMARY KEY,
    last_seen TIMESTAMPTZ NOT NULL,
    last_geom GEOMETRY(Point, 4326) NOT NULL,
    last_lat DOUBLE PRECISION,
    last_lon DOUBLE PRECISION,
    last_sog REAL,
    last_cog REAL,
    last_heading REAL,
    vessel_type INT,
    transceiver_class CHAR(1),
    last_cell TEXT,
    msg_count INT DEFAULT 1,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'stale', 'dark'))
);

-- Crucial Spatial Index for Tactical Radar Viewport Bounding Box Queries
CREATE INDEX IF NOT EXISTS idx_vessel_latest_state_geom 
    ON vessel_latest_state USING GIST (last_geom);

-- Temporal Index for Sweeper Absence Detection
CREATE INDEX IF NOT EXISTS idx_vessel_latest_state_last_seen 
    ON vessel_latest_state (last_seen);

-- Status Filter Index
CREATE INDEX IF NOT EXISTS idx_vessel_latest_state_status 
    ON vessel_latest_state (status);`}
              />

              <p className="docs-p">
                Whenever a valid message arrives, the consumer executes an atomic PostGIS upsert. The <code>status</code> field dynamically reflects detection transitions:
              </p>
              <ul style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px", margin: "12px 0" }}>
                <li><code>active</code>: Normal broadcasting within expected H3 coverage intervals.</li>
                <li><code>stale</code>: Reporting gap exceeding median expectations (p50) but below anomaly threshold (p99).</li>
                <li><code>dark</code>: Confirmed absence anomaly flagged by the Sweeper Daemon.</li>
              </ul>

              <h2 id="cold-table" className="docs-h2">
                Cold Table: vessel_positions
              </h2>
              <p className="docs-p">
                While the hot table maintains live tactical coordinates, forensic analysis and trajectory reconstruction (e.g. rendering historical breadcrumb tracks via <code>GET /api/vessels/[mmsi]/track</code>) require the complete chronological ping history.
              </p>
              <p className="docs-p">
                The <strong>Cold Store</strong> (<code>vessel_positions</code>) is an append-only table <strong>range-partitioned by month</strong> on the event timestamp column (<code>ts</code>).
              </p>

              <CodeBlock
                language="sql"
                filename="db/init/01_schema.sql (Partitioned Cold Store)"
                code={`CREATE TABLE IF NOT EXISTS vessel_positions (
    mmsi BIGINT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    sog REAL,
    cog REAL,
    heading REAL,
    vessel_type INT,
    transceiver_class CHAR(1),
    cell TEXT,
    PRIMARY KEY (mmsi, ts)
) PARTITION BY RANGE (ts);

-- Monthly range partitions
CREATE TABLE IF NOT EXISTS vessel_positions_2024_01 PARTITION OF vessel_positions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS vessel_positions_2024_02 PARTITION OF vessel_positions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Block Range Index (BRIN) for high-density timestamp ranges
CREATE INDEX IF NOT EXISTS idx_vessel_positions_ts 
    ON vessel_positions USING BRIN (ts);

-- Spatial GIST index for bounding box trajectory searches
CREATE INDEX IF NOT EXISTS idx_vessel_positions_geom 
    ON vessel_positions USING GIST (geom);`}
              />

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Dimension</th>
                      <th>Hot Table (vessel_latest_state)</th>
                      <th>Cold Table (vessel_positions)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Storage Cardinality</td>
                      <td>1 row per tracked vessel (~50,000 rows)</td>
                      <td>Append-only history (50M+ rows per month)</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Partitioning</td>
                      <td>Unpartitioned with GiST & B-tree indices</td>
                      <td>Range-partitioned by month on <code>ts</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Write Pattern</td>
                      <td>Atomic <code>ON CONFLICT DO UPDATE</code></td>
                      <td>Append-only batch bulk inserts</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Query Latency</td>
                      <td style={{ color: "#10b981", fontWeight: 700 }}>&lt; 3 milliseconds</td>
                      <td>50&ndash;200 ms (partition pruned)</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>Primary Purpose</td>
                      <td>Tactical Deck.gl map & Sweeper scans</td>
                      <td>Historical trajectory audit & ML training</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Callout type="tip">
                <strong>Why BRIN Indexes?</strong> Standard B-Trees for 100 million timestamps require several gigabytes of RAM. Because incoming AIS logs are naturally chronological, <strong>BRIN (Block Range Index)</strong> summaries require less than 1% of the disk footprint while allowing PostgreSQL partition pruning to skip unneeded monthly tables instantly.
              </Callout>
            </article>
          )}

          {activeDocId === "sweeper-daemon" && (
            <article>
              <h1 className="docs-title">Periodic Sweeper Daemon</h1>
              <p className="docs-subtitle">
                The absence-driven detection engine scanning hot state against spatial empirical priors and marine protected zones.
              </p>
              <div className="docs-divider" />

              <h2 id="sweeper-lifecycle" className="docs-h2">
                Sweeper Daemon Execution Loop
              </h2>
              <p className="docs-p">
                Most streaming anomaly detectors are event-driven: they trigger an action when a message arrives (<code>onMessage(event)</code>). However, <strong>a dark vessel is defined by a non-event</strong>: a rogue vessel that intentionally powers down its AIS transmitter will never emit an event to trigger a detector!
              </p>
              <p className="docs-p">
                Therefore, absence detection must be an active, time-driven polling process. The <code>sweeper.py</code> daemon executes on a continuous background tick (default: <strong>every 60 seconds</strong>):
              </p>

              <CodeBlock
                language="python"
                filename="backend/streaming/sweeper.py (Execution Loop)"
                code={`def run_sweeper(args):
    conn = psycopg2.connect(args.db_url)
    logger.info(f"Starting Dark Vessel Sweeper daemon: interval={args.interval}s, min_obs={args.min_obs}...")

    while True:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # 1. Execute absence scan with spatial prior join
                cur.execute(SWEEP_SQL, {
                    "min_score": args.min_score,
                    "min_obs": args.min_obs,
                    "dedup_hours": args.dedup_hours,
                })
                new_alerts = cur.fetchall()

                # 2. Update status of newly detected dark hulls
                if new_alerts:
                    dark_mmsis = tuple(a["mmsi"] for a in new_alerts)
                    cur.execute(UPDATE_STATUS_SQL, (dark_mmsis,))
                    conn.commit()
                    logger.warning(f"[SWEEPER] Flagged {len(new_alerts)} dark vessel(s): {dark_mmsis}")
        except Exception as e:
            logger.error(f"[SWEEPER ERROR] {e}")
            conn.rollback()

        time.sleep(args.interval)`}
              />

              <h2 id="alert-generation" className="docs-h2">
                Alert Generation & Auditing
              </h2>
              <p className="docs-p">
                During each sweep cycle, the daemon executes an optimized Common Table Expression (CTE) query joining three key spatial tables:
              </p>
              <ol style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px", margin: "12px 0" }}>
                <li><code>vessel_latest_state</code>: Scans vessels currently silent for longer than their local baseline.</li>
                <li><code>coverage_prior</code>: Looks up the exact historical p99 gap for the vessel's last known H3 cell and transceiver class.</li>
                <li><code>geofences</code>: Performs PostGIS <code>ST_Contains</code> point-in-polygon checks to verify if the silence began inside a Marine Protected Area (MPA) or Exclusive Economic Zone (EEZ).</li>
              </ol>

              <CodeBlock
                language="sql"
                filename="backend/streaming/sweeper.py (Core Absence Sweep Query)"
                code={`WITH candidate_gaps AS (
    SELECT
        v.mmsi,
        v.last_seen,
        v.last_lat,
        v.last_lon,
        v.last_geom,
        v.transceiver_class,
        v.last_cell,
        EXTRACT(EPOCH FROM (now() - v.last_seen)) AS observed_gap_s,
        cp.p50_gap_s,
        cp.p95_gap_s,
        cp.p99_gap_s,
        cp.n_obs,
        COALESCE(g.name, 'Open Ocean') AS zone_name,
        COALESCE(g.zone_type, 'none') AS zone_type
    FROM vessel_latest_state v
    JOIN coverage_prior cp
      ON cp.cell = v.last_cell AND cp.transceiver_class = v.transceiver_class
    LEFT JOIN geofences g
      ON ST_Contains(g.geom, v.last_geom) AND g.zone_type IN ('mpa', 'eez')
    WHERE cp.n_obs >= %(min_obs)s                                    -- 1. Confidence Gating
      AND EXTRACT(EPOCH FROM (now() - v.last_seen)) > (cp.p99_gap_s * %(min_score)s)
      AND v.status != 'dark'                                          -- 2. State Guard
      AND NOT EXISTS (                                                -- 3. 6-Hour Deduplication
          SELECT 1 FROM alerts a
          WHERE a.mmsi = v.mmsi
            AND a.alert_type = 'dark_vessel'
            AND a.detected_at > now() - (%(dedup_hours)s || ' hours')::interval
      )
)
INSERT INTO alerts (mmsi, alert_type, score, severity, detected_at, last_lat, last_lon, details)
SELECT
    cg.mmsi,
    'dark_vessel',
    ROUND((cg.observed_gap_s / NULLIF(cg.p99_gap_s, 0))::numeric, 2) AS score,
    CASE
        WHEN cg.observed_gap_s > (cg.p99_gap_s * 3.0) OR cg.zone_type = 'mpa' THEN 'high'
        WHEN cg.observed_gap_s > (cg.p99_gap_s * 1.5) THEN 'medium'
        ELSE 'low'
    END AS severity,
    now(),
    cg.last_lat,
    cg.last_lon,
    jsonb_build_object(
        'gap_s', ROUND(cg.observed_gap_s::numeric, 0),
        'p99_gap_s', ROUND(cg.p99_gap_s::numeric, 0),
        'cell', cg.last_cell,
        'coverage_n', cg.n_obs,
        'zone', cg.zone_name,
        'zone_type', cg.zone_type,
        'transceiver_class', cg.transceiver_class
    )
FROM candidate_gaps cg
ON CONFLICT (mmsi, alert_type, date_trunc('hour', detected_at AT TIME ZONE 'UTC')) DO NOTHING
RETURNING mmsi, score, severity, details;`}
              />

              <Callout type="note">
                <strong>Confidence Gating Rule:</strong> If an H3 spatial cell has fewer than 500 historical observations (<code>cp.n_obs &lt; 500</code>), the sweeper automatically suppresses alerts. This prevents flagging vessels when they transit open ocean zones where terrestrial receiver coverage simply does not exist.
              </Callout>

              <p className="docs-p">
                Alerts recorded by the sweeper are immediately written to the <code>alerts</code> table and broadcast to the tactical operator console. The vessel status in <code>vessel_latest_state</code> is simultaneously toggled to <code>'dark'</code>, coloring the vessel icon in red on the live tactical radar display.
              </p>
            </article>
          )}

          {activeDocId === "prior-pipeline" && (
            <article>
              <h1 className="docs-title">Empirical Prior Generation</h1>
              <p className="docs-subtitle">
                Distributed PySpark and local DuckDB batch aggregation computing baseline reporting gap distributions across historical maritime archives.
              </p>
              <div className="docs-divider" />

              <h2 id="spark-engine" className="docs-h2">
                PySpark & DuckDB Prior Calculation
              </h2>
              <p className="docs-p">
                Static timeout heuristics fail because maritime reception quality is physically heterogeneous: Class A transponders (12.5W) achieve significantly higher coastal line-of-sight than Class B transponders (2W), and busy port straits suffer higher packet collision than open coastal waters.
              </p>
              <p className="docs-p">
                To establish an empirical baseline, the batch layer processes months of historical NOAA Marine Cadastre AIS Parquet partitions using a distributed <strong>PySpark</strong> pipeline (with a lightweight <strong>DuckDB / Pandas</strong> single-node fallback engine for local development).
              </p>

              <CodeBlock
                language="python"
                filename="backend/analysis/build_coverage_prior.py (PySpark Pipeline)"
                code={`# 1. Read multi-gigabyte historical Parquet partitions
df = spark.read.parquet("data/parquet/")

# 2. Window partition by vessel MMSI ordered chronologically
w = Window.partitionBy("MMSI").orderBy("BaseDateTime")

# 3. Compute inter-message time delta (gap_s) and H3 spatial cell
gaps = (
    df.filter(F.col("LAT").isNotNull() & F.col("LON").isNotNull())
    .withColumn("prev_ts", F.lag("BaseDateTime").over(w))
    .withColumn("gap_s", F.unix_timestamp("BaseDateTime") - F.unix_timestamp("prev_ts"))
    .withColumn("cell", h3_udf("LAT", "LON"))
    .withColumn("TransceiverClass", F.coalesce(F.col("TransceiverClass"), F.lit("A")))
    .filter(F.col("gap_s").between(1, 86400)) # Exclude cold restarts > 24h
)

# 4. Aggregate gap percentiles per spatial cell and transceiver class
prior = (
    gaps.groupBy("cell", "TransceiverClass")
    .agg(
        F.count("*").alias("n_obs"),
        F.expr("percentile_approx(gap_s, 0.50)").alias("p50_gap_s"),
        F.expr("percentile_approx(gap_s, 0.95)").alias("p95_gap_s"),
        F.expr("percentile_approx(gap_s, 0.99)").alias("p99_gap_s"),
    )
    .filter(F.col("n_obs") >= 500) # Confidence gating
)`}
              />

              <h2 id="percentile-matrix" className="docs-h2">
                Gap Percentile Matrix (p50/p95/p99)
              </h2>
              <p className="docs-p">
                For every spatial cell and transceiver class, the pipeline computes the non-parametric percentile distribution of observed reporting intervals:
              </p>
              <ul style={{ paddingLeft: "20px", color: "#a1a1aa", lineHeight: 1.8, fontSize: "14px", margin: "12px 0" }}>
                <li><strong>p50 (Median Cadence):</strong> The typical inter-message reporting cadence under normal sea-state and radio conditions (typically 10s to 3m in monitored waters).</li>
                <li><strong>p95 (Upper Operational Interval):</strong> The 95th percentile interval capturing minor propagation fading, course alteration delays, and repeater collisions.</li>
                <li><strong>p99 (Empirical Anomaly Threshold):</strong> The 99th percentile cutoff. In monitored coastal waters with dense receiver coverage, p99 is under 15 minutes. In unmonitored open ocean, p99 may naturally be 4 to 8 hours.</li>
              </ul>

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>H3 Spatial Cell</th>
                      <th>Class</th>
                      <th>Observations (N)</th>
                      <th>p50 (Median)</th>
                      <th>p95 Gap</th>
                      <th>p99 Baseline</th>
                      <th>Zone Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>85283473fffffff</td>
                      <td>A</td>
                      <td>428,190</td>
                      <td>12s</td>
                      <td>45s</td>
                      <td style={{ color: "#10b981", fontWeight: 700 }}>180s (3m)</td>
                      <td>Harbor Entrance / Dense Terrestrial</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>85283473fffffff</td>
                      <td>B</td>
                      <td>89,420</td>
                      <td>30s</td>
                      <td>120s</td>
                      <td style={{ color: "#10b981", fontWeight: 700 }}>480s (8m)</td>
                      <td>Harbor Entrance (Class B Lower Power)</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>8529a1b7fffffff</td>
                      <td>A</td>
                      <td>14,200</td>
                      <td>4m</td>
                      <td>25m</td>
                      <td style={{ color: "#f59e0b", fontWeight: 700 }}>45m</td>
                      <td>Near-Shore Coastal Transition (~40 nm)</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>8529b563fffffff</td>
                      <td>A</td>
                      <td>840</td>
                      <td>45m</td>
                      <td>3.5h</td>
                      <td style={{ color: "#f43f5e", fontWeight: 700 }}>5.8h</td>
                      <td>Open Ocean / Intermittent Satellite</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <CodeBlock
                language="sql"
                filename="PostgreSQL Schema: coverage_prior"
                code={`CREATE TABLE IF NOT EXISTS coverage_prior (
    cell TEXT NOT NULL,
    transceiver_class CHAR(1) NOT NULL,
    n_obs BIGINT NOT NULL,
    p50_gap_s REAL NOT NULL,
    p95_gap_s REAL NOT NULL,
    p99_gap_s REAL NOT NULL,
    PRIMARY KEY (cell, transceiver_class)
);

CREATE INDEX IF NOT EXISTS idx_coverage_prior_cell ON coverage_prior (cell);`}
              />

              <Callout type="note">
                <strong>Why Confidence Gating Matters:</strong> Cells with fewer than 500 total historical observations (<code>n_obs &lt; 500</code>) are excluded from the prior table. During live streaming, if a vessel goes silent in an unindexed cell, the absence sweeper automatically suppresses alerts, eliminating false positive alerts on open ocean fringes.
              </Callout>
            </article>
          )}

          {activeDocId === "h3-indexing" && (
            <article>
              <h1 className="docs-title">H3 Hexagonal Indexing</h1>
              <p className="docs-subtitle">
                Discrete global grid systems, hexagonal topology advantages, and spatial resolution tuning for VHF coverage.
              </p>
              <div className="docs-divider" />

              <h2 id="hex-properties" className="docs-h2">
                Uber H3 Resolution 5 Properties
              </h2>
              <p className="docs-p">
                Partitioning the earth's oceans for coverage analysis requires a discrete global grid system (DGGS). Traditional latitude/longitude grid rectangles suffer from severe geometric distortion: cell surface area collapses toward the poles, and Cartesian square cells exhibit unequal diagonal neighbor distances (&radic;2 &approx; 1.414x farther than orthogonal neighbors).
              </p>
              <p className="docs-p">
                We utilize <strong>Uber H3</strong>, a hierarchical hexagonal discrete spatial index. Hexagons offer uniform adjacency: <strong>every adjacent neighbor is strictly equidistant</strong>, with identical centroid-to-centroid step distance across all 6 directional vectors.
              </p>

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>H3 Resolution</th>
                      <th>Avg Hexagon Area</th>
                      <th>Avg Edge Length</th>
                      <th>Earth Coverage</th>
                      <th>Suitability for AIS Surveillance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Resolution 3</td>
                      <td>11,000 km&sup2;</td>
                      <td>59.8 km</td>
                      <td>41,162 cells</td>
                      <td>Too coarse: Blurs coastal reception boundaries into open ocean</td>
                    </tr>
                    <tr>
                      <td>Resolution 4</td>
                      <td>1,770 km&sup2;</td>
                      <td>22.6 km</td>
                      <td>288,122 cells</td>
                      <td>Regional maritime traffic overview</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>Resolution 5 (Selected)</td>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>252.9 km&sup2;</td>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>8.54 km</td>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>2,016,842 cells</td>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>Optimal balance: Matches VHF curvature limits while preserving N &ge; 500</td>
                    </tr>
                    <tr>
                      <td>Resolution 6</td>
                      <td>36.1 km&sup2;</td>
                      <td>3.23 km</td>
                      <td>14,117,882 cells</td>
                      <td>Too sparse: Coastal cells suffer under-sampling (&lt;500 observations)</td>
                    </tr>
                    <tr>
                      <td>Resolution 7</td>
                      <td>5.16 km&sup2;</td>
                      <td>1.22 km</td>
                      <td>98,825,162 cells</td>
                      <td>Port berth & dock-scale tracking only</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Callout type="tip">
                <strong>Why Resolution 5 is the Mathematical Sweet Spot:</strong> Terrestrial VHF line-of-sight terminates between 40 and 60 nautical miles offshore. Resolution 5 hexagons have a diameter of ~17.1 km (~9.2 nm). This provides 4 to 6 discrete spatial steps across the coastal drop-off transition zone while ensuring that moderate shipping lanes accumulate sufficient pings to build statistically robust 99th percentile baselines.
              </Callout>

              <h2 id="spatial-join" className="docs-h2">
                Spatial Hexagonal Joins
              </h2>
              <p className="docs-p">
                Traditional GIS pipelines join vessel waypoints to spatial polygons via <code>ST_Contains</code>, which requires expensive point-in-polygon ray-casting ($O(N)$ geometry vertex tests).
              </p>
              <p className="docs-p">
                With H3 indexing, spatial localization is an <strong>O(1) mathematical coordinate projection</strong>:
              </p>

              <CodeBlock
                language="python"
                filename="Spatial H3 Coordinate Projection"
                code={`import h3

# Convert GPS coordinates to 64-bit H3 index in O(1) time
lat, lon = 37.7749, -122.4194
h3_cell = h3.latlng_to_cell(lat, lon, res=5)
# Output: "85283473fffffff"

# Retrieve 6 equidistant neighbor cells for spatial smoothing
neighbors = h3.grid_disk(h3_cell, k=1)
# Returns set of 7 cells (center + 6 neighbors)`}
              />

              <p className="docs-p">
                Because H3 cell IDs are 15-character hex strings (e.g. <code>85283473fffffff</code>), spatial joins between <code>vessel_latest_state</code> and <code>coverage_prior</code> execute as native <strong>hash equality joins</strong> on B-Tree indexed strings, delivering sub-microsecond dictionary lookups during high-velocity streaming ingestion.
              </p>
            </article>
          )}

          {activeDocId === "feature-engineering" && (
            <article>
              <h1 className="docs-title">Trajectory Feature Extraction</h1>
              <p className="docs-subtitle">
                1-hour tumbling window transformations, directional circular variance, and trajectory tortuosity metrics.
              </p>
              <div className="docs-divider" />

              <h2 id="kinematic-features" className="docs-h2">
                Extracted Kinematic Features
              </h2>
              <p className="docs-p">
                Rule-based detectors easily catch threshold violations (e.g. speed &gt; 35 kn or static absence). However, complex evasive maneuvers—such as illegal pair-trawling inside protected reserves, unauthorized mid-ocean transshipment encounters, or systematic drifting—require unsupervised machine learning.
              </p>
              <p className="docs-p">
                The <code>features.py</code> engine extracts a <strong>10-dimensional numerical feature vector</strong> over 1-hour tumbling windows per vessel (requiring a minimum of 8 pings per window):
              </p>

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Feature Name</th>
                      <th>Type</th>
                      <th>Physical Meaning</th>
                      <th>Anomaly Indicator Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>sog_mean</td>
                      <td>Continuous</td>
                      <td>Average speed over ground (knots)</td>
                      <td>Abnormally low speed in transit lanes (loitering)</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>sog_std</td>
                      <td>Continuous</td>
                      <td>Standard deviation of speed (knots)</td>
                      <td>Erratic acceleration/deceleration bursts</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>sog_max</td>
                      <td>Continuous</td>
                      <td>Peak speed observed in window</td>
                      <td>Vessel class design speed ceiling violations</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>cog_circular_std</td>
                      <td>Continuous</td>
                      <td>Circular standard deviation of COG (&deg;)</td>
                      <td>Directional weaving, circles, and evasive evasions</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>heading_cog_diff_mean</td>
                      <td>Continuous</td>
                      <td>Mean angle between Compass Heading &amp; COG (&deg;)</td>
                      <td>Severe crabbing, leeway drift, or uncoupled sensors</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>path_tortuosity</td>
                      <td>Ratio</td>
                      <td>Total trajectory length / Net displacement</td>
                      <td>Closed-loop loitering or illegal fishing patterns</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>total_path_km</td>
                      <td>Continuous</td>
                      <td>Sum of sequential Haversine segments</td>
                      <td>Mileage covered in the 1-hour tumbling window</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>max_gap_s</td>
                      <td>Continuous</td>
                      <td>Maximum inter-ping reporting silence</td>
                      <td>Short-duration intermittent deactivations</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>gap_count_gt_5m</td>
                      <td>Discrete</td>
                      <td>Number of gaps exceeding 300 seconds</td>
                      <td>Intermittent transponder cycling cadence</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>ping_count</td>
                      <td>Discrete</td>
                      <td>Total pings ingested during the window</td>
                      <td>Reporting frequency and sensor reliability</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="tortuosity-ratio" className="docs-h2">
                Path Tortuosity Ratio
              </h2>
              <p className="docs-p">
                Commercial cargo vessels and container ships prioritize fuel efficiency and navigate in nearly straight rhumb lines or great circle routes. In contrast, illicit vessels engaged in bottom-trawling, drift-net fishing, or clandestine rendezvous cruise in erratic loops.
              </p>
              <p className="docs-p">
                We quantify track crookedness using the <strong>Path Tortuosity Ratio</strong> (&tau;):
              </p>

              <CodeBlock
                language="math"
                filename="Trajectory Tortuosity Formulation"
                code={`τ = TotalPathLength / NetDisplacement

Where:
  TotalPathLength = sum_{i=1}^{N-1} Haversine(p_i, p_{i+1})
  NetDisplacement = Haversine(p_1, p_N)`}
              />

              <p className="docs-p">
                A commercial vessel transiting an open sea corridor yields &tau; &approx; 1.05 to 1.15. Conversely, an illegal fishing trawler executing repeated sweeps yields &tau; &gt; 3.5.
              </p>

              <Callout type="warning">
                <strong>Handling Angular Discontinuity in COG:</strong> Standard arithmetic variance cannot be applied to Course Over Ground (COG). For example, two readings of 359&deg; and 1&deg; yield an arithmetic mean of 180&deg; and variance of 32,041 (a catastrophic false anomaly!), when in reality the vessel changed heading by only 2 degrees. We compute directional variance using <strong>Mardia-Jupp circular statistics</strong>:
              </Callout>

              <CodeBlock
                language="python"
                filename="backend/detection/features.py (Circular Dispersion)"
                code={`def circular_std_degrees(angles_deg: np.ndarray) -> float:
    """Calculate circular standard deviation in degrees."""
    if len(angles_deg) == 0:
        return 0.0

    rads = np.radians(angles_deg)
    sin_mean = np.mean(np.sin(rads))
    cos_mean = np.mean(np.cos(rads))
    r = np.hypot(sin_mean, cos_mean)

    if r <= 0.0:
        return 180.0
    if r >= 1.0:
        return 0.0

    # Circular standard deviation formula
    circ_std_rad = np.sqrt(-2.0 * np.log(min(1.0, r)))
    return float(np.degrees(circ_std_rad))`}
              />
            </article>
          )}

          {activeDocId === "api-vessels" && (
            <article>
              <h1 className="docs-title">GET /api/vessels</h1>
              <p className="docs-subtitle">
                Retrieve real-time surveillance snapshots of all tracked vessels directly from the PostGIS hot store.
              </p>
              <div className="docs-divider" />

              <h2 id="endpoint-spec" className="docs-h2">
                Endpoint Specification
              </h2>
              <p className="docs-p">
                Queries the <code>vessel_latest_state</code> hot table to return the latest known kinematic state, transponder telemetry, and anomaly classification for all currently tracked hulls. Results are ordered chronologically by <code>last_seen DESC</code> (capped at 10,000 records).
              </p>

              <CodeBlock
                language="http"
                filename="HTTP Request"
                code={`GET /api/vessels HTTP/1.1
Host: localhost:3000
Accept: application/json`}
              />

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Required</th>
                      <th>Default</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>None</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>Endpoint accepts no query parameters; returns current fleet snapshot up to 10,000 vessels.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="response-schema" className="docs-h2">
                Response JSON Schema
              </h2>
              <p className="docs-p">
                Returns an envelope containing the query data source, total record count, and an array of vessel state objects conforming to the <code>VesselState</code> TypeScript interface:
              </p>

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Field Name</th>
                      <th>Type</th>
                      <th>Description &amp; Range</th>
                      <th>Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>source</td>
                      <td>string</td>
                      <td>Data provider: <code>"database"</code> (live PostgreSQL) or <code>"mock"</code> (fallback).</td>
                      <td><code>"database"</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>count</td>
                      <td>integer</td>
                      <td>Total number of vessel records returned in payload.</td>
                      <td><code>542</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].mmsi</td>
                      <td>integer</td>
                      <td>9-digit Maritime Mobile Service Identity (unique vessel primary key).</td>
                      <td><code>367123456</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].last_seen</td>
                      <td>string</td>
                      <td>ISO-8601 UTC timestamp of the most recent verified AIS position broadcast.</td>
                      <td><code>"2026-09-24T18:42:10.000Z"</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].lat</td>
                      <td>float</td>
                      <td>WGS84 latitude coordinate in degrees [-90.0, 90.0].</td>
                      <td><code>37.8201</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].lon</td>
                      <td>float</td>
                      <td>WGS84 longitude coordinate in degrees [-180.0, 180.0].</td>
                      <td><code>-122.4206</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].sog</td>
                      <td>float | null</td>
                      <td>Speed over ground in knots (sentinel 102.3 normalized to null).</td>
                      <td><code>12.4</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].cog</td>
                      <td>float | null</td>
                      <td>Course over ground in degrees [0.0, 359.9] (sentinel 360.0 normalized to null).</td>
                      <td><code>182.5</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].heading</td>
                      <td>float | null</td>
                      <td>True compass heading in degrees [0, 359] (sentinel 511 normalized to null).</td>
                      <td><code>180.0</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].vessel_type</td>
                      <td>integer | null</td>
                      <td>ITU/USCG classification code (e.g. 70=Cargo, 80=Tanker, 30=Fishing, 52=Tug).</td>
                      <td><code>70</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].transceiver_class</td>
                      <td>string</td>
                      <td>Transponder certification standard: <code>"A"</code> (12.5W SOLAS) or <code>"B"</code> (2W small craft).</td>
                      <td><code>"A"</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].cell</td>
                      <td>string | null</td>
                      <td>Uber H3 resolution 5 hexagonal spatial index corresponding to coordinate.</td>
                      <td><code>"85283473fffffff"</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].msg_count</td>
                      <td>integer</td>
                      <td>Cumulative broadcast counter ingested since pipeline initialization.</td>
                      <td><code>1420</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>vessels[].status</td>
                      <td>string</td>
                      <td>Surveillance status: <code>"active"</code> (broadcasting), <code>"stale"</code> (&gt;p50), <code>"dark"</code> (&gt;p99 anomaly).</td>
                      <td><code>"active"</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <CodeBlock
                language="json"
                filename="Sample 200 OK Response"
                code={`{
  "source": "database",
  "count": 2,
  "vessels": [
    {
      "mmsi": 367123456,
      "last_seen": "2026-09-24T18:45:00.000Z",
      "lat": 37.8201,
      "lon": -122.4206,
      "sog": 0.2,
      "cog": 180.0,
      "heading": 182.0,
      "vessel_type": 70,
      "transceiver_class": "A",
      "cell": "85283473fffffff",
      "msg_count": 342,
      "status": "dark"
    },
    {
      "mmsi": 368987654,
      "last_seen": "2026-09-24T18:44:30.000Z",
      "lat": 37.795,
      "lon": -122.385,
      "sog": 12.8,
      "cog": 95.0,
      "heading": 96.0,
      "vessel_type": 80,
      "transceiver_class": "A",
      "cell": "85283473fffffff",
      "msg_count": 812,
      "status": "active"
    }
  ]
}`}
              />

              <Callout type="tip">
                <strong>Sub-Millisecond Dashboard Rendering:</strong> This endpoint executes a fast index scan over <code>vessel_latest_state</code> using <code>idx_vessel_latest_state_last_seen</code>. Because the table is sharded from historical logs, response latency remains under 5ms even when the historical cold store exceeds 100M rows.
              </Callout>
            </article>
          )}

          {activeDocId === "api-alerts" && (
            <article>
              <h1 className="docs-title">GET /api/alerts</h1>
              <p className="docs-subtitle">
                Query active and historical maritime anomaly alerts with structured kinematic and spatial evidence.
              </p>
              <div className="docs-divider" />

              <h2 id="alerts-spec" className="docs-h2">
                Endpoint Specification
              </h2>
              <p className="docs-p">
                Retrieves detection events generated by the Sweeper Daemon, rule-based kinematic engines, and unsupervised Isolation Forest ML scorers. Alerts include contextual forensic details (observed silence duration, local H3 p99 baseline, protected zone cross-reference, and implied velocities).
              </p>

              <CodeBlock
                language="http"
                filename="HTTP Request"
                code={`GET /api/alerts?severity=high&type=dark_vessel HTTP/1.1
Host: localhost:3000
Accept: application/json`}
              />

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Query Parameter</th>
                      <th>Type</th>
                      <th>Required</th>
                      <th>Allowed Values</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>severity</td>
                      <td>string</td>
                      <td>Optional</td>
                      <td><code>low</code> | <code>medium</code> | <code>high</code></td>
                      <td>Filter alerts by risk tier. High represents &gt;3.0x p99 gap, speed jumps &gt;60kn, or MPA incursions.</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>type</td>
                      <td>string</td>
                      <td>Optional</td>
                      <td><code>dark_vessel</code>, <code>spoof</code>, <code>loiter</code>, <code>mmsi_collision</code>, <code>ml_anomaly</code></td>
                      <td>Filter alerts by specific detection engine source.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="alerts-schema" className="docs-h2">
                Alert Record JSON Schema
              </h2>
              <p className="docs-p">
                Returns the detection metadata conforming to the <code>AlertRecord</code> TypeScript interface:
              </p>

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Field Name</th>
                      <th>Type</th>
                      <th>Description &amp; Semantics</th>
                      <th>Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>id</td>
                      <td>integer</td>
                      <td>Unique sequential alert identifier.</td>
                      <td><code>142</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>mmsi</td>
                      <td>integer</td>
                      <td>Vessel MMSI responsible for the detected violation.</td>
                      <td><code>367123456</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>alert_type</td>
                      <td>string</td>
                      <td>Detector class: <code>dark_vessel</code>, <code>spoof</code>, <code>loiter</code>, <code>mmsi_collision</code>, or <code>ml_anomaly</code>.</td>
                      <td><code>"dark_vessel"</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>score</td>
                      <td>float</td>
                      <td>Normalized anomaly severity score (e.g. observed_gap_s / p99_gap_s).</td>
                      <td><code>3.70</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>severity</td>
                      <td>string</td>
                      <td>Priority triage classification: <code>"low"</code>, <code>"medium"</code>, or <code>"high"</code>.</td>
                      <td><code>"high"</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>detected_at</td>
                      <td>string</td>
                      <td>ISO-8601 UTC timestamp when the violation was verified.</td>
                      <td><code>"2026-09-24T18:30:00.000Z"</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>details</td>
                      <td>object</td>
                      <td>JSONB payload containing structured audit evidence for human radar operators.</td>
                      <td>See payload below</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <CodeBlock
                language="json"
                filename="Sample 200 OK Response"
                code={`{
  "source": "database",
  "count": 2,
  "alerts": [
    {
      "id": 1,
      "mmsi": 367123456,
      "alert_type": "dark_vessel",
      "score": 3.7,
      "severity": "high",
      "detected_at": "2026-09-24T18:30:00.000Z",
      "last_lat": 37.8201,
      "last_lon": -122.4206,
      "details": {
        "gap_s": 11340,
        "p99_gap_s": 3065,
        "cell": "85283473fffffff",
        "coverage_n": 8421,
        "zone": "Greater Farallones NMS",
        "transceiver_class": "A"
      }
    },
    {
      "id": 2,
      "mmsi": 369888777,
      "alert_type": "spoof",
      "score": 6.2,
      "severity": "high",
      "detected_at": "2026-09-24T17:15:00.000Z",
      "last_lat": 37.65,
      "last_lon": -122.75,
      "details": {
        "implied_speed_knots": 84.5,
        "transceiver_class": "A"
      }
    }
  ]
}`}
              />

              <Callout type="note">
                <strong>Hourly Deduplication Guarantee:</strong> The database enforces an hourly unique index <code>uq_alerts_mmsi_type_hour</code> on <code>(mmsi, alert_type, date_trunc('hour', detected_at))</code>. This prevents telemetry loops from spamming operator alert feeds during prolonged deactivation windows.
              </Callout>
            </article>
          )}

          {activeDocId === "api-geofences" && (
            <article>
              <h1 className="docs-title">GET /api/geofences</h1>
              <p className="docs-subtitle">
                Retrieve GeoJSON FeatureCollection boundaries for Marine Protected Areas (MPAs), EEZs, and port exclusion zones.
              </p>
              <div className="docs-divider" />

              <h2 id="geofences-spec" className="docs-h2">
                Endpoint Specification
              </h2>
              <p className="docs-p">
                Queries the <code>geofences</code> PostGIS table and serializes spatial boundary polygons directly into standard RFC 7946 <strong>GeoJSON FeatureCollection</strong> format using <code>ST_AsGeoJSON(geom)::jsonb</code>. Used by the Deck.gl GPU rendering engine to draw interactive radar boundary overlays.
              </p>

              <CodeBlock
                language="http"
                filename="HTTP Request"
                code={`GET /api/geofences HTTP/1.1
Host: localhost:3000
Accept: application/json`}
              />

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Supported Zone Type</th>
                      <th>PostGIS Classification</th>
                      <th>Regulatory Rules Applied</th>
                      <th>Radar Visual Styling</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#f43f5e" }}>mpa</td>
                      <td>Marine Protected Area / Sanctuary</td>
                      <td>Speed &lt; 1.5 kn for &gt;3h triggers Loitering Alert; absence immediately flagged High Severity</td>
                      <td>Red translucent polygon fill with crimson border</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#38bdf8" }}>eez</td>
                      <td>Exclusive Economic Zone (200 nm limit)</td>
                      <td>Sovereign maritime border enforcement and transshipment monitoring</td>
                      <td>Cyan dashed perimeter boundary line</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>port</td>
                      <td>Designated Commercial Port / Terminal</td>
                      <td>Suppresses loitering alerts to prevent false positives during legitimate berthing</td>
                      <td>Amber anchor icon marker overlay</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#cbd5e1" }}>anchorage</td>
                      <td>Official Maritime Anchorage Ground</td>
                      <td>Suppresses drift and speed ceiling warnings for anchored hulls</td>
                      <td>Grey stippled zone fill</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="geojson-schema" className="docs-h2">
                GeoJSON FeatureCollection
              </h2>
              <p className="docs-p">
                Returns standard GeoJSON with feature properties and MultiPolygon coordinates:
              </p>

              <CodeBlock
                language="json"
                filename="Sample 200 OK Response"
                code={`{
  "source": "database",
  "data": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "id": 1,
        "properties": {
          "id": 1,
          "name": "Greater Farallones National Marine Sanctuary",
          "zone_type": "mpa"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [-123.05, 37.95],
              [-122.85, 37.95],
              [-122.85, 37.65],
              [-123.15, 37.65],
              [-123.05, 37.95]
            ]
          ]
        }
      },
      {
        "type": "Feature",
        "id": 2,
        "properties": {
          "id": 2,
          "name": "US EEZ Boundary (Sector 12)",
          "zone_type": "eez"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [-124.5, 38.5],
              [-122.0, 38.5],
              [-122.0, 36.5],
              [-124.5, 36.5],
              [-124.5, 38.5]
            ]
          ]
        }
      }
    ]
  }
}`}
              />

              <Callout type="tip">
                <strong>PostGIS Spatial Indexing:</strong> The <code>geofences</code> table is indexed with a Generalized Search Tree (GiST) index: <code>CREATE INDEX idx_geofences_geom ON geofences USING GIST (geom);</code>. This allows the Sweeper and Consumer to evaluate <code>ST_Contains(geofences.geom, vessel.geom)</code> in sub-millisecond query time.
              </Callout>
            </article>
          )}

          {activeDocId === "api-metrics" && (
            <article>
              <h1 className="docs-title">GET /api/metrics</h1>
              <p className="docs-subtitle">
                Real-time pipeline health, streaming ingestion rates, Kafka lag, and surveillance fleet observability telemetry.
              </p>
              <div className="docs-divider" />

              <h2 id="metrics-spec" className="docs-h2">
                Endpoint Specification
              </h2>
              <p className="docs-p">
                Aggregates real-time pipeline performance indicators from the <code>pipeline_metrics</code> table, active vessel counts from <code>vessel_latest_state</code>, and 24-hour alert totals from <code>alerts</code>. Queried by the top tactical HUD telemetry bar in the dashboard.
              </p>

              <CodeBlock
                language="http"
                filename="HTTP Request"
                code={`GET /api/metrics HTTP/1.1
Host: localhost:3000
Accept: application/json`}
              />

              <h2 id="metrics-schema" className="docs-h2">
                Observability JSON Schema
              </h2>
              <p className="docs-p">
                Returns system metrics indicating pipeline ingestion throughput, Kafka consumer group lag, and fleet anomaly counts:
              </p>

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Metric Key</th>
                      <th>Type</th>
                      <th>Operational Target</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>source</td>
                      <td>string</td>
                      <td><code>"database"</code></td>
                      <td>Telemetry data source (switches to mock if DB offline).</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>active_vessels</td>
                      <td>integer</td>
                      <td>Dynamic count</td>
                      <td>Vessels with recent broadcasts within local H3 p50/p95 coverage intervals.</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>stale_vessels</td>
                      <td>integer</td>
                      <td>Dynamic count</td>
                      <td>Vessels exceeding expected median gap but not yet surpassing p99 threshold.</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#f43f5e" }}>dark_vessels</td>
                      <td>integer</td>
                      <td>0 (Surveillance Goal)</td>
                      <td>Total vessels currently categorized with confirmed silence anomalies.</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>total_vessels</td>
                      <td>integer</td>
                      <td>Total tracked fleet</td>
                      <td>Total distinct vessel MMSIs maintained in hot memory.</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>alerts_24h</td>
                      <td>integer</td>
                      <td>Rolling 24-hour total</td>
                      <td>Count of all verified anomaly events detected across the fleet in past 24h.</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>msgs_consumed_per_s</td>
                      <td>float</td>
                      <td>&gt; 2,500 msg/s</td>
                      <td>Current Kafka consumer throughput rate into PostGIS.</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>consumer_lag</td>
                      <td>integer</td>
                      <td>&lt; 500 messages</td>
                      <td>Cumulative offset lag across all 6 Kafka partitions.</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>dlq_rate</td>
                      <td>float</td>
                      <td>&lt; 0.015 (1.5%)</td>
                      <td>Fraction of ingested pings rejected to Dead-Letter Queue due to bad telemetry.</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>e2e_latency_s_p95</td>
                      <td>float</td>
                      <td>&lt; 5.0 seconds</td>
                      <td>95th percentile wall-clock delay between vessel broadcast and radar map display.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <CodeBlock
                language="json"
                filename="Sample 200 OK Response"
                code={`{
  "source": "database",
  "active_vessels": 420,
  "stale_vessels": 18,
  "dark_vessels": 3,
  "total_vessels": 441,
  "alerts_24h": 14,
  "msgs_consumed_per_s": 3420.5,
  "consumer_lag": 42,
  "dlq_rate": 0.006,
  "e2e_latency_s_p95": 3.8
}`}
              />

              <Callout type="note">
                <strong>Automated Alert Triggers:</strong> If <code>consumer_lag</code> exceeds 5,000 messages or <code>dlq_rate</code> exceeds 0.05 (5%), Prometheus alerts notify platform engineers to scale consumer worker replicas or inspect receiver feed corruption.
              </Callout>
            </article>
          )}

          {activeDocId === "api-track" && (
            <article>
              <h1 className="docs-title">GET /api/vessels/[mmsi]/track</h1>
              <p className="docs-subtitle">
                Retrieve historical chronologically ordered trajectory waypoints and kinematic breadcrumbs for a specific vessel.
              </p>
              <div className="docs-divider" />

              <h2 id="track-spec" className="docs-h2">
                Endpoint Specification
              </h2>
              <p className="docs-p">
                Queries the partitioned <strong>cold table</strong> (<code>vessel_positions</code>) for a given vessel MMSI. Returns up to 1,000 historical position waypoints ordered chronologically (<code>ORDER BY ts ASC</code>). Used by the Tactical Console's Vessel Drawer to draw trajectory trails and historical motion paths on the Deck.gl map.
              </p>

              <CodeBlock
                language="http"
                filename="HTTP Request"
                code={`GET /api/vessels/367123456/track HTTP/1.1
Host: localhost:3000
Accept: application/json`}
              />

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Path Parameter</th>
                      <th>Type</th>
                      <th>Required</th>
                      <th>Constraints</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>mmsi</td>
                      <td>string (integer)</td>
                      <td>Required</td>
                      <td>9-digit integer (e.g. <code>367123456</code>)</td>
                      <td>Vessel Maritime Mobile Service Identity identifier. Returns 400 Bad Request if non-numeric.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="track-schema" className="docs-h2">
                Trajectory Waypoints JSON
              </h2>
              <p className="docs-p">
                Returns the vessel identity and chronological array of coordinate waypoints:
              </p>

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>Waypoint Field</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Sample Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>ts</td>
                      <td>string</td>
                      <td>ISO-8601 UTC timestamp of historical position broadcast.</td>
                      <td><code>"2026-09-24T17:15:00.000Z"</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>lat</td>
                      <td>float</td>
                      <td>Latitude coordinate extracted via PostGIS <code>ST_Y(geom)</code>.</td>
                      <td><code>37.8201</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>lon</td>
                      <td>float</td>
                      <td>Longitude coordinate extracted via PostGIS <code>ST_X(geom)</code>.</td>
                      <td><code>-122.4206</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>sog</td>
                      <td>float | null</td>
                      <td>Speed over ground in knots at waypoint time.</td>
                      <td><code>12.4</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>cog</td>
                      <td>float | null</td>
                      <td>Course over ground in degrees at waypoint time.</td>
                      <td><code>180.0</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "var(--silver-100)" }}>heading</td>
                      <td>float | null</td>
                      <td>Compass heading in degrees at waypoint time.</td>
                      <td><code>182.0</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <CodeBlock
                language="json"
                filename="Sample 200 OK Response"
                code={`{
  "source": "database",
  "mmsi": 367123456,
  "points": [
    {
      "ts": "2026-09-24T17:00:00.000Z",
      "lat": 37.7502,
      "lon": -122.5104,
      "sog": 12.8,
      "cog": 180.0,
      "heading": 182.0
    },
    {
      "ts": "2026-09-24T17:15:00.000Z",
      "lat": 37.7850,
      "lon": -122.4650,
      "sog": 12.5,
      "cog": 180.0,
      "heading": 182.0
    },
    {
      "ts": "2026-09-24T17:30:00.000Z",
      "lat": 37.8201,
      "lon": -122.4206,
      "sog": 0.2,
      "cog": 180.0,
      "heading": 182.0
    }
  ]
}`}
              />

              <div style={{ overflowX: "auto", margin: "20px 0" }}>
                <table className="arch-table">
                  <thead>
                    <tr>
                      <th>HTTP Status</th>
                      <th>Condition</th>
                      <th>Response Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#10b981" }}>200 OK</td>
                      <td>MMSI found or synthesized fallback points returned</td>
                      <td>JSON array with <code>points</code> waypoints</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#f43f5e" }}>400 Bad Request</td>
                      <td>MMSI path parameter contains non-numeric characters</td>
                      <td><code>&#123; "error": "Invalid MMSI" &#125;</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Callout type="tip">
                <strong>Partition Pruning Optimization:</strong> Queries against <code>vessel_positions</code> utilize PostgreSQL monthly partition pruning. If the query includes a time range, only the relevant monthly partition table (e.g. <code>vessel_positions_2024_01</code>) is scanned, avoiding full table scans across multi-year archives.
              </Callout>
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
