"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import DeckMap, { ViewportBounds } from "@/components/DeckMap";
import LeftSidebar from "@/components/LeftSidebar";
import { VesselState } from "@/app/api/vessels/route";
import { AlertRecord } from "@/app/api/alerts/route";
import {
  Zap,
  X,
  Compass,
  Radio,
  ExternalLink,
  Layers,
  MapPin,
  Radar,
  Globe,
  Moon,
  Plus,
  Minus,
  Ship,
  AlertTriangle,
  Gauge,
  ChevronRight,
  ChevronLeft,
  Crosshair,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { getVesselCountry, getVesselTypeName } from "@/lib/mmsi";

interface AnomalyBannerData {
  type: string;
  mmsi: number;
  score: number;
  message: string;
  details?: any;
}

function SurveillanceDashboardContent() {
  const searchParams = useSearchParams();
  const mmsiParam = searchParams.get("mmsi");

  const [vessels, setVessels] = useState<VesselState[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [geofences, setGeofences] = useState<any>(null);
  const [metrics, setMetrics] = useState({
    active_vessels: 0,
    dark_vessels: 0,
    alerts_24h: 0,
    msgs_consumed_per_s: 3420,
    consumer_lag: 42,
    dlq_rate: 0.005,
  });

  const [selectedVessel, setSelectedVessel] = useState<VesselState | null>(null);
  const [vesselTrack, setVesselTrack] = useState<Array<{ lat: number; lon: number; ts: string }>>([]);
  const [showGeofences, setShowGeofences] = useState<boolean>(true);
  const [showPlaceNames, setShowPlaceNames] = useState<boolean>(true);
  const [showDriftCones, setShowDriftCones] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [activeAlertBanner, setActiveAlertBanner] = useState<AnomalyBannerData | null>(null);

  // References for viewport-aware hybrid delta updates
  const currentBoundsRef = useRef<ViewportBounds | null>(null);
  const lastFetchTimeRef = useRef<string | null>(null);
  const vesselsMapRef = useRef<Map<number, VesselState>>(new Map());
  const prevAlertIdsRef = useRef<Set<number>>(new Set());

  // Auto-dismiss active alert toast after 8 seconds
  useEffect(() => {
    if (!activeAlertBanner) return;
    const timer = setTimeout(() => {
      setActiveAlertBanner(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeAlertBanner]);

  // Helper to detect newly surfaced alerts and trigger audio-visual banners
  const processAlerts = useCallback((newAlerts: AlertRecord[]) => {
    setAlerts(newAlerts);
    if (newAlerts && newAlerts.length > 0) {
      const currentIds = new Set<number>(newAlerts.map((a) => a.id));
      if (prevAlertIdsRef.current.size > 0) {
        const newlyAdded = newAlerts.find((a) => !prevAlertIdsRef.current.has(a.id));
        if (newlyAdded) {
          setActiveAlertBanner({
            type: newlyAdded.alert_type,
            mmsi: newlyAdded.mmsi,
            score: Number(newlyAdded.score) || 0.9,
            message: `${newlyAdded.alert_type.toUpperCase().replace("_", " ")} detected on MMSI ${newlyAdded.mmsi}`,
            details: newlyAdded.details,
          });
        }
      }
      prevAlertIdsRef.current = currentIds;
    }
  }, []);

  // 1. Fetch full viewport snapshot
  const fetchSnapshot = useCallback(async (customBounds?: ViewportBounds | null) => {
    try {
      setIsRefreshing(true);
      const bounds = customBounds !== undefined ? customBounds : currentBoundsRef.current;
      let vesselsUrl = "/api/vessels?limit=3000";
      if (
        bounds &&
        (bounds.minLon > -180 || bounds.maxLon < 180 || bounds.minLat > -85 || bounds.maxLat < 85)
      ) {
        vesselsUrl += `&minLon=${bounds.minLon}&minLat=${bounds.minLat}&maxLon=${bounds.maxLon}&maxLat=${bounds.maxLat}`;
      }

      const [vesselsRes, alertsRes, metricsRes] = await Promise.all([
        fetch(vesselsUrl).then((r) => r.json()),
        fetch("/api/alerts").then((r) => r.json()),
        fetch("/api/metrics").then((r) => r.json()),
      ]);

      if (vesselsRes.vessels) {
        const newMap = new Map<number, VesselState>();
        for (const v of vesselsRes.vessels) {
          newMap.set(v.mmsi, v);
        }
        vesselsMapRef.current = newMap;
        setVessels(vesselsRes.vessels);
        lastFetchTimeRef.current = vesselsRes.server_time || new Date().toISOString();
      }
      if (alertsRes.alerts) processAlerts(alertsRes.alerts);
      if (metricsRes) setMetrics(metricsRes);
    } catch (err) {
      console.error("Failed to fetch surveillance snapshot:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [processAlerts]);

  // 2. Fetch lightweight incremental delta updates
  const fetchDelta = useCallback(async () => {
    try {
      if (!lastFetchTimeRef.current) {
        return fetchSnapshot();
      }

      const bounds = currentBoundsRef.current;
      let vesselsUrl = `/api/vessels?since=${encodeURIComponent(lastFetchTimeRef.current)}&limit=5000`;
      if (
        bounds &&
        (bounds.minLon > -180 || bounds.maxLon < 180 || bounds.minLat > -85 || bounds.maxLat < 85)
      ) {
        vesselsUrl += `&minLon=${bounds.minLon}&minLat=${bounds.minLat}&maxLon=${bounds.maxLon}&maxLat=${bounds.maxLat}`;
      }

      const [vesselsRes, alertsRes, metricsRes] = await Promise.all([
        fetch(vesselsUrl).then((r) => r.json()),
        fetch("/api/alerts").then((r) => r.json()),
        fetch("/api/metrics").then((r) => r.json()),
      ]);

      if (vesselsRes.vessels) {
        if (vesselsRes.vessels.length > 0) {
          for (const v of vesselsRes.vessels) {
            vesselsMapRef.current.set(v.mmsi, v);
          }
          setVessels(Array.from(vesselsMapRef.current.values()));
        }
        lastFetchTimeRef.current = vesselsRes.server_time || new Date().toISOString();
      }
      if (alertsRes.alerts) processAlerts(alertsRes.alerts);
      if (metricsRes) setMetrics(metricsRes);
    } catch (err) {
      console.error("Failed to poll delta updates:", err);
    }
  }, [fetchSnapshot, processAlerts]);

  // Handle map camera bounds change
  const handleBoundsChange = useCallback((newBounds: ViewportBounds) => {
    const prev = currentBoundsRef.current;
    currentBoundsRef.current = newBounds;

    const shouldRefetch =
      !prev ||
      Math.abs(prev.minLon - newBounds.minLon) > 1.5 ||
      Math.abs(prev.maxLon - newBounds.maxLon) > 1.5 ||
      Math.abs(prev.minLat - newBounds.minLat) > 1.0 ||
      Math.abs(prev.maxLat - newBounds.maxLat) > 1.0;

    if (shouldRefetch) {
      fetchSnapshot(newBounds);
    }
  }, [fetchSnapshot]);

  // Fetch geofences once
  useEffect(() => {
    fetch("/api/geofences")
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setGeofences(res.data);
      })
      .catch((err) => console.error("Failed to fetch geofences:", err));
  }, []);

  // Periodic polling every 5 seconds
  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchDelta, 5000);
    return () => clearInterval(interval);
  }, [fetchSnapshot, fetchDelta]);

  // When a vessel is selected, fetch its track
  const handleSelectVessel = useCallback(async (vessel: VesselState | null) => {
    setSelectedVessel(vessel);
    if (!vessel) {
      setVesselTrack([]);
      return;
    }

    try {
      const res = await fetch(`/api/vessels/${vessel.mmsi}/track`).then((r) => r.json());
      if (res.points) {
        setVesselTrack(res.points);
      }
    } catch (err) {
      console.error("Failed to fetch vessel track:", err);
    }
  }, []);

  const handleSelectAlertMmsi = useCallback(
    (mmsi: number) => {
      const vessel = vessels.find((v) => v.mmsi === mmsi);
      if (vessel) {
        handleSelectVessel(vessel);
      } else {
        const alert = alerts.find((a) => a.mmsi === mmsi);
        const tempVessel: VesselState = {
          mmsi,
          last_seen: alert?.detected_at || new Date().toISOString(),
          lat: alert?.last_lat || 37.8201,
          lon: alert?.last_lon || -122.4206,
          sog: 0.2,
          cog: 180,
          heading: 182,
          vessel_type: 70,
          transceiver_class: alert?.details?.transceiver_class || "A",
          cell: alert?.details?.cell || null,
          msg_count: 100,
          status: "dark",
        };
        handleSelectVessel(tempVessel);
      }
    },
    [vessels, alerts, handleSelectVessel]
  );

  // Auto-focus on vessel if passed via ?mmsi= query parameter
  useEffect(() => {
    if (mmsiParam && (vessels.length > 0 || alerts.length > 0)) {
      const targetMmsi = parseInt(mmsiParam, 10);
      if (!isNaN(targetMmsi)) {
        handleSelectAlertMmsi(targetMmsi);
      }
    }
  }, [mmsiParam, vessels, alerts, handleSelectAlertMmsi]);

  // Live Scenario Injection
  const handleInjectScenario = async (scenarioId: string) => {
    try {
      const res = await fetch("/api/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenarioId }),
      });
      const data = await res.json();
      if (res.ok && data?.mmsi) {
        handleSelectAlertMmsi(data.mmsi);
        setActiveAlertBanner({
          type: data.alert_type || "anomaly",
          mmsi: data.mmsi,
          score: data.score || 0.95,
          message: `Injected scenario on MMSI ${data.mmsi}`,
          details: data.details,
        });
        setTimeout(() => fetchSnapshot(), 400);
      }
    } catch (err) {
      console.error("Injection failed:", err);
    }
  };

  return (
    <div className="mt-dashboard-viewport">
      {/* 1. Left Sidebar (Slim Icon Rail + Expandable Details Drawer) */}
      <LeftSidebar
        vessels={vessels}
        selectedVessel={selectedVessel}
        onSelectVessel={handleSelectVessel}
        alerts={alerts}
        metrics={metrics}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen((prev) => !prev)}
        onInjectScenario={handleInjectScenario}
        vesselTrackPoints={vesselTrack}
      />

      {/* 3. Floating Expand Sidebar Trigger (When drawer is collapsed) */}
      {!sidebarOpen && (
        <button
          type="button"
          className="mt-floating-expand-btn"
          onClick={() => setSidebarOpen(true)}
          title="Expand Fleet Directory Sidebar"
        >
          <Ship size={15} className="text-orange-500 shrink-0" />
          <span className="font-bold text-slate-800 text-xs">Fleet Directory</span>
          <span className="mt-count-pill">{vessels.length.toLocaleString()}</span>
          <ChevronRight size={14} className="text-slate-400 shrink-0" />
        </button>
      )}

      {/* 4. Compact Bottom-Right Anomaly Alert Toast */}
      {activeAlertBanner && (
        <div className="mt-modern-toast" role="alert">
          <div className="mt-toast-content">
            <div className="mt-toast-icon-wrap">
              <AlertTriangle size={14} className="text-red-600" />
              <span className="mt-toast-ping" />
            </div>

            <div className="mt-toast-body">
              <div className="mt-toast-header-row">
                <span className="mt-toast-badge-danger">
                  {activeAlertBanner.type.toUpperCase().replace("_", " ")}
                </span>
                <span className="mt-toast-mmsi">
                  MMSI {activeAlertBanner.mmsi}
                </span>
                <span className="mt-toast-score">
                  {Number(activeAlertBanner.score).toFixed(1)}
                </span>
              </div>
              <p className="mt-toast-message">
                {activeAlertBanner.message}
              </p>
            </div>

            <div className="mt-toast-actions">
              <button
                type="button"
                className="mt-toast-track-btn"
                onClick={() => {
                  handleSelectAlertMmsi(activeAlertBanner.mmsi);
                  setActiveAlertBanner(null);
                }}
                title="Track target on map"
              >
                <Crosshair size={12} className="text-white shrink-0" />
                <span>Track</span>
              </button>
              <button
                type="button"
                className="mt-toast-close-icon-btn"
                onClick={() => setActiveAlertBanner(null)}
                aria-label="Dismiss alert"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {/* Animated 8-second auto-dismiss progress bar */}
          <div className="mt-toast-progress-bar" />
        </div>
      )}

      {/* 5. Full-Screen Interactive Deck.gl Map */}
      <div style={{ flex: 1, width: "100%", height: "100%", position: "relative" }}>
        <DeckMap
          vessels={vessels}
          alerts={alerts}
          geofences={geofences}
          selectedVessel={selectedVessel}
          onSelectVessel={handleSelectVessel}
          vesselTrack={vesselTrack}
          showGeofences={showGeofences}
          onToggleGeofences={() => setShowGeofences((prev) => !prev)}
          showPlaceNames={showPlaceNames}
          onTogglePlaceNames={() => setShowPlaceNames((prev) => !prev)}
          showDriftCones={showDriftCones}
          onToggleDriftCones={() => setShowDriftCones((prev) => !prev)}
          onBoundsChange={handleBoundsChange}
          drawerOpen={sidebarOpen}
          onToggleDrawer={() => setSidebarOpen((prev) => !prev)}
          alertCount={alerts.length}
        />
      </div>

      {/* 6. Centered Floating Minimalist Telemetry Status Capsule */}
      <div className="mt-dock-capsule">
        {/* Active Fleet */}
        <div className="mt-dock-chip" title="Live vessels in database">
          <span className="mt-dot-pulse-green" />
          <span className="mt-dock-val font-mono">{metrics.active_vessels.toLocaleString()}</span>
          <span className="mt-dock-lbl">Fleet</span>
        </div>

        <div className="mt-dock-sep" />

        {/* Dark Vessel Anomaly Alerts */}
        <button
          type="button"
          className={`mt-dock-chip mt-dock-chip-alerts ${alerts.length > 0 ? "has-alerts" : ""}`}
          onClick={() => setSidebarOpen(true)}
          title="Click to view live anomaly alerts in sidebar"
        >
          {alerts.length > 0 ? (
            <>
              <AlertTriangle size={13} className="text-red-400 animate-pulse shrink-0" />
              <span className="mt-dock-val text-red-400 font-bold">{alerts.length}</span>
              <span className="mt-dock-lbl text-red-400">Dark Alerts</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <span className="mt-dock-lbl text-emerald-400 font-medium">All Clear</span>
            </>
          )}
        </button>

        <div className="mt-dock-sep" />

        {/* Throughput */}
        <div className="mt-dock-chip" title="Real-time Kafka ingestion throughput">
          <Zap size={13} className="text-orange-500 shrink-0" />
          <span className="mt-dock-val font-mono">{metrics.msgs_consumed_per_s.toLocaleString()}</span>
          <span className="mt-dock-lbl">msg/s</span>
        </div>

        <div className="mt-dock-sep" />

        {/* Consumer Lag */}
        <div className="mt-dock-chip" title="Kafka stream consumer lag">
          <Gauge size={13} className="text-slate-400 shrink-0" />
          <span className="mt-dock-val font-mono">{metrics.consumer_lag.toLocaleString()}</span>
          <span className="mt-dock-lbl">lag</span>
        </div>

        <div className="mt-dock-sep" />

        {/* Stream Health */}
        <div className="mt-dock-chip" title="AIS Validation Sentinel pass rate">
          <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
          <span className="mt-dock-val font-mono">{((1 - metrics.dlq_rate) * 100).toFixed(1)}%</span>
          <span className="mt-dock-lbl">valid</span>
        </div>
      </div>
    </div>
  );
}

export default function SurveillanceDashboard() {
  return (
    <Suspense fallback={<div className="surveillance-container" />}>
      <SurveillanceDashboardContent />
    </Suspense>
  );
}
