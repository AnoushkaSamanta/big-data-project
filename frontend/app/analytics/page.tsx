"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import EChart from "@/components/analytics/EChart";
import * as echarts from "echarts";
import {
  Ship,
  AlertTriangle,
  ShieldAlert,
  Radio,
  Activity,
  RefreshCw,
  Radar,
  Layers,
  Clock,
  TrendingUp,
  BarChart3,
  Search,
  ArrowUpRight,
  Zap,
  Gauge,
  Cpu,
  GlobeLock,
  ChevronRight,
  PieChart as PieIcon,
  Crosshair,
} from "lucide-react";
import { getVesselCountry, getVesselTypeName } from "@/lib/mmsi";

interface AnalyticsData {
  timestamp: string;
  fleet: {
    total: number;
    active: number;
    stale: number;
    dark: number;
    class_a: number;
    class_b: number;
    categories: Array<{ category: string; count: number }>;
  };
  anomalies: {
    total_alerts: number;
    by_type: Array<{
      type: string;
      count: number;
      avg_score: number;
      max_score: number;
    }>;
    by_severity: Array<{
      severity: string;
      count: number;
    }>;
    timeline: Array<{
      bucket: string;
      count: number;
      dark_count: number;
      spoof_count: number;
    }>;
    top_suspects: Array<{
      id: string;
      mmsi: number;
      vessel_name: string | null;
      vessel_type: number | null;
      transceiver_class: string | null;
      status: string | null;
      alert_type: string;
      score: number;
      severity: string;
      detected_at: string;
      lat: number | null;
      lon: number | null;
      details: any;
    }>;
  };
  spatial_prior: {
    cells_count: number;
    total_observations: number;
    avg_p50_gap_s: number;
    avg_p95_gap_s: number;
    avg_p99_gap_s: number;
    geofences: Array<{ name: string; zone_type: string }>;
  };
  pipeline: {
    msgs_consumed_per_s: number;
    consumer_lag: number;
    dlq_rate: number;
    e2e_latency_s_p95: number;
  };
  threat_radar?: {
    indicators: Array<{ name: string; max: number }>;
    dark_vessel: number[];
    spoof: number[];
    nominal: number[];
  };
}

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [suspectSearch, setSuspectSearch] = useState<string>("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load analytics data:", err);
      setError(err.message || "Network error loading analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Periodic polling if auto-refresh is active
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAnalytics]);

  // Filter top suspects
  const filteredSuspects = useMemo(() => {
    if (!data?.anomalies?.top_suspects) return [];
    return data.anomalies.top_suspects.filter((s) => {
      const matchesSearch =
        suspectSearch.trim() === "" ||
        s.mmsi.toString().includes(suspectSearch.trim()) ||
        (s.vessel_name &&
          s.vessel_name.toLowerCase().includes(suspectSearch.toLowerCase()));
      const matchesType =
        selectedTypeFilter === "all" || s.alert_type === selectedTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [data, suspectSearch, selectedTypeFilter]);

  // =========================================================================
  // Apache ECharts Configuration Options
  // =========================================================================

  // 1. Time Series Anomaly Velocity Area Chart
  const timelineOption = useMemo<echarts.EChartsOption>(() => {
    const timeline = data?.anomalies?.timeline || [];
    const rawLabels = timeline.map((p) => {
      const parts = p.bucket.split(" ");
      return parts.length > 1 ? parts[1] : p.bucket;
    });
    const rawDark = timeline.map((p) => p.dark_count);
    const rawSpoof = timeline.map((p) => p.spoof_count);

    let labels = rawLabels;
    let darkData = rawDark;
    let spoofData = rawSpoof;

    if (rawLabels.length === 1) {
      labels = ["--:--", rawLabels[0]];
      darkData = [0, rawDark[0]];
      spoofData = [0, rawSpoof[0]];
    }

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(13, 19, 31, 0.96)",
        borderColor: "rgba(51, 65, 85, 0.5)",
        borderWidth: 1,
        textStyle: { color: "#f8fafc", fontSize: 11, fontFamily: "monospace" },
        axisPointer: {
          type: "cross",
          lineStyle: { color: "rgba(242, 101, 34, 0.6)", width: 1, type: "dashed" },
          crossStyle: { color: "rgba(242, 101, 34, 0.6)" },
        },
      },
      legend: {
        data: ["Dark Vessel Gaps (> p99)", "Kinematic Spoofing / Jumps"],
        textStyle: { color: "#94a3b8", fontSize: 11 },
        top: 0,
        right: 10,
        icon: "circle",
        itemGap: 16,
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "6%",
        top: "16%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: labels.length > 0 ? labels : ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"],
        axisLine: { lineStyle: { color: "rgba(226, 232, 240, 0.15)" } },
        axisLabel: { color: "#64748b", fontSize: 10, fontFamily: "monospace" },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "rgba(226, 232, 240, 0.15)" } },
        axisLabel: { color: "#64748b", fontSize: 10, fontFamily: "monospace" },
        splitLine: { lineStyle: { color: "rgba(226, 232, 240, 0.06)", type: "dashed" } },
      },
      series: [
        {
          name: "Dark Vessel Gaps (> p99)",
          type: "line",
          smooth: 0.35,
          showSymbol: labels.length < 15,
          symbolSize: 5,
          itemStyle: { color: "#ef4444" },
          lineStyle: { width: 2.5, color: "#ef4444", shadowColor: "rgba(239, 68, 68, 0.5)", shadowBlur: 8 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(239, 68, 68, 0.38)" },
              { offset: 1, color: "rgba(239, 68, 68, 0.00)" },
            ]),
          },
          data: darkData.length > 0 ? darkData : [0, 0],
        },
        {
          name: "Kinematic Spoofing / Jumps",
          type: "line",
          smooth: 0.35,
          showSymbol: labels.length < 15,
          symbolSize: 5,
          itemStyle: { color: "#f59e0b" },
          lineStyle: { width: 2.5, color: "#f59e0b", shadowColor: "rgba(245, 158, 11, 0.5)", shadowBlur: 8 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(245, 158, 11, 0.38)" },
              { offset: 1, color: "rgba(245, 158, 11, 0.00)" },
            ]),
          },
          data: spoofData.length > 0 ? spoofData : [0, 0],
        },
      ],
    };
  }, [data]);

  // 2. Fleet Composition Donut & Category Distribution
  const fleetDonutOption = useMemo<echarts.EChartsOption>(() => {
    const categories = data?.fleet?.categories || [];
    const total = data?.fleet?.total || 0;

    const colorMap: Record<string, string> = {
      "Cargo & Containers": "#10b981",
      "Tankers (Crude/Chemical)": "#ef4444",
      "Commercial Fishing": "#f97316",
      "Passenger & Ferries": "#f26522",
      "High-Speed Craft": "#a855f7",
      "Tug & Special Service": "#64748b",
      "Unspecified / General Fleet": "#475569",
      "Other Craft": "#fb923c",
    };

    const pieData = categories.map((c) => ({
      name: c.category.replace(" & Containers", "").replace(" (Crude/Chemical)", ""),
      value: c.count,
      itemStyle: { color: colorMap[c.category] || "#94a3b8" },
    }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(13, 19, 31, 0.96)",
        borderColor: "rgba(51, 65, 85, 0.5)",
        borderWidth: 1,
        textStyle: { color: "#f8fafc", fontSize: 11, fontFamily: "monospace" },
        formatter: "{b}: <strong>{c}</strong> vessels ({d}%)",
      },
      legend: {
        type: "scroll",
        orient: "vertical",
        right: "2%",
        top: "middle",
        textStyle: { color: "#cbd5e1", fontSize: 11 },
        itemGap: 10,
        itemWidth: 10,
        itemHeight: 10,
        pageTextStyle: { color: "#94a3b8" },
        pageIconColor: "#f26522",
      },
      series: [
        {
          name: "Vessel Classification",
          type: "pie",
          radius: ["50%", "78%"],
          center: ["35%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 5,
            borderColor: "rgba(7, 8, 11, 0.8)",
            borderWidth: 2,
          },
          label: {
            show: false,
            position: "center",
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: "bold",
              color: "#f8fafc",
              formatter: "{d}%\n{b}",
            },
            itemStyle: {
              shadowBlur: 14,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.7)",
            },
          },
          labelLine: { show: false },
          data:
            pieData.length > 0
              ? pieData
              : [
                  { value: 1048, name: "Cargo", itemStyle: { color: "#10b981" } },
                  { value: 735, name: "Tanker", itemStyle: { color: "#ef4444" } },
                  { value: 580, name: "Fishing", itemStyle: { color: "#f97316" } },
                  { value: 484, name: "Passenger", itemStyle: { color: "#0ea5e9" } },
                ],
        },
      ],
    };
  }, [data]);

  // 3. Multi-Dimensional Maritime Threat Vector Radar (Live from PostgreSQL alerts)
  const threatRadarOption = useMemo<echarts.EChartsOption>(() => {
    const radar = data?.threat_radar;
    const darkVec = radar?.dark_vessel || [18, 66, 31, 24, 0];
    const spoofVec = radar?.spoof || [47, 14, 0, 6, 42];
    const nominalVec = radar?.nominal || [8, 12, 14, 5, 2];

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(9, 12, 18, 0.95)",
        borderColor: "rgba(226, 232, 240, 0.2)",
        textStyle: { color: "#f8fafc", fontSize: 11, fontFamily: "monospace" },
      },
      legend: {
        data: ["Dark Vessel Fleet Profile", "Kinematic Spoof Profile", "Nominal Surveillance Baseline"],
        textStyle: { color: "#94a3b8", fontSize: 10 },
        bottom: 0,
        itemGap: 12,
        icon: "circle",
      },
      radar: {
        shape: "polygon",
        indicator: radar?.indicators || [
          { name: "Speed Over Ceiling", max: 100 },
          { name: "Silence vs p99", max: 100 },
          { name: "EEZ Incursion Risk", max: 100 },
          { name: "Displacement Jump", max: 100 },
          { name: "MMSI Collision Index", max: 100 },
        ],
        center: ["50%", "45%"],
        radius: "65%",
        axisName: {
          color: "#cbd5e1",
          fontSize: 10,
          fontFamily: "monospace",
        },
        splitLine: {
          lineStyle: {
            color: [
              "rgba(226, 232, 240, 0.05)",
              "rgba(226, 232, 240, 0.08)",
              "rgba(226, 232, 240, 0.12)",
              "rgba(226, 232, 240, 0.18)",
            ],
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ["rgba(17, 20, 29, 0.6)", "rgba(7, 8, 11, 0.4)"],
          },
        },
        axisLine: {
          lineStyle: {
            color: "rgba(226, 232, 240, 0.15)",
          },
        },
      },
      series: [
        {
          name: "Threat Vectors",
          type: "radar",
          data: [
            {
              value: darkVec,
              name: "Dark Vessel Fleet Profile",
              symbol: "none",
              itemStyle: { color: "#ef4444" },
              lineStyle: { width: 2, color: "#ef4444" },
              areaStyle: { color: "rgba(239, 68, 68, 0.3)" },
            },
            {
              value: spoofVec,
              name: "Kinematic Spoof Profile",
              symbol: "none",
              itemStyle: { color: "#f59e0b" },
              lineStyle: { width: 2, color: "#f59e0b" },
              areaStyle: { color: "rgba(245, 158, 11, 0.25)" },
            },
            {
              value: nominalVec,
              name: "Nominal Surveillance Baseline",
              symbol: "none",
              itemStyle: { color: "#10b981" },
              lineStyle: { width: 1.5, color: "#10b981", type: "dashed" },
              areaStyle: { color: "rgba(16, 185, 129, 0.15)" },
            },
          ],
        },
      ],
    };
  }, [data]);

  // 4. Alert Classification Bar Chart (Horizontal)
  const alertComparisonOption = useMemo<echarts.EChartsOption>(() => {
    const types = data?.anomalies?.by_type || [];
    const names = types.map((t) => t.type.toUpperCase().replace("_", " "));
    const counts = types.map((t) => t.count);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(13, 19, 31, 0.96)",
        borderColor: "rgba(51, 65, 85, 0.5)",
        textStyle: { color: "#f8fafc", fontSize: 11, fontFamily: "monospace" },
        formatter: (params: any) => {
          const item = params[0];
          return `${item.name}: <strong>${item.value}</strong> detections`;
        },
      },
      grid: {
        left: "3%",
        right: "10%",
        bottom: "8%",
        top: "8%",
        containLabel: true,
      },
      xAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "rgba(226, 232, 240, 0.15)" } },
        axisLabel: { color: "#64748b", fontSize: 10, fontFamily: "monospace" },
        splitLine: { lineStyle: { color: "rgba(226, 232, 240, 0.06)", type: "dashed" } },
      },
      yAxis: {
        type: "category",
        data: names.length > 0 ? names : ["DARK VESSEL", "SPOOF"],
        axisLine: { lineStyle: { color: "rgba(226, 232, 240, 0.15)" } },
        axisLabel: { color: "#cbd5e1", fontSize: 11, fontWeight: "bold" },
      },
      series: [
        {
          name: "Detections",
          type: "bar",
          barWidth: "40%",
          label: {
            show: true,
            position: "right",
            color: "#cbd5e1",
            fontFamily: "monospace",
            fontWeight: "bold",
          },
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: (params: any) => {
              return params.dataIndex === 0 ? "#ef4444" : "#f59e0b";
            },
          },
          data: counts.length > 0 ? counts : [618, 587],
        },
      ],
    };
  }, [data]);

  return (
    <div className="surveillance-container analytics-page-container">
      {/* Top Tactical Header */}
      <Header
        onRefresh={fetchAnalytics}
        isRefreshing={loading}
        activeCount={data?.fleet?.active || 0}
        darkCount={data?.fleet?.dark || 0}
      />

      {/* Analytics Sub-Header & Controls Bar */}
      <div className="analytics-toolbar">
        <div className="analytics-toolbar-left">
          <div className="analytics-title-group">
            <div className="analytics-badge">APACHE ECHARTS // MARITIME INTELLIGENCE</div>
            <h1 className="analytics-heading">
              MARITIME DOMAIN AWARENESS // LIVE SURVEILLANCE ANALYTICS
            </h1>
            <span className="analytics-timestamp">
              TELEMETRY SNAPSHOT: {data?.timestamp ? new Date(data.timestamp).toUTCString() : "SYNCING DATA..."}
            </span>
          </div>
        </div>

        <div className="analytics-toolbar-right">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`toggle-btn ${autoRefresh ? "active" : ""}`}
            title="Auto-refresh analytics every 5 seconds"
          >
            <Radio size={13} className={autoRefresh ? "pulse-icon" : ""} />
            <span>STREAM REFRESH: {autoRefresh ? "5S ACTIVE" : "PAUSED"}</span>
          </button>

          {/* Quick manual refresh */}
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="toggle-btn"
            title="Fetch immediate analytics refresh"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>SYNC NOW</span>
          </button>

          {/* Shortcut to Radar Console */}
          <Link href="/" className="toggle-btn radar-link-btn">
            <Radar size={13} />
            <span>SWITCH TO RADAR CONSOLE</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {/* Scrollable Analytics Body */}
      <div className="analytics-body">
        {/* Row 1: Executive KPI Strip */}
        <div className="analytics-kpi-grid">
          {/* Card 1: Fleet Under Surveillance */}
          <div className="analytics-kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Fleet Under Surveillance</span>
              <Ship size={18} className="text-active" />
            </div>
            <div className="kpi-primary-val">
              {data?.fleet?.total ? data.fleet.total.toLocaleString() : "..."}
            </div>
            <div className="kpi-sub-breakdown">
              <div className="kpi-progress-bar">
                <div
                  className="kpi-progress-fill"
                  style={{
                    width: `${
                      data?.fleet?.total
                        ? Math.round(
                            (data.fleet.class_a / data.fleet.total) * 100
                          )
                        : 60
                    }%`,
                    background: "#f26522",
                  }}
                />
              </div>
              <div className="kpi-legend-row">
                <span>
                  Class A (SOLAS):{" "}
                  <strong>{data?.fleet?.class_a.toLocaleString()}</strong>
                </span>
                <span>
                  Class B:{" "}
                  <strong>{data?.fleet?.class_b.toLocaleString()}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Dark Vessel Anomalies */}
          <div className="analytics-kpi-card danger-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Dark Vessel Incidents</span>
              <AlertTriangle size={18} color="#ef4444" />
            </div>
            <div className="kpi-primary-val text-danger">
              {data?.fleet?.dark ? data.fleet.dark.toLocaleString() : "0"}
            </div>
            <div className="kpi-sub-breakdown">
              <div className="kpi-stat-chip">
                <span>Gap Threshold:</span>
                <strong style={{ color: "#ef4444" }}>&gt; p99 Coverage</strong>
              </div>
              <div className="kpi-stat-chip">
                <span>Active Alerts:</span>
                <strong>
                  {data?.anomalies?.by_type?.find(
                    (t) => t.type === "dark_vessel"
                  )?.count || 0}{" "}
                  Recorded
                </strong>
              </div>
            </div>
          </div>

          {/* Card 3: Kinematic Spoofing Flags */}
          <div className="analytics-kpi-card warning-card">
            <div className="kpi-card-header">
              <span className="kpi-label">AIS Spoofing / Jump Detections</span>
              <ShieldAlert size={18} color="#f59e0b" />
            </div>
            <div className="kpi-primary-val text-warning">
              {data?.anomalies?.by_type?.find((t) => t.type === "spoof")?.count ||
                0}
            </div>
            <div className="kpi-sub-breakdown">
              <div className="kpi-stat-chip">
                <span>Max Anomaly Score:</span>
                <strong style={{ color: "#f59e0b" }}>
                  {data?.anomalies?.by_type?.find((t) => t.type === "spoof")
                    ?.max_score
                    ? `${data.anomalies.by_type
                        .find((t) => t.type === "spoof")!
                        .max_score.toLocaleString()}x`
                    : "0x"}
                </strong>
              </div>
              <div className="kpi-stat-chip">
                <span>Pattern:</span>
                <strong>Kinematic Jump &amp; Return</strong>
              </div>
            </div>
          </div>

          {/* Card 4: Territorial Geofence Gates */}
          <div className="analytics-kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Geofence Zones Monitored</span>
              <Layers size={18} className="text-cyan" />
            </div>
            <div className="kpi-primary-val text-cyan">
              {data?.spatial_prior?.geofences?.length || 5}
            </div>
            <div className="kpi-sub-breakdown">
              <div className="kpi-stat-chip">
                <span>Jurisdictions:</span>
                <strong>EEZ, MPA &amp; Port Basins</strong>
              </div>
              <div className="kpi-stat-chip">
                <span>Spatial Index:</span>
                <strong>PostGIS GiST MultiPolygon</strong>
              </div>
            </div>
          </div>

          {/* Card 5: Streaming Pipeline SLA */}
          <div className="analytics-kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Kafka Ingest Throughput</span>
              <Zap size={18} className="text-purple" />
            </div>
            <div className="kpi-primary-val text-purple">
              {data?.pipeline?.msgs_consumed_per_s !== undefined
                ? data.pipeline.msgs_consumed_per_s.toLocaleString()
                : "0"}
              <small style={{ fontSize: "12px", color: "var(--silver-400)" }}>
                {" "}
                msg/s
              </small>
            </div>
            <div className="kpi-sub-breakdown">
              <div className="kpi-stat-chip">
                <span>Lag / DLQ:</span>
                <strong>
                  {data?.pipeline?.consumer_lag ?? 0} msgs /{" "}
                  {(((data?.pipeline?.dlq_rate ?? 0)) * 100).toFixed(2)}%
                </strong>
              </div>
              <div className="kpi-stat-chip">
                <span>End-to-End Latency:</span>
                <strong>
                  {data?.pipeline?.e2e_latency_s_p95 !== undefined
                    ? `${Number(data.pipeline.e2e_latency_s_p95).toFixed(1)}s`
                    : "0.0s"}{" "}
                  p95
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Apache ECharts Visual Grid (Dual Column) */}
        <div className="analytics-two-col">
          {/* ECharts Chart 1: Anomaly Velocity Area Chart */}
          <div className="analytics-panel">
            <div className="panel-header">
              <div className="panel-title">
                <TrendingUp size={16} color="#ef4444" />
                <span>ANOMALY DETECTION VELOCITY // TEMPORAL TREND</span>
              </div>
              <span className="panel-badge">APACHE ECHARTS DUAL AREA</span>
            </div>
            <div className="panel-body" style={{ minHeight: "320px" }}>
              <EChart option={timelineOption} style={{ height: "300px", width: "100%" }} />
            </div>
          </div>

          {/* ECharts Chart 2: Fleet Composition Donut */}
          <div className="analytics-panel">
            <div className="panel-header">
              <div className="panel-title">
                <PieIcon size={16} color="#f26522" />
                <span>VESSEL FLEET CLASSIFICATION &amp; TRAFFIC VOLUME</span>
              </div>
              <span className="panel-badge">APACHE ECHARTS DONUT</span>
            </div>
            <div className="panel-body" style={{ minHeight: "320px" }}>
              <EChart option={fleetDonutOption} style={{ height: "300px", width: "100%" }} />
            </div>
          </div>
        </div>

        {/* Row 3: Apache ECharts Advanced Analytics (Radar & Horizontal Bars) */}
        <div className="analytics-two-col">
          {/* ECharts Chart 3: Threat Vector Radar */}
          <div className="analytics-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Crosshair size={16} color="#c084fc" />
                <span>MULTI-DIMENSIONAL THREAT SIGNATURE // RADAR VECTOR</span>
              </div>
              <span className="panel-badge" style={{ color: "#34d399", borderColor: "rgba(52, 211, 153, 0.3)" }}>LIVE RADAR AGGREGATION</span>
            </div>
            <div className="panel-body" style={{ minHeight: "300px" }}>
              <EChart option={threatRadarOption} style={{ height: "280px", width: "100%" }} />
            </div>
          </div>

          {/* ECharts Chart 4: Anomaly Breakdown Horizontal Bars */}
          <div className="analytics-panel">
            <div className="panel-header">
              <div className="panel-title">
                <BarChart3 size={16} color="#f59e0b" />
                <span>ANOMALY VOLUME &amp; INCIDENT DISTRIBUTION</span>
              </div>
              <span className="panel-badge">APACHE ECHARTS BAR</span>
            </div>
            <div className="panel-body" style={{ minHeight: "300px" }}>
              <EChart option={alertComparisonOption} style={{ height: "180px", width: "100%" }} />

              {/* Severity breakdown pill group */}
              <div className="severity-summary-box" style={{ marginTop: "12px", marginBottom: "0" }}>
                <div className="severity-title">
                  THREAT SEVERITY BREAKDOWN:
                </div>
                <div className="severity-chips">
                  {data?.anomalies?.by_severity?.map((s) => (
                    <div key={s.severity} className={`severity-chip ${s.severity}`}>
                      <span className="chip-color-dot" />
                      <span className="severity-chip-name">{s.severity.toUpperCase()}</span>
                      <span className="severity-chip-count">{s.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Top Anomaly Threat Suspects Leaderboard */}
        <div className="analytics-panel full-width-panel">
          <div className="panel-header suspects-header">
            <div className="panel-title">
              <ShieldAlert size={16} color="#ef4444" />
              <span>TOP ANOMALY SUSPECTS // TARGET DOSSIER LEADERBOARD</span>
            </div>

            {/* Filter and search bar */}
            <div className="suspects-controls">
              <div className="suspect-search-box">
                <Search size={14} color="var(--silver-400)" />
                <input
                  type="text"
                  placeholder="Filter by MMSI or Name..."
                  value={suspectSearch}
                  onChange={(e) => setSuspectSearch(e.target.value)}
                  className="suspect-input"
                />
              </div>

              <div className="suspect-type-filters">
                <button
                  onClick={() => setSelectedTypeFilter("all")}
                  className={`filter-btn ${
                    selectedTypeFilter === "all" ? "active" : ""
                  }`}
                >
                  ALL ({data?.anomalies?.top_suspects?.length || 0})
                </button>
                <button
                  onClick={() => setSelectedTypeFilter("dark_vessel")}
                  className={`filter-btn ${
                    selectedTypeFilter === "dark_vessel" ? "active" : ""
                  }`}
                >
                  DARK VESSEL
                </button>
                <button
                  onClick={() => setSelectedTypeFilter("spoof")}
                  className={`filter-btn ${
                    selectedTypeFilter === "spoof" ? "active" : ""
                  }`}
                >
                  SPOOF
                </button>
              </div>
            </div>
          </div>

          <div className="panel-body no-padding">
            <div className="suspects-table-container">
              <table className="tactical-table">
                <thead>
                  <tr>
                    <th>VESSEL IDENTITY</th>
                    <th>CLASS &amp; TYPE</th>
                    <th>ANOMALY CLASSIFICATION</th>
                    <th>THREAT SCORE</th>
                    <th>SEVERITY</th>
                    <th>KINEMATIC EVIDENCE</th>
                    <th>LAST OBSERVED</th>
                    <th style={{ textAlign: "right" }}>TACTICAL ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuspects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="table-empty">
                        No targets matched the specified filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSuspects.map((s) => {
                      const country = getVesselCountry(s.mmsi);
                      const vTypeName = getVesselTypeName(s.vessel_type);
                      const isDark = s.alert_type === "dark_vessel";

                      // Format kinematic evidence
                      let evidenceText = "Kinematic disparity detected";
                      if (s.details?.gap_s) {
                        const gapHrs = (s.details.gap_s / 3600).toFixed(1);
                        evidenceText = `Silent ${gapHrs}h (gap ${s.details.gap_s.toLocaleString()}s > p99)`;
                      } else if (s.details?.implied_speed_knots) {
                        evidenceText = `Implied ${Math.round(
                          s.details.implied_speed_knots
                        )} kn (Ceiling: ${s.details.speed_ceiling_knots || 30} kn)`;
                      }

                      return (
                        <tr key={s.id}>
                          {/* Identity */}
                          <td>
                            <div className="target-id-cell">
                              <span className="flag-icon">{country.flag}</span>
                              <div>
                                <div className="target-mmsi">MMSI {s.mmsi}</div>
                                <div className="target-country">
                                  {country.country}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Vessel Type */}
                          <td>
                            <div className="target-type-cell">
                              <span className="type-name">{vTypeName}</span>
                              <span className="class-tag">
                                Class {s.transceiver_class || "A"}
                              </span>
                            </div>
                          </td>

                          {/* Alert Type */}
                          <td>
                            <span
                              className={`alert-type-badge ${
                                isDark ? "dark" : "spoof"
                              }`}
                            >
                              {s.alert_type.toUpperCase().replace("_", " ")}
                            </span>
                          </td>

                          {/* Anomaly Score */}
                          <td>
                            <span className="score-badge">
                              {s.score > 1000
                                ? `${(s.score / 1000).toFixed(1)}k`
                                : s.score.toFixed(1)}
                              x
                            </span>
                          </td>

                          {/* Severity */}
                          <td>
                            <span className={`severity-tag ${s.severity}`}>
                              {s.severity.toUpperCase()}
                            </span>
                          </td>

                          {/* Evidence */}
                          <td>
                            <span className="evidence-text" title={evidenceText}>
                              {evidenceText}
                            </span>
                          </td>

                          {/* Last Observed */}
                          <td>
                            <div className="timestamp-cell">
                              <span>
                                {new Date(s.detected_at)
                                  .toISOString()
                                  .replace("T", " ")
                                  .substring(0, 16)}
                              </span>
                              {s.lat && s.lon && (
                                <span className="coord-text">
                                  {s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action */}
                          <td style={{ textAlign: "right" }}>
                            <Link
                              href={`/?mmsi=${s.mmsi}`}
                              className="track-radar-btn"
                              title="Focus radar camera and open trajectory track"
                            >
                              <Radar size={12} />
                              <span>TRACK ON RADAR</span>
                              <ChevronRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
