"use client";

import React, { useState, useMemo, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { GeoJsonLayer, PathLayer } from "@deck.gl/layers";
import Map from "react-map-gl/maplibre";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { VesselState } from "@/app/api/vessels/route";
import { Globe, Compass, Moon, ChevronDown, MapPin, Layers, Radar, ShieldAlert } from "lucide-react";
import { computeDriftCone, DriftConeFeature } from "@/lib/drift";
import {
  getVesselCountry,
  getVesselTypeName,
  getVesselPhoto,
  getMotionState,
  getNavStatusName,
  getVoyageDetails,
} from "@/lib/mmsi";

interface DeckMapProps {
  vessels: VesselState[];
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
}: DeckMapProps) {
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [activeBasemap, setActiveBasemap] = useState<"satellite" | "ocean" | "dark">("satellite");
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
  const [activeRegion, setActiveRegion] = useState<string>("Global World");
  const [sectorDropdownOpen, setSectorDropdownOpen] = useState<boolean>(false);

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

    // 2. Selected Vessel Track Path Layer
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

    // 3. Dead-Reckoning Drift Search Cones for Dark Vessels
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

    // 3. Vessel Scatterplot Layer (High performance GPU rendering for 60k+ points)
    list.push(
      new ScatterplotLayer<VesselState>({
        id: "vessels-layer",
        data: vessels,
        pickable: true,
        opacity: 0.9,
        stroked: true,
        filled: true,
        radiusScale: 6,
        radiusMinPixels: 2.5,
        radiusMaxPixels: 16,
        lineWidthMinPixels: 1,
        getPosition: (d: VesselState) => [d.lon, d.lat],
        getRadius: (d: VesselState) => {
          if (selectedVessel && selectedVessel.mmsi === d.mmsi) return 140;
          if (d.status === "dark") return 110;
          return 50;
        },
        getFillColor: (d: VesselState) => {
          if (d.status === "dark") return [239, 68, 68, 255]; // Crimson warning (Dark vessel)
          if (d.status === "stale") return [245, 158, 11, 220]; // Amber (delayed ping)

          // GPS Spoofed Inland Target (Queen Alia Airport hotspot, Jordan)
          if (d.lat >= 31.65 && d.lat <= 31.85 && d.lon >= 35.9 && d.lon <= 36.1) {
            return [245, 158, 11, 240]; // Amber warning
          }

          // MarineTraffic-Style Maritime Category Color-Coding
          const code = Number(d.vessel_type) || 70;
          if (code >= 80 && code <= 89) return [239, 68, 68, 210]; // Red/Crimson: Tankers
          if (code >= 70 && code <= 79) return [16, 185, 129, 210]; // Green: Cargo & Container
          if (code === 30) return [249, 115, 22, 210];             // Orange: Fishing
          if (code >= 60 && code <= 69) return [14, 165, 233, 210]; // Cyan/Blue: Passenger
          if (code >= 40 && code <= 49) return [168, 85, 247, 210]; // Purple: High-Speed Craft
          if (code === 52 || code === 31 || code === 32) return [148, 163, 184, 190]; // Slate: Tugs

          return [16, 185, 129, 210]; // Default: Cargo Green
        },
        getLineColor: (d: VesselState) => {
          if (selectedVessel && selectedVessel.mmsi === d.mmsi) {
            return [255, 255, 255, 255];
          }
          if (d.lat >= 31.65 && d.lat <= 31.85 && d.lon >= 35.9 && d.lon <= 36.1) {
            return [239, 68, 68, 255]; // Crimson border for spoofed inland target
          }
          if (d.status === "dark") return [255, 220, 220, 255];
          return [5, 10, 20, 180];
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
          getRadius: [selectedVessel?.mmsi],
          getLineColor: [selectedVessel?.mmsi],
        },
      })
    );

    return list;
  }, [vessels, geofences, selectedVessel, vesselTrack, showGeofences, onSelectVessel, showDriftCones]);

  return (
    <div className="map-viewport" style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Unified Tactical Command Bar (HUD Ribbon) */}
      <div className="tactical-command-bar">
        {/* Left Cluster: Operational Sector Jump & Layer Toggles */}
        <div className="command-bar-cluster command-bar-left">
          {/* Sector Selector Dropdown */}
          <div className="sector-dropdown-wrapper">
            <button
              type="button"
              className={`command-bar-btn sector-trigger ${sectorDropdownOpen ? "active" : ""}`}
              onClick={() => setSectorDropdownOpen((prev) => !prev)}
              title="Select operational surveillance theater"
            >
              <Compass size={13} className="cluster-icon text-cyan" />
              <span className="btn-label-dim">SECTOR:</span>
              <span className="btn-label-bold">{activeRegion}</span>
              <ChevronDown size={12} className={`dropdown-chevron ${sectorDropdownOpen ? "open" : ""}`} />
            </button>

            {sectorDropdownOpen && (
              <div className="sector-dropdown-menu">
                <div className="dropdown-menu-header">OPERATIONAL SURVEILLANCE SECTORS</div>
                {REGIONS.map((r) => {
                  const isRegActive = activeRegion === r.name;
                  return (
                    <button
                      key={r.name}
                      type="button"
                      className={`dropdown-menu-item ${isRegActive ? "active" : ""}`}
                      onClick={() => {
                        handleRegionSelect(r);
                        setSectorDropdownOpen(false);
                      }}
                    >
                      <div className="menu-item-info">
                        <span className="menu-item-name">{r.name}</span>
                        <span className="menu-item-sub">{r.desc}</span>
                      </div>
                      {isRegActive && <span className="active-dot" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="command-bar-divider" />

          {/* Layer Toggles Strip */}
          <div className="layer-toggles-strip">
            <button
              type="button"
              onClick={onTogglePlaceNames}
              className={`command-bar-chip ${showPlaceNames ? "active" : ""}`}
              title="Toggle world borders, coastlines, and place names"
            >
              <MapPin size={12} />
              <span>NAMES</span>
              <span className={`chip-indicator ${showPlaceNames ? "on" : ""}`} />
            </button>

            <button
              type="button"
              onClick={onToggleGeofences}
              className={`command-bar-chip ${showGeofences ? "active" : ""}`}
              title="Toggle EEZ maritime boundaries & Marine Protected Areas"
            >
              <Layers size={12} />
              <span>GEOFENCES</span>
              <span className={`chip-indicator ${showGeofences ? "on" : ""}`} />
            </button>

            <button
              type="button"
              onClick={onToggleDriftCones}
              className={`command-bar-chip ${showDriftCones ? "active" : ""}`}
              title="Toggle dead-reckoning search uncertainty cones for dark vessels"
            >
              <Radar size={12} />
              <span>DRIFT CONES</span>
              <span className={`chip-indicator ${showDriftCones ? "on" : ""}`} />
            </button>
          </div>
        </div>

        {/* Right Cluster: Basemap Switcher & Alert Drawer Toggle */}
        <div className="command-bar-cluster command-bar-right">
          {/* Basemap Switcher */}
          <div className="basemap-strip">
            {(["satellite", "ocean", "dark"] as const).map((key) => {
              const item = BASEMAPS[key];
              const Icon = item.icon;
              const isActive = activeBasemap === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveBasemap(key)}
                  className={`command-bar-chip basemap-chip ${isActive ? "active" : ""}`}
                  title={`Switch basemap to ${item.name}`}
                >
                  <Icon size={12} />
                  <span>{item.name.replace("Earth ", "").replace("Nautical ", "").replace("Tactical ", "")}</span>
                </button>
              );
            })}
          </div>

          <div className="command-bar-divider" />

          {/* Alert Feed Toggle Button */}
          <button
            type="button"
            onClick={onToggleDrawer}
            className={`command-bar-btn alert-drawer-trigger ${drawerOpen ? "active" : ""}`}
            title="Toggle Anomaly Alert Feed sidebar"
          >
            <ShieldAlert size={14} color="#ef4444" />
            <span>ALERTS</span>
            <span className="command-badge">{alertCount}</span>
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
        <Map
          reuseMaps
          mapLib={maplibregl}
          mapStyle={currentMapStyle}
          style={{ width: "100%", height: "100%" }}
        />
      </DeckGL>

      {/* Floating Tooltip */}
      {hoverInfo && hoverInfo.object && (
        <div
          style={{
            position: "absolute",
            zIndex: 100,
            pointerEvents: "none",
            left: hoverInfo.x + 12,
            top: hoverInfo.y + 12,
            background: "rgba(7, 8, 11, 0.95)",
            border: "1px solid var(--silver-border-glow)",
            backdropFilter: "blur(10px)",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            color: "var(--silver-100)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          }}
        >
          {hoverInfo.object.properties && hoverInfo.object.properties.distance_km !== undefined ? (
            <div>
              <div style={{ fontWeight: 700, color: "#f87171", marginBottom: "4px" }}>
                TACTICAL SEARCH CONE // MMSI {hoverInfo.object.properties.mmsi}
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

              return (
                <div style={{ maxWidth: "260px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                    <img
                      src={photo.url}
                      alt={hoverInfo.object.vessel_name || `MMSI: ${hoverInfo.object.mmsi}`}
                      style={{
                        width: "68px",
                        height: "48px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        border: "1px solid var(--silver-border-glow)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "var(--silver-100)", fontSize: "13px", display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span>{country.flag}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{hoverInfo.object.vessel_name || `MMSI: ${hoverInfo.object.mmsi}`}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--silver-400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {vTypeName}
                      </div>
                    </div>
                  </div>

                  {/* GPS Spoofing inland warning badge */}
                  {hoverInfo.object.lat >= 31.65 && hoverInfo.object.lat <= 31.85 && hoverInfo.object.lon >= 35.9 && hoverInfo.object.lon <= 36.1 && (
                    <div style={{
                      background: "rgba(239, 68, 68, 0.2)",
                      border: "1px solid rgba(239, 68, 68, 0.6)",
                      color: "#fca5a5",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      marginBottom: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px"
                    }}>
                      <ShieldAlert size={12} color="#ef4444" />
                      <span>⚠️ GPS SPOOFED // INLAND AMMAN AIRPORT</span>
                    </div>
                  )}

                  {/* Motion Pill */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <span className={`motion-beacon ${motion.statusClass}`} />
                    <span style={{ fontSize: "11px", fontWeight: 700, color: motion.color }}>{motion.label}</span>
                  </div>

                  {/* Route corridor */}
                  <div style={{ fontSize: "11px", color: "var(--silver-300)", marginBottom: "4px" }}>
                    Route: <span style={{ color: "#38bdf8", fontWeight: 600 }}>{voyage.originCode} ➔ {voyage.destCode}</span>
                  </div>

                  <div style={{ fontSize: "11px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", borderTop: "1px solid var(--silver-border-subtle)", paddingTop: "6px" }}>
                    <div>Nav: <span style={{ color: "var(--silver-200)" }}>{navStatus.split(" ")[0]}</span></div>
                    <div>Draught: <span style={{ color: "var(--silver-200)" }}>{voyage.draughtMeters}m</span></div>
                    <div>Course: <span style={{ color: "var(--silver-200)" }}>{hoverInfo.object.cog !== null && hoverInfo.object.cog !== undefined ? `${Number(hoverInfo.object.cog).toFixed(0)}°` : "N/A"}</span></div>
                    <div>Class: <span style={{ color: "var(--silver-200)" }}>Class {hoverInfo.object.transceiver_class || "A"}</span></div>
                  </div>

                  <div style={{ fontSize: "10px", color: "var(--silver-500)", marginTop: "6px", textAlign: "right" }}>
                    Click vessel to inspect full dossier ➔
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Map Legend */}
      <div className="map-legend">
        <div style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.05em", color: "var(--silver-100)", marginBottom: "4px" }}>
          GLOBAL FLEET RADAR
        </div>
        <div className="legend-item">
          <div className="legend-swatch" style={{ background: "#10b981" }} />
          <span>Cargo &amp; Container Vessels</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch" style={{ background: "#ef4444" }} />
          <span>Tankers (Crude Oil / Chemical)</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch" style={{ background: "#f97316" }} />
          <span>Commercial Fishing</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch" style={{ background: "#0ea5e9" }} />
          <span>Passenger &amp; Ferries</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch" style={{ background: "#a855f7" }} />
          <span>High-Speed Craft (HSC)</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch" style={{ background: "#f59e0b", border: "1px solid #ef4444", boxShadow: "0 0 6px #f59e0b" }} />
          <span>GPS Spoofed Inland Target</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch dark" style={{ boxShadow: "0 0 8px #ef4444" }} />
          <span>Dark Vessel Anomaly (Gap &gt; p99)</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch" style={{ background: "rgba(239, 68, 68, 0.4)", border: "1px dashed #f87171" }} />
          <span>Drift Search Uncertainty Cone</span>
        </div>
      </div>
    </div>
  );
}
