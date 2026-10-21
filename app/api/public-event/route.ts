import { NextResponse } from "next/server";
import { z } from "zod";
import { db, id } from "@/lib/db";
import { hostedPage, siteBySlug } from "@/lib/hosted";

export const runtime = "nodejs";

const input = z.object({ siteSlug: z.string().max(100), pageSlug: z.string().max(180), visitorId: z.uuid(), referrer: z.string().max(500).default("") });

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { siteSlug, pageSlug, visitorId, referrer } = parsed.data;
  const site = siteBySlug(siteSlug);
  if (!site || (pageSlug && !hostedPage(site.company_id, pageSlug))) return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  const recent = db().prepare("SELECT id FROM site_events WHERE company_id=? AND page_slug=? AND visitor_id=? AND created_at>datetime('now','-1 minute') LIMIT 1")
    .get(site.company_id, pageSlug, visitorId);
  if (recent) return NextResponse.json({ ok: true });
  let source = "";
  if (referrer) {
    try { const url = new URL(referrer); if (url.protocol === "https:" || url.protocol === "http:") source = url.origin; }
    catch { /* Treat malformed referrers as unknown. */ }
  }
  db().prepare("INSERT INTO site_events(id,company_id,page_slug,visitor_id,referrer) VALUES(?,?,?,?,?)")
    .run(id(), site.company_id, pageSlug, visitorId, source);
  return NextResponse.json({ ok: true });
}
