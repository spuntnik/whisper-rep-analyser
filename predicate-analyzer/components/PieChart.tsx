"use client";

import { useEffect, useRef } from "react";
import {
  ArcElement,
  Chart,
  Legend,
  PieController,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";

Chart.register(ArcElement, PieController, Tooltip, Legend);

interface PieChartProps {
  labels: string[];
  values: number[];
  colors: string[];
}

export function PieChart({ labels, values, colors }: PieChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"pie"> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const data: ChartData<"pie"> = {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: "rgba(255,255,255,0.18)",
          borderWidth: 1,
          hoverOffset: 8,
        },
      ],
    };

    const options: ChartOptions<"pie"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#f8fbff",
            usePointStyle: true,
            pointStyle: "circle",
            padding: 18,
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const label = context.label ?? "";
              const value = typeof context.raw === "number" ? context.raw : 0;
              return `${label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, {
      type: "pie",
      data,
      options,
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [colors, labels, values]);

  return <canvas ref={canvasRef} />;
}
