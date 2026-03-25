"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarRange, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { getSummary } from "@/lib/bridge";
import type { RangeKey } from "./Analytics";

type SummaryState = {
  avgIncome: number;
  avgExpense: number;
  savingsRate: number;
  monthsUsed: number;
};

type Props = {
  userId: string;
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
};

const monthsMap: Record<RangeKey, 3 | 6 | 12> = {
  "3M": 3,
  "6M": 6,
  "1Y": 12,
};

export default function SummaryCards({
  userId,
  range,
  onRangeChange,
}: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const [summary, setSummary] = useState<SummaryState>({
    avgIncome: 0,
    avgExpense: 0,
    savingsRate: 0,
    monthsUsed: 0,
  });

  useEffect(() => {
    let mounted = true;

    const loadSummary = async () => {
      try {
        setLoading(true);
        setErr(null);

        const months = monthsMap[range];
        const res = await getSummary({ userId, months });

        if (!mounted) return;

        const avgIncome =
          (res as any).avg_income_per_month ??
          (res as any).avgIncome ??
          0;

        const avgExpense =
          (res as any).avg_expense_per_month ??
          (res as any).avgExpense ??
          0;

        const savingsRate =
          (res as any).savings_rate ??
          (res as any).savingsRate ??
          0;

        const monthsUsed =
          (res as any).months_used ??
          (res as any).monthsUsed ??
          months;

        setSummary({
          avgIncome: Number(avgIncome) || 0,
          avgExpense: Number(avgExpense) || 0,
          savingsRate: Number(savingsRate) || 0,
          monthsUsed: Number(monthsUsed) || 0,
        });
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Failed to load summary");
        setSummary({
          avgIncome: 0,
          avgExpense: 0,
          savingsRate: 0,
          monthsUsed: 0,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (userId) loadSummary();

    return () => {
      mounted = false;
    };
  }, [userId, range]);

  const money = (n: number) =>
    n.toLocaleString("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    });

  const pct = (n: number) =>
    `${Number.isFinite(n) ? n.toFixed(1) : "0.0"}%`;

  const subtitle = useMemo(() => {
    if (loading) return "Calculating from your entries…";
    if (err) return "Couldn’t load right now.";
    if (summary.monthsUsed <= 0) return "No data yet — add entries to unlock insights.";
    if (summary.monthsUsed === 1) return "Based on 1 month of data.";
    return `Based on ${summary.monthsUsed} months of data.`;
  }, [loading, err, summary.monthsUsed]);

  return (
    <div className="summary-shell">
      <div className="range-panel">
        <div className="range-panel-top">
          <div className="range-label-wrap">
            <span className="range-icon">
              <CalendarRange size={16} />
            </span>
            <span className="range-label">Range</span>
          </div>
        </div>

        <div className="range-segmented" role="tablist" aria-label="Analytics range">
          {(["3M", "6M", "1Y"] as RangeKey[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onRangeChange(item)}
              className={`range-chip ${range === item ? "active" : ""}`}
            >
              {item === "1Y" ? "1Y" : item}
            </button>
          ))}
        </div>

        <div className="summary-subtitle">{subtitle}</div>

        {err && (
          <div className="summary-error">
            {err}
            <div className="summary-error-tip">
              Tip: check analytics summary API and user filtering.
            </div>
          </div>
        )}
      </div>


      <div className="summary-cards-grid">
        <MetricCard
          title="Avg income"
          value={loading ? "Loading…" : money(summary.avgIncome)}
          
          tone="income"
        />
        <MetricCard
          title="Avg expense"
          value={loading ? "Loading…" : money(summary.avgExpense)}
          
          tone="expense"
        />
        <MetricCard
          title="Savings rate"
          value={loading ? "Loading…" : pct(summary.savingsRate)}
          
          tone="savings"
        />
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "income" | "expense" | "savings";
}) {
  return (
    <div className={`metric-card metric-card--${tone}`}>
      <div className="metric-card-top">
        <div className="metric-card-title">{title}</div>
      </div>
      <div className="metric-card-value">{value}</div>
    </div>
  );
}