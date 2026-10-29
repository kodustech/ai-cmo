import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { accessibleCompany, currentUser } from "@/lib/auth";
import { db, firstRow, id, listRows } from "@/lib/db";
import { buildStrategy, chatWithAgent, runNextTask } from "@/lib/agent";
import { connectLinkedIn, listLinkedInAccounts } from "@/lib/connections";
import { maybeAutoPublish, publicationMode, publishApproved, setPublicationMode } from "@/lib/publishing";
import { googleProperties, setGoogleProperties, syncGoogleMetrics } from "@/lib/google";
import { syncChatGptVisibility, syncSemrush } from "@/lib/market";
import { readPublicPage } from "@/lib/site";
import { hostedMetrics, hostedSite, siteUrl } from "@/lib/hosted";
import { siteRepository, verifySiteRepository } from "@/lib/git-site";

export const runtime = "nodejs";
export const maxDuration = 120;

const companyInput = z.object({
  name: z.string().trim().min(2).max(120), website: z.string().trim().max(500).default(""),
  offer: z.string().trim().max(2000), audience: z.string().trim().max(2000),
  competitors: z.string().trim().max(1000).default(""),
  founderVoice: z.string().trim().max(3000).default(""),
  goal: z.string().trim().max(1000), country: z.string().trim().min(2).max(10),
});

const onboardingInput = z.object({
  website: z.string().trim().max(500).default(""),
  name: z.string().trim().max(120).default(""),
  summary: z.string().trim().max(1000).default(""),
  country: z.string().trim().min(2).max(10),
});

const profileFactsInput = z.object({
  productCategory: z.string().trim().max(600).default(""),
  productType: z.string().trim().max(300).default(""),
  businessModel: z.string().trim().max(600).default(""),
  pricing: z.string().trim().max(2000).default(""),
  keyFeatures: z.string().trim().max(3000).default(""),
  primaryCta: z.string().trim().max(200).default(""),
  techSignals: z.string().trim().max(1000).default(""),
  icpSegment: z.string().trim().max(500).default(""),
  icpCompanySize: z.string().trim().max(500).default(""),
  icpPersona: z.string().trim().max(500).default(""),
  icpPainPoint: z.string().trim().max(500).default(""),
});

function splitList(value: string, sep: string) {
  return value.split(sep).map((item) => item.trim()).filter(Boolean);
}

function failure(error: unknown) {
  console.error("[workspace]", error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    const operators = (process.env.OPERATOR_EMAILS || "").split(",").map((s) => s.trim().toLowerCase());
    const companies = operators.includes(user.email.toLowerCase())
      ? listRows("SELECT id,name,website,plan_mode,onboarding_complete FROM companies WHERE plan_mode='managed' OR owner_id=? ORDER BY created_at DESC", user.id)
      : listRows("SELECT id,name,website,plan_mode,onboarding_complete FROM companies WHERE owner_id=? ORDER BY created_at DESC", user.id);
    return NextResponse.json({ user, companies });
  }
  const company = await accessibleCompany(companyId);
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  db().prepare("INSERT OR IGNORE INTO site_projects(company_id) VALUES(?)").run(company.id);
  const operator = (process.env.OPERATOR_EMAILS || "").split(",").some((email) => email.trim().toLowerCase() === user.email.toLowerCase());
  return NextResponse.json({
    user, company: { ...company, strategy: JSON.parse(company.strategy_json) },
    operator,
    siteProject: firstRow("SELECT stage,brief,updated_at FROM site_projects WHERE company_id=?", company.id),
    siteRepository: siteRepository(company.id),
    connections: listRows("SELECT id,kind,status,label,checked_at FROM connections WHERE company_id=?", company.id),
    google: googleProperties(company.id),
    work: listRows("SELECT * FROM work_items WHERE company_id=? ORDER BY priority,created_at DESC", company.id),
    content: listRows("SELECT * FROM content WHERE company_id=? ORDER BY created_at DESC", company.id),
    messages: listRows("SELECT * FROM messages WHERE company_id=? ORDER BY created_at,id LIMIT 100", company.id),
    signals: listRows("SELECT * FROM signals WHERE company_id=? ORDER BY period DESC LIMIT 100", company.id),
    aiPrompts: listRows("SELECT id,prompt,active FROM ai_prompts WHERE company_id=? ORDER BY created_at", company.id),
    aiRuns: listRows("SELECT r.id,p.prompt,r.answer,r.mentioned,r.cited,r.citations_json,r.created_at FROM ai_runs r JOIN ai_prompts p ON p.id=r.prompt_id WHERE r.company_id=? ORDER BY r.created_at DESC LIMIT 30", company.id),
    reviews: listRows("SELECT * FROM reviews WHERE company_id=? ORDER BY created_at DESC LIMIT 12", company.id),
    activity: listRows("SELECT * FROM activity WHERE company_id=? ORDER BY created_at DESC LIMIT 30", company.id),
    siteAudit: firstRow("SELECT * FROM site_audits WHERE company_id=?", company.id) || null,
    research: firstRow("SELECT source_url,profile_json,checked_at FROM company_research WHERE company_id=?", company.id) || null,
    profileConfirmed: !!firstRow("SELECT company_id FROM profile_confirmations WHERE company_id=?", company.id),
    hostedSite: (() => { const site = hostedSite(company.id); return site ? { ...site, url: siteUrl(site) } : null; })(),
    hostedMetrics: hostedMetrics(company.id),
    publicationMode: publicationMode(company.id),
    leads: listRows("SELECT id,page_slug,name,email,message,created_at FROM leads WHERE company_id=? ORDER BY created_at DESC LIMIT 30", company.id),
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    const body = await request.json();
    const action = z.string().parse(body.action);
    if (action === "create_company") {
      const input = onboardingInput.parse(body);
      if (!input.website && (input.name.length < 2 || input.summary.length < 10)) {
        throw new Error("Sem site, informe o nome da empresa e uma frase sobre o que ela faz.");
      }
      const page = input.website ? await readPublicPage(input.website) : null;
      const website = page?.url || "";
      const name = input.name || (website ? new URL(website).hostname.replace(/^www\./, "") : "");
      const companyId = id();
      db().prepare(`INSERT INTO companies(id,owner_id,name,website,offer,audience,competitors,founder_voice,goal,country,plan_mode)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(companyId, user.id, name, website, input.summary,
        "", "", "", "", input.country, "agent");
      db().prepare("INSERT INTO publication_settings(company_id,mode) VALUES(?,'automatic')").run(companyId);
      db().prepare("INSERT INTO site_projects(company_id) VALUES(?)").run(companyId);
      return NextResponse.json({ companyId });
    }
    const companyId = z.uuid().parse(body.companyId);
    const company = await accessibleCompany(companyId);
    if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    if (action === "update_site_brief") {
      const brief = z.string().trim().max(3000).parse(body.brief);
      db().prepare("INSERT INTO site_projects(company_id,brief,updated_at) VALUES(?,?,?) ON CONFLICT(company_id) DO UPDATE SET brief=excluded.brief,updated_at=excluded.updated_at")
        .run(company.id, brief, new Date().toISOString());
      return NextResponse.json({ ok: true });
    }
    if (action === "set_site_stage") {
      const operator = (process.env.OPERATOR_EMAILS || "").split(",").some((email) => email.trim().toLowerCase() === user.email.toLowerCase());
      if (!operator) return NextResponse.json({ error: "Somente a equipe pode atualizar a implantação." }, { status: 403 });
      const stage = z.enum(["diagnosis", "building", "review", "operating"]).parse(body.stage);
      const repo = siteRepository(company.id);
      if ((stage === "review" || stage === "operating") && !repo) throw new Error("Conecte o repositório antes de iniciar a revisão.");
      if (stage === "operating" && !repo?.live_url) throw new Error("Informe o domínio publicado antes de iniciar a operação.");
      if (stage === "operating" && firstRow<{ stage: string }>("SELECT stage FROM site_projects WHERE company_id=?", company.id)?.stage !== "review") {
        throw new Error("Conclua a revisão do site antes de iniciar a operação.");
      }
      db().prepare("INSERT INTO site_projects(company_id,stage,updated_at) VALUES(?,?,?) ON CONFLICT(company_id) DO UPDATE SET stage=excluded.stage,updated_at=excluded.updated_at")
        .run(company.id, stage, new Date().toISOString());
      return NextResponse.json({ ok: true });
    }
    if (action === "configure_site_repository") {
      const operator = (process.env.OPERATOR_EMAILS || "").split(",").some((email) => email.trim().toLowerCase() === user.email.toLowerCase());
      if (!operator) return NextResponse.json({ error: "Somente a equipe pode conectar o repositório." }, { status: 403 });
      const input = z.object({
        repository: z.string().trim().min(3).max(200),
        branch: z.string().trim().min(1).max(100),
        contentRoot: z.string().trim().min(1).max(150),
        previewUrl: z.url().startsWith("https://").or(z.literal("")),
        liveUrl: z.url().startsWith("https://").or(z.literal("")),
      }).parse(body);
      await verifySiteRepository(input.repository, input.branch, input.contentRoot);
      const previous = siteRepository(company.id);
      db().prepare(`INSERT INTO site_repositories(company_id,repository,branch,content_root,preview_url,live_url,updated_at)
        VALUES(?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET repository=excluded.repository,branch=excluded.branch,
        content_root=excluded.content_root,preview_url=excluded.preview_url,live_url=excluded.live_url,updated_at=excluded.updated_at`)
        .run(company.id, input.repository, input.branch, input.contentRoot, input.previewUrl, input.liveUrl, new Date().toISOString());
      if (previous && (previous.repository !== input.repository || previous.branch !== input.branch || previous.content_root !== input.contentRoot || previous.live_url !== input.liveUrl)) {
        db().prepare("UPDATE site_projects SET stage='building',updated_at=? WHERE company_id=?").run(new Date().toISOString(), company.id);
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "build_strategy") return NextResponse.json({ strategy: await buildStrategy(company) });
    if (action === "run_next") {
      const result = await runNextTask(company);
      try {
        const publishedUrl = result.contentId ? await maybeAutoPublish(company, result.contentId) : null;
        return NextResponse.json({ ...result, publishedUrl });
      } catch (error) {
        return NextResponse.json({ ...result, warning: `Rascunho salvo, mas a publicação automática falhou: ${error instanceof Error ? error.message : "tente novamente"}` });
      }
    }
    if (action === "chat") {
      const message = z.string().trim().min(1).max(4000).parse(body.message);
      return NextResponse.json({ reply: await chatWithAgent(company, message) });
    }
    if (action === "update_brief") {
      const input = companyInput.parse(body);
      const siteChanged = input.website !== company.website;
      const website = siteChanged && input.website ? (await readPublicPage(input.website)).url : input.website;
      const previousResearch = firstRow<{ profile_json: string; source_url: string }>("SELECT profile_json,source_url FROM company_research WHERE company_id=?", company.id);
      const previousProfile = previousResearch ? JSON.parse(previousResearch.profile_json) as Record<string, string> : {};
      const retainOrReset = (value: string, prior?: string) => siteChanged && prior && value === prior ? "" : value;
      const name = siteChanged && website && previousProfile.name === input.name ? new URL(website).hostname.replace(/^www\./, "") : input.name;
      const offer = retainOrReset(input.offer, previousProfile.offer);
      const audience = retainOrReset(input.audience, previousProfile.audience);
      const competitors = retainOrReset(input.competitors, previousProfile.competitors);
      db().prepare(`UPDATE companies SET name=?,website=?,offer=?,audience=?,competitors=?,founder_voice=?,goal=?,country=? WHERE id=?`)
        .run(name, website, offer, audience, competitors,
          input.founderVoice, input.goal, input.country, company.id);
      if (siteChanged) {
        db().prepare("DELETE FROM company_research WHERE company_id=?").run(company.id);
        db().prepare("DELETE FROM site_audits WHERE company_id=?").run(company.id);
        db().prepare("DELETE FROM profile_confirmations WHERE company_id=?").run(company.id);
      } else {
        if (input.goal.trim()) {
          db().prepare("INSERT INTO profile_confirmations(company_id,confirmed_at) VALUES(?,?) ON CONFLICT(company_id) DO UPDATE SET confirmed_at=excluded.confirmed_at")
            .run(company.id, new Date().toISOString());
        }
        if (body.profile && typeof body.profile === "object") {
          const edit = profileFactsInput.parse(body.profile);
          const nextProfile = {
            ...previousProfile,
            productCategory: splitList(edit.productCategory, ","),
            productType: edit.productType,
            businessModel: splitList(edit.businessModel, ","),
            pricing: edit.pricing,
            keyFeatures: splitList(edit.keyFeatures, ";"),
            primaryCta: edit.primaryCta,
            techSignals: splitList(edit.techSignals, ","),
            icp: { segment: edit.icpSegment, companySize: edit.icpCompanySize, persona: edit.icpPersona, painPoint: edit.icpPainPoint },
          };
          db().prepare(`INSERT INTO company_research(company_id,source_url,profile_json,checked_at) VALUES(?,?,?,?)
            ON CONFLICT(company_id) DO UPDATE SET profile_json=excluded.profile_json`)
            .run(company.id, previousResearch?.source_url ?? "", JSON.stringify(nextProfile), new Date().toISOString());
        }
      }
      const updated = firstRow<typeof company>("SELECT * FROM companies WHERE id=?", company.id)!;
      try { await buildStrategy(updated); return NextResponse.json({ ok: true }); }
      catch (error) {
        return NextResponse.json({ ok: true, warning: `Contexto salvo, mas o plano não foi atualizado: ${error instanceof Error ? error.message : "tente novamente"}` });
      }
    }
    if (action === "confirm_profile") {
      db().prepare("INSERT INTO profile_confirmations(company_id,confirmed_at) VALUES(?,?) ON CONFLICT(company_id) DO UPDATE SET confirmed_at=excluded.confirmed_at")
        .run(company.id, new Date().toISOString());
      return NextResponse.json({ ok: true });
    }
    if (action === "set_publication_mode") {
      const mode = z.enum(["review", "automatic"]).parse(body.mode);
      setPublicationMode(company.id, mode);
      const published: string[] = [];
      const errors: string[] = [];
      if (mode === "automatic") {
        const awaiting = listRows<{ id: string }>("SELECT id FROM content WHERE company_id=? AND status='awaiting_approval' AND channel IN ('page','blog','linkedin') ORDER BY created_at LIMIT 3", company.id);
        for (const item of awaiting) {
          try { const url = await maybeAutoPublish(company, item.id); if (url) published.push(url); }
          catch (error) { errors.push(error instanceof Error ? error.message : "Erro na revisão automática"); }
        }
      }
      return NextResponse.json({ ok: true, published, warning: errors.length ? `Modo salvo, mas algumas peças ficaram pendentes: ${errors.join("; ")}` : undefined });
    }
    if (action === "connect_linkedin") {
      return NextResponse.json(await connectLinkedIn(company, z.coerce.number().int().positive().parse(body.accountId), z.string().min(10).parse(body.apiKey)));
    }
    if (action === "list_linkedin_accounts") {
      return NextResponse.json({ accounts: await listLinkedInAccounts(z.string().min(10).parse(body.apiKey)) });
    }
    if (action === "set_google_properties") {
      setGoogleProperties(company.id, z.string().parse(body.siteUrl), z.string().parse(body.property));
      return NextResponse.json({ ok: true });
    }
    if (action === "sync_google_metrics") return NextResponse.json(await syncGoogleMetrics(company));
    if (action === "sync_semrush") return NextResponse.json(await syncSemrush(company));
    if (action === "add_ai_prompt") {
      const prompt = z.string().trim().min(10).max(500).parse(body.prompt);
      db().prepare("INSERT INTO ai_prompts(id,company_id,prompt) VALUES(?,?,?)").run(id(), company.id, prompt);
      return NextResponse.json({ ok: true });
    }
    if (action === "remove_ai_prompt") {
      db().prepare("DELETE FROM ai_prompts WHERE id=? AND company_id=?").run(z.uuid().parse(body.promptId), company.id);
      return NextResponse.json({ ok: true });
    }
    if (action === "sync_ai_visibility") return NextResponse.json(await syncChatGptVisibility(company));
    if (action === "review_content") {
      const contentId = z.uuid().parse(body.contentId);
      const decision = z.enum(["approved", "rejected"]).parse(body.decision);
      const note = z.string().max(1000).optional().parse(body.note);
      const content = firstRow<{ id: string; work_item_id: string | null; status: string; body: string }>(
        "SELECT id,work_item_id,status,body FROM content WHERE id=? AND company_id=?", contentId, company.id);
      if (!content || content.status !== "awaiting_approval") throw new Error("Conteúdo não está aguardando aprovação.");
      if (decision === "approved" && /\[[^\]]+\]\(\s*(?:#|https?:\/\/(?:www\.)?example\.(?:com|org)[^)]*)\s*\)/i.test(content.body)) {
        throw new Error("O rascunho contém um link provisório. Peça um ajuste com o destino real antes de aprovar.");
      }
      db().prepare("UPDATE content SET status=?,rejection_note=?,updated_at=? WHERE id=?")
        .run(decision, note || null, new Date().toISOString(), contentId);
      if (content.work_item_id) db().prepare("UPDATE work_items SET status=?,updated_at=? WHERE id=?")
        .run(decision, new Date().toISOString(), content.work_item_id);
      return NextResponse.json({ ok: true });
    }
    if (action === "publish_content") {
      const contentId = z.uuid().parse(body.contentId);
      const url = await publishApproved(company, contentId);
      return NextResponse.json({ url });
    }
    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error) { return failure(error); }
}
