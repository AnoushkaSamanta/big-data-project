"use client";

import React, { useState, useMemo, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { GeoJsonLayer, PathLayer } from "@deck.gl/layers";
import Map from "react-map-gl/maplibre";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { VesselState } from "@/app/api/vessels/route";
import { Globe, Compass, Moon } from "lucide-react";
import { computeDriftCone, DriftConeFeature } from "@/lib/drift";
import { getVesselCountry, getVesselTypeName } from "@/lib/mmsi";

interface DeckMapProps {
  vessels: VesselState[];
  geofences: any;
  selectedVessel: VesselState | null;
  onSelectVessel: (v: VesselState | null) => void;
  vesselTrack: Array<{ lat: number; lon: number; ts: string }>;
  showGeofences: boolean;
  showPlaceNames?: boolean;
  showDriftCones?: boolean;
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
  { name: "Global World", lon: 10.0, lat: 25.0, zoom: 2.2 },
  { name: "Pacific / US", lon: -122.42, lat: 37.8, zoom: 8 },
  { name: "Europe / North Sea", lon: 4.5, lat: 51.5, zoom: 5.5 },
  { name: "Asia / Singapore", lon: 103.8, lat: 1.3, zoom: 6.5 },
  { name: "Mediterranean", lon: 15.0, lat: 36.5, zoom: 5.2 },
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
  showPlaceNames = true,
  showDriftCones = true,
}: DeckMapProps) {
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [activeBasemap, setActiveBasemap] = useState<"satellite" | "ocean" | "dark">("satellite");
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
  const [activeRegion, setActiveRegion] = useState<string>("Global World");

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

    // 3. Vessel Scatterplot Layer (High performance GPU rendering for 10k+ points)
    list.push(
      new ScatterplotLayer<VesselState>({
        id: "vessels-layer",
        data: vessels,
        pickable: true,
        opacity: 0.95,
        stroked: true,
        filled: true,
        radiusScale: 6,
        radiusMinPixels: 5,
        radiusMaxPixels: 20,
        lineWidthMinPixels: 2,
        getPosition: (d: VesselState) => [d.lon, d.lat],
        getRadius: (d: VesselState) => {
          if (selectedVessel && selectedVessel.mmsi === d.mmsi) return 140;
          if (d.status === "dark") return 100;
          return 60;
        },
        getFillColor: (d: VesselState) => {
          if (d.status === "dark") return [239, 68, 68, 255]; // Crimson warning
          if (d.status === "stale") return [245, 158, 11, 240]; // Amber
          return [16, 185, 129, 230]; // Emerald active
        },
        getLineColor: (d: VesselState) => {
          if (selectedVessel && selectedVessel.mmsi === d.mmsi) {
            return [255, 255, 255, 255];
          }
          if (d.status === "dark") return [255, 200, 200, 255];
          return [10, 20, 38, 220];
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
      {/* Top Map Toolbar: Regional Navigator & Basemap Switcher */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          zIndex: 35,
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        {/* Regional Focus Pills */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: "rgba(11, 13, 19, 0.9)",
            padding: "5px",
            borderRadius: "8px",
            border: "1px solid var(--silver-border)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          }}
        >
          {REGIONS.map((r) => {
            const isRegActive = activeRegion === r.name;
            return (
              <button
                key={r.name}
                onClick={() => handleRegionSelect(r)}
                style={{
                  padding: "5px 9px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "5px",
                  border: "none",
                  cursor: "pointer",
                  background: isRegActive ? "rgba(226, 232, 240, 0.16)" : "transparent",
                  color: isRegActive ? "#ffffff" : "var(--silver-400)",
                  borderBottom: isRegActive ? "2px solid #ffffff" : "2px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                {r.name}
              </button>
            );
          })}
        </div>

        {/* Basemap Switcher */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: "rgba(11, 13, 19, 0.9)",
            padding: "5px",
            borderRadius: "8px",
            border: "1px solid var(--silver-border)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          }}
        >
          {(["satellite", "ocean", "dark"] as const).map((key) => {
            const item = BASEMAPS[key];
            const Icon = item.icon;
            const isActive = activeBasemap === key;
            return (
              <button
                key={key}
                onClick={() => setActiveBasemap(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "5px",
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "var(--silver-gradient)" : "transparent",
                  color: isActive ? "#07080b" : "var(--silver-400)",
                  boxShadow: isActive ? "0 2px 8px rgba(226, 232, 240, 0.3)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={13} />
                <span>{item.name}</span>
              </button>
            );
          })}
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
              return (
                <div>
                  <div style={{ fontWeight: 700, color: "var(--silver-200)", marginBottom: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "14px" }}>{country.flag}</span>
                    <span>{hoverInfo.object.vessel_name || `MMSI: ${hoverInfo.object.mmsi}`}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--silver-400)", marginBottom: "4px" }}>
                    {country.country} • {vTypeName}
                  </div>
                  <div>Status: <span style={{ textTransform: "uppercase", fontWeight: 600 }}>{hoverInfo.object.status}</span></div>
                  <div>Speed: {hoverInfo.object.sog !== null && hoverInfo.object.sog !== undefined ? `${Number(hoverInfo.object.sog).toFixed(1)} kn` : "N/A"}</div>
                  <div>Heading: {hoverInfo.object.heading !== null && hoverInfo.object.heading !== undefined ? `${Number(hoverInfo.object.heading).toFixed(1)}°` : "N/A"}</div>
                  <div>Class: {hoverInfo.object.transceiver_class || "A"}</div>
                  <div style={{ fontSize: "10px", color: "var(--silver-500)", marginTop: "4px" }}>
                    Lat: {Number(hoverInfo.object.lat).toFixed(4)}, Lon: {Number(hoverInfo.object.lon).toFixed(4)}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Map Legend */}
      <div className="map-legend">
        <div style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.05em", color: "var(--silver-100)" }}>
          SURVEILLANCE RADAR
        </div>
        <div className="legend-item">
          <div className="legend-swatch active" />
          <span>Active Vessel (Normal AIS)</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch stale" />
          <span>Stale (Delayed broadcast)</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch dark" />
          <span>Dark Vessel Anomaly (Gap &gt; p99)</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch" style={{ background: "rgba(239, 68, 68, 0.4)", border: "1px dashed #f87171" }} />
          <span>Drift Uncertainty Search Zone</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch geofence" />
          <span>EEZ / Marine Protected Area</span>
        </div>
      </div>
    </div>
  );
}
