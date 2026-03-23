"use client";

import { useEffect, useState } from "react";
import "../CSS/MonthCard.css";

type Props = {
  onChange: (date: Date) => void;
  value?: Date;
};

export default function MonthCard({ onChange, value }: Props) {
  const [date, setDate] = useState<Date>(value ?? new Date());

  useEffect(() => {
    if (value) setDate(value);
  }, [value]);

  const changeMonth = (direction: -1 | 1) => {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + direction);
    setDate(newDate);
    onChange(newDate);
  };

  const month = date.toLocaleString("default", {
    month: "long",
  });

  const year = date.getFullYear();

  return (
    <div className="month-card-shell">
      <button
        type="button"
        className="month-nav-btn"
        onClick={() => changeMonth(-1)}
        aria-label="Previous month"
      >
        <span className="month-nav-icon">‹</span>
      </button>

      <div className="month-card-modern">
        <div className="month-card-content">
          <div className="month-name">{month}</div>
          <div className="month-year">{year}</div>
        </div>
      </div>

      <button
        type="button"
        className="month-nav-btn"
        onClick={() => changeMonth(1)}
        aria-label="Next month"
      >
        <span className="month-nav-icon">›</span>
      </button>
    </div>
  );
}