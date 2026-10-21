import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runAllCycles } from "@/lib/cycle";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || !bearer || Buffer.byteLength(secret) !== Buffer.byteLength(bearer) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(bearer))) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  return NextResponse.json({ results: await runAllCycles() });
}
