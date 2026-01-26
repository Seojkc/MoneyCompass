'use client';

import React, { useMemo } from "react";
import "../CSS/PieChart.css";

export type PieItem = {
  category: string;
  value: number;
  color: string;
};

type Props = {
  selectedDate: Date;
};

export default function ExpensePieChart({ selectedDate }: Props) {


    const MIN_RADIUS = 75;
    const MAX_RADIUS = 100;

    const getRadius = (value: number) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const normalized = value / maxValue;

    return MIN_RADIUS + normalized * (MAX_RADIUS - MIN_RADIUS);
    };



  // 🔹 Random temp data (replace later with API)
  const data: PieItem[] = [
    { category: "Rent", value: 40, color: "#00358a" },
    { category: "Food", value: 25, color: "#8b0000" },
    { category: "Travel", value: 20, color: "#007a2d" },
    { category: "Other", value: 15, color: "#976000" },
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const slices = useMemo(() => {
    let cumulative = 0;

    return data.map(item => {
      const startAngle = (cumulative / total) * 360;
      const sliceAngle = (item.value / total) * 360;
      cumulative += item.value;

      return { ...item, startAngle, sliceAngle };
    });
  }, [data, total]);

  const describeArc = (x: number, y: number, r: number, start: number, end: number) => {
    const polarToCartesian = (cx: number, cy: number, radius: number, angle: number) => {
      const rad = (angle - 90) * Math.PI / 180.0;
      return {
        x: cx + radius * Math.cos(rad),
        y: cy + radius * Math.sin(rad),
      };
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

  const monthYear = selectedDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="pie-wrapper">
      <h3>Expense Breakdown </h3>

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
                {((item.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
