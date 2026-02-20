import { NextResponse } from "next/server";

type RangeKey = "1M" | "3M" | "1Y" | "5Y";

function rangeToOutputSize(range: RangeKey) {
  // Alpha Vantage gives "compact" (~100) or "full"
  return range === "5Y" || range === "1Y" ? "full" : "compact";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol"); // e.g., "XIU.TO"
  const range = (searchParams.get("range") as RangeKey) || "1M";

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  // Daily adjusted gives close + dividends/splits adjustments (good for long ranges)
  const url =
    "https://www.alphavantage.co/query" +
    `?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}` +
    `&outputsize=${rangeToOutputSize(range)}` +
    `&apikey=${apiKey}`;

  const r = await fetch(url, { next: { revalidate: 60 } }); // cache 60s
  const json = await r.json();

  const series = json["Time Series (Daily)"];
  if (!series) {
    return NextResponse.json(
      { error: "Provider error", raw: json },
      { status: 502 }
    );
  }

  // Convert to sorted points (oldest → newest)
  const entries = Object.entries(series)
    .map(([date, v]: any) => ({
      date,
      close: Number(v["4. close"]),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Slice based on range (approx trading days)
  const keep =
    range === "1M" ? 22 : range === "3M" ? 66 : range === "1Y" ? 252 : 252 * 5;

  const sliced = entries.slice(Math.max(0, entries.length - keep));

  const last = sliced.at(-1)?.close ?? 0;
  const prevClose = sliced.at(-2)?.close ?? last; // “previous close” from last two closes

  // Return normalized format for your chart
  return NextResponse.json({
    symbol,
    points: sliced.map((p) => ({ t: p.date, p: p.close })),
    last,
    prevClose,
    asOf: sliced.at(-1)?.date ?? null,
  });
}