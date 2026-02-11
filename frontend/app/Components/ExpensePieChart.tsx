'use client';

import React, { useMemo, useEffect, useState } from "react";
import "../CSS/PieChart.css";

type Entry = {
  id: string;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number; // positive in your entries
  date: Date;
};

export type PieItem = {
  category: string;
  value: number;
  color: string;
};

type Props = {
  selectedDate: Date;
  entries: Entry[];
};

export default function ExpensePieChart({ selectedDate, entries }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ Build expense totals by category for selected month/year
  const data: PieItem[] = useMemo(() => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();

    const totals = new Map<string, number>();

    for (const e of entries) {
      if (e.type !== "expense") continue;
      const d = e.date;
      if (d.getMonth() !== month || d.getFullYear() !== year) continue;

      const cat = e.category || "Other";
      totals.set(cat, (totals.get(cat) ?? 0) + (e.amount ?? 0));
    }

    // Convert to array sorted by biggest first
    const arr = Array.from(totals.entries())
      .map(([category, value]) => ({
        category,
        value,
        color: colorFromCategory(category),
      }))
      .sort((a, b) => b.value - a.value);

    // If no expense data, show a friendly placeholder slice
    if (arr.length === 0) {
      return [{ category: "No Expenses", value: 1, color: "#444" }];
    }

    return arr;
  }, [entries, selectedDate]);

  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  const slices = useMemo(() => {
    let cumulative = 0;
    return data.map(item => {
      const startAngle = (cumulative / total) * 360;
      const sliceAngle = (item.value / total) * 360;
      cumulative += item.value;
      return { ...item, startAngle, sliceAngle };
    });
  }, [data, total]);

  const MIN_RADIUS = 75;
  const MAX_RADIUS = 100;

  const getRadius = (value: number) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const normalized = maxValue === 0 ? 0 : value / maxValue;
    return MIN_RADIUS + normalized * (MAX_RADIUS - MIN_RADIUS);
  };

  const describeArc = (x: number, y: number, r: number, start: number, end: number) => {
    const polarToCartesian = (cx: number, cy: number, radius: number, angle: number) => {
      const rad = (angle - 90) * Math.PI / 180.0;
      return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    };

    const startPoint = polarToCartesian(x, y, r, end);
    const endPoint = polarToCartesian(x, y, r, start);
    const largeArcFlag = end - start <= 180 ? "0" : "1";

    return `
      M ${x} ${y}
      L ${startPoint.x} ${startPoint.y}
      A ${r} ${r} 0 ${largeArcFlag} 0 ${endPoint.x} ${endPoint.y}
      Z
    `;
  };

  if (!mounted) return null;

  return (
    <div className="pie-wrapper">
      <h3>Expense Breakdown</h3>

      <div className="pie-content">
        <svg width="220" height="220" viewBox="0 0 220 220">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {slices.map((slice, i) => (
            <g key={i}>
              <path
                d={describeArc(110, 110, getRadius(slice.value), slice.startAngle, slice.startAngle + slice.sliceAngle)}
                fill="none"
                stroke={slice.color}
                strokeWidth="6"
                opacity="0.25"
                filter="url(#glow)"
              />
              <path
                d={describeArc(110, 110, getRadius(slice.value), slice.startAngle, slice.startAngle + slice.sliceAngle)}
                fill="none"
                stroke={slice.color}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          ))}

          <circle cx="110" cy="110" r="30" fill="#ffffff70" />
          <circle cx="110" cy="110" r="28" fill="#000000" />
        </svg>

        <div className="pie-legend">
          {data.map((item, i) => (
            <div key={i} className="legend-row">
              <span className="color-dot" style={{ background: item.color }} />
              <span>{item.category}</span>
              <span className="percent">
               $ {((item.value) ).toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ✅ Stable color (no hydration mismatch)
function colorFromCategory(category: string) {
  const palette = [
    "#00358a", "#8b0000", "#007a2d", "#976000",
    "#7c3aed", "#0ea5e9", "#db2777", "#10b981",
    "#f97316", "#84cc16", "#14b8a6", "#f43f5e",
  ];

  // simple stable hash
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}
