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

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  if (typeof v !== "number") return null;

  return (
    <div className="trade-tooltip">
      <div className="trade-tooltip-label">Price</div>
      <div className="trade-tooltip-value">{formatMoney(v)}</div>
    </div>
  );
}

type Props = {
  moneySpent: number;
  category: string;
};

export default function GoogleStyleStockCardWithRisk1Y({
  moneySpent,
  category,
}: Props) {
  const [risk, setRisk] = useState<RiskKey>("MEDIUM");

  const symbol = RISK_TO_ETF_SYMBOL[risk];
  const currency = "CAD";

  const [points, setPoints] = useState<Point[]>([]);
  const [last, setLast] = useState<number>(0);
  const [prevClose, setPrevClose] = useState<number>(0);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { yearAbs, yearPct, first } = useMemo(() => {
    const first = points[0]?.p ?? 0;
    const lastP = last;

    const yearAbs = lastP - first;
    const yearPct = first > 0 ? (yearAbs / first) * 100 : 0;

    return { yearAbs, yearPct, first };
  }, [points, last]);

  const investSim = useMemo(() => {
    if (!moneySpent || moneySpent <= 0) return null;
    if (!first || !last) return null;

    const growthFactor = last / first;
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
        const r = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}`);
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
  const lineColor = isUp ? "#4ade80" : "#f87171";
  const chartMargin = { top: 8, right: 12, left: 0, bottom: 0 };

  return (
    <div className="trade-card-shell">
      <div className="trade-card">
        <div className="trade-card-header">
          <div className="trade-card-title-wrap">
            <div className="trade-card-eyebrow">Market Insight</div>
            <div className="trade-card-title">What Your Spending Could Become</div>
            <div className="trade-card-subtitle">
              Spending vs simple 1-year ETF growth view
            </div>
          </div>

          
        </div>

        <div className="trade-risk-row">
          <div className="trade-risk-label">Risk</div>

          <div className="trade-risk-group" role="tablist" aria-label="Risk level">
            <RiskButton
              label="Low"
              active={risk === "LOW"}
              onClick={() => setRisk("LOW")}
            />
            <RiskButton
              label="Medium"
              active={risk === "MEDIUM"}
              onClick={() => setRisk("MEDIUM")}
            />
            <RiskButton
              label="High"
              active={risk === "HIGH"}
              onClick={() => setRisk("HIGH")}
            />
          </div>
        </div>

        <div className="trade-top-stats">
          <div className="trade-price-symbol-row">
            <div className="trade-price-block">
              <div className="trade-price-main">
                {loading ? "—" : last ? last.toFixed(2) : "—"}
              </div>
              <div className="trade-price-currency">{currency}</div>
            </div>

            <div className="trade-inline-symbol">
              <span className="trade-inline-symbol-code">{symbol}</span>
              <span className="trade-inline-symbol-range">1Y</span>
            </div>
          </div>

          <div
            className={`trade-performance trade-performance-below ${isUp ? "up" : "down"}`}
            aria-live="polite"
          >
            {loading
              ? "Loading…"
              : last && first
              ? `${formatNum(yearAbs)} (${formatPct(yearPct)}) past year`
              : "—"}
          </div>
        </div>

        <div className="trade-meta">
          {err ? `Error: ${err}` : asOf ? `${asOf} • Yahoo Finance 1Y daily` : "Yahoo Finance 1Y daily"}
        </div>

        <div className="trade-chart-wrap  trade-chart-wrap--mobile-friendly">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={chartMargin}>
              <defs>
                <linearGradient id="tradeAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="rgba(255,255,255,0.08)"
                vertical={false}
                strokeDasharray="3 4"
              />

              <XAxis dataKey="t" hide />

              <YAxis
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.62)" }}
                axisLine={false}
                tickLine={false}
                width={20}
                domain={["auto", "auto"]}
                tickCount={5}
              />

              <Tooltip content={<CustomTooltip />} />

              {!!prevClose && (
                <ReferenceLine
                  y={prevClose}
                  stroke="rgba(255,255,255,0.28)"
                  strokeDasharray="3 5"
                  ifOverflow="extendDomain"
                />
              )}

              <Area
                type="monotone"
                dataKey="p"
                stroke={lineColor}
                strokeWidth={1}
                fill="url(#tradeAreaFill)"
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: "#ffffff",
                  strokeWidth: 2,
                  fill: lineColor,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="trade-insight-card">
          {investSim ? (
            <>
              <div className="trade-insight-label">What if you invested instead?</div>

              <p className="trade-insight-text">
                <span className="trade-strong">{formatMoney(moneySpent)}</span> spent could be worth{" "}
                <span className="trade-strong">{formatMoney(investSim.valueNow)}</span> today in{" "}
                <span className="trade-strong">{symbol.replace(".TO", "")}</span>.
              </p>

              <div
                className={`trade-insight-result ${
                  investSim.gain >= 0 ? "up" : "down"
                }`}
              >
                {formatNum(investSim.gain)} • {formatPct(investSim.gainPct)}
              </div>
            </>
          ) : (
            <>
              <div className="trade-insight-label">What if you invested instead?</div>
              <p className="trade-insight-text muted">
                Add a spending category and amount to show the comparison insight here.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RiskButton({
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
      type="button"
      onClick={onClick}
      className={`trade-risk-btn ${active ? "active" : ""}`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}