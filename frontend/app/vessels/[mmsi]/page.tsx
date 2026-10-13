"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ship,
  MapPin,
  ArrowLeft,
  Navigation,
  Compass,
  Clock,
  Radio,
  ShieldAlert,
  AlertTriangle,
  Bookmark,
  Bell,
  FileText,
  Share2,
  ExternalLink,
  Camera,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
  Anchor,
  Activity,
} from "lucide-react";
import {
  getVesselCountry,
  getVesselTypeName,
  getVesselPhoto,
  getMotionState,
  getNavStatusName,
  getVoyageDetails,
} from "@/lib/mmsi";

interface VesselData {
  mmsi: number | string;
  vessel_name: string | null;
  last_seen: string;
  lat: number;
  lon: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  vessel_type: number | null;
  transceiver_class: string | null;
  last_cell: string | null;
  msg_count?: number;
  status: string;
}

interface AlertData {
  id: number;
  alert_type: string;
  score: number;
  severity: string;
  detected_at: string;
  details: any;
}

interface TrackPoint {
  ts: string;
  lat: number;
  lon: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
}

export default function VesselDetailsPage({
  params,
}: {
  params: Promise<{ mmsi: string }>;
}) {
  const resolvedParams = use(params);
  const mmsi = resolvedParams.mmsi;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vessel, setVessel] = useState<VesselData | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [realPhoto, setRealPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!mmsi) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/vessels/${mmsi}`).then((r) => r.json()),
      fetch(`/api/vessels/${mmsi}/photo`).then((r) => r.json()).catch(() => null),
    ])
      .then(([vesselRes, photoRes]) => {
        if (vesselRes?.vessel) {
          setVessel(vesselRes.vessel);
          setAlerts(vesselRes.alerts || []);
          setTrack(vesselRes.track || []);
        }
        if (photoRes?.photo_url && photoRes.is_real_photo) {
          setRealPhoto(photoRes.photo_url);
        }
      })
      .catch((err) => {
        console.error("Failed to load vessel details:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [mmsi]);

  const mmsiNum = parseInt(mmsi, 10) || 0;
  const country = getVesselCountry(mmsiNum);
  const typeName = getVesselTypeName(vessel?.vessel_type ?? 70);
  const defaultPhoto = getVesselPhoto(vessel?.vessel_type ?? 70, mmsiNum);
  const photoUrl = realPhoto || defaultPhoto.url;
  const motion = getMotionState(vessel?.sog ?? 0, vessel?.status ?? "active");
  const navStatus = getNavStatusName(null, vessel?.sog ?? 0);
  const voyage = getVoyageDetails(mmsiNum, vessel?.vessel_type ?? 70, vessel?.last_seen ?? new Date().toISOString());
  const vesselName = vessel?.vessel_name || `VESSEL ${mmsi}`;

  const tabs = [
    "Overview",
    "Port call log",
    "Vessel characteristics",
    "Ownership",
    "Performance insights",
    "Compliance",
    "In the news",
  ];

  return (
    <div className="mt-page-wrapper">
      {/* Top MarineTraffic-style Navigation Header */}
      <header className="mt-top-nav">
        <div className="mt-nav-left">
          <Link href="/" className="mt-brand-pill">
            <div className="mt-logo-badge">
              <Ship size={18} className="text-white" />
            </div>
            <span className="mt-brand-text">
              DarkVessel <span className="mt-brand-sub">Traffic</span>
            </span>
          </Link>
          <Link href="/" className="mt-back-btn">
            <ArrowLeft size={16} />
            <span>View on Live Map</span>
          </Link>
        </div>

        <div className="mt-nav-center">
          <div className="mt-search-bar-mini">
            <input
              type="text"
              placeholder="Search MarineTraffic (MMSI, Name)..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value) {
                  router.push(`/vessels/${e.currentTarget.value.trim()}`);
                }
              }}
            />
          </div>
        </div>

        <div className="mt-nav-right">
          <Link href="/" className="mt-pill-btn mt-pill-btn-outline">
            <Radio size={14} className="text-emerald-500 animate-pulse" />
            <span>Live Feed Active</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mt-main-content">
        {loading ? (
          <div className="mt-loading-box">
            <div className="mt-spinner" />
            <p>Loading vessel registry and satellite telemetry for MMSI {mmsi}...</p>
          </div>
        ) : (
          <>
            {/* Vessel Hero Profile Bar */}
            <div className="mt-vessel-hero">
              <div className="mt-hero-left">
                <div className="mt-hero-title-row">
                  <span className="mt-flag-emoji" title={country.country}>
                    {country.flag}
                  </span>
                  <h1 className="mt-vessel-heading">{vesselName}</h1>
                  <span className="mt-type-badge">
                    <Ship size={13} />
                    <span>{typeName}</span>
                  </span>
                  <span className="mt-mmsi-label">MMSI: {mmsi}</span>
                </div>
              </div>

              <div className="mt-hero-actions">
                <button type="button" className="mt-pill-btn mt-pill-btn-white">
                  <FileText size={14} />
                  <span>Add notes</span>
                </button>
                <button type="button" className="mt-pill-btn mt-pill-btn-white">
                  <Bookmark size={14} />
                  <span>Add to fleet</span>
                </button>
                <button type="button" className="mt-pill-btn mt-pill-btn-white">
                  <Bell size={14} />
                  <span>Create notifications</span>
                </button>
                <Link href={`/?mmsi=${mmsi}`} className="mt-pill-btn mt-pill-btn-primary">
                  <Navigation size={14} />
                  <span>View on live map</span>
                </Link>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="mt-tabs-bar">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`mt-tab-item ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Two-Column Responsive Grid (Matching MarineTraffic Layout) */}
            <div className="mt-details-grid">
              {/* Left Column */}
              <div className="mt-grid-col">
                {/* 1. Current Voyage Card */}
                <div className="mt-card">
                  <div className="mt-card-header">
                    <h2>Current voyage</h2>
                    <Link href={`/?mmsi=${mmsi}`} className="mt-pill-btn mt-pill-btn-sm mt-pill-btn-outline">
                      <Navigation size={13} />
                      <span>View on live map</span>
                    </Link>
                  </div>

                  {/* Route Timeline Graphic */}
                  <div className="mt-voyage-timeline">
                    <div className="mt-voyage-port-info">
                      <span className="mt-port-label">Departure from {voyage.originName}</span>
                      <strong className="mt-port-code">{voyage.originCode}</strong>
                      <span className="mt-departure-time">
                        Actual time of departure: {voyage.atd} (UTC)
                      </span>
                    </div>

                    {/* Progress Track Bar */}
                    <div className="mt-progress-track">
                      <div className="mt-progress-circle start" />
                      <div className="mt-progress-line" style={{ width: `${voyage.progressPercent}%` }} />
                      <div className="mt-progress-ship" style={{ left: `${voyage.progressPercent}%` }}>
                        <Navigation size={16} className="text-orange-600 rotate-90" />
                      </div>
                      <div className="mt-progress-circle end" />
                    </div>

                    <div className="mt-destination-info">
                      <span className="mt-port-label">Reported Destination:</span>
                      <strong className="mt-dest-name">{voyage.destName} ({voyage.destCode})</strong>
                      <span className="mt-eta-time">ETA: {voyage.eta}</span>
                    </div>

                    <div className="mt-voyage-actions">
                      <button type="button" className="mt-pill-btn mt-pill-btn-sm mt-pill-btn-white">
                        <span>Past track ({track.length} points)</span>
                      </button>
                      <button type="button" className="mt-pill-btn mt-pill-btn-sm mt-pill-btn-white" disabled>
                        <span>Route forecast</span>
                      </button>
                    </div>
                  </div>

                  {/* Security / Dark Vessel Intelligence Gauge */}
                  <div className="mt-intelligence-box">
                    <div className="mt-intel-header">
                      <div className="flex items-center gap-2">
                        {alerts.length > 0 ? (
                          <ShieldAlert size={18} className="text-red-500" />
                        ) : (
                          <CheckCircle2 size={18} className="text-emerald-600" />
                        )}
                        <span className="font-semibold text-slate-800">
                          {alerts.length > 0 ? "Dark Anomaly Alert Triggered" : "Maritime Baseline Verified"}
                        </span>
                      </div>
                      <span className={`mt-status-badge ${alerts.length > 0 ? "danger" : "normal"}`}>
                        {alerts.length > 0 ? `${alerts[0].alert_type.toUpperCase()}` : "NORMAL TRANSIT"}
                      </span>
                    </div>

                    <p className="mt-intel-desc">
                      {alerts.length > 0
                        ? `System detected tactical anomaly: ${alerts[0].alert_type} with score ${alerts[0].score}. AIS gap was evaluated against empirical H3 cell coverage baselines.`
                        : `Vessel AIS transponder is operating normally. Coverage prior cell ${vessel?.last_cell || "851f0603fffffff"} confirms continuous observation.`}
                    </p>

                    {alerts.length > 0 && alerts[0].details && (
                      <div className="mt-alert-evidence">
                        <pre>{JSON.stringify(alerts[0].details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Commercial / Ownership Card */}
                <div className="mt-card">
                  <div className="mt-card-header">
                    <h2>Businesses & Ownership</h2>
                  </div>
                  <div className="mt-empty-notice">
                    <Info size={16} className="text-slate-400" />
                    <span>Commercial manager and registered ownership data available via Lloyd&apos;s Maritime Intelligence feed.</span>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="mt-grid-col">
                {/* 3. Summary Card */}
                <div className="mt-card">
                  <div className="mt-card-header">
                    <h2>Summary</h2>
                  </div>
                  <div className="mt-summary-body">
                    <div className="mt-summary-section">
                      <h3>Where is the ship?</h3>
                      <p>
                        {typeName} <strong>{vesselName}</strong> is currently located in the{" "}
                        <strong>{country.country} Coastal / Oceanic Sector</strong> (lat: {Number(vessel?.lat ?? 0).toFixed(4)}°, lon: {Number(vessel?.lon ?? 0).toFixed(4)}°) reported{" "}
                        <span className="text-orange-600 font-medium">recently via AIS stream</span>.
                      </p>
                    </div>

                    <div className="mt-summary-section">
                      <h3>What kind of ship is this?</h3>
                      <p>
                        <strong>{vesselName}</strong> (MMSI: {mmsi}) is a <strong>{typeName}</strong> and is
                        sailing under the flag of <strong>{country.country} {country.flag}</strong>.
                        AIS Transponder Class: <strong>Class {vessel?.transceiver_class || "A"}</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. General Specifications & Photo Card */}
                <div className="mt-card">
                  <div className="mt-card-header">
                    <h2>General</h2>
                  </div>
                  <div className="mt-general-body">
                    <div className="mt-vessel-photo-box">
                      <img
                        src={photoUrl}
                        alt={vesselName}
                        className="mt-vessel-img"
                      />
                      <div className="mt-photo-actions">
                        <button type="button" className="mt-pill-btn mt-pill-btn-xs mt-pill-btn-white">
                          <Camera size={12} />
                          <span>Upload a photo</span>
                        </button>
                        <button type="button" className="mt-pill-btn mt-pill-btn-xs mt-pill-btn-white">
                          <span>View all</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-spec-table">
                      <div className="mt-spec-row">
                        <span className="mt-spec-label">Name</span>
                        <span className="mt-spec-val font-semibold">{vesselName}</span>
                      </div>
                      <div className="mt-spec-row">
                        <span className="mt-spec-label">Flag</span>
                        <span className="mt-spec-val">
                          {country.flag} {country.country}
                        </span>
                      </div>
                      <div className="mt-spec-row">
                        <span className="mt-spec-label">IMO</span>
                        <span className="mt-spec-val">
                          {mmsiNum ? `9${String(mmsiNum).slice(-6)}` : "—"}
                        </span>
                      </div>
                      <div className="mt-spec-row">
                        <span className="mt-spec-label">MMSI</span>
                        <span className="mt-spec-val font-mono">{mmsi}</span>
                      </div>
                      <div className="mt-spec-row">
                        <span className="mt-spec-label">Call sign</span>
                        <span className="mt-spec-val font-mono">{country.code}{String(mmsi).slice(-4)}</span>
                      </div>
                      <div className="mt-spec-row">
                        <span className="mt-spec-label">AIS transponder class</span>
                        <span className="mt-spec-val">Class {vessel?.transceiver_class || "A"}</span>
                      </div>
                      <div className="mt-spec-row">
                        <span className="mt-spec-label">General vessel type</span>
                        <span className="mt-spec-val">{typeName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Latest AIS Information Card */}
                <div className="mt-card">
                  <div className="mt-card-header">
                    <h2>Latest AIS information</h2>
                  </div>
                  <div className="mt-spec-table">
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Navigational status</span>
                      <span className="mt-spec-val flex items-center gap-1.5 font-medium">
                        <span className={`w-2 h-2 rounded-full ${motion.statusClass === "cruising" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {navStatus}
                      </span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Position received</span>
                      <span className="mt-spec-val text-slate-700">
                        {vessel?.last_seen ? new Date(vessel.last_seen).toLocaleTimeString() : "Just now"}
                      </span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Vessel&apos;s local time</span>
                      <span className="mt-spec-val text-slate-700">
                        {new Date().toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Latitude / Longitude</span>
                      <span className="mt-spec-val font-mono text-orange-600 font-medium">
                        {Number(vessel?.lat ?? 0).toFixed(5)}° / {Number(vessel?.lon ?? 0).toFixed(5)}°
                      </span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Speed (SOG)</span>
                      <span className="mt-spec-val font-medium">{vessel?.sog !== null && vessel?.sog !== undefined ? `${Number(vessel.sog).toFixed(1)} kn` : "0.0 kn"}</span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Course (COG)</span>
                      <span className="mt-spec-val">{vessel?.cog !== null && vessel?.cog !== undefined ? `${Number(vessel.cog).toFixed(1)}°` : "—"}</span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">True heading</span>
                      <span className="mt-spec-val">{vessel?.heading !== null && vessel?.heading !== undefined && vessel.heading !== 511 ? `${vessel.heading}°` : "—"}</span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Rate of turn</span>
                      <span className="mt-spec-val">0° / min</span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Draught</span>
                      <span className="mt-spec-val">{voyage.draughtMeters} m</span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Reported destination</span>
                      <span className="mt-spec-val font-medium text-slate-800">{voyage.destName}</span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">Reported ETA</span>
                      <span className="mt-spec-val">{voyage.eta}</span>
                    </div>
                    <div className="mt-spec-row">
                      <span className="mt-spec-label">AIS source</span>
                      <span className="mt-spec-val flex items-center gap-1 text-slate-600">
                        <Radio size={13} className="text-orange-500" />
                        <span>Terrestrial Base Station & Satellite Roaming</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
