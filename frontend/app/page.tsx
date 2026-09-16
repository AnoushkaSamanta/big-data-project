"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import HudStats from "@/components/HudStats";
import DeckMap from "@/components/DeckMap";
import AlertFeed from "@/components/AlertFeed";
import VesselDrawer from "@/components/VesselDrawer";
import { VesselState } from "@/app/api/vessels/route";
import { AlertRecord } from "@/app/api/alerts/route";
import { ShieldAlert, Layers, Bell } from "lucide-react";

export default function SurveillanceDashboard() {
  const [vessels, setVessels] = useState<VesselState[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [geofences, setGeofences] = useState<any>(null);
  const [metrics, setMetrics] = useState({
    active_vessels: 0,
    dark_vessels: 0,
    alerts_24h: 0,
    msgs_consumed_per_s: 3200,
    consumer_lag: 42,
    dlq_rate: 0.005,
  });

  const [selectedVessel, setSelectedVessel] = useState<VesselState | null>(null);
  const [vesselTrack, setVesselTrack] = useState<Array<{ lat: number; lon: number; ts: string }>>([]);
  const [showGeofences, setShowGeofences] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);

  // Fetch live snapshot
  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [vesselsRes, alertsRes, metricsRes] = await Promise.all([
        fetch("/api/vessels").then((r) => r.json()),
        fetch("/api/alerts").then((r) => r.json()),
        fetch("/api/metrics").then((r) => r.json()),
      ]);

      if (vesselsRes.vessels) setVessels(vesselsRes.vessels);
      if (alertsRes.alerts) setAlerts(alertsRes.alerts);
      if (metricsRes) setMetrics(metricsRes);
    } catch (err) {
      console.error("Failed to fetch surveillance telemetry:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch geofences once
  useEffect(() => {
    fetch("/api/geofences")
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setGeofences(res.data);
      })
      .catch((err) => console.error("Failed to fetch geofences:", err));
  }, []);

  // Periodic polling every 5 seconds (simulates live streaming ingestion)
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
        // If vessel not in current active view, synthesize temporary reference
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

  return (
    <div className="surveillance-container">
      {/* Top Tactical Header */}
      <Header
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
        activeCount={metrics.active_vessels}
        darkCount={metrics.dark_vessels}
      />

      {/* Top HUD Telemetry stats */}
      <HudStats
        activeVessels={metrics.active_vessels}
        darkVessels={metrics.dark_vessels}
        alerts24h={metrics.alerts_24h}
        msgsConsumedPerS={metrics.msgs_consumed_per_s}
        consumerLag={metrics.consumer_lag}
        dlqRate={metrics.dlq_rate}
      />

      {/* Main Workspace */}
      <div className="workspace">
        {/* Map Viewport */}
        <DeckMap
          vessels={vessels}
          geofences={geofences}
          selectedVessel={selectedVessel}
          onSelectVessel={handleSelectVessel}
          vesselTrack={vesselTrack}
          showGeofences={showGeofences}
        />

        {/* Floating map layer toggles */}
        <div className="map-floating-controls">
          <button
            onClick={() => setShowGeofences(!showGeofences)}
            className={`toggle-btn ${showGeofences ? "active" : ""}`}
          >
            <Layers size={14} />
            <span>EEZ / MPA GEOFENCES</span>
          </button>

          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={`toggle-btn ${drawerOpen ? "active" : ""}`}
          >
            <Bell size={14} />
            <span>ALERTS FEED ({alerts.length})</span>
          </button>
        </div>

        {/* Side Alert / Feed Drawer */}
        {drawerOpen && (
          <div className="side-drawer">
            <div className="drawer-header">
              <div className="drawer-title">
                <ShieldAlert size={18} color="#ef4444" />
                <span>ANOMALY ALERT FEED</span>
              </div>
            </div>

            <div className="drawer-content">
              <AlertFeed
                alerts={alerts}
                onSelectMmsi={handleSelectAlertMmsi}
                selectedMmsi={selectedVessel?.mmsi || null}
              />
            </div>
          </div>
        )}

        {/* Vessel Drilldown Drawer (if selected) */}
        {selectedVessel && (
          <VesselDrawer
            vessel={selectedVessel}
            onClose={() => handleSelectVessel(null)}
            trackPoints={vesselTrack}
          />
        )}
      </div>
    </div>
  );
}
