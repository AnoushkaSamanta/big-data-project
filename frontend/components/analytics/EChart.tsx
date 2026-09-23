"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface EChartProps {
  option: echarts.EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  loading?: boolean;
}

export default function EChart({
  option,
  style = { height: "300px", width: "100%" },
  className = "",
  loading = false,
}: EChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart instance with dark-friendly defaults
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    const chart = chartInstance.current;
    if (loading) {
      chart.showLoading({
        text: "ANALYZING TELEMETRY...",
        color: "#38bdf8",
        textColor: "#94a3b8",
        maskColor: "rgba(7, 8, 11, 0.6)",
      });
    } else {
      chart.hideLoading();
      chart.setOption(option, true);
    }
  }, [option, loading]);

  useEffect(() => {
    if (!chartRef.current || !chartInstance.current) return;

    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return <div ref={chartRef} style={style} className={className} />;
}
