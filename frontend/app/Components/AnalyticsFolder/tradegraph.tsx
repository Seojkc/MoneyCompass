// "use client";

// import React, { useEffect, useMemo, useState } from "react";
// import {
//   Area,
//   AreaChart,
//   CartesianGrid,
//   ReferenceLine,
//   ResponsiveContainer,
//   Tooltip,
//   XAxis,
//   YAxis,
// } from "recharts";

// type RangeKey = "1M" | "3M" | "1Y" | "5Y";
// type RiskKey = "LOW" | "MEDIUM" | "HIGH";

// const RISK_TO_ETF_SYMBOL: Record<RiskKey, string> = {
//   LOW: "XIU.TO",
//   MEDIUM: "XIC.TO",
//   HIGH: "XIT.TO",
// };

// type Point = { t: string; p: number };

// function formatMoney(n: number, currency = "CAD") {
//   return n.toLocaleString("en-CA", {
//     style: "currency",
//     currency,
//     maximumFractionDigits: 2,
//   });
// }
// function formatPct(n: number) {
//   const sign = n >= 0 ? "+" : "";
//   return `${sign}${n.toFixed(2)}%`;
// }
// function formatNum(n: number) {
//   const sign = n >= 0 ? "+" : "";
//   return `${sign}${n.toFixed(2)}`;
// }

// function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
//   if (!active || !payload?.length) return null;
//   const v = payload[0]?.value;
//   if (typeof v !== "number") return null;

//   return (
//     <div className="rounded-md border border-white/10 bg-black/80 px-3 py-2 text-xs text-white">
//       <div className="opacity-80">Price</div>
//       <div className="text-sm font-semibold">{formatMoney(v)}</div>
//     </div>
//   );
// }

// export default function GoogleStyleStockCardWithRiskReal() {
//   const [range, setRange] = useState<RangeKey>("1M");
//   const [risk, setRisk] = useState<RiskKey>("MEDIUM");

//   const symbol = RISK_TO_ETF_SYMBOL[risk];
//   const currency = "CAD";

//   const [points, setPoints] = useState<Point[]>([]);
//   const [last, setLast] = useState<number>(0);
//   const [prevClose, setPrevClose] = useState<number>(0);
//   const [asOf, setAsOf] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     let cancelled = false;
//     async function load() {
//       setLoading(true);
//       try {
//         const r = await fetch(`api/market?symbol=${encodeURIComponent(symbol)}&range=${range}`)
//         const json = await r.json();
//         if (cancelled) return;

//         setPoints(json.points ?? []);
//         setLast(Number(json.last ?? 0));
//         setPrevClose(Number(json.prevClose ?? 0));
//         setAsOf(json.asOf ?? null);
//       } finally {
//         if (!cancelled) setLoading(false);
//       }
//     }
//     load();
//     return () => {
//       cancelled = true;
//     };
//   }, [symbol, range]);

//   const { changeAbs, changePct, isUp } = useMemo(() => {
//     const abs = last - prevClose;
//     const pct = prevClose > 0 ? (abs / prevClose) * 100 : 0;
//     return { changeAbs: abs, changePct: pct, isUp: abs >= 0 };
//   }, [last, prevClose]);

//   const lineColor = isUp ? "#66d19e" : "#ef4444";
//   const chartMargin = { top: 8, right: 12, left: 0, bottom: 0 };

//   return (
//     <div className="w-full max-w-4xl">
//       {/* Risk selector */}
//       <div className="mb-2 flex items-center justify-between">
//         <div className="text-sm font-semibold text-white">Risk</div>
//         <div className="flex items-center gap-2">
//           <PillButton label="Low • XIU" active={risk === "LOW"} onClick={() => setRisk("LOW")} />
//           <PillButton label="Medium • XIC" active={risk === "MEDIUM"} onClick={() => setRisk("MEDIUM")} />
//           <PillButton label="High • XIT" active={risk === "HIGH"} onClick={() => setRisk("HIGH")} />
//         </div>
//       </div>

//       {/* Card */}
//       <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-white">
//         <div className="flex items-start justify-between gap-4">
//           <div>
//             <div className="flex items-baseline gap-2">
//               <div className="text-4xl font-semibold tracking-tight">
//                 {loading ? "—" : last.toFixed(2)}
//               </div>
//               <div className="text-sm opacity-70">{currency}</div>
//             </div>

//             <div className="mt-1 flex items-center gap-2 text-sm">
//               <span style={{ color: lineColor }}>
//                 {loading ? "Loading…" : `${formatNum(changeAbs)} (${formatPct(changePct)})`}
//               </span>
//             </div>

//             <div className="mt-2 text-xs opacity-60">
//               {asOf ? `${asOf} •` : ""} Data delayed / provider terms apply
//             </div>
//           </div>

//           <div className="text-right text-xs opacity-70">
//             <div className="font-medium">{symbol}</div>
//             <div className="opacity-60">{range}</div>
//           </div>
//         </div>

//         <div className="mt-4 flex items-center gap-2">
//           <RangeButton value="1M" current={range} onChange={setRange} />
//           <RangeButton value="3M" current={range} onChange={setRange} />
//           <RangeButton value="1Y" current={range} onChange={setRange} />
//           <RangeButton value="5Y" current={range} onChange={setRange} />
//         </div>

//         <div className="mt-3 h-[260px] w-full">
//           <ResponsiveContainer width="100%" height="100%">
//             <AreaChart data={points} margin={chartMargin}>
//               <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
//               <XAxis dataKey="t" hide />
//               <YAxis
//                 tick={{ fontSize: 11, fill: "rgba(255,255,255,0.65)" }}
//                 axisLine={false}
//                 tickLine={false}
//                 width={42}
//                 domain={["auto", "auto"]}
//               />
//               <Tooltip content={<CustomTooltip />} />

//               {!!prevClose && (
//                 <ReferenceLine
//                   y={prevClose}
//                   stroke="rgba(255,255,255,0.35)"
//                   strokeDasharray="2 6"
//                   ifOverflow="extendDomain"
//                   label={{
//                     value: `Previous close  ${prevClose.toFixed(2)}`,
//                     position: "right",
//                     fill: "rgba(255,255,255,0.65)",
//                     fontSize: 11,
//                   }}
//                 />
//               )}

//               <Area
//                 type="monotone"
//                 dataKey="p"
//                 stroke={lineColor}
//                 strokeWidth={2}
//                 fill={lineColor}
//                 fillOpacity={0.12}
//                 dot={false}
//               />
//             </AreaChart>
//           </ResponsiveContainer>
//         </div>
//       </div>
//     </div>
//   );
// }

// function RangeButton({
//   value,
//   current,
//   onChange,
// }: {
//   value: RangeKey;
//   current: RangeKey;
//   onChange: (v: RangeKey) => void;
// }) {
//   const active = current === value;
//   return (
//     <button
//       onClick={() => onChange(value)}
//       className={[
//         "rounded-md px-3 py-1 text-xs transition-colors",
//         active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
//       ].join(" ")}
//       aria-pressed={active}
//     >
//       {value}
//     </button>
//   );
// }

// function PillButton({
//   label,
//   active,
//   onClick,
// }: {
//   label: string;
//   active: boolean;
//   onClick: () => void;
// }) {
//   return (
//     <button
//       onClick={onClick}
//       className={[
//         "rounded-full px-3 py-1 text-xs border transition-colors",
//         active
//           ? "border-white/40 bg-white/10 text-white"
//           : "border-white/10 text-white/70 hover:border-white/25 hover:text-white",
//       ].join(" ")}
//       aria-pressed={active}
//     >
//       {label}
//     </button>
//   );
// }

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "XIU.TO";
  const range = searchParams.get("range") ?? "1M";

  // simple fake series to confirm chart renders
  const n = range === "1M" ? 22 : range === "3M" ? 66 : range === "1Y" ? 252 : 252 * 5;

  const points = Array.from({ length: n }, (_, i) => ({
    t: `P${i + 1}`,
    p: Number((100 + i * 0.2 + Math.sin(i / 3) * 2).toFixed(2)),
  }));

  const last = points[points.length - 1].p;
  const prevClose = points[Math.max(0, points.length - 2)].p;

  return NextResponse.json({
    symbol,
    range,
    points,
    last,
    prevClose,
    asOf: new Date().toISOString(),
  });
}