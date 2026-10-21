import { z } from "zod";
import { addActivity, db, firstRow, id, listRows, type Company } from "./db";
import { deepseekJson, deepseekProse } from "./llm";
import { readCompanySite, readPublicPage } from "./site";
import { hostedMetrics } from "./hosted";

const strategySchema = z.object({
  diagnosis: z.string(),
  positioning: z.string(),
  icp: z.string(),
  priorities: z.array(z.object({
    title: z.string(), reason: z.string(), expectedSignal: z.string(),
    kind: z.enum(["site", "seo", "geo", "blog", "linkedin"]),
  })).min(2).max(8),
  questions: z.array(z.string()).max(5),
  nextReview: z.string(),
});

export type Strategy = z.infer<typeof strategySchema>;

function normalizeStrategy(input: unknown): Strategy {
  const raw = z.object({
    diagnosis: z.unknown(), positioning: z.unknown(), icp: z.unknown(),
    priorities: z.array(z.record(z.string(), z.unknown())).min(2),
    questions: z.array(z.unknown()).optional(), nextReview: z.unknown().optional(),
  }).parse(input);
  const stringValue = (value: unknown): string => {
    if (typeof value === "string") {
      if (value.trim().startsWith("{")) {
        try { return stringValue(JSON.parse(value)); } catch { /* keep the original text */ }
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(stringValue).join("; ");
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const preferred = record.resumo || record.summary || record.description || record.descricao || record.message || record.perfil;
      if (preferred) return stringValue(preferred);
      return Object.values(record).slice(0, 3).map(stringValue).filter(Boolean).join("; ");
    }
    return String(value ?? "");
  };
  const kindValue = (value: unknown, title: string): Strategy["priorities"][number]["kind"] => {
    const explicit = stringValue(value).toLowerCase().trim();
    if (["site", "seo", "geo", "blog", "linkedin"].includes(explicit)) return explicit as Strategy["priorities"][number]["kind"];
    const text = `${stringValue(value)} ${title}`.toLowerCase();
    if (/linkedin|social|founder|post/.test(text)) return "linkedin";
    if (/blog|artigo|conteúdo/.test(text)) return "blog";
    if (/site|página|landing|conversão/.test(text)) return "site";
    if (/geo|chatgpt|ia generativa|llm/.test(text)) return "geo";
    return "seo";
  };
  const priorities = raw.priorities.filter((item) => !/prospecção ativa|contatos.alvo|abordagem consultiva|lista nominal|cold email|cadência de abordagem|outbound/i.test(`${stringValue(item.title || item.action || item.name)} ${stringValue(item.reason || item.rationale || item.why)}`)).slice(0, 8).map((item) => {
    const title = stringValue(item.title || item.action || item.name);
    return {
      title, reason: stringValue(item.reason || item.rationale || item.why),
      expectedSignal: stringValue(item.expectedSignal || item.signal || item.metric || "Execução concluída e resultado acompanhado"),
      kind: kindValue(item.kind || item.channel || item.type, title),
    };
  });
  if (!priorities.some((item) => item.kind === "linkedin")) {
    if (priorities.length === 8) priorities.pop();
    priorities.push({
    title: "Testar no LinkedIn a principal dúvida do comprador",
    reason: "Publicar uma pergunta concreta sobre o problema que a empresa resolve e usar as respostas para ajustar a mensagem e as próximas pautas.",
    expectedSignal: "Respostas relevantes e conversas iniciadas a partir do post.",
    kind: "linkedin",
    });
  }
  return strategySchema.parse({
    diagnosis: stringValue(raw.diagnosis), positioning: stringValue(raw.positioning), icp: stringValue(raw.icp),
    priorities,
    questions: (raw.questions || []).slice(0, 5).map(stringValue),
    nextReview: stringValue(raw.nextReview || "Em 30 dias"),
  });
}

function companyContext(company: Company) {
  const signals = listRows<{ source: string; metric: string; value: number; period: string; label: string }>(
    "SELECT source,metric,value,period,label FROM signals WHERE company_id=? ORDER BY period DESC LIMIT 20", company.id);
  return `Empresa: ${company.name}\nSite: ${company.website}\nOferta: ${company.offer}\nPúblico: ${company.audience}\nConcorrentes: ${company.competitors}\nVoz/opiniões do founder: ${company.founder_voice}\nObjetivo: ${company.goal}\nSinais medidos (não confunda estimativas com tráfego real): ${JSON.stringify(signals)}`;
}

type CompanyProfile = { name: string; offer: string; audience: string; competitors: string; likelyAlternatives: string; evidence: string[]; unknowns: string[] };

function profileText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(profileText).filter(Boolean).join("; ");
  return "";
}

async function learnFromSite(company: Company, site: Awaited<ReturnType<typeof readCompanySite>>): Promise<Company> {
  if (firstRow("SELECT company_id FROM company_research WHERE company_id=?", company.id)) return company;
  const page = site.home;
  const raw = await deepseekJson([
    { role: "system", content: "Extraia um perfil comercial B2B apenas do texto público fornecido. Retorne JSON com name, offer, audience, competitors (array de marcas ou alternativas explicitamente citadas), likelyAlternatives (até 3 tipos de solução ou processo que o comprador provavelmente compara, apenas como hipóteses), evidence (trechos curtos do site que sustentam o perfil) e unknowns (até 3 perguntas importantes que o site não responde). Se não houver evidência para um campo factual, retorne string vazia ou array vazio. Separe fatos de hipóteses. Não invente ICP confirmado, marcas concorrentes, resultados, objetivo de negócio ou opiniões do founder." },
    { role: "user", content: `Página inicial: ${page.url}\nMeta description: ${page.audit.description}\nPáginas públicas lidas: ${site.text.slice(0, 19000)}\nExtraia o que for verificável. JSON.` },
  ], z.unknown());
  const parsed = z.record(z.string(), z.unknown()).parse(raw);
  const profile: CompanyProfile = {
    name: profileText(parsed.name).slice(0, 120),
    offer: profileText(parsed.offer).slice(0, 2000),
    audience: profileText(parsed.audience).slice(0, 2000),
    competitors: profileText(parsed.competitors).slice(0, 1000),
    likelyAlternatives: profileText(parsed.likelyAlternatives).slice(0, 1000),
    evidence: (Array.isArray(parsed.evidence) ? parsed.evidence : []).slice(0, 5).map(profileText).filter(Boolean),
    unknowns: (Array.isArray(parsed.unknowns) ? parsed.unknowns : []).slice(0, 3).map(profileText).filter(Boolean),
  };
  db().prepare(`INSERT INTO company_research(company_id,source_url,profile_json,checked_at) VALUES(?,?,?,?)`)
    .run(company.id, page.url, JSON.stringify(profile), new Date().toISOString());
  const inferredHost = new URL(company.website.includes("://") ? company.website : `https://${company.website}`).hostname.replace(/^www\./, "");
  const name = company.name === inferredHost && profile.name ? profile.name : company.name;
  const offer = company.offer || profile.offer;
  const audience = company.audience || profile.audience;
  const competitors = company.competitors || profile.competitors;
  db().prepare("UPDATE companies SET name=?,offer=?,audience=?,competitors=? WHERE id=?")
    .run(name, offer, audience, competitors, company.id);
  addActivity(company.id, "research", "Empresa analisada", `Informações extraídas de ${page.url}`);
  return { ...company, name, offer, audience, competitors };
}

export async function buildStrategy(company: Company): Promise<Strategy> {
  let page = "Site não fornecido.";
  let subject = company;
  if (company.website) {
    try {
      const site = await readCompanySite(company.website);
      const result = site.home;
      db().prepare(`INSERT INTO site_audits(company_id,url,title,description,h1_json,canonical,robots,issues_json,checked_at)
        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET
        url=excluded.url,title=excluded.title,description=excluded.description,h1_json=excluded.h1_json,
        canonical=excluded.canonical,robots=excluded.robots,issues_json=excluded.issues_json,checked_at=excluded.checked_at`)
        .run(company.id, result.url, result.title, result.audit.description, JSON.stringify(result.audit.h1),
          result.audit.canonical, result.audit.robots, JSON.stringify(result.audit.issues), new Date().toISOString());
      page = `Título: ${result.title}\nAuditoria verificável: ${JSON.stringify(result.audit)}\nPáginas públicas: ${site.text.slice(0, 12000)}`;
      try { subject = await learnFromSite(company, site); }
      catch (error) { addActivity(company.id, "research", "Perfil automático incompleto", error instanceof Error ? error.message : "Falha ao extrair perfil"); }
    } catch (error) {
      page = `Não foi possível ler o site: ${error instanceof Error ? error.message : "erro desconhecido"}`;
    }
  }
  const rawStrategy = await deepseekJson([
    { role: "system", content: "Você é diretor de marketing inbound B2B. Faça diagnóstico honesto e útil. Comece pelo que foi aprendido e pela primeira decisão; trate lacunas como perguntas objetivas, sem abrir com uma lista longa do que não é possível fazer. Use o site como evidência, não invente cases, métricas ou diferenciais. Priorize oportunidades executáveis em 30 dias. O objetivo comercial deve orientar páginas, busca, conteúdo e distribuição orgânica; não inclua prospecção ativa, lista de contatos, cold email ou cadência outbound. Cada prioridade deve corresponder ao seu kind real: site, seo, geo, blog ou linkedin. SEO/GEO significa conteúdo útil, estrutura e fontes; não prometa posição em buscadores ou assistentes. Retorne um JSON compacto com diagnosis (até 500 caracteres), positioning (até 300), icp (até 300), priorities (3 a 5 itens com title, reason de até 250 caracteres, expectedSignal de até 150 caracteres e kind), questions (até 3 perguntas curtas) e nextReview (até 100 caracteres)." },
    { role: "user", content: `${companyContext(subject)}\n\n${page}\n\nCrie o primeiro plano. Inclua pelo menos uma ação de site/SEO, um artigo de blog e uma ação de LinkedIn. Se um dado de mercado, cliente ou objetivo não foi confirmado, apresente como hipótese ou pergunta. JSON.` },
  ], z.unknown());
  const strategy = normalizeStrategy(rawStrategy);
  const connection = db();
  connection.prepare("UPDATE companies SET strategy_json=?,strategy_updated_at=?,onboarding_complete=1 WHERE id=?")
    .run(JSON.stringify(strategy), new Date().toISOString(), company.id);
  connection.prepare("DELETE FROM work_items WHERE company_id=? AND status='planned' AND source='agent'").run(company.id);
  const insert = connection.prepare("INSERT INTO work_items(id,company_id,kind,title,rationale,description,priority) VALUES(?,?,?,?,?,?,?)");
  strategy.priorities.forEach((item, index) => insert.run(id(), company.id, item.kind, item.title, item.reason, item.expectedSignal, index + 1));
  addActivity(company.id, "strategy", company.onboarding_complete ? "Plano atualizado" : "Plano inicial pronto", strategy.diagnosis);
  return strategy;
}

type WorkItem = { id: string; kind: string; title: string; rationale: string; description: string; status: string };

export async function runNextTask(company: Company) {
  const task = firstRow<WorkItem>(
    "SELECT * FROM work_items WHERE company_id=? AND status IN ('rejected','planned') AND kind IN ('blog','linkedin','site','seo','geo') ORDER BY CASE status WHEN 'rejected' THEN 0 ELSE 1 END,priority,created_at LIMIT 1",
    company.id,
  );
  if (!task) return { message: "Não há tarefa pronta para executar. Vou acompanhar os resultados e revisar o plano." };
  if (task.kind === "seo" || task.kind === "geo") {
    let observedSite = "Site não informado.";
    if (company.website) {
      try {
        const page = await readPublicPage(company.website);
        observedSite = `Título: ${page.title}; achados da página inicial: ${JSON.stringify(page.audit)}; texto visível: ${page.text.slice(0, 7000)}`;
      } catch (error) { observedSite = `Não foi possível ler o site: ${error instanceof Error ? error.message : "erro"}`; }
    }
    const body = await deepseekProse([
      { role: "system", content: "Você é um pesquisador de SEO/GEO B2B. Entregue um relatório curto e acionável em português, com: o que foi observado, o que é hipótese, ação específica, como verificar e quais acessos ou dados faltam. Não afirme que implementou uma mudança. Não invente volume, ranking, citação em IA, concorrentes ou resultados. GEO não garante inclusão em respostas de IA. Use Markdown." },
      { role: "user", content: `${companyContext(company)}\nPlano: ${company.strategy_json}\nTarefa: ${task.title}\nMotivo: ${task.rationale}\n${observedSite}\nExecute a parte de pesquisa e descreva a próxima ação verificável.` },
    ], 2200);
    const contentId = id();
    db().prepare("INSERT INTO content(id,company_id,work_item_id,channel,title,body,status) VALUES(?,?,?,?,?,?,'researched')")
      .run(contentId, company.id, task.id, "research", task.title, body);
    db().prepare("UPDATE work_items SET status='needs_action',updated_at=? WHERE id=?")
      .run(new Date().toISOString(), task.id);
    addActivity(company.id, "research", `Pesquisa pronta: ${task.title}`, "Recomendações disponíveis em Execução.");
    return { message: `Pesquisei “${task.title}”. A recomendação está em Execução; a próxima ação ainda precisa ser realizada.`, contentId };
  }
  const channel = task.kind === "site" ? "page" : task.kind === "blog" ? "blog" : "linkedin";
  const strategy = company.strategy_json;
  const previous = firstRow<{ id: string; body: string; rejection_note: string | null }>(
    "SELECT id,body,rejection_note FROM content WHERE work_item_id=? AND status='rejected' ORDER BY created_at DESC LIMIT 1", task.id);
  const body = await deepseekProse([
    { role: "system", content: `Você escreve para uma empresa B2B. Produza conteúdo original, específico e útil. Nunca invente números, clientes, falas, resultados, comparações com concorrentes ou experiência pessoal. Se faltar evidência própria, não finja que ela existe. Não deixe marcadores como [preencher data], links genéricos ou instruções para o editor no rascunho. Nunca use links provisórios como [Agendar](#), example.com ou URLs inventadas. Se não houver destino real para o CTA, escreva uma chamada em texto simples, sem Markdown de link. Para LinkedIn, escreva em primeira pessoa apenas quando houver opinião real do founder no contexto. Entregue apenas o texto publicável, em português, sem explicação antes ou depois.` },
    { role: "user", content: `${companyContext(company)}\nEstratégia: ${strategy}\nPauta: ${task.title}\nRazão: ${task.rationale}\nCanal: ${channel}\n${previous ? `Versão anterior: ${previous.body.slice(0, 12000)}\nFeedback do founder: ${previous.rejection_note || "Revise o texto"}\nFaça uma nova versão atendendo ao feedback.\n` : ""}\nEscreva um rascunho pronto para revisão. ${channel === "blog" ? "Artigo com subtítulos e conclusão prática, em Markdown, com 700 a 1000 palavras." : channel === "page" ? "Texto de página do site em Markdown, com H1, descrição clara da oferta, prova apenas se fornecida e chamada para ação concreta." : "Post de LinkedIn com gancho, argumento e fechamento, sem hashtags genéricas, com até 250 palavras."}` },
  ], channel === "linkedin" ? 1200 : 5000);
  if (body.length < 100) throw new Error("O rascunho ficou curto demais; a pauta continua na fila para tentar novamente.");
  const contentId = previous?.id || id();
  if (previous) db().prepare("UPDATE content SET body=?,status='awaiting_approval',rejection_note=NULL,updated_at=? WHERE id=?")
    .run(body, new Date().toISOString(), previous.id);
  else db().prepare("INSERT INTO content(id,company_id,work_item_id,channel,title,body,status) VALUES(?,?,?,?,?,?,'awaiting_approval')")
    .run(contentId, company.id, task.id, channel, task.title, body);
  db().prepare("UPDATE work_items SET status='awaiting_approval',updated_at=? WHERE id=?")
    .run(new Date().toISOString(), task.id);
  addActivity(company.id, "draft", `Rascunho para aprovar: ${task.title}`);
  return { message: `Preparei “${task.title}” para sua aprovação.`, contentId };
}

export async function chatWithAgent(company: Company, message: string) {
  db().prepare("INSERT INTO messages(id,company_id,role,content) VALUES(?,?,?,?)").run(id(), company.id, "user", message);
  const history = listRows<{ role: "user" | "assistant"; content: string }>(
    "SELECT role,content FROM messages WHERE company_id=? ORDER BY created_at DESC,id DESC LIMIT 12", company.id,
  ).reverse();
  const pending = listRows<{ title: string; kind: string; status: string }>(
    "SELECT title,kind,status FROM work_items WHERE company_id=? AND status!='done' ORDER BY priority LIMIT 12", company.id,
  );
  const decision = await deepseekJson([
    { role: "system", content: `Você é o agente de inbound da empresa. Responda em português com clareza e concisão. Explique decisões com base no contexto e plano. Você pode adicionar uma pauta quando o founder pedir trabalho novo. Quando ele compartilhar uma opinião, case ou fato da própria empresa, salve na memória. Não invente execução. Retorne JSON: {"reply":"...","action":{"type":"none|add_task|remember_fact|run_next","title":"...","kind":"site|seo|geo|blog|linkedin","reason":"...","fact":"..."}}. Faça no máximo uma ação por mensagem; action.type="none" se for só uma pergunta.\n${companyContext(company)}\nPlano: ${company.strategy_json}\nTrabalho aberto: ${JSON.stringify(pending)}` },
    ...history.map((item) => ({ role: item.role, content: item.content })),
  ], z.object({ reply: z.string(), action: z.object({ type: z.string(), title: z.string().optional(), kind: z.string().optional(), reason: z.string().optional(), fact: z.string().optional() }).optional() }));
  let reply = decision.reply;
  const action = decision.action;
  if (action?.type === "add_task" && action.title?.trim()) {
    const kind = ["site", "seo", "geo", "blog", "linkedin"].includes(action.kind || "") ? action.kind as string : "blog";
    db().prepare("INSERT INTO work_items(id,company_id,kind,title,rationale,description,priority,source) VALUES(?,?,?,?,?,?,?,?)")
      .run(id(), company.id, kind, action.title.slice(0, 200), (action.reason || message).slice(0, 1000), "Pedido na conversa", 1, "founder");
    addActivity(company.id, "task", `Pauta adicionada: ${action.title}`);
    reply += "\n\nAdicionei esta pauta à fila de execução.";
  } else if (action?.type === "remember_fact" && action.fact?.trim()) {
    const fact = action.fact.trim().slice(0, 1000);
    db().prepare("UPDATE companies SET founder_voice=? WHERE id=?")
      .run(`${company.founder_voice}\n${fact}`.trim().slice(-6000), company.id);
    addActivity(company.id, "memory", "Contexto do founder atualizado", fact);
    reply += "\n\nGuardei isso no contexto da empresa.";
  } else if (action?.type === "run_next") {
    const result = await runNextTask(company);
    reply += `\n\n${result.message}`;
  }
  db().prepare("INSERT INTO messages(id,company_id,role,content) VALUES(?,?,?,?)").run(id(), company.id, "assistant", reply);
  return reply;
}

export async function reviewPerformance(company: Company) {
  const signals = listRows<{ source: string; metric: string; value: number; period: string; label: string }>(
    "SELECT source,metric,value,period,label FROM signals WHERE company_id=? ORDER BY created_at DESC LIMIT 40", company.id);
  const completed = listRows<{ kind: string; title: string; status: string }>(
    "SELECT kind,title,status FROM work_items WHERE company_id=? ORDER BY updated_at DESC LIMIT 20", company.id);
  const ownedSite = hostedMetrics(company.id);
  const draft = await deepseekJson([
    { role: "system", content: "Você revisa uma operação de inbound B2B. Não confunda estimativas da Semrush, amostras de respostas de IA, impressões na busca e sessões reais. Sem dados suficientes, diga o que falta. Escolha no máximo uma nova ação baseada nos sinais. JSON: {summary, lesson, decision, nextTask:{title,kind,reason} ou null}." },
    { role: "user", content: `${companyContext(company)}\nPlano atual: ${company.strategy_json}\nSinais: ${JSON.stringify(signals)}\nSite operado pelo agente (visitas, visitantes únicos, contatos recebidos): ${JSON.stringify(ownedSite)}\nTrabalho: ${JSON.stringify(completed)}\nFaça a revisão semanal em português. JSON.` },
  ], z.unknown());
  const raw = z.object({ summary: z.unknown(), lesson: z.unknown(), decision: z.unknown(), nextTask: z.unknown().optional() }).parse(draft);
  const stringify = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value ?? "");
  const review = { summary: stringify(raw.summary), lesson: stringify(raw.lesson), decision: stringify(raw.decision) };
  db().prepare("INSERT INTO reviews(id,company_id,summary,lesson,decision) VALUES(?,?,?,?,?)")
    .run(id(), company.id, review.summary, review.lesson, review.decision);
  const nextTask = z.object({ title: z.string(), kind: z.string(), reason: z.string() }).safeParse(raw.nextTask);
  if (nextTask.success && nextTask.data.title.trim()) {
    const { title, reason } = nextTask.data;
    const kind = ["site", "seo", "geo", "blog", "linkedin"].includes(nextTask.data.kind) ? nextTask.data.kind : "seo";
    const exists = firstRow("SELECT id FROM work_items WHERE company_id=? AND title=? AND status!='done'", company.id, title);
    if (!exists) db().prepare("INSERT INTO work_items(id,company_id,kind,title,rationale,description,priority,source) VALUES(?,?,?,?,?,?,?,?)")
      .run(id(), company.id, kind, title, reason, "Revisão semanal", 2, "review");
  }
  addActivity(company.id, "review", "Revisão semanal pronta", review.decision);
  return review;
}
