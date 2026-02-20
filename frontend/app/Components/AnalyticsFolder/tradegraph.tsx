"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RiskKey = "LOW" | "MEDIUM" | "HIGH";

const RISK_TO_ETF_SYMBOL: Record<RiskKey, string> = {
  LOW: "XIU.TO",
  MEDIUM: "XIC.TO",
  HIGH: "TEC.TO",
};

type Point = { t: string; p: number };

function formatMoney(n: number, currency = "CAD") {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}
function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
function formatNum(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  if (typeof v !== "number") return null;

  return (
    <div className="rounded-md border border-white/10 bg-black/80 px-3 py-2 text-xs text-white">
      <div className="opacity-80">Price</div>
      <div className="text-sm font-semibold">{formatMoney(v)}</div>
    </div>
  );
}

/** ✅ Parent passes these */
type Props = {
  moneySpent: number; // e.g. 1200
  category: string;   // e.g. "Food"
};

export default function GoogleStyleStockCardWithRisk1Y({ moneySpent, category }: Props) {
  const [risk, setRisk] = useState<RiskKey>("MEDIUM");

  const symbol = RISK_TO_ETF_SYMBOL[risk];
  const currency = "CAD";

  const [points, setPoints] = useState<Point[]>([]);
  const [last, setLast] = useState<number>(0);
  const [prevClose, setPrevClose] = useState<number>(0);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Past-year + daily change
  const { yearAbs, yearPct, dayAbs, dayPct, first } = useMemo(() => {
    const first = points[0]?.p ?? 0;
    const lastP = last;

    const yearAbs = lastP - first;
    const yearPct = first > 0 ? (yearAbs / first) * 100 : 0;

    const dayAbs = lastP - prevClose;
    const dayPct = prevClose > 0 ? (dayAbs / prevClose) * 100 : 0;

    return { yearAbs, yearPct, dayAbs, dayPct, first };
  }, [points, last, prevClose]);

  // ✅ “If you invested” simulation (based on 1Y growth factor)
  const investSim = useMemo(() => {
    if (!moneySpent || moneySpent <= 0) return null;
    if (!first || !last) return null;

    const growthFactor = last / first; // e.g. 1.27 means +27% over the year
    const valueNow = moneySpent * growthFactor;
    const gain = valueNow - moneySpent;
    const gainPct = (growthFactor - 1) * 100;

    return {
      growthFactor,
      valueNow,
      gain,
      gainPct,
    };
  }, [moneySpent, first, last]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const r = await fetch(`api/market?symbol=${encodeURIComponent(symbol)}`);
        if (!r.ok) {
          const text = await r.text();
          throw new Error(`${r.status}: ${text}`);
        }

        const json = await r.json();
        if (cancelled) return;

        setPoints(json.points ?? []);
        setLast(Number(json.last ?? 0));
        setPrevClose(Number(json.prevClose ?? 0));
        setAsOf(json.asOf ?? null);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load market data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const isUp = yearAbs >= 0;
  const lineColor = isUp ? "#66d19e" : "#ef4444";
  const chartMargin = { top: 8, right: 12, left: 0, bottom: 0 };

  return (
    <div className="w-full max-w-4xl">
      {/* Risk selector */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Risk →</div>
        <div className="flex items-center gap-2">
          <PillButton label="Low" active={risk === "LOW"} onClick={() => setRisk("LOW")} />
          <PillButton label="Medium" active={risk === "MEDIUM"} onClick={() => setRisk("MEDIUM")} />
          <PillButton label="High" active={risk === "HIGH"} onClick={() => setRisk("HIGH")} />
        </div>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-semibold tracking-tight">
                {loading ? "—" : last ? last.toFixed(2) : "—"}
              </div>
              <div className="text-sm opacity-70">{currency}</div>
            </div>

            <div className="mt-1 flex items-center gap-2 text-sm">
              <span style={{ color: lineColor }}>
                {loading
                  ? "Loading…"
                  : last && first
                  ? `${formatNum(yearAbs)} (${formatPct(yearPct)}) ↑ past year`
                  : "—"}
              </span>
            </div>

            <div className="mt-2 text-xs opacity-60">
              {err ? `Error: ${err}` : asOf ? `${asOf} •` : ""} 1Y daily (Yahoo Finance)
            </div>
          </div>

          <div className="text-right text-xs opacity-70">
            <div className="font-medium">{symbol}</div>
            <div className="opacity-60">1Y</div>
          </div>
        </div>

        <div className="mt-3 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={chartMargin}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.65)" }}
                axisLine={false}
                tickLine={false}
                width={42}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<CustomTooltip />} />

              {!!prevClose && (
                <ReferenceLine
                  y={prevClose}
                  stroke="rgba(255,255,255,0.35)"
                  strokeDasharray="2 6"
                  ifOverflow="extendDomain"
                  label={{
                    value: `Previous close  ${prevClose.toFixed(2)}`,
                    position: "right",
                    fill: "rgba(255,255,255,0.65)",
                    fontSize: 11,
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey="p"
                stroke={lineColor}
                strokeWidth={2}
                fill={lineColor}
                fillOpacity={0.12}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ✅ New insight text under the chart */}
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
          {investSim ? (
            <p>
                What if that{" "}
                <span className="font-semibold text-white">{formatMoney(moneySpent)}</span>{" "}
                spent on{" "}
                <span className="font-semibold text-white">{category}</span>{" "}
                had quietly been working for you in{" "}
                <span className="font-semibold text-white">{symbol.replace(".TO", "")}</span>?
                Today, it could be worth{" "}
                <span className="font-semibold text-white">{formatMoney(investSim.valueNow)}</span>{" "}
                <span style={{ color: investSim.gain >= 0 ? "#66d19e" : "#ef4444" }}> ({formatNum(investSim.gain)} / {formatPct(investSim.gainPct)}) </span>
                — a reminder that small choices today shape tomorrow.
                </p>
          ) : (
            <p className="text-white/60">
              Enter a category and amount to see the “if you invested instead” insight.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-xs border transition-colors",
        active
          ? "border-white/40 bg-white/10 text-white"
          : "border-white/10 text-white/70 hover:border-white/25 hover:text-white",
      ].join(" ")}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}