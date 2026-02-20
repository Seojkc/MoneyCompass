import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol"); // e.g. XIU.TO

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  // ✅ Fixed: always 1 year daily
  const yahooRange = "1y";
  const interval = "1d";

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${yahooRange}&interval=${interval}&includePrePost=false&events=div%7Csplit`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      next: { revalidate: 3600 }, // cache 1 hour (you can change)
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: "Yahoo request failed", status: r.status, raw: text },
        { status: 502 }
      );
    }

    const json = await r.json();
    const result = json?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ error: "Provider error", raw: json }, { status: 502 });
    }

    const timestamps: number[] = result.timestamp || [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

    const points = timestamps
      .map((ts, i) => {
        const p = closes[i];
        if (p == null || Number.isNaN(p)) return null;
        const d = new Date(ts * 1000);
        const t = d.toISOString().slice(0, 10); // YYYY-MM-DD
        return { t, p: Number(p.toFixed(2)) };
      })
      .filter(Boolean) as { t: string; p: number }[];

    if (points.length < 2) {
      return NextResponse.json(
        { error: "Not enough data points", raw: { symbol, pointsCount: points.length } },
        { status: 502 }
      );
    }

    const last = points.at(-1)!.p;
    const prevClose = points.at(-2)!.p;

    return NextResponse.json({
      symbol,
      range: "1Y",
      points,
      last,
      prevClose,
      asOf: points.at(-1)!.t,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}