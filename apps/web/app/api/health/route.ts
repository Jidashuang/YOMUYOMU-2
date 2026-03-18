import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "web",
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
}
