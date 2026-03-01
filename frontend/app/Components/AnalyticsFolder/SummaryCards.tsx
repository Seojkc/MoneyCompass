"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getSummary } from "@/lib/bridge";

type RangeKey = "3M" | "6M" | "1Y";

type SummaryState = {
  avgIncome: number;
  avgExpense: number;
  savingsRate: number;
  monthsUsed: number;
};

const monthsMap: Record<RangeKey, 3 | 6 | 12> = {
  "3M": 3,
  "6M": 6,
  "1Y": 12,
};

export default function SummaryCards({
  range,
  onRangeChange,
}: {
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
}) {
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

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const months = monthsMap[range];

        // If your backend supports optional "anchor" month/year later,
        // you can pass them here.
        const res = await getSummary({ months });

        if (!mounted) return;

        // Supports both shapes:
        // 1) adaptive backend: months_used + avg_income_per_month...
        // 2) older backend: avgIncome/avgExpense/savingsRate
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
          months; // fallback

        setSummary({
          avgIncome: Number(avgIncome) || 0,
          avgExpense: Number(avgExpense) || 0,
          savingsRate: Number(savingsRate) || 0,
          monthsUsed: Number(monthsUsed) || 0,
        });
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Failed to load summary");
        setSummary({ avgIncome: 0, avgExpense: 0, savingsRate: 0, monthsUsed: 0 });
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [range]);

  const money = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  const pct = (n: number) => `${Number.isFinite(n) ? n.toFixed(1) : "0.0"}%`;

  const subtitle = useMemo(() => {
    if (loading) return "Calculating from your entries…";
    if (err) return "Couldn’t load right now.";
    if (summary.monthsUsed <= 0) return "No data yet — add a few entries to unlock insights.";
    if (summary.monthsUsed === 1) return "Based on 1 month of data.";
    return `Based on ${summary.monthsUsed} months of data.`;
  }, [loading, err, summary.monthsUsed]);

  return (
    <div className="w-full max-w-md">
      {/* Dropdown (controlled by parent) */}
      <div className="mb-4">
        <label className="block text-sm mb-2 text-white/80">Range</label>
        <select
          value={range}
          onChange={(e) => onRangeChange(e.target.value as RangeKey)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
        >
          <option value="3M">3 M</option>
          <option value="6M">6 M</option>
          <option value="1Y">1 year</option>
        </select>
      </div>

      {/* Small helper line */}
      <div className="mb-3 text-xs text-white/60">{subtitle}</div>

      {/* Error banner */}
      {err && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
          <div className="mt-1 text-xs text-red-200/70">
            Tip: check <code>/api/analytics/summary</code> is reachable.
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Card
          title="Avg income / month"
          value={loading ? "Loading…" : money(summary.avgIncome)}
        />
        <Card
          title="Avg expense / month"
          value={loading ? "Loading…" : money(summary.avgExpense)}
        />
        <Card
          title="Savings rate"
          value={loading ? "Loading…" : pct(summary.savingsRate)}
        />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="text-sm text-white/60">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}