import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const upstream = `${API_URL}/user-steps-progress${qs ? `?${qs}` : ""}`;

  const res = await fetch(upstream, { cache: "no-store" });
  const text = await res.text();

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

export async function PUT(req: NextRequest) {
  const body = await req.text();

  const res = await fetch(`${API_URL}/user-steps-progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const text = await res.text();
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