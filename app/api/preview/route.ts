import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readPublicPage } from "@/lib/site";

export const runtime = "nodejs";

const attempts = new Map<string, number[]>();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const now = Date.now();
    const recent = (attempts.get(ip) || []).filter((time) => now - time < 60 * 60_000);
    if (recent.length >= 10) return NextResponse.json({ error: "Muitas análises. Tente novamente mais tarde." }, { status: 429 });
    attempts.set(ip, [...recent, now]);
    const { website } = z.object({ website: z.string().trim().min(4).max(500) }).parse(await request.json());
    const page = await readPublicPage(website);
    return NextResponse.json({ url: page.url, title: page.title, description: page.audit.description, h1: page.audit.h1[0] || "" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui ler esse site." }, { status: 400 });
  }
}
