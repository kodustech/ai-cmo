import { addActivity, db, id, listRows, type Company } from "./db";
import { saveSignal } from "./google";

function domainOf(website: string) {
  if (!website) throw new Error("Informe o site da empresa primeiro.");
  return new URL(website.includes("://") ? website : `https://${website}`).hostname.replace(/^www\./, "");
}

function csvRow(text: string) {
  const [header, values] = text.trim().split(/\r?\n/);
  if (!header || !values) throw new Error("Semrush não retornou dados para este domínio.");
  const names = header.split(";"); const cells = values.split(";");
  return Object.fromEntries(names.map((name, index) => [name, cells[index] || ""]));
}

export async function syncSemrush(company: Company) {
  const key = process.env.SEMRUSH_API_KEY;
  if (!key) throw new Error("SEMRUSH_API_KEY não está configurada.");
  const domain = domainOf(company.website);
  const params = new URLSearchParams({ type: "domain_ranks", key, domain, database: "us", export_columns: "Db,Dt,Rk,Or,Ot,Oc,Ad,At,Ac" });
  const response = await fetch(`https://api.semrush.com/?${params}`, { signal: AbortSignal.timeout(25_000), cache: "no-store" });
  const data = csvRow(await response.text());
  if (!response.ok) throw new Error(`Semrush respondeu ${response.status}.`);
  const period = new Date().toISOString().slice(0, 7);
  const traffic = Number(data.Ot || data["Organic Traffic"] || 0);
  const keywords = Number(data.Or || data["Organic Keywords"] || 0);
  if (!Number.isFinite(traffic) || !Number.isFinite(keywords)) throw new Error("Semrush retornou métricas inválidas.");
  saveSignal(company.id, "Semrush", "estimated_organic_traffic", traffic, period, "Estimativa de tráfego orgânico");
  saveSignal(company.id, "Semrush", "organic_keywords", keywords, period, "Keywords orgânicas estimadas");
  addActivity(company.id, "metrics", "Cenário competitivo atualizado", `${domain}: ${keywords} keywords estimadas`);
  return { domain, traffic, keywords };
}

type DataForSeoResponse = {
  tasks?: Array<{
    status_code?: number;
    status_message?: string;
    result?: Array<{
      items?: Array<{
        type?: string;
        sections?: Array<{ type?: string; text?: string; annotations?: Array<{ url?: string }> }>;
      }>;
    }>;
  }>;
};

export async function syncChatGptVisibility(company: Company) {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("Configure DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD para acompanhar respostas do ChatGPT.");
  const prompts = listRows<{ id: string; prompt: string }>(
    "SELECT id,prompt FROM ai_prompts WHERE company_id=? AND active=1 ORDER BY created_at LIMIT 10", company.id);
  if (!prompts.length) throw new Error("Cadastre perguntas de compra para acompanhar.");
  const domain = company.website ? domainOf(company.website) : "";
  let mentioned = 0, cited = 0;
  for (const prompt of prompts) {
    const response = await fetch("https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live", {
      method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ user_prompt: prompt.prompt.slice(0, 500), model_name: process.env.DATAFORSEO_CHATGPT_MODEL || "gpt-5.5", web_search: true }]),
      signal: AbortSignal.timeout(120_000), cache: "no-store",
    });
    const payload = await response.json() as DataForSeoResponse;
    const task = payload.tasks?.[0];
    if (!response.ok || task?.status_code !== 20000) throw new Error(`DataForSEO: ${task?.status_message || response.status}`);
    const sections = (task.result?.[0]?.items || []).filter((item) => item.type === "message").flatMap((item) => item.sections || []);
    const answer = sections.filter((section) => section.type === "text").map((section) => section.text || "").join("\n\n");
    const citations = [...new Set(sections.flatMap((section) => (section.annotations || []).map((annotation) => annotation.url || "")).filter(Boolean))];
    const brandTerms = [company.name, domain].filter((term) => term.length >= 3);
    const isMentioned = brandTerms.some((term) => answer.toLowerCase().includes(term.toLowerCase()));
    const isCited = citations.some((url) => {
      try { return Boolean(domain && new URL(url).hostname.replace(/^www\./, "") === domain); }
      catch { return false; }
    });
    mentioned += Number(isMentioned); cited += Number(isCited);
    db().prepare("INSERT INTO ai_runs(id,company_id,prompt_id,answer,mentioned,cited,citations_json) VALUES(?,?,?,?,?,?,?)")
      .run(id(), company.id, prompt.id, answer, Number(isMentioned), Number(isCited), JSON.stringify(citations));
  }
  const period = new Date().toISOString().slice(0, 10);
  saveSignal(company.id, "ChatGPT sample", "mentions", mentioned, period, `Marca citada em ${mentioned} de ${prompts.length} perguntas acompanhadas`);
  saveSignal(company.id, "ChatGPT sample", "citations", cited, period, `Site citado em ${cited} de ${prompts.length} perguntas acompanhadas`);
  addActivity(company.id, "metrics", "Presença no ChatGPT verificada", `${mentioned}/${prompts.length} perguntas com menção`);
  return { prompts: prompts.length, mentioned, cited };
}
