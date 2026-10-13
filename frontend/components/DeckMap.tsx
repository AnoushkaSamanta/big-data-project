"use client";

import React, { useState, useMemo, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer, IconLayer, GeoJsonLayer, PathLayer } from "@deck.gl/layers";
import MapGL from "react-map-gl/maplibre";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { VesselState } from "@/app/api/vessels/route";
import { AlertRecord } from "@/app/api/alerts/route";
import { Globe, Compass, Moon, ChevronDown, MapPin, Layers, Radar, ShieldAlert, AlertTriangle, ExternalLink, Plus, Minus } from "lucide-react";
import { computeDriftCone, DriftConeFeature } from "@/lib/drift";
import {
  getVesselCountry,
  getVesselTypeName,
  getVesselPhoto,
  getMotionState,
  getNavStatusName,
  getVoyageDetails,
} from "@/lib/mmsi";

// High-fidelity MarineTraffic vessel chevron arrow (North-facing sharp chevron)
const SHIP_ARROW_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><polygon points="24,4 44,42 24,33 4,42" fill="%23ffffff" stroke="%231e293b" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

// Stationary / Anchored vessel circle marker
const SHIP_CIRCLE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" fill="%23ffffff" stroke="%231e293b" stroke-width="2.5"/></svg>`;

export interface ViewportBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface DeckMapProps {
  vessels: VesselState[];
  alerts?: AlertRecord[];
  geofences: any;
  selectedVessel: VesselState | null;
  onSelectVessel: (v: VesselState | null) => void;
  vesselTrack: Array<{ lat: number; lon: number; ts: string }>;
  showGeofences: boolean;
  onToggleGeofences: () => void;
  showPlaceNames?: boolean;
  onTogglePlaceNames: () => void;
  showDriftCones?: boolean;
  onToggleDriftCones: () => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  alertCount: number;
  onBoundsChange?: (bounds: ViewportBounds) => void;
}

export function calculateBounds(viewState: { longitude: number; latitude: number; zoom: number }): ViewportBounds {
  const { longitude, latitude, zoom } = viewState;
  if (zoom < 3.0) {
    return { minLon: -180, minLat: -85, maxLon: 180, maxLat: 85 };
  }
  const dLon = Math.min(180, (360 / Math.pow(2, zoom)) * 1.5);
  const dLat = Math.min(85, (180 / Math.pow(2, zoom)) * 1.5);
  return {
    minLon: Number(Math.max(-180, longitude - dLon).toFixed(4)),
    minLat: Number(Math.max(-85, latitude - dLat).toFixed(4)),
    maxLon: Number(Math.min(180, longitude + dLon).toFixed(4)),
    maxLat: Number(Math.min(85, latitude + dLat).toFixed(4)),
  };
}

const INITIAL_VIEW_STATE = {
  longitude: 10.0,
  latitude: 25.0,
  zoom: 2.2,
  minZoom: 1.5,
  maxZoom: 18,
  pitch: 20,
  bearing: 0,
};

const REGIONS = [
  { name: "Global World", desc: "Global Oceanic Fleet", lon: 10.0, lat: 25.0, zoom: 2.2 },
  { name: "Pacific / US", desc: "California Surveillance Corridor", lon: -122.42, lat: 37.8, zoom: 8 },
  { name: "Europe / North Sea", desc: "Rotterdam & English Channel", lon: 4.5, lat: 51.5, zoom: 5.5 },
  { name: "Asia / Singapore", desc: "Strait of Malacca Chokepoint", lon: 103.8, lat: 1.3, zoom: 6.5 },
  { name: "Mediterranean", desc: "Gibraltar & Suez Gateway", lon: 15.0, lat: 36.5, zoom: 5.2 },
];

// Basemap style generator with Esri World Boundaries and Places labels
const getSatelliteStyle = (showLabels: boolean = true): any => ({
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
    "esri-labels": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, HERE, Garmin, OpenStreetMap",
    },
  },
  layers: [
    {
      id: "esri-satellite-layer",
      type: "raster",
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 19,
    },
    {
      id: "esri-labels-layer",
      type: "raster",
      source: "esri-labels",
      minzoom: 0,
      maxzoom: 19,
      layout: {
        visibility: showLabels ? "visible" : "none",
      },
    },
  ],
});

const BASEMAPS = {
  satellite: {
    name: "Earth Satellite",
    icon: Globe,
    style: getSatelliteStyle(true),
  },
  ocean: {
    name: "Nautical Ocean",
    icon: Compass,
    style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  },
  dark: {
    name: "Tactical Dark",
    icon: Moon,
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
};

export default function DeckMap({
  vessels,
  alerts = [],
  geofences,
  selectedVessel,
  onSelectVessel,
  vesselTrack,
  showGeofences,
  onToggleGeofences,
  showPlaceNames = true,
  onTogglePlaceNames,
  showDriftCones = true,
  onToggleDriftCones,
  drawerOpen = true,
  onToggleDrawer,
  alertCount = 0,
  onBoundsChange,
}: DeckMapProps) {
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [activeBasemap, setActiveBasemap] = useState<"satellite" | "ocean" | "dark">("dark");
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
  const [activeRegion, setActiveRegion] = useState<string>("Global World");
  const [sectorDropdownOpen, setSectorDropdownOpen] = useState<boolean>(false);

  const latestAlertByMmsi = useMemo(() => {
    const map = new Map<number, AlertRecord>();
    for (const a of alerts || []) {
      if (!map.has(a.mmsi)) {
        map.set(a.mmsi, a);
      }
    }
    return map;
  }, [alerts]);

  // Notify parent of viewport bounds changes with 300ms debounce
  useEffect(() => {
    if (!onBoundsChange) return;
    const timer = setTimeout(() => {
      onBoundsChange(calculateBounds(viewState));
    }, 300);
    return () => clearTimeout(timer);
  }, [viewState.longitude, viewState.latitude, viewState.zoom, onBoundsChange]);

  // Close sector dropdown on outside click
  useEffect(() => {
    if (!sectorDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".sector-dropdown-wrapper")) {
        setSectorDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [sectorDropdownOpen]);

  // Dynamic satellite style respecting showPlaceNames toggle
  const currentMapStyle = useMemo(() => {
    if (activeBasemap === "satellite") {
      return getSatelliteStyle(showPlaceNames);
    }
    return BASEMAPS[activeBasemap].style;
  }, [activeBasemap, showPlaceNames]);

  // Auto-focus on vessel when selected from drawer or feed
  useEffect(() => {
    if (selectedVessel) {
      setViewState((prev: any) => ({
        ...prev,
        longitude: Number(selectedVessel.lon),
        latitude: Number(selectedVessel.lat),
        zoom: 9.5,
        transitionDuration: 1000,
      }));
    }
  }, [selectedVessel]);

  const handleRegionSelect = (r: (typeof REGIONS)[0]) => {
    setActiveRegion(r.name);
    setViewState((prev: any) => ({
      ...prev,
      longitude: r.lon,
      latitude: r.lat,
      zoom: r.zoom,
      transitionDuration: 1000,
    }));
  };

  const layers = useMemo(() => {
    const list: any[] = [];

    // 1. Geofences Polygon Layer
    if (showGeofences && geofences && geofences.features) {
      list.push(
        new GeoJsonLayer({
          id: "geofences-layer",
          data: geofences,
          pickable: true,
          stroked: true,
          filled: true,
          lineWidthMinPixels: 1.5,
          getLineColor: [203, 213, 225, 180], // Liquid silver/slate line
          getFillColor: [148, 163, 184, 20],
          getLineWidth: 2,
        })
      );
    }

    // 2. Incident Vectors Layer (Spoof Teleportation lines & STS Rendezvous links)
    const incidentPaths: Array<{ path: [[number, number], [number, number]]; color: [number, number, number, number] }> = [];
    for (const a of alerts || []) {
      const details = a.details;
      if (a.alert_type === "spoof" && details?.origin_lat && details?.origin_lon && a.last_lat && a.last_lon) {
        incidentPaths.push({
          path: [[details.origin_lon, details.origin_lat], [a.last_lon, a.last_lat]],
          color: [245, 158, 11, 230], // Amber vector for GPS jump
        });
      }
      if (a.alert_type === "rendezvous_sts" && details?.partner_mmsi && a.last_lat && a.last_lon) {
        const partnerMmsi = details.partner_mmsi;
        const partner = vessels.find((v) => v.mmsi === partnerMmsi);
        if (partner) {
          incidentPaths.push({
            path: [[a.last_lon, a.last_lat], [partner.lon, partner.lat]],
            color: [249, 115, 22, 240], // Orange link for STS encounter
          });
        }
      }
    }

    if (incidentPaths.length > 0) {
      list.push(
        new PathLayer({
          id: "incident-vectors-layer",
          data: incidentPaths,
          pickable: false,
          widthMinPixels: 2.5,
          getPath: (d: any) => d.path,
          getColor: (d: any) => d.color,
          getWidth: 3,
        })
      );
    }

    // 3. Selected Vessel Track Path Layer
    if (vesselTrack && vesselTrack.length > 1) {
      const pathCoordinates = vesselTrack.map((pt) => [pt.lon, pt.lat]);
      list.push(
        new PathLayer({
          id: "vessel-track-layer",
          data: [{ path: pathCoordinates }],
          getPath: (d: any) => d.path,
          getColor: [241, 245, 249, 240], // Platinum silver luminous trail
          getWidth: 3,
          widthMinPixels: 2,
          pickable: false,
        })
      );
    }

    // 4. Dead-Reckoning Drift Search Cones for Dark Vessels
    const darkVesselsToRender = showDriftCones
      ? vessels.filter((v) => v.status === "dark")
      : selectedVessel && selectedVessel.status === "dark"
      ? [selectedVessel]
      : [];

    if (darkVesselsToRender.length > 0) {
      const coneFeatures: DriftConeFeature[] = darkVesselsToRender.map((v) =>
        computeDriftCone(v.mmsi, v.lat, v.lon, v.sog, v.cog, v.last_seen)
      );

      list.push(
        new GeoJsonLayer({
          id: "drift-cones-layer",
          data: {
            type: "FeatureCollection",
            features: coneFeatures,
          },
          pickable: true,
          stroked: true,
          filled: true,
          lineWidthMinPixels: 1.5,
          getLineColor: [248, 113, 113, 220], // Luminous crimson edge
          getFillColor: [239, 68, 68, 55],    // Translucent search wedge
          getLineWidth: 2,
        })
      );
    }

    // 5. Anomaly Aura Pulse Layer (Draws glowing halo around all anomalous vessels)
    const anomalousVessels = vessels.filter((v) => latestAlertByMmsi.has(v.mmsi));
    if (anomalousVessels.length > 0) {
      list.push(
        new ScatterplotLayer<VesselState>({
          id: "anomalies-aura-layer",
          data: anomalousVessels,
          pickable: false,
          stroked: true,
          filled: true,
          radiusScale: 6,
          radiusMinPixels: 10,
          radiusMaxPixels: 30,
          lineWidthMinPixels: 2,
          getPosition: (d: VesselState) => [d.lon, d.lat],
          getRadius: () => 180,
          getFillColor: (d: VesselState) => {
            const a = latestAlertByMmsi.get(d.mmsi);
            if (!a) return [239, 68, 68, 40];
            if (a.alert_type === "spoof") return [245, 158, 11, 45];
            if (a.alert_type === "mmsi_collision") return [6, 182, 212, 45];
            if (a.alert_type === "loiter") return [234, 179, 8, 45];
            if (a.alert_type === "rendezvous_sts") return [249, 115, 22, 45];
            if (a.alert_type === "ml_anomaly") return [168, 85, 247, 50];
            return [239, 68, 68, 45];
          },
          getLineColor: (d: VesselState) => {
            const a = latestAlertByMmsi.get(d.mmsi);
            if (!a) return [239, 68, 68, 220];
            if (a.alert_type === "spoof") return [245, 158, 11, 240];
            if (a.alert_type === "mmsi_collision") return [6, 182, 212, 240];
            if (a.alert_type === "loiter") return [234, 179, 8, 240];
            if (a.alert_type === "rendezvous_sts") return [249, 115, 22, 240];
            if (a.alert_type === "ml_anomaly") return [168, 85, 247, 255];
            return [239, 68, 68, 220];
          },
        })
      );
    }

    // 6. MarineTraffic Directional Vessel Arrow Layer (Oriented by True Heading or Course Over Ground)
    list.push(
      new IconLayer<VesselState>({
        id: "vessels-arrow-layer",
        data: vessels,
        pickable: true,
        sizeScale: 1,
        sizeMinPixels: 12,
        sizeMaxPixels: 38,
        getPosition: (d: VesselState) => [Number(d.lon), Number(d.lat)],
        getIcon: (d: VesselState) => {
          const isMoving = Number(d.sog || 0) > 0.5;
          return {
            url: isMoving ? SHIP_ARROW_SVG : SHIP_CIRCLE_SVG,
            width: 48,
            height: 48,
            mask: true, // Enables dynamic GPU color tinting via getColor
          };
        },
        getAngle: (d: VesselState) => {
          // In AIS navigation: 0° is North, 90° East, 180° South, 270° West (clockwise)
          // DeckGL IconLayer rotates counter-clockwise from initial North sprite
          // Therefore 360 - angle produces smooth clockwise rotation
          const headingVal =
            d.heading !== null && d.heading !== undefined && d.heading !== 511 && d.heading >= 0
              ? Number(d.heading)
              : Number(d.cog || 0);
          return (360 - headingVal) % 360;
        },
        getSize: (d: VesselState) => {
          if (selectedVessel && selectedVessel.mmsi === d.mmsi) return 34;
          if (latestAlertByMmsi.has(d.mmsi)) return 26;
          if (d.status === "dark") return 24;
          return 18;
        },
        getColor: (d: VesselState) => {
          const alert = latestAlertByMmsi.get(d.mmsi);
          if (alert) {
            if (alert.alert_type === "spoof") return [245, 158, 11, 255]; // Amber
            if (alert.alert_type === "mmsi_collision") return [6, 182, 212, 255]; // Cyan
            if (alert.alert_type === "loiter") return [234, 179, 8, 255]; // Gold
            if (alert.alert_type === "rendezvous_sts") return [249, 115, 22, 255]; // Orange
            if (alert.alert_type === "ml_anomaly") return [168, 85, 247, 255]; // Purple
            if (alert.alert_type === "dark_vessel") return [239, 68, 68, 255]; // Crimson
          }

          if (d.status === "dark") return [239, 68, 68, 255];
          if (d.status === "stale") return [245, 158, 11, 230];

          // MarineTraffic standard vessel category colors:
          const code = Number(d.vessel_type) || 70;
          if (code >= 80 && code <= 89) return [239, 68, 68, 240]; // Red: Tankers
          if (code >= 70 && code <= 79) return [16, 185, 129, 240]; // Green: Cargo & Container
          if (code === 30) return [249, 115, 22, 240];             // Orange: Fishing
          if (code >= 60 && code <= 69) return [14, 165, 233, 240]; // Sky Blue: Passenger
          if (code >= 40 && code <= 49 || code >= 36 && code <= 37) return [168, 85, 247, 240]; // Purple: HSC & Pleasure
          if (code === 52 || code === 31 || code === 32) return [100, 116, 139, 220]; // Slate: Tugs / Port

          return [16, 185, 129, 240]; // Default: Cargo Green
        },
        onHover: (info) => setHoverInfo(info),
        onClick: (info) => {
          if (info.object) {
            onSelectVessel(info.object as VesselState);
          } else {
            onSelectVessel(null);
          }
        },
        updateTriggers: {
          getSize: [selectedVessel?.mmsi, latestAlertByMmsi],
          getColor: [selectedVessel?.mmsi, latestAlertByMmsi],
          getAngle: [vessels],
        },
      })
    );

    return list;
  }, [vessels, geofences, selectedVessel, vesselTrack, showGeofences, onSelectVessel, showDriftCones, alerts, latestAlertByMmsi]);

  return (
    <div className="map-viewport" style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Minimalist Floating Controls on the Right Side of the Map */}
      <div className="mt-map-floating-controls">
        {/* Unified Surveillance & Layer Control Card */}
        <div className="mt-floating-control-card">
          {/* Segmented Basemap Switcher */}
          <div className="mt-basemap-btn-group">
            {(["satellite", "ocean", "dark"] as const).map((key) => {
              const item = BASEMAPS[key];
              const Icon = item.icon;
              const isActive = activeBasemap === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveBasemap(key)}
                  className={`mt-basemap-pill-btn ${isActive ? "active" : ""}`}
                  title={`Switch basemap to ${item.name}`}
                >
                  <Icon size={12} />
                  <span>{item.name.replace("Earth ", "").replace("Nautical ", "").replace("Tactical ", "")}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-control-divider" />

          {/* Quick Layer Toggles */}
          <div className="mt-layer-btn-group">
            <button
              type="button"
              onClick={onTogglePlaceNames}
              className={`mt-layer-toggle-row ${showPlaceNames ? "active" : ""}`}
              title="Toggle world borders, coastlines, and place names"
            >
              <div className="flex items-center gap-2">
                <MapPin size={12} className={showPlaceNames ? "text-orange-500" : "text-slate-400"} />
                <span className="text-xs text-slate-700">Names & Borders</span>
              </div>
              <span className={`mt-switch-dot ${showPlaceNames ? "on" : "off"}`} />
            </button>

            <button
              type="button"
              onClick={onToggleGeofences}
              className={`mt-layer-toggle-row ${showGeofences ? "active" : ""}`}
              title="Toggle EEZ maritime boundaries"
            >
              <div className="flex items-center gap-2">
                <Layers size={12} className={showGeofences ? "text-orange-500" : "text-slate-400"} />
                <span className="text-xs text-slate-700">EEZ Boundaries</span>
              </div>
              <span className={`mt-switch-dot ${showGeofences ? "on" : "off"}`} />
            </button>

            <button
              type="button"
              onClick={onToggleDriftCones}
              className={`mt-layer-toggle-row ${showDriftCones ? "active" : ""}`}
              title="Toggle dead-reckoning search uncertainty cones"
            >
              <div className="flex items-center gap-2">
                <Radar size={12} className={showDriftCones ? "text-orange-500" : "text-slate-400"} />
                <span className="text-xs text-slate-700">Drift Cones</span>
              </div>
              <span className={`mt-switch-dot ${showDriftCones ? "on" : "off"}`} />
            </button>
          </div>

          <div className="mt-control-divider" />

          {/* Sector Jump Dropdown */}
          <div className="sector-dropdown-wrapper">
            <button
              type="button"
              className={`mt-sector-trigger-btn ${sectorDropdownOpen ? "open" : ""}`}
              onClick={() => setSectorDropdownOpen((prev) => !prev)}
              title="Select surveillance theater"
            >
              <div className="flex items-center gap-2 truncate">
                <Compass size={13} className="text-orange-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-800 truncate">{activeRegion}</span>
              </div>
              <ChevronDown size={12} className="text-slate-400 shrink-0" />
            </button>

            {sectorDropdownOpen && (
              <div className="mt-floating-sector-menu">
                <div className="mt-sector-menu-title">SURVEILLANCE THEATER</div>
                {REGIONS.map((r) => {
                  const isRegActive = activeRegion === r.name;
                  return (
                    <button
                      key={r.name}
                      type="button"
                      className={`mt-sector-menu-item ${isRegActive ? "active" : ""}`}
                      onClick={() => {
                        handleRegionSelect(r);
                        setSectorDropdownOpen(false);
                      }}
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-semibold text-slate-800">{r.name}</span>
                        <span className="text-2xs text-slate-400">{r.desc}</span>
                      </div>
                      {isRegActive && <span className="mt-active-indicator-dot" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Minimal Floating Zoom Pill */}
        <div className="mt-floating-zoom-card">
          <button
            type="button"
            className="mt-zoom-btn"
            onClick={() => setViewState((prev: any) => ({ ...prev, zoom: Math.min(prev.maxZoom || 18, prev.zoom + 1), transitionDuration: 300 }))}
            title="Zoom In"
          >
            <Plus size={14} />
          </button>
          <div className="mt-zoom-divider" />
          <button
            type="button"
            className="mt-zoom-btn"
            onClick={() => setViewState((prev: any) => ({ ...prev, zoom: Math.max(prev.minZoom || 1.5, prev.zoom - 1), transitionDuration: 300 }))}
            title="Zoom Out"
          >
            <Minus size={14} />
          </button>
          <div className="mt-zoom-divider" />
          <button
            type="button"
            className="mt-zoom-btn"
            onClick={() => handleRegionSelect(REGIONS[0])}
            title="Reset to Global World"
          >
            <Globe size={13} />
          </button>
        </div>
      </div>

      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: newViewState }: any) => setViewState(newViewState)}
        controller={true}
        layers={layers}
        style={{ width: "100%", height: "100%", position: "absolute", top: "0px", left: "0px" }}
      >
        {/* MapLibre basemap with full Earth visibility & place names */}
        <MapGL
          reuseMaps
          mapLib={maplibregl}
          mapStyle={currentMapStyle}
          style={{ width: "100%", height: "100%" }}
        />
      </DeckGL>

      {/* Floating MarineTraffic Tooltip Card */}
      {hoverInfo && hoverInfo.object && (
        <div
          className="mt-map-tooltip"
          style={{
            position: "absolute",
            zIndex: 100,
            pointerEvents: "none",
            left: hoverInfo.x + 14,
            top: hoverInfo.y + 14,
          }}
        >
          {hoverInfo.object.properties && hoverInfo.object.properties.distance_km !== undefined ? (
            <div className="mt-tooltip-cone">
              <div className="mt-tooltip-header text-red-600 font-bold">
                DRIFT SEARCH CONE // MMSI {hoverInfo.object.properties.mmsi}
              </div>
              <div>Elapsed Silent: {hoverInfo.object.properties.elapsed_hours} hrs</div>
              <div>Est. Displacement: {hoverInfo.object.properties.distance_km} km</div>
              <div>Last Track: {hoverInfo.object.properties.sog_knots} kn @ {hoverInfo.object.properties.cog_degrees}°</div>
            </div>
          ) : (
            (() => {
              const country = getVesselCountry(hoverInfo.object.mmsi);
              const vTypeName = getVesselTypeName(hoverInfo.object.vessel_type);
              const photo = getVesselPhoto(hoverInfo.object.vessel_type, hoverInfo.object.mmsi);
              const motion = getMotionState(hoverInfo.object.sog, hoverInfo.object.status);
              const navStatus = getNavStatusName(null, hoverInfo.object.sog);
              const voyage = getVoyageDetails(hoverInfo.object.mmsi, hoverInfo.object.vessel_type, hoverInfo.object.last_seen);
              const vName = hoverInfo.object.vessel_name || `MMSI: ${hoverInfo.object.mmsi}`;

              return (
                <div className="mt-tooltip-card">
                  <div className="mt-tooltip-top">
                    <span className="mt-tooltip-type font-semibold">{vTypeName}</span>
                    <span className="mt-tooltip-source text-xs text-slate-500">Position received via Satellite</span>
                  </div>

                  <div className="mt-tooltip-title-row">
                    <span className="text-base">{country.flag}</span>
                    <strong className="mt-tooltip-name">{vName}</strong>
                    <span className="mt-tooltip-mmsi font-mono text-xs text-slate-500">({hoverInfo.object.mmsi})</span>
                  </div>

                  <div className="mt-tooltip-metrics">
                    <div className="mt-metric-col">
                      <span className="mt-metric-label">SPEED (SOG)</span>
                      <span className="mt-metric-value text-orange-600 font-bold">
                        {hoverInfo.object.sog !== null && hoverInfo.object.sog !== undefined ? `${Number(hoverInfo.object.sog).toFixed(1)} kn` : "0.0 kn"}
                      </span>
                    </div>
                    <div className="mt-metric-col">
                      <span className="mt-metric-label">COURSE (COG)</span>
                      <span className="mt-metric-value font-medium">
                        {hoverInfo.object.cog !== null && hoverInfo.object.cog !== undefined ? `${Number(hoverInfo.object.cog).toFixed(0)}°` : "—"}
                      </span>
                    </div>
                    <div className="mt-metric-col">
                      <span className="mt-metric-label">HEADING</span>
                      <span className="mt-metric-value font-medium">
                        {hoverInfo.object.heading !== null && hoverInfo.object.heading !== undefined && hoverInfo.object.heading !== 511 ? `${hoverInfo.object.heading}°` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-tooltip-footer">
                    <span className="text-xs text-orange-600 font-medium">Click vessel to open details sidebar ➔</span>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

    </div>
  );
}
