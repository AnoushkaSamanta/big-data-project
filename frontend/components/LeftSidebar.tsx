"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Ship,
  ShieldAlert,
  Radio,
  Search,
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Navigation,
  Compass,
  AlertTriangle,
  Zap,
  Activity,
  X,
  FileText,
  Bookmark,
  Camera,
  Gauge,
  CheckCircle2,
  Anchor,
  Sliders,
  ShieldCheck,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { VesselState } from "@/app/api/vessels/route";
import { AlertRecord } from "@/app/api/alerts/route";
import {
  getVesselCountry,
  getVesselTypeName,
  getVesselPhoto,
  getMotionState,
  getNavStatusName,
  getVoyageDetails,
} from "@/lib/mmsi";

interface LeftSidebarProps {
  vessels: VesselState[];
  selectedVessel: VesselState | null;
  onSelectVessel: (v: VesselState | null) => void;
  alerts: AlertRecord[];
  metrics: {
    active_vessels: number;
    dark_vessels: number;
    alerts_24h: number;
    msgs_consumed_per_s: number;
    consumer_lag: number;
    dlq_rate: number;
  };
  isOpen: boolean;
  onToggleOpen: () => void;
  onInjectScenario?: (scenario: string) => void;
  vesselTrackPoints?: Array<{ lat: number; lon: number; ts: string }>;
}

export default function LeftSidebar({
  vessels,
  selectedVessel,
  onSelectVessel,
  alerts,
  metrics,
  isOpen,
  onToggleOpen,
  onInjectScenario,
  vesselTrackPoints = [],
}: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<"fleet" | "alerts">("fleet");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [alertSearchQuery, setAlertSearchQuery] = useState("");
  const [alertTypeFilter, setAlertTypeFilter] = useState("all");

  // Filter alerts for the alerts pane
  const filteredAlerts = React.useMemo(() => {
    let result = alerts;
    if (alertTypeFilter !== "all") {
      result = result.filter((a) => a.alert_type === alertTypeFilter);
    }
    if (alertSearchQuery.trim()) {
      const q = alertSearchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          String(a.mmsi).includes(q) ||
          (a.vessel_name && a.vessel_name.toLowerCase().includes(q)) ||
          a.alert_type.toLowerCase().includes(q)
      );
    }
    return result;
  }, [alerts, alertTypeFilter, alertSearchQuery]);

  // Filter vessels for the fleet list
  const filteredVessels = React.useMemo(() => {
    let result = vessels;

    if (selectedCategory !== "all") {
      result = result.filter((v) => {
        if (selectedCategory === "dark") return v.status === "dark";
        const code = Number(v.vessel_type) || 70;
        if (selectedCategory === "tanker") return code >= 80 && code <= 89;
        if (selectedCategory === "cargo") return code >= 70 && code <= 79;
        if (selectedCategory === "fishing") return code === 30;
        if (selectedCategory === "passenger") return code >= 60 && code <= 69;
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (v) =>
          String(v.mmsi).includes(q) ||
          (v.vessel_name && v.vessel_name.toLowerCase().includes(q))
      );
    }

    return result.slice(0, 150);
  }, [vessels, searchQuery, selectedCategory]);

  return (
    <aside className={`mt-sidebar-container ${isOpen ? "open" : "collapsed"}`}>
      {/* 1. Slim Left Icon Rail (MarineTraffic style) */}
      <div className="mt-rail">
        <div className="mt-rail-top">
          <Link href="/" className="mt-rail-brand" title="DarkVessel Maritime Intelligence">
            <Anchor size={20} className="text-white" />
          </Link>

          <button
            type="button"
            className={`mt-rail-btn ${activeTab === "fleet" && !selectedVessel ? "active" : ""}`}
            onClick={() => {
              onSelectVessel(null);
              setActiveTab("fleet");
              if (!isOpen) onToggleOpen();
            }}
            title="Live Fleet & Search"
          >
            <Ship size={18} />
            <span className="mt-rail-label">Fleet</span>
          </button>

          <button
            type="button"
            className={`mt-rail-btn ${activeTab === "alerts" && !selectedVessel ? "active" : ""}`}
            onClick={() => {
              onSelectVessel(null);
              setActiveTab("alerts");
              if (!isOpen) onToggleOpen();
            }}
            title="Anomaly Alerts Feed"
          >
            <ShieldAlert size={18} />
            <span className="mt-rail-label">Alerts</span>
            {alerts.length > 0 && <span className="mt-rail-badge">{alerts.length}</span>}
          </button>

          <Link
            href="/analytics"
            className="mt-rail-btn"
            title="ECharts Analytical Dashboard"
          >
            <BarChart3 size={18} />
            <span className="mt-rail-label">Analytics</span>
          </Link>

          <Link
            href="/docs"
            className="mt-rail-btn"
            title="Documentation & Architecture"
          >
            <BookOpen size={18} />
            <span className="mt-rail-label">Docs</span>
          </Link>
        </div>

        <div className="mt-rail-bottom">
          <button
            type="button"
            className="mt-rail-toggle-btn"
            onClick={onToggleOpen}
            title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* 2. Expandable Sidebar Panel with Butter-Smooth CSS Width Transition */}
      <div className={`mt-drawer-panel ${isOpen ? "open" : "collapsed"}`} aria-hidden={!isOpen}>
        <div className="mt-drawer-inner">
          {selectedVessel ? (
            /* Selected Vessel Details View */
            <div className="mt-vessel-selected-view">
              {(() => {
                const country = getVesselCountry(selectedVessel.mmsi);
                const typeName = getVesselTypeName(selectedVessel.vessel_type);
                const photo = getVesselPhoto(selectedVessel.vessel_type, selectedVessel.mmsi);
                const motion = getMotionState(selectedVessel.sog, selectedVessel.status);
                const vName = selectedVessel.vessel_name || `VESSEL ${selectedVessel.mmsi}`;
                const alertsOnThis = alerts.filter((a) => a.mmsi === selectedVessel.mmsi);

                return (
                  <div className="mt-vessel-card-full">
                    {/* Header with collapse & close */}
                    <div className="mt-drawer-header">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{country.flag}</span>
                        <div className="truncate">
                          <h3 className="font-bold text-slate-900 text-sm truncate">{vName}</h3>
                          <span className="text-xs text-slate-500 font-mono">MMSI: {selectedVessel.mmsi}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          className="mt-pane-collapse-btn"
                          onClick={onToggleOpen}
                          title="Collapse Sidebar"
                        >
                          <ChevronLeft size={14} />
                          <span>Collapse</span>
                        </button>
                        <button
                          type="button"
                          className="mt-icon-close"
                          onClick={() => onSelectVessel(null)}
                          title="Close vessel inspector"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Vessel Photo Preview */}
                    <div className="mt-vessel-thumb-box">
                      <img src={photo.url} alt={vName} className="mt-vessel-thumb" />
                      <div className="mt-thumb-overlay">
                        <span className="mt-thumb-badge">{typeName}</span>
                        <span className={`mt-motion-pill ${motion.statusClass}`}>{motion.label}</span>
                      </div>
                    </div>

                    {/* Primary Call to Action: Open Dedicated Route */}
                    <div className="mt-open-route-cta">
                      <Link
                        href={`/vessels/${selectedVessel.mmsi}`}
                        className="mt-pill-btn mt-pill-btn-primary w-full justify-center shadow-sm"
                      >
                        <ExternalLink size={15} />
                        <span>Open Full Ship Details Page</span>
                      </Link>
                    </div>

                    {/* Quick Specs Grid */}
                    <div className="mt-drawer-specs">
                      <div className="mt-drawer-spec-item">
                        <span className="mt-spec-key">SPEED (SOG)</span>
                        <strong className="mt-spec-val text-orange-600">
                          {selectedVessel.sog !== null && selectedVessel.sog !== undefined
                            ? `${Number(selectedVessel.sog).toFixed(1)} kn`
                            : "0.0 kn"}
                        </strong>
                      </div>
                      <div className="mt-drawer-spec-item">
                        <span className="mt-spec-key">COURSE (COG)</span>
                        <strong className="mt-spec-val">
                          {selectedVessel.cog !== null && selectedVessel.cog !== undefined
                            ? `${Number(selectedVessel.cog).toFixed(0)}°`
                            : "—"}
                        </strong>
                      </div>
                      <div className="mt-drawer-spec-item">
                        <span className="mt-spec-key">HEADING</span>
                        <strong className="mt-spec-val">
                          {selectedVessel.heading !== null && selectedVessel.heading !== undefined && selectedVessel.heading !== 511
                            ? `${selectedVessel.heading}°`
                            : "—"}
                        </strong>
                      </div>
                      <div className="mt-drawer-spec-item">
                        <span className="mt-spec-key">CLASS</span>
                        <strong className="mt-spec-val">Class {selectedVessel.transceiver_class || "A"}</strong>
                      </div>
                    </div>

                    {/* Coordinates & Ping */}
                    <div className="mt-drawer-coords">
                      <div className="flex justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-slate-500">Position:</span>
                        <span className="font-mono text-slate-800">
                          {Number(selectedVessel.lat).toFixed(4)}°, {Number(selectedVessel.lon).toFixed(4)}°
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-slate-500">Last Broadcast:</span>
                        <span className="text-slate-800">
                          {new Date(selectedVessel.last_seen).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-slate-500">H3 Cell:</span>
                        <span className="font-mono text-xs text-slate-600">
                          {selectedVessel.cell || "851f0603fffffff"}
                        </span>
                      </div>
                    </div>

                    {/* Tactical Anomaly Alert Box if flagged */}
                    {alertsOnThis.length > 0 && (
                      <div className="mt-drawer-alert-card">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle size={15} className="text-red-500" />
                          <strong className="text-xs text-red-700">
                            {alertsOnThis[0].alert_type.toUpperCase().replace("_", " ")} DETECTED
                          </strong>
                        </div>
                        <p className="text-xs text-slate-600">
                          Tactical risk score: <strong>{alertsOnThis[0].score}</strong> ({alertsOnThis[0].severity})
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Multi-tab Standard View */
            <div className="mt-tabs-content">
              {/* Tab 1: Live Fleet List */}
              {activeTab === "fleet" && (
                <div className="mt-fleet-pane">
                  <div className="mt-pane-header">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">Live Fleet Directory</h3>
                      <span className="mt-count-pill">{vessels.length.toLocaleString()} vessels</span>
                    </div>
                    <button
                      type="button"
                      className="mt-pane-collapse-btn"
                      onClick={onToggleOpen}
                      title="Collapse Sidebar"
                    >
                      <ChevronLeft size={14} />
                      <span>Collapse</span>
                    </button>
                  </div>

                  {/* Search inside fleet */}
                  <div className="mt-search-box">
                    <Search size={14} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search MMSI or Vessel Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Pills */}
                  <div className="mt-filter-pills">
                    {[
                      { id: "all", label: "All" },
                      { id: "cargo", label: "Cargo" },
                      { id: "tanker", label: "Tankers" },
                      { id: "fishing", label: "Fishing" },
                      { id: "passenger", label: "Passenger" },
                      { id: "dark", label: "Dark/Alerts" },
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`mt-pill-filter ${selectedCategory === c.id ? "active" : ""}`}
                        onClick={() => setSelectedCategory(c.id)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  {/* List of vessels */}
                  <div className="mt-fleet-list">
                    {filteredVessels.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">
                        No vessels matching filter criteria.
                      </div>
                    ) : (
                      filteredVessels.map((v) => {
                        const country = getVesselCountry(v.mmsi);
                        const typeName = getVesselTypeName(v.vessel_type);
                        const vName = v.vessel_name || `VESSEL ${v.mmsi}`;
                        return (
                          <div
                            key={v.mmsi}
                            className="mt-fleet-row"
                            onClick={() => onSelectVessel(v)}
                          >
                            <span className="text-base">{country.flag}</span>
                            <div className="mt-fleet-row-info min-w-0">
                              <span className="font-semibold text-slate-800 text-xs truncate block">{vName}</span>
                              <div className="flex items-center gap-2 text-2xs text-slate-500 font-mono">
                                <span>{typeName}</span>
                                <span>•</span>
                                <span>{v.sog !== null ? `${Number(v.sog).toFixed(1)} kn` : "0 kn"}</span>
                              </div>
                            </div>
                            <div className="mt-fleet-row-action">
                              <Link
                                href={`/vessels/${v.mmsi}`}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-icon-link-btn"
                                title="Open ship page"
                              >
                                <ExternalLink size={12} />
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Alerts Feed */}
              {activeTab === "alerts" && (
                <div className="mt-alerts-pane">
                  <div className="mt-pane-header">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">Anomaly Alerts Feed</h3>
                      <span className="mt-count-pill red">{filteredAlerts.length} live</span>
                    </div>
                    <button
                      type="button"
                      className="mt-pane-collapse-btn"
                      onClick={onToggleOpen}
                      title="Collapse Sidebar"
                    >
                      <ChevronLeft size={14} />
                      <span>Collapse</span>
                    </button>
                  </div>

                  {/* 1-Click Interactive Demo Scenario Injectors */}
                  <div className="p-2 mb-2 bg-slate-900 rounded-md border border-amber-500/30">
                    <div className="flex items-center justify-between text-2xs font-bold text-amber-400 mb-1.5 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Zap size={11} className="text-amber-400" /> Demo Injections (1-Click)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onInjectScenario?.("spoof")}
                        className="text-left px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 rounded text-2xs text-amber-200 transition-colors"
                        title="Inject Jump-and-Return GPS Spoofing"
                      >
                        <span className="font-bold block text-white">⚡ GPS Spoof</span>
                        <span className="text-3xs text-amber-300 font-mono">GHOST (369888777)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onInjectScenario?.("dark")}
                        className="text-left px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 rounded text-2xs text-red-200 transition-colors"
                        title="Inject Dark Vessel Transponder Blackout"
                      >
                        <span className="font-bold block text-white">⚡ Dark Vessel</span>
                        <span className="text-3xs text-red-300 font-mono">SHADOW (367999888)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onInjectScenario?.("loiter")}
                        className="text-left px-2 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/40 rounded text-2xs text-yellow-200 transition-colors"
                        title="Inject Marine Protected Area Loitering"
                      >
                        <span className="font-bold block text-white">⚡ MPA Loiter</span>
                        <span className="text-3xs text-yellow-300 font-mono">HARVEST (366234890)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onInjectScenario?.("collision")}
                        className="text-left px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 rounded text-2xs text-cyan-200 transition-colors"
                        title="Inject Identity Collision Cloned Transponder"
                      >
                        <span className="font-bold block text-white">⚡ Collision</span>
                        <span className="text-3xs text-cyan-300 font-mono">TWIN (368111222)</span>
                      </button>
                    </div>
                  </div>

                  {/* Search inside alerts */}
                  <div className="mt-search-box mb-2">
                    <Search size={14} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter by MMSI, name, or type..."
                      value={alertSearchQuery}
                      onChange={(e) => setAlertSearchQuery(e.target.value)}
                    />
                    {alertSearchQuery && (
                      <button type="button" onClick={() => setAlertSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Alert Category Filter Pills */}
                  <div className="mt-filter-pills mb-2">
                    {[
                      { id: "all", label: "All" },
                      { id: "spoof", label: "Spoof" },
                      { id: "dark_vessel", label: "Dark" },
                      { id: "loiter", label: "Loiter" },
                      { id: "mmsi_collision", label: "Collision" },
                      { id: "rendezvous_sts", label: "STS" },
                      { id: "ml_anomaly", label: "ML" },
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`mt-pill ${alertTypeFilter === c.id ? "active" : ""}`}
                        onClick={() => setAlertTypeFilter(c.id)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-alerts-list">
                    {filteredAlerts.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">
                        No tactical anomalies found matching filter.
                      </div>
                    ) : (
                      filteredAlerts.map((a) => {
                        const country = getVesselCountry(a.mmsi);
                        return (
                          <div
                            key={a.id}
                            className={`mt-alert-feed-card ${a.severity} cursor-pointer hover:border-orange-500`}
                            onClick={() => {
                              const found = vessels.find((v) => v.mmsi === a.mmsi);
                              if (found) {
                                onSelectVessel(found);
                              } else {
                                onSelectVessel({
                                  mmsi: a.mmsi,
                                  last_seen: a.detected_at,
                                  lat: a.last_lat ?? 37.82,
                                  lon: a.last_lon ?? -122.42,
                                  sog: a.details?.implied_speed_knots ?? 0.0,
                                  cog: 0.0,
                                  heading: 0.0,
                                  vessel_type: 70,
                                  transceiver_class: a.details?.transceiver_class ?? "A",
                                  cell: a.details?.cell ?? null,
                                  msg_count: 1,
                                  status: a.alert_type === "dark_vessel" ? "dark" : "active",
                                  vessel_name: a.vessel_name || `VESSEL ${a.mmsi}`,
                                });
                              }
                            }}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="mt-alert-pill">{a.alert_type.toUpperCase().replace("_", " ")}</span>
                              <span className="text-2xs text-slate-400 font-mono">
                                {new Date(a.detected_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span>{country.flag}</span>
                                <span className="font-bold text-xs text-slate-900 font-mono">
                                  {a.vessel_name ? `${a.vessel_name} (${a.mmsi})` : `MMSI ${a.mmsi}`}
                                </span>
                              </div>
                              <span className="text-2xs font-semibold text-red-600 font-mono">Score {a.score}</span>
                            </div>
                            <div className="mt-2 text-right">
                              <Link
                                href={`/vessels/${a.mmsi}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-2xs text-orange-600 font-medium hover:underline inline-flex items-center gap-1"
                              >
                                <span>View dossier</span>
                                <ExternalLink size={10} />
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
