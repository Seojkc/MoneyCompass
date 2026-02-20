"use client";

import { useMemo } from "react";
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

export type RangeKey = "3M" | "6M" | "1Y";

export default function GraphsPanel({ range }: { range: RangeKey }) {
  const months = useMemo(() => {
    if (range === "3M") return ["Jan", "Feb", "Mar"];
    if (range === "6M") return ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  }, [range]);

  const rand = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const expenseData = useMemo(
    () => months.map(m => ({ month: m, expense: rand(2500, 4000) })),
    [months]
  );

  const cashflowData = useMemo(
    () => months.map(m => ({ month: m, net: rand(-500, 1500) })),
    [months]
  );

  const categoryData = useMemo(
    () => [
      { category: "Rent", amount: rand(800, 1200) },
      { category: "Food", amount: rand(300, 600) },
      { category: "Transport", amount: rand(100, 300) },
      { category: "Utilities", amount: rand(150, 350) },
      { category: "Fun", amount: rand(100, 250) },
    ],
    [range]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-30">
      <Chart title="Expense">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={expenseData}  margin={{ top: 5, right: 10, left: -35, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="expense" strokeWidth={1.5} stroke="#3b82f6" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Chart>

      <Chart title="Category">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={categoryData}  margin={{ top: 5, right: 10, left: -35, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="category" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="amount" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </Chart>

      <Chart title="Cashflow">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={cashflowData}  margin={{ top: 5, right: 10, left: -35, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="net" strokeWidth={1.5} stroke="#f59e0b" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Chart>
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
