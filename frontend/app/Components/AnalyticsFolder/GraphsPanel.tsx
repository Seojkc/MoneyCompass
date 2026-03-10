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
} from "recharts";
import { listEntries, UiEntry } from "@/lib/bridge";

export type RangeKey = "3M" | "6M" | "1Y";

type MonthPoint = {
  key: string;   // "2026-02"
  label: string; // "Feb"
  year: number;
  month: number; // 1-12
};

type ExpensePoint = { month: string; expense: number };
type CashflowPoint = { month: string; net: number };
type CategoryPoint = { category: string; amount: number };

const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function ymKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function addMonths(y: number, m: number, delta: number) {
  // m is 1-12
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return { year: ny, month: nm };
}

function buildWindow(anchorYear: number, anchorMonth: number, months: number): MonthPoint[] {
  // inclusive window: (months-1) back to anchor
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

export default function GraphsPanel({
  range,
  anchorDate,
  limitPerMonth = 500,
}: {
  range: RangeKey;
  anchorDate?: Date; // optional; if not provided we use current month on client
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

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Fetch each month (backend supports year/month filtering)
        // This avoids downloading "all time" data.
        const perMonth = await Promise.all(
          windowMonths.map(async (m) => {
            const [inc, exp] = await Promise.all([
              listEntries({ year: m.year, month: m.month, type: "income", limit: limitPerMonth }),
              listEntries({ year: m.year, month: m.month, type: "expense", limit: limitPerMonth }),
            ]);
            return { month: m, income: inc, expense: exp };
          })
        );

        if (!mounted) return;

        // Build expense line + cashflow line
        const expSeries: ExpensePoint[] = perMonth.map((x) => ({
          month: x.month.label,
          expense: sumAmount(x.expense),
        }));

        const netSeries: CashflowPoint[] = perMonth.map((x) => ({
          month: x.month.label,
          net: sumAmount(x.income) - sumAmount(x.expense),
        }));

        // Category breakdown: aggregate expenses across the whole window
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
          .slice(0, 8); // top 8 to keep chart readable

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
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [windowMonths, limitPerMonth]);

  return (
    <div className="mt-6">
      {err && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
          <div className="mt-1 text-xs text-red-200/70">
            Tip: confirm <code>/api/entries</code> works and API_URL is correct.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Chart title="Expense">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={expenseData}
              margin={{ top: 5, right: 10, left: -35, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="expense"
                strokeWidth={1.5}
                dot={false}
                opacity={loading ? 0.4 : 1}
              />
            </LineChart>
          </ResponsiveContainer>
        </Chart>

        <Chart title="Category">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={categoryData} 
              margin={{ top: 5, right: 10, left: -35, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="amount" fill="#0077ffce" opacity={loading ? 0.4 : 1} />
            </BarChart>
          </ResponsiveContainer>
        </Chart>

        <Chart title="Cashflow">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={cashflowData}
              margin={{ top: 5, right: 10, left: -35, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="net"
                strokeWidth={1.5}
                dot={false}
                opacity={loading ? 0.4 : 1}
              />
            </LineChart>
          </ResponsiveContainer>
        </Chart>
      </div>
    </div>
  );
}

function Chart({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-2">
      <div className="text-s font-medium opacity-70 mb-1">{title}</div>
      {children}
    </div>
  );
}