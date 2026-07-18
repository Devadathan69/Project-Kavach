import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ service: "kavach", status: "ok", timestamp: new Date().toISOString() });
}
