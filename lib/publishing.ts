import { addActivity, db, firstRow, type Company } from "./db";
import { publishContent } from "./connections";
import { siteReady } from "./git-site";
import { deepseekJson } from "./llm";
import { z } from "zod";

type Publishable = { id: string; work_item_id: string | null; channel: string; title: string; body: string; status: string };

export function publicationMode(companyId: string): "review" | "automatic" {
  return firstRow<{ mode: "review" | "automatic" }>("SELECT mode FROM publication_settings WHERE company_id=?", companyId)?.mode || "review";
}

export function setPublicationMode(companyId: string, mode: "review" | "automatic") {
  db().prepare("INSERT INTO publication_settings(company_id,mode,updated_at) VALUES(?,?,?) ON CONFLICT(company_id) DO UPDATE SET mode=excluded.mode,updated_at=excluded.updated_at")
    .run(companyId, mode, new Date().toISOString());
  addActivity(companyId, "policy", mode === "automatic" ? "Publicação automática ativada" : "Revisão manual ativada");
}

function hasDestination(company: Company, channel: string) {
  if (channel === "linkedin") return !!firstRow("SELECT id FROM connections WHERE company_id=? AND kind='linkedin' AND status='connected'", company.id);
  if (channel === "blog" || channel === "page") return siteReady(company.id);
  return false;
}

export async function maybeAutoPublish(company: Company, contentId: string) {
  if (publicationMode(company.id) !== "automatic") return null;
  const content = firstRow<Publishable>("SELECT * FROM content WHERE id=? AND company_id=?", contentId, company.id);
  if (!content || content.status !== "awaiting_approval" || !hasDestination(company, content.channel)) return null;
  const words = content.body.trim().split(/\s+/).length;
  const tooShort = content.channel === "blog" ? words < 350 : content.channel === "page" ? words < 70 : words < 30;
  const provisional = /\[[^\]]+\]\(\s*(?:#|https?:\/\/(?:www\.)?example\.(?:com|org)[^)]*)\s*\)|\[(?:inserir|preencher|colocar|link|fonte|dado)[^\]]*\]/i.test(content.body);
  if (tooShort || provisional) {
    addActivity(company.id, "review", `Revisão necessária: ${content.title}`, tooShort ? "Conteúdo curto para publicação automática." : "Conteúdo contém marcador ou link provisório.");
    return null;
  }
  const verdict = await deepseekJson([
    { role: "system", content: "Você é a revisão final de uma publicação B2B automática. Use SOMENTE o contexto fornecido. Bloqueie alegações sobre resultados, clientes, números, cases, experiência pessoal ou comparações que não estejam no contexto da empresa. Bloqueie instruções internas, placeholders, links inventados e texto sem sentido. Não exija fonte para conselhos gerais. Retorne JSON: {\"approved\":boolean,\"reason\":string}. Seja conservador." },
    { role: "user", content: `Empresa: ${company.name}\nOferta: ${company.offer}\nComprador: ${company.audience}\nOpiniões e evidências do founder: ${company.founder_voice}\nCanal: ${content.channel}\nTítulo: ${content.title}\nTexto:\n${content.body.slice(0, 18000)}` },
  ], z.object({ approved: z.boolean(), reason: z.string() }));
  if (!verdict.approved) {
    addActivity(company.id, "review", `Revisão necessária: ${content.title}`, verdict.reason.slice(0, 600));
    return null;
  }
  const claim = db().prepare("UPDATE content SET status='approved',updated_at=? WHERE id=? AND company_id=? AND status='awaiting_approval'")
    .run(new Date().toISOString(), content.id, company.id);
  if (claim.changes !== 1) return null;
  addActivity(company.id, "review", `Revisão automática aprovada: ${content.title}`, verdict.reason.slice(0, 600));
  return publishApproved(company, content.id);
}

export async function publishApproved(company: Company, contentId: string) {
  const claim = db().prepare("UPDATE content SET status='publishing',updated_at=? WHERE id=? AND company_id=? AND status='approved'")
    .run(new Date().toISOString(), contentId, company.id);
  if (claim.changes !== 1) throw new Error("Conteúdo não está aprovado ou já está sendo publicado.");
  const content = firstRow<Publishable>("SELECT * FROM content WHERE id=? AND company_id=?", contentId, company.id)!;
  try {
    const url = await publishContent(company, content);
    const scheduled = content.channel === "linkedin";
    const committed = content.channel === "blog" || content.channel === "page";
    db().prepare("UPDATE content SET status=?,published_url=?,updated_at=? WHERE id=? AND status='publishing'")
      .run(scheduled ? "scheduled" : committed ? "committed" : "published", url, new Date().toISOString(), contentId);
    if (content.work_item_id) db().prepare("UPDATE work_items SET status='done',updated_at=? WHERE id=?")
      .run(new Date().toISOString(), content.work_item_id);
    addActivity(company.id, "publish", `${scheduled ? "Agendado" : committed ? "Enviado ao Git" : "Publicado"}: ${content.title}`, url);
    return url;
  } catch (error) {
    db().prepare("UPDATE content SET status='approved',updated_at=? WHERE id=? AND status='publishing'")
      .run(new Date().toISOString(), contentId);
    throw error;
  }
}
