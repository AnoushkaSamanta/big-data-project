"use client";

import React, { useState, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { GeoJsonLayer, PathLayer } from "@deck.gl/layers";
import { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { VesselState } from "@/app/api/vessels/route";

interface DeckMapProps {
  vessels: VesselState[];
  geofences: any;
  selectedVessel: VesselState | null;
  onSelectVessel: (v: VesselState | null) => void;
  vesselTrack: Array<{ lat: number; lon: number; ts: string }>;
  showGeofences: boolean;
}

const INITIAL_VIEW_STATE = {
  longitude: -122.42,
  latitude: 37.8,
  zoom: 8.5,
  minZoom: 3,
  maxZoom: 18,
  pitch: 30,
  bearing: 0,
};

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function DeckMap({
  vessels,
  geofences,
  selectedVessel,
  onSelectVessel,
  vesselTrack,
  showGeofences,
}: DeckMapProps) {
  const [hoverInfo, setHoverInfo] = useState<any>(null);

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
          getLineColor: [56, 189, 248, 160], // Tactical cyan
          getFillColor: [6, 182, 212, 22],
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
          getColor: [56, 189, 248, 220],
          getWidth: 3,
          widthMinPixels: 2,
          pickable: false,
        })
      );
    }

    // 3. Vessel Scatterplot Layer (High performance GPU rendering for 10k+ points)
    list.push(
      new ScatterplotLayer<VesselState>({
        id: "vessels-layer",
        data: vessels,
        pickable: true,
        opacity: 0.9,
        stroked: true,
        filled: true,
        radiusScale: 6,
        radiusMinPixels: 4,
        radiusMaxPixels: 18,
        lineWidthMinPixels: 1.5,
        getPosition: (d: VesselState) => [d.lon, d.lat],
        getRadius: (d: VesselState) => {
          if (selectedVessel && selectedVessel.mmsi === d.mmsi) return 120;
          if (d.status === "dark") return 90;
          return 50;
        },
        getFillColor: (d: VesselState) => {
          if (d.status === "dark") return [239, 68, 68, 255]; // Crimson warning
          if (d.status === "stale") return [245, 158, 11, 230]; // Amber
          return [16, 185, 129, 220]; // Emerald active
        },
        getLineColor: (d: VesselState) => {
          if (selectedVessel && selectedVessel.mmsi === d.mmsi) {
            return [255, 255, 255, 255];
          }
          if (d.status === "dark") return [255, 100, 100, 240];
          return [10, 20, 38, 180];
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
  }, [vessels, geofences, selectedVessel, vesselTrack, showGeofences, onSelectVessel]);

  return (
    <div className="map-viewport">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
      >
        {/* MapLibre dark basemap */}
        {/* @ts-ignore maplibre component rendering */}
        <Map
          // @ts-ignore
          reuseMaps
          mapLib={import("maplibre-gl")}
          mapStyle={MAP_STYLE}
          preventStyleDiffing={true}
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
            background: "rgba(10, 20, 38, 0.94)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            backdropFilter: "blur(8px)",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            color: "#f8fafc",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: "4px" }}>
            MMSI: {hoverInfo.object.mmsi}
          </div>
          <div>Status: <span style={{ textTransform: "uppercase", fontWeight: 600 }}>{hoverInfo.object.status}</span></div>
          <div>Speed: {hoverInfo.object.sog !== null ? `${hoverInfo.object.sog} kn` : "N/A"}</div>
          <div>Heading: {hoverInfo.object.heading !== null ? `${hoverInfo.object.heading}°` : "N/A"}</div>
          <div>Class: {hoverInfo.object.transceiver_class || "A"}</div>
          <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
            Lat: {hoverInfo.object.lat.toFixed(4)}, Lon: {hoverInfo.object.lon.toFixed(4)}
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="map-legend">
        <div style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.05em", color: "#f8fafc" }}>
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
          <div className="legend-swatch geofence" />
          <span>EEZ / Marine Protected Area</span>
        </div>
      </div>
    </div>
  );
}
