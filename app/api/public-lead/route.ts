import { NextResponse } from "next/server";
import { z } from "zod";
import { addActivity, db, id } from "@/lib/db";
import { hostedPage, siteBySlug } from "@/lib/hosted";

export const runtime = "nodejs";

const input = z.object({ siteSlug: z.string().max(100), pageSlug: z.string().max(180), name: z.string().trim().min(2).max(120), email: z.email().max(254), message: z.string().trim().min(3).max(3000), website: z.string().max(300).optional() });

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { siteSlug, pageSlug, name, email, message, website } = parsed.data;
  const site = siteBySlug(siteSlug);
  if (!site || (pageSlug && !hostedPage(site.company_id, pageSlug))) return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  if (website) return NextResponse.json({ ok: true });
  const recent = db().prepare("SELECT COUNT(*) AS total FROM leads WHERE company_id=? AND email=? AND created_at>datetime('now','-1 hour')").get(site.company_id, email) as { total: number };
  if (recent.total >= 3) return NextResponse.json({ error: "Limite temporário de mensagens." }, { status: 429 });
  db().prepare("INSERT INTO leads(id,company_id,page_slug,name,email,message) VALUES(?,?,?,?,?,?)")
    .run(id(), site.company_id, pageSlug, name, email, message);
  addActivity(site.company_id, "lead", `Novo contato: ${name}`, `Página: ${pageSlug || "início"}`);
  return NextResponse.json({ ok: true });
}
