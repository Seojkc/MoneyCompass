"use client";

import { useMemo } from "react";

type RangeKey = "3M" | "6M" | "1Y";

export default function SummaryCards({
  range,
  onRangeChange,
}: {
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
}) {
  const summary = useMemo(() => {
    const data: Record<RangeKey, { income: number; expense: number }> = {
      "3M": { income: 4200, expense: 3100 },
      "6M": { income: 4500, expense: 3300 },
      "1Y": { income: 4800, expense: 3500 },
    };

    const income = data[range].income;
    const expense = data[range].expense;

    const savings = Math.max(income - expense, 0);
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    return { avgIncome: income, avgExpense: expense, savingsRate };
  }, [range]);

  const money = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

  const pct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div className="w-full max-w-md">
      {/* Dropdown (controlled by parent) */}
      <div className="mb-4">
        <label className="block text-sm mb-2">Range</label>
        <select
          value={range}
          onChange={(e) => onRangeChange(e.target.value as RangeKey)}
          className="w-full rounded border px-3 py-2"
        >
          <option value="3M">3 M</option>
          <option value="6M">6 M</option>
          <option value="1Y">1 year</option>
        </select>
      </div>

      <div className="flex flex-col gap-3">
        <Card title="Avg income / month" value={money(summary.avgIncome)} />
        <Card title="Avg expense / month" value={money(summary.avgExpense)} />
        <Card title="Savings rate" value={pct(summary.savingsRate)} />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm opacity-70">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
