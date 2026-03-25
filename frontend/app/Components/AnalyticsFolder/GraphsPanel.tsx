"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { listEntries, UiEntry } from "@/lib/bridge";
import type { RangeKey } from "./Analytics";

type MonthPoint = {
  key: string;
  label: string;
  year: number;
  month: number;
};

type ExpensePoint = { month: string; expense: number };
type CashflowPoint = { month: string; net: number };
type CategoryPoint = { category: string; amount: number };

const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ymKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function addMonths(y: number, m: number, delta: number) {
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return { year: ny, month: nm };
}

function buildWindow(anchorYear: number, anchorMonth: number, months: number): MonthPoint[] {
  const start = addMonths(anchorYear, anchorMonth, -(months - 1));
  const out: MonthPoint[] = [];

  for (let i = 0; i < months; i++) {
    const cur = addMonths(start.year, start.month, i);
    out.push({
      key: ymKey(cur.year, cur.month),
      label: monthShort[cur.month - 1],
      year: cur.year,
      month: cur.month,
    });
  }

  return out;
}

function sumAmount(entries: UiEntry[]) {
  return entries.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
}

const chartPalette = [
  "#4699ff",
  "#22c55e",
  "#a78bfa",
  "#f59e0b",
  "#38bdf8",
  "#fb7185",
  "#34d399",
  "#c084fc",
];

export default function GraphsPanel({
  userId,
  range,
  anchorDate,
  limitPerMonth = 500,
}: {
  userId: string;
  range: RangeKey;
  anchorDate?: Date;
  limitPerMonth?: number;
}) {
  const monthsCount = range === "3M" ? 3 : range === "6M" ? 6 : 12;

  const anchor = useMemo(() => {
    const d = anchorDate ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [anchorDate]);

  const windowMonths = useMemo(
    () => buildWindow(anchor.year, anchor.month, monthsCount),
    [anchor.year, anchor.month, monthsCount]
  );

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [expenseData, setExpenseData] = useState<ExpensePoint[]>([]);
  const [cashflowData, setCashflowData] = useState<CashflowPoint[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryPoint[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadGraphs = async () => {
      try {
        setLoading(true);
        setErr(null);

        const perMonth = await Promise.all(
          windowMonths.map(async (m) => {
            const [inc, exp] = await Promise.all([
              listEntries({
                userId,
                year: m.year,
                month: m.month,
                type: "income",
                limit: limitPerMonth,
              }),
              listEntries({
                userId,
                year: m.year,
                month: m.month,
                type: "expense",
                limit: limitPerMonth,
              }),
            ]);

            return { month: m, income: inc, expense: exp };
          })
        );

        if (!mounted) return;

        const expSeries: ExpensePoint[] = perMonth.map((x) => ({
          month: x.month.label,
          expense: sumAmount(x.expense),
        }));

        const netSeries: CashflowPoint[] = perMonth.map((x) => ({
          month: x.month.label,
          net: sumAmount(x.income) - sumAmount(x.expense),
        }));

        const categoryMap = new Map<string, number>();

        for (const x of perMonth) {
          for (const e of x.expense) {
            const key = e.category || "Other";
            categoryMap.set(key, (categoryMap.get(key) || 0) + (Number(e.amount) || 0));
          }
        }

        const catSeries: CategoryPoint[] = Array.from(categoryMap.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8);

        setExpenseData(expSeries);
        setCashflowData(netSeries);
        setCategoryData(catSeries);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Failed to load graphs");
        setExpenseData([]);
        setCashflowData([]);
        setCategoryData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (userId) loadGraphs();

    return () => {
      mounted = false;
    };
  }, [userId, windowMonths, limitPerMonth]);

  const money = (n: number) =>
    n.toLocaleString("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    });

  return (
    <div className="graphs-shell">
      {err && (
        <div className="graphs-error">
          {err}
          <div className="graphs-error-tip">
            Tip: confirm <code>/entries/by-user</code> works and user-specific data exists.
          </div>
        </div>
      )}

      <div className="graphs-grid">
        <ChartCard title="Expense Trend" subtitle="Track spending across selected months">
          <ResponsiveContainer width="100%" height={255}>
            <LineChart data={expenseData} margin={{ top: 12, right: 12, left: -24, bottom: 6 }}>
              <defs>
                <linearGradient id="expenseStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#cbd5e1" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#cbd5e1" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${Number(v) / 1000}k`}
              />
              <Tooltip content={<ModernTooltip money={money} />} cursor={{ stroke: "rgba(255,255,255,0.18)" }} />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="url(#expenseStroke)"
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 0, fill: "#93c5fd" }}
                activeDot={{ r: 5, fill: "#fff" }}
                opacity={loading ? 0.45 : 1}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Categories" subtitle="Highest expense categories in this range">
          <ResponsiveContainer width="100%" height={255}>
            <BarChart data={categoryData} margin={{ top: 12, right: 12, left: -24, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="category"
                interval={0}
                angle={-28}
                textAnchor="end"
                height={74}
                tick={{ fontSize: 11, fill: "#cbd5e1" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#cbd5e1" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${Number(v) / 1000}k`}
              />
              <Tooltip content={<ModernTooltip money={money} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]} opacity={loading ? 0.45 : 1}>
                {categoryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={chartPalette[index % chartPalette.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cashflow" subtitle="Net income minus expenses by month">
          <ResponsiveContainer width="100%" height={255}>
            <LineChart data={cashflowData} margin={{ top: 12, right: 12, left: -24, bottom: 6 }}>
              <defs>
                <linearGradient id="cashStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#cbd5e1" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#cbd5e1" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${Number(v) / 1000}k`}
              />
              <Tooltip content={<ModernTooltip money={money} />} cursor={{ stroke: "rgba(255,255,255,0.18)" }} />
              <Line
                type="monotone"
                dataKey="net"
                stroke="url(#cashStroke)"
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 0, fill: "#86efac" }}
                activeDot={{ r: 5, fill: "#fff" }}
                opacity={loading ? 0.45 : 1}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div className="chart-card-title">{title}</div>
      </div>
      <div className="chart-card-body">{children}</div>
    </div>
  );
}

function ModernTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  money: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const key = item?.name || item?.dataKey || "Value";
  const value = Number(item?.value || 0);

  return (
    <div
      style={{
        background: "rgba(0, 0, 0, 0.51)",
        borderRadius: 14,
        padding: "5px 10px",
      }}
    >
      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffffde", marginTop: 2 }}>
        {money(value)}
      </div>
    </div>
  );
}