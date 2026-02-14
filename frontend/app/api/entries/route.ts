import { NextResponse } from "next/server";

const API_URL = process.env.API_URL!; // server-only env var (no NEXT_PUBLIC)

export async function GET() {
  const res = await fetch(`${API_URL}/entries`, { cache: "no-store" });

  const text = await res.text(); // helpful for debugging
  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream API error", status: res.status, body: text },
      { status: 502 }
    );
  }

  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
