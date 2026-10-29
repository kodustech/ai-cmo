"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { COUNTRIES, countryLabel } from "@/lib/countries";

type User = { id: string; email: string };
type CompanySummary = { id: string; name: string; website: string; plan_mode: string; onboarding_complete: number };
type Company = CompanySummary & {
  offer: string; audience: string; competitors: string; founder_voice: string; goal: string; country: string;
  strategy: { diagnosis?: string; positioning?: string; icp?: string; priorities?: Array<{ title: string; reason: string; expectedSignal: string; kind: string }>; questions?: string[]; nextReview?: string };
};
type Work = { id: string; kind: string; title: string; rationale: string; description: string; status: string; priority: number };
type Content = { id: string; channel: string; title: string; body: string; status: string; published_url: string | null; rejection_note: string | null };
type Connection = { kind: string; status: string; label: string };
type Signal = { id: string; source: string; metric: string; value: number; period: string; label: string };
type AiPrompt = { id: string; prompt: string; active: number };
type AiRun = { id: string; prompt: string; answer: string; mentioned: number; cited: number; citations_json: string; created_at: string };
type Review = { id: string; summary: string; lesson: string; decision: string; created_at: string };
type Message = { id: string; role: string; content: string };
type Activity = { id: string; kind: string; title: string; detail: string; created_at: string };
type GoogleProperties = { sites: Array<{ siteUrl: string }>; properties: Array<{ name: string; displayName: string }>; siteUrl?: string; property?: string };
type SiteAudit = { url: string; title: string; description: string; h1_json: string; canonical: string; robots: string; issues_json: string; checked_at: string };
type Research = { source_url: string; profile_json: string; checked_at: string };
type Workspace = { user: User; company: Company; operator: boolean; siteProject: { stage: "diagnosis" | "building" | "review" | "operating"; brief: string; updated_at: string }; siteRepository: { repository: string; branch: string; content_root: string; preview_url: string; live_url: string } | null; connections: Connection[]; google: GoogleProperties | null; work: Work[]; content: Content[]; signals: Signal[]; aiPrompts: AiPrompt[]; aiRuns: AiRun[]; reviews: Review[]; messages: Message[]; activity: Activity[]; siteAudit: SiteAudit | null; research: Research | null; profileConfirmed: boolean; hostedSite: { slug: string; url: string } | null; publicationMode: "review" | "automatic"; hostedMetrics: { visits: number; visitors: number; leads: number; sources: Array<{ name: string; visits: number }>; pages: Array<{ name: string; visits: number }> }; leads: Array<{ id: string; name: string; email: string; message: string; page_slug: string; created_at: string }> };
type Section = "overview" | "site" | "plan" | "work" | "insights" | "connections" | "brief";

const labels: Record<Section, string> = {
  overview: "Hoje", site: "Seu site", plan: "Plano", work: "Entregas", insights: "Resultados", connections: "Canais e dados", brief: "Sua empresa",
};
const kindLabels: Record<string, string> = { site: "Site", page: "Página", seo: "SEO", geo: "GEO", blog: "Blog", linkedin: "LinkedIn", research: "Pesquisa" };
const statusLabels: Record<string, string> = {
  planned: "Planejado", awaiting_approval: "Aguardando você", approved: "Aprovado", rejected: "Revisar", publishing: "Publicando", scheduled: "Agendado", published: "Publicado", committed: "Enviado ao Git", researched: "Pesquisa pronta", needs_action: "Ação pendente", done: "Concluído",
};

async function api(path: string, body?: Record<string, unknown>) {
  const response = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a ação.");
  return data;
}

function Mark() { return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>; }

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [quickMessage, setQuickMessage] = useState("");
  const [startingSite, setStartingSite] = useState("");
  const [startingNoSite, setStartingNoSite] = useState(false);

  const refresh = useCallback(async (id?: string | null) => {
    const selected = id === undefined ? companyId : id;
    const data = await api(`/api/workspace${selected ? `?companyId=${encodeURIComponent(selected)}` : ""}`);
    if (selected) setWorkspace(data);
    else { setCompanies(data.companies); setUser(data.user); }
  }, [companyId]);

  useEffect(() => {
    api("/api/auth").then(async ({ user: current }) => {
      setUser(current);
      if (current) {
        const list = await api("/api/workspace");
        setCompanies(list.companies);
        const saved = new URLSearchParams(window.location.search).get("companyId") || sessionStorage.getItem("ai-cmo-company");
        const first = list.companies.find((item: CompanySummary) => item.id === saved) || list.companies[0];
        if (first) {
          setCompanyId(first.id);
          setWorkspace(await api(`/api/workspace?companyId=${first.id}`));
        }
      }
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!companyId) return;
    const timer = window.setInterval(() => { refresh(companyId).catch(() => {}); }, 60_000);
    return () => window.clearInterval(timer);
  }, [companyId, refresh]);

  async function act(name: string, body: Record<string, unknown>, after?: () => void) {
    setBusy(name); setError("");
    try {
      const result = await api("/api/workspace", { ...body, action: name, companyId });
      await refresh(companyId);
      if (result.warning) setError(result.warning);
      after?.();
      return result;
    } catch (err) { setError(err instanceof Error ? err.message : "Erro inesperado."); }
    finally { setBusy(""); }
  }

  async function selectCompany(id: string) {
    setCompanyId(id); sessionStorage.setItem("ai-cmo-company", id);
    setWorkspace(await api(`/api/workspace?companyId=${id}`)); setSection("overview");
  }

  async function logout() {
    await api("/api/auth", { action: "logout" });
    sessionStorage.removeItem("ai-cmo-company");
    setUser(null); setWorkspace(null); setCompanies([]); setCompanyId(null); setStartingSite(""); setStartingNoSite(false);
  }

  if (loading) return <main className="loading-screen"><Mark /><p>Preparando sua operação…</p></main>;
  if (!user) return <AuthScreen onSuccess={async (next, website, noSite) => {
    setStartingSite(website);
    setStartingNoSite(noSite);
    setUser(next);
    const list = await api("/api/workspace");
    setCompanies(list.companies);
    if (list.companies[0]) await selectCompany(list.companies[0].id);
  }} error={error} setError={setError} />;
  if (!workspace) return <Onboarding initialWebsite={startingSite} initialNoSite={startingNoSite} onLogout={logout} onCreated={async (id) => { await refresh(null); await selectCompany(id); setSection("brief"); }} error={error} setError={setError} />;

  const { company, work, content, connections, signals, activity } = workspace;
  const pending = content.filter((item) => item.status === "awaiting_approval");
  const openWork = work.filter((item) => item.status !== "done");
  const nextTask = openWork.find((item) => item.status === "rejected") || openWork.find((item) => item.status === "planned");
  const shipped = content.filter((item) => item.status === "published" || item.status === "scheduled" || item.status === "committed").length;
  const lastCycle = activity.find((item) => item.kind === "cycle");
  const recentCycle = !!lastCycle && Date.now() - new Date(lastCycle.created_at.replace(" ", "T") + "Z").getTime() < 8 * 60 * 60 * 1000;
  const lastDelivery = content.find((item) => item.status === "published" || item.status === "scheduled" || item.status === "committed");
  const latestReview = workspace.reviews[0];
  const connected = (kind: string) => connections.some((item) => item.kind === kind && item.status === "connected");
  const nextStep: { title: string; description: string; button: string; section: Section | "chat" } = workspace.research && !workspace.profileConfirmed
    ? { title: "Confira o que entendi sobre sua empresa.", description: "Separei fatos do site e pontos que ainda precisam da sua visão.", button: "Conferir leitura →", section: "brief" as Section }
    : pending.length
        ? { title: "Tem conteúdo pronto para você revisar.", description: workspace.publicationMode === "automatic" ? "O agente não conseguiu liberar esta peça sozinho. Confira o que falta." : "O agente aguarda sua aprovação antes de publicar.", button: "Revisar conteúdo →", section: "work" as Section }
        : !company.audience
          ? { title: "Vamos afinar quem você quer alcançar.", description: "Confirme o comprador no contexto da empresa para orientar as próximas pautas.", button: "Completar comprador →", section: "brief" as Section }
        : workspace.siteProject.stage !== "operating"
          ? { title: "Seu site está em implantação.", description: "A equipe prepara seu site. Você também pode conectar o LinkedIn para publicar posts.", button: "Acompanhar site →", section: "site" as Section }
          : { title: "Nenhuma decisão pendente.", description: "O agente segue com as próximas pautas e mostra aqui o que precisar de você.", button: "Ver entregas →", section: "work" as Section };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><Mark /><span>cmo<span className="brand-period">.</span></span></div>
      <div className="workspace-switcher">
        <span className="eyebrow">ESPAÇO DE TRABALHO</span>
        <select value={company.id} onChange={(event) => selectCompany(event.target.value)} aria-label="Escolher empresa">
          {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <nav className="nav-list" aria-label="Navegação principal">
        {(Object.entries(labels) as Array<[Section, string]>).map(([key, label]) =>
          <button key={key} className={`nav-item ${section === key ? "active" : ""}`} onClick={() => setSection(key)}>
            <span className="nav-symbol">{({ overview: "◉", site: "▣", plan: "▤", work: "▦", insights: "◔", connections: "⌁", brief: "◇" } as Record<Section, string>)[key]}</span>
            {label}{key === "work" && pending.length > 0 && <span className="nav-count">{pending.length}</span>}
          </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="agent-presence"><span className={`pulse-dot ${recentCycle ? "" : "inactive"}`} /><div><strong>Agente de inbound</strong><small>{lastCycle ? `Último ciclo: ${new Date(lastCycle.created_at.replace(" ", "T") + "Z").toLocaleDateString("pt-BR")}` : company.onboarding_complete ? "Ciclo automático ainda não registrado" : "Preparando o primeiro plano"}</small></div></div>
        <button className="text-button" onClick={() => { setWorkspace(null); setCompanyId(null); }}>+ Adicionar empresa</button>
        <button className="text-button muted" onClick={logout}>Sair de {user.email}</button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><span>{labels[section]}</span><div><span className="topbar-date">{new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(new Date())}</span><button className="topbar-chat" onClick={() => setChatOpen(true)}>Conversar com o agente <span>↗</span></button></div></header>
      {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>Fechar</button></div>}

      {section === "overview" && <HomeWorkspace
        company={company} workspace={workspace} openWork={openWork} pending={pending}
        nextTask={nextTask} nextStep={nextStep} shipped={shipped} lastCycle={lastCycle}
        lastDelivery={lastDelivery} latestReview={latestReview} busy={busy}
        setSection={setSection} setChatOpen={setChatOpen} act={act}
      />}

      {section === "site" && <SiteWorkspace company={company} workspace={workspace} busy={busy} act={act} setChatOpen={setChatOpen} />}

      {section === "plan" && <div className="page-content narrow"><PageHeading eyebrow="PLANO DE EXECUÇÃO" title="O que vamos fazer e por quê." description="As prioridades seguem o objetivo do negócio. O agente prepara as entregas e ajusta o plano conforme aprende." /><section className="plan-goal"><span className="eyebrow">OBJETIVO DO NEGÓCIO</span><strong>{company.goal || "Defina seu objetivo em Sua empresa."}</strong></section>{company.strategy.diagnosis ? <><div className="plan-summary"><span className="eyebrow">DIAGNÓSTICO</span><p>{company.strategy.diagnosis}</p><div className="plan-duo"><div><span>POSICIONAMENTO</span><strong>{company.strategy.positioning}</strong></div><div><span>COMPRADOR</span><strong>{company.strategy.icp}</strong></div></div></div><div className="section-title-row"><h2>Prioridades</h2><button className="secondary-button" disabled={!!busy} onClick={() => act("build_strategy", {})}>{busy === "build_strategy" ? "Revisando…" : "Revisar plano ↻"}</button></div><div className="priority-list">{company.strategy.priorities?.map((item, index) => <div className="priority-card" key={`${item.title}-${index}`}><span className="priority-index">0{index + 1}</span><div><span className="kind-chip">{kindLabels[item.kind] || item.kind}</span><h3>{item.title}</h3><p>{item.reason}</p><small>SINAL ACOMPANHADO · {item.expectedSignal}</small></div></div>)}</div>{!!company.strategy.questions?.length && <div className="question-block"><span className="eyebrow">O QUE AINDA PRECISO SABER</span>{company.strategy.questions.map((question) => <p key={question}>↗ {question}</p>)}<button className="link-button" onClick={() => setChatOpen(true)}>Responder ao agente →</button></div>}</> : <div className="blank-state"><h2>Vamos desenhar a primeira estratégia.</h2><p>Usarei seu site e o briefing para escolher ações concretas.</p><button className="primary-button" disabled={!!busy} onClick={() => act("build_strategy", {})}>{busy ? "Analisando…" : "Criar plano →"}</button></div>}</div>}

      {section === "work" && <WorkWorkspace work={work} content={content} busy={busy} ready={!!company.onboarding_complete} onAct={act} publicationMode={workspace.publicationMode} connected={(kind) => kind === "site" ? workspace.siteProject.stage === "operating" && !!workspace.siteRepository : connected(kind)} />}

      {section === "insights" && <div className="page-content"><PageHeading eyebrow="RESULTADOS" title="Estamos chegando perto do objetivo?" description="O agente cruza entregas e sinais medidos para decidir o próximo passo." /><section className="outcome-banner"><span className="eyebrow">OBJETIVO DO NEGÓCIO</span><h2>{company.goal || "Defina um resultado comercial em Sua empresa."}</h2><p>{signals.length ? "Veja abaixo os sinais disponíveis. Visitas e buscas ainda não comprovam conversas comerciais; conte ao agente quais viraram oportunidades." : workspace.hostedMetrics.visits ? "Já medimos visitas no seu site. Acompanhe abaixo as origens e os contatos recebidos." : "Ainda não há dados para afirmar impacto. Primeiro vamos estabelecer uma linha de base."}</p></section><details className="insight-intro"><summary>De onde vêm os números?</summary><p>Search Console mostra aparições na busca. Analytics mostra visitas e ações no site. Semrush traz estimativas de mercado. As perguntas feitas ao ChatGPT são uma amostra; visitas vindas dele são medidas separadamente.</p></details>{workspace.reviews[0] && <div className="review-strip"><span className="eyebrow">O QUE O AGENTE CONCLUIU</span><strong>{workspace.reviews[0].summary}</strong><p>{workspace.reviews[0].lesson}</p><p><b>Próxima ação:</b> {workspace.reviews[0].decision}</p></div>}{(connected("google") || !!company.website || workspace.aiPrompts.length > 0) && <div className="insight-actions"><button className="secondary-button" disabled={!!busy || !connected("google")} onClick={() => act("sync_google_metrics", {})}>Atualizar tráfego ↻</button><button className="secondary-button" disabled={!!busy || !company.website} onClick={() => act("sync_semrush", {})}>Atualizar Semrush ↻</button><button className="secondary-button" disabled={!!busy || workspace.aiPrompts.length === 0} onClick={() => act("sync_ai_visibility", {})}>Verificar ChatGPT ↻</button></div>}{workspace.hostedSite && <section className="hosted-results"><span className="eyebrow">AMBIENTE PROVISÓRIO</span><div className="metric-grid"><div className="metric-card"><span>Visitas</span><strong>{workspace.hostedMetrics.visits}</strong><p>{workspace.hostedMetrics.visitors} visitantes únicos</p></div><div className="metric-card"><span>Contatos</span><strong>{workspace.hostedMetrics.leads}</strong><p>Mensagens recebidas pelo formulário</p></div></div>{workspace.hostedMetrics.sources.length > 0 && <div className="hosted-breakdown"><div><h2>De onde vieram</h2>{workspace.hostedMetrics.sources.map((item) => <p key={item.name}><span>{item.name}</span><strong>{item.visits}</strong></p>)}</div><div><h2>Páginas visitadas</h2>{workspace.hostedMetrics.pages.map((item) => <p key={item.name}><span>{item.name}</span><strong>{item.visits}</strong></p>)}</div></div>}{workspace.leads.length > 0 && <div className="lead-list"><h2>Contatos recebidos</h2>{workspace.leads.map((lead) => <article key={lead.id}><strong>{lead.name}</strong><a href={`mailto:${lead.email}`}>{lead.email}</a><p>{lead.message}</p><small>{new Date(lead.created_at.replace(" ", "T") + "Z").toLocaleString("pt-BR")}</small></article>)}</div>}</section>}<div className="metric-grid">{signals.map((signal) => <div className="metric-card" key={signal.id}><span>{signal.source} · {signal.period}</span><strong>{signal.value.toLocaleString("pt-BR")}</strong><p>{signal.label || signal.metric}</p></div>)}</div>{signals.length === 0 && workspace.hostedMetrics.visits === 0 && <div className="empty-box"><h2>Ainda não conseguimos medir o progresso.</h2><p>A medição começa depois que o site do cliente estiver publicado e as fontes conectadas. Para acompanhar conversas e propostas, precisamos também da origem desses contatos.</p><button className="secondary-button" onClick={() => setSection("connections")}>Configurar fontes →</button></div>}{workspace.siteAudit && <details className="audit-details"><summary>Ver auditoria inicial do site</summary><SiteAuditCard audit={workspace.siteAudit} /></details>}<AiVisibilityPanel prompts={workspace.aiPrompts} runs={workspace.aiRuns} busy={busy} onAct={act} /></div>}

      {section === "connections" && <div className="page-content narrow"><PageHeading eyebrow="DISTRIBUIÇÃO E MEDIÇÃO" title="Canais e fontes de dados." description="Conecte o LinkedIn e as fontes que ajudam o agente a medir o resultado." /><ConnectionPanel company={company} connections={connections} publicationMode={workspace.publicationMode} google={workspace.google} busy={busy} onAct={act} /></div>}

      {section === "brief" && <div className="page-content narrow"><PageHeading eyebrow="MEMÓRIA DO AGENTE" title="O que sei sobre vocês." description="Confira minha leitura e me diga qual resultado importa primeiro. O restante eu aprendo na execução." /><BriefForm key={company.id} company={company} research={workspace.research} confirmed={workspace.profileConfirmed} busy={busy} onSave={(input, profile) => act("update_brief", { ...input, profile }, () => setSection("plan"))} onConfirm={() => setSection("plan")} /></div>}
    </main>
    <button className="floating-chat" onClick={() => setChatOpen(true)} aria-label="Conversar com o agente"><span className="pulse-dot" /> Falar com o agente <span>↗</span></button>
    {chatOpen && <ChatDrawer company={company} messages={workspace.messages} busy={busy} onClose={() => setChatOpen(false)} onSend={(message) => act("chat", { message })} />}
  </div>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><span className="eyebrow accent">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}
function HomeWorkspace({ company, workspace, openWork, pending, nextTask, nextStep, shipped, lastCycle, lastDelivery, latestReview, busy, setSection, setChatOpen, act }: {
  company: Company; workspace: Workspace; openWork: Work[]; pending: Content[]; nextTask: Work | undefined;
  nextStep: { title: string; description: string; button: string; section: Section | "chat" };
  shipped: number; lastCycle: Activity | undefined; lastDelivery: Content | undefined; latestReview: Review | undefined;
  busy: string; setSection: (section: Section) => void; setChatOpen: (open: boolean) => void;
  act: (name: string, body: Record<string, unknown>, after?: () => void) => Promise<unknown>;
}) {
  const goal = company.goal.trim();
  const planned = openWork.filter((item) => item.status === "planned" || item.status === "rejected").slice(0, 3);
  const needsYou = !!pending.length || (!!workspace.research && !workspace.profileConfirmed) || !company.audience;
  const cycleTime = lastCycle ? new Date(lastCycle.created_at.replace(" ", "T") + "Z").toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;
  const cycleRecent = !!lastCycle && Date.now() - new Date(lastCycle.created_at.replace(" ", "T") + "Z").getTime() < 8 * 60 * 60 * 1000;
  const nextCheck = lastCycle ? new Date(new Date(lastCycle.created_at.replace(" ", "T") + "Z").getTime() + 6 * 60 * 60 * 1000).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;
  return <div className="page-content operation-home">
    <div className="operation-header"><div><span className="eyebrow accent">OPERAÇÃO DE INBOUND · {company.name.toUpperCase()}</span><h1>Seu objetivo, em movimento.</h1><p>O agente planeja, prepara as entregas e volta quando precisa de uma decisão sua.</p></div><button className="secondary-button" onClick={() => setChatOpen(true)}>Dar uma direção ao agente ↗</button></div>

    <section className="mission-panel" aria-label="Objetivo da operação"><div><span className="eyebrow">OBJETIVO DO NEGÓCIO</span><h2>{goal || "Defina o resultado comercial que o marketing precisa ajudar a alcançar."}</h2><p>{goal ? `Comprador: ${(company.audience || "a definir").replace(/[.!?]+$/, "")}.` : "O agente usa esse objetivo para escolher e revisar as prioridades."}</p></div><button className="mission-edit" onClick={() => setSection("brief")}>{goal ? "Ajustar objetivo ↗" : "Definir objetivo ↗"}</button></section>

    <div className="operation-grid">
      <section className="operation-main-card"><div className="operation-section-head"><div><span className="eyebrow">O AGENTE VAI FAZER</span><h2>Próximas ações</h2></div><button className="link-button" onClick={() => setSection("plan")}>Ver plano completo ↗</button></div>
        {planned.length ? <div className="operation-task-list">{planned.map((item, index) => <article className="operation-task" key={item.id}><span className="task-sequence">{String(index + 1).padStart(2, "0")}</span><div><div className="operation-task-meta"><span className="kind-chip">{kindLabels[item.kind] || item.kind}</span><span>{item.status === "rejected" ? "Revisão solicitada" : "Na fila"}</span></div><h3>{item.title}</h3><p>{item.rationale}</p></div></article>)}</div> : <p className="operation-empty">{openWork.length ? "As próximas ações estão em revisão ou aguardam sua aprovação." : "O plano está em preparação. As primeiras ações aparecerão aqui."}</p>}
        <div className="operation-cycle"><span className={`cycle-indicator ${cycleRecent ? "" : "inactive"}`} /><div><strong>{cycleTime ? `Último ciclo: ${cycleTime}` : "A operação automática ainda não foi iniciada"}</strong><p>{cycleTime ? cycleRecent ? `Próxima checagem prevista: ${nextCheck}. O agente busca novas pautas, aprovações e sinais.` : "O último ciclo passou do intervalo esperado. Confira o agendamento da operação." : "É preciso ativar o agendamento da operação. Enquanto isso, você pode antecipar a primeira entrega abaixo."}</p></div></div>
        {nextTask && <button className="secondary-button operation-advance" disabled={!!busy} onClick={() => act("run_next", {}, () => setSection("work"))}>{busy === "run_next" ? "Preparando entrega…" : "Antecipar próxima entrega ↗"}</button>}
      </section>
      <section className={`operation-decision ${needsYou ? "has-decision" : ""}`}><div className="operation-section-head"><div><span className="eyebrow">SUA PARTICIPAÇÃO</span><h2>{needsYou ? "Precisa de você" : "Tudo encaminhado"}</h2></div>{pending.length > 0 && <span className="decision-count">{pending.length}</span>}</div><h3>{nextStep.title}</h3><p>{nextStep.description}</p><button className={needsYou ? "primary-button" : "secondary-button"} onClick={() => nextStep.section === "chat" ? setChatOpen(true) : setSection(nextStep.section)}>{nextStep.button}</button><small>{workspace.publicationMode === "automatic" ? "Modo automático ativo: o agente revisa e envia ao site em operação ou aos canais conectados. Peças bloqueadas ficam aqui." : "Publicações exigem sua aprovação. O agente prepara os rascunhos e registra o que fez."}</small></section>
    </div>

    <div className="operation-lower-grid"><section className="operation-report"><div className="operation-section-head"><div><span className="eyebrow">O QUE JÁ SAIU</span><h2>Entregas e aprendizado</h2></div><button className="link-button" onClick={() => setSection("work")}>Ver entregas ↗</button></div>{lastDelivery ? <div className="report-feature"><span className="kind-chip">{lastDelivery.channel === "linkedin" ? "LinkedIn" : lastDelivery.channel}</span><h3>{lastDelivery.title}</h3><p>{lastDelivery.status === "scheduled" ? "Agendado" : lastDelivery.status === "committed" ? "Enviado ao Git" : "Publicado"} · {shipped} {shipped === 1 ? "entrega registrada" : "entregas registradas"}</p>{lastDelivery.published_url && <a href={lastDelivery.published_url} target="_blank" rel="noopener noreferrer">Abrir entrega ↗</a>}</div> : <div className="report-feature"><h3>A primeira entrega ainda está a caminho.</h3><p>Os rascunhos e as publicações aparecem em Entregas para você acompanhar.</p></div>}{latestReview && <div className="report-review"><strong>O que aprendemos</strong><p>{latestReview.lesson}</p><small>Próximo ajuste: {latestReview.decision}</small></div>}</section>
      <section className="operation-results"><div className="operation-section-head"><div><span className="eyebrow">RESULTADO COMERCIAL</span><h2>O que estamos medindo</h2></div></div><p className="result-goal">{goal || "Defina seu objetivo para orientar a leitura dos resultados."}</p><div className="result-facts"><div><strong>{shipped}</strong><span>entregas enviadas ou agendadas</span></div><div><strong>{workspace.signals.length}</strong><span>sinais de resultado coletados</span></div></div><p className="result-note">{workspace.siteProject.stage === "operating" ? "O site está em operação. Conecte Search Console e Analytics para acompanhar o tráfego." : "O site está em implantação. Os resultados aparecem depois que as fontes de dados estiverem conectadas."}</p><button className="link-button" onClick={() => setSection("insights")}>Ver resultados e fontes ↗</button></section></div>
  </div>;
}
function Stat({ label, value, detail, highlight }: { label: string; value: string; detail: string; highlight?: boolean }) {
  return <div className={`stat-card ${highlight ? "highlight" : ""}`}><span className="eyebrow">{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function SiteAuditCard({ audit }: { audit: SiteAudit }) {
  const issues = JSON.parse(audit.issues_json) as string[];
  return <section className="panel site-audit"><div className="panel-head"><div><span className="eyebrow">SITE · AUDITORIA INICIAL</span><h2>O que encontramos na página inicial</h2></div><small>{new Date(audit.checked_at).toLocaleDateString("pt-BR")}</small></div><p><strong>Título:</strong> {audit.title}</p><p><strong>Descrição:</strong> {audit.description || "Ausente"}</p><p><strong>H1:</strong> {(JSON.parse(audit.h1_json) as string[]).join(" · ") || "Ausente"}</p>{issues.length > 0 ? <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>Os elementos básicos desta página estão presentes.</p>}</section>;
}

function SiteWorkspace({ company, workspace, busy, act, setChatOpen }: {
  company: Company; workspace: Workspace; busy: string;
  act: (name: string, body: Record<string, unknown>) => Promise<unknown>;
  setChatOpen: (open: boolean) => void;
}) {
  const [brief, setBrief] = useState(workspace.siteProject.brief);
  const [repository, setRepository] = useState(workspace.siteRepository?.repository || "");
  const [branch, setBranch] = useState(workspace.siteRepository?.branch || "main");
  const [contentRoot, setContentRoot] = useState(workspace.siteRepository?.content_root || "content");
  const [previewUrl, setPreviewUrl] = useState(workspace.siteRepository?.preview_url || "");
  const [liveUrl, setLiveUrl] = useState(workspace.siteRepository?.live_url || "");
  const stages = [
    { key: "diagnosis", label: "Diagnóstico", detail: "Entender o site atual e definir o que preservar." },
    { key: "building", label: "Construção", detail: "Montar o site no Git e preparar as páginas." },
    { key: "review", label: "Revisão", detail: "Conferir a prévia antes da troca de domínio." },
    { key: "operating", label: "Operação", detail: "Site no domínio do cliente e agente criando novas páginas." },
  ] as const;
  const stageIndex = Math.max(0, stages.findIndex((item) => item.key === workspace.siteProject.stage));
  const committed = workspace.content.filter((item) => item.status === "committed");
  return <div className="page-content narrow site-workspace">
    <PageHeading eyebrow="IMPLANTAÇÃO E OPERAÇÃO" title="Seu site, sob nossos cuidados." description="Analisamos o que já existe, construímos a nova versão com você e depois o agente passa a criar e melhorar páginas continuamente." />
    <section className="site-project-hero"><div><span className="eyebrow">ETAPA ATUAL</span><h2>{stages[stageIndex].label}</h2><p>{stages[stageIndex].detail}</p></div><span className="site-project-count">{String(stageIndex + 1).padStart(2, "0")} / 04</span></section>
    <ol className="site-stage-list">{stages.map((item, index) => <li key={item.key} className={index === stageIndex ? "current" : index < stageIndex ? "complete" : ""}><span>{index < stageIndex ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>{item.label}</strong><p>{item.detail}</p></div></li>)}</ol>
    <div className="site-workspace-grid"><section className="panel"><span className="eyebrow">PONTO DE PARTIDA</span><h2>{company.website ? "O site que vamos transformar" : "Vamos construir seu primeiro site"}</h2><p>{company.website ? "Usamos o endereço atual para entender a empresa e levantar conteúdo, páginas e oportunidades." : "O briefing da empresa é o ponto de partida para a primeira versão."}</p>{company.website && <a className="site-source-link" href={company.website} target="_blank" rel="noreferrer">{company.website} ↗</a>}{workspace.siteAudit && <div className="site-audit-summary"><strong>Auditoria inicial concluída</strong><span>{workspace.siteAudit.title || "Página inicial analisada"}</span></div>}</section>
      <section className="panel"><span className="eyebrow">SITE NO GIT</span><h2>{workspace.siteRepository ? "Repositório conectado" : "Repositório em preparação"}</h2><p>{workspace.siteRepository ? "As novas páginas e artigos são enviados ao Git. A publicação no domínio depende do deploy configurado para este repositório." : "A equipe cria ou adapta o site em um repositório por cliente. É esse código que o agente vai atualizar."}</p>{workspace.siteRepository && <><a className="site-source-link" href={`https://github.com/${workspace.siteRepository.repository}`} target="_blank" rel="noreferrer">{workspace.siteRepository.repository} ↗</a><div className="site-link-row">{workspace.siteRepository.preview_url && <a className="secondary-button" href={workspace.siteRepository.preview_url} target="_blank" rel="noreferrer">Abrir prévia ↗</a>}{workspace.siteRepository.live_url && <a className="secondary-button" href={workspace.siteRepository.live_url} target="_blank" rel="noreferrer">Abrir site ↗</a>}</div></>}</section></div>
    <section className="panel site-brief-panel"><div><span className="eyebrow">O QUE PRECISAMOS PRESERVAR</span><h2>Deixe orientações para a implantação.</h2><p>Conte quais páginas, mensagens, formulários ou partes da identidade são importantes. A equipe usa isso junto com a análise do site.</p></div><form onSubmit={(event) => { event.preventDefault(); act("update_site_brief", { brief }); }}><label htmlFor="site-brief">Orientações do site</label><textarea id="site-brief" rows={5} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Ex.: manter as páginas de serviços e o formulário de contato; refazer a página inicial." /><div><button className="primary-button" disabled={!!busy}>Salvar orientações →</button><button className="link-button" type="button" onClick={() => setChatOpen(true)}>Conversar com o agente ↗</button></div></form></section>
    {committed.length > 0 && <section className="site-pages-panel"><div className="section-title-row"><h2>Alterações no Git</h2><span className="count-pill">{committed.length}</span></div>{committed.map((item) => <a key={item.id} href={item.published_url || "#"} target="_blank" rel="noreferrer"><span className="kind-chip">{item.channel === "blog" ? "Blog" : "Página"}</span><strong>{item.title}</strong><span>Ver commit ↗</span></a>)}</section>}
    {workspace.operator && <section className="panel site-operator-panel"><span className="eyebrow">CONTROLE DA EQUIPE</span><h2>Configurar site no Git</h2><p>O repositório precisa conter ai-cmo.json e consumir arquivos Markdown nas pastas configuradas. O token fica somente no servidor.</p><form className="site-repo-form" onSubmit={(event) => { event.preventDefault(); act("configure_site_repository", { repository, branch, contentRoot, previewUrl, liveUrl }); }}><label>Repositório GitHub<input required value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="empresa/site" /></label><div className="input-pair"><label>Branch<input required value={branch} onChange={(event) => setBranch(event.target.value)} /></label><label>Pasta de conteúdo<input required value={contentRoot} onChange={(event) => setContentRoot(event.target.value)} /></label></div><div className="input-pair"><label>URL de prévia<input type="url" value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} placeholder="https://preview.exemplo.com" /></label><label>Domínio publicado<input type="url" value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://exemplo.com" /></label></div><button className="primary-button" disabled={!!busy}>Verificar e salvar →</button></form><div className="content-buttons">{stages.map((item) => <button key={item.key} className={item.key === workspace.siteProject.stage ? "primary-button" : "secondary-button"} disabled={!!busy || item.key === workspace.siteProject.stage} onClick={() => act("set_site_stage", { stage: item.key })}>{item.label}</button>)}</div></section>}
  </div>;
}
function WorkWorkspace({ work, content, busy, ready, onAct, connected, publicationMode }: {
  work: Work[]; content: Content[]; busy: string; ready: boolean; publicationMode: Workspace["publicationMode"];
  onAct: (action: string, body: Record<string, unknown>) => void;
  connected: (channel: string) => boolean;
}) {
  const waiting = content.filter((item) => item.status === "awaiting_approval");
  const approved = content.filter((item) => item.status === "approved");
  const research = content.filter((item) => item.status === "researched");
  const rejected = content.filter((item) => item.status === "rejected");
  const published = content.filter((item) => item.status === "published" || item.status === "scheduled" || item.status === "committed");
  return <div className="page-content work-workspace">
    <div className="work-workspace-heading"><PageHeading eyebrow="ENTREGAS DO AGENTE" title="Do plano à publicação." description={publicationMode === "automatic" ? "O agente prepara e revisa. Depois envia ao site em operação ou aos canais conectados. Peças bloqueadas vêm para sua decisão." : "O agente prepara o trabalho. Você revisa as entregas antes de elas irem ao ar."} /><button className="secondary-button" disabled={!!busy || !ready} onClick={() => onAct("run_next", {})}>{busy === "run_next" ? "Preparando entrega…" : "Antecipar próxima entrega ↗"}</button></div>
    <div className="work-workspace-grid"><section className="work-queue-panel"><div className="card-topline"><div><span className="eyebrow">O QUE ESTÁ NO PLANO</span><h2>Fila de trabalho</h2></div><span className="count-pill">{work.filter((item) => item.status !== "done").length}</span></div>{work.length ? <div className="work-queue-list">{work.map((item, index) => <article className="work-queue-item" key={item.id}><span className="work-queue-index">{String(index + 1).padStart(2, "0")}</span><div><div className="work-queue-meta"><span className="kind-chip">{kindLabels[item.kind] || item.kind}</span><span className={`status ${item.status}`}>{statusLabels[item.status] || item.status}</span></div><h3>{item.title}</h3><p>{item.rationale}</p></div></article>)}</div> : <div className="work-queue-empty">A primeira tarefa aparece aqui quando o plano estiver pronto.</div>}</section>
      <section className="work-deliveries-panel"><div className="card-topline"><div><span className="eyebrow">O QUE VOLTOU PARA VOCÊ</span><h2>Entregas e decisões</h2></div>{waiting.length > 0 && <span className="decision-count">{waiting.length}</span>}</div>{waiting.length > 0 && <div className="delivery-group"><h3>Para sua revisão</h3>{waiting.map((item) => <ContentCard key={item.id} item={item} busy={busy} onAct={onAct} connected={connected(item.channel === "linkedin" ? "linkedin" : "site")} />)}</div>}{approved.length > 0 && <div className="delivery-group"><h3>Prontos para publicar</h3>{approved.map((item) => <ContentCard key={item.id} item={item} busy={busy} onAct={onAct} connected={connected(item.channel === "linkedin" ? "linkedin" : "site")} />)}</div>}{research.length > 0 && <div className="delivery-group"><h3>Pesquisas e recomendações</h3>{research.map((item) => <ContentCard key={item.id} item={item} busy={busy} onAct={onAct} connected={false} />)}</div>}{published.length > 0 && <div className="delivery-group"><h3>Enviados e agendados</h3>{published.map((item) => <ContentCard key={item.id} item={item} busy={busy} onAct={onAct} connected={true} />)}</div>}{rejected.length > 0 && <div className="delivery-group"><h3>Ajustes pedidos</h3>{rejected.map((item) => <ContentCard key={item.id} item={item} busy={busy} onAct={onAct} connected={false} />)}</div>}{content.length === 0 && <div className="work-deliveries-empty"><span>↗</span><h3>A primeira entrega ainda está sendo preparada.</h3><p>O ciclo automático cria rascunhos para sua revisão. Se quiser, antecipe a próxima entrega usando o botão acima.</p></div>}</section></div>
  </div>;
}

function AuthScreen({ onSuccess, error, setError }: { onSuccess: (user: User, website: string, noSite: boolean) => Promise<void>; error: string; setError: (value: string) => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [phase, setPhase] = useState<"site" | "account">("site");
  const [website, setWebsite] = useState("");
  const [noSite, setNoSite] = useState(false);
  const [preview, setPreview] = useState<{ title: string; description: string; h1: string } | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "signup" && phase === "site") {
        const result = await api("/api/preview", { website: website.trim() });
        setPreview(result); setWebsite(result.url); setPhase("account");
      } else {
        const result = await api("/api/auth", { action: mode, email, password });
        await onSuccess(result.user, mode === "signup" ? website : "", mode === "signup" && noSite);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Erro inesperado."); }
    finally { setBusy(false); }
  }
  const siteStep = mode === "signup" && phase === "site";
  return <main className="auth-layout"><section className="auth-story"><div className="brand light"><Mark /><span>cmo<span className="brand-period">.</span></span></div><div><span className="eyebrow">SEU AGENTE DE INBOUND B2B</span><h1>Seu marketing,<br /><em>em operação.</em></h1><p>Entende seu negócio, escolhe prioridades, prepara entregas e aprende com os resultados.</p></div><small>Entender → planejar → entregar → medir</small></section><section className="auth-form-wrap"><form onSubmit={submit} className="auth-form"><span className="eyebrow accent">{siteStep ? "COMECE PELO SEU SITE" : mode === "signup" ? "SALVE SUA ANÁLISE" : "BEM-VINDO DE VOLTA"}</span><h2>{siteStep ? "O que sua empresa já mostra?" : mode === "signup" ? "Agora, salve esse ponto de partida." : "Entre na sua operação."}</h2><p>{siteStep ? "Cole o endereço e veja uma leitura inicial antes de criar sua conta." : mode === "signup" ? "Depois do cadastro, o agente pesquisa seu negócio e monta o primeiro plano." : "Acompanhe o plano, as entregas e os resultados."}</p>{error && <div className="error-banner" role="alert">{error}</div>}
    {siteStep ? <><label>Site da empresa<input type="text" inputMode="url" autoComplete="url" required value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="suaempresa.com" /></label><button className="primary-button wide" disabled={busy}>{busy ? "Lendo o site…" : "Ver leitura inicial →"}</button><button type="button" className="switch-auth" onClick={() => { setNoSite(true); setWebsite(""); setPreview(null); setError(""); setPhase("account"); }}>Ainda não tenho site</button></> : <>{preview && mode === "signup" && <div className="signup-preview"><span className="eyebrow">ENCONTRAMOS NO SEU SITE</span><strong>{preview.h1 || preview.title}</strong><p>{preview.description || "A página foi encontrada. O agente fará uma leitura mais completa após o cadastro."}</p><button type="button" className="link-button" onClick={() => setPhase("site")}>Corrigir endereço ↗</button></div>}<label>E-mail<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" /></label><label>Senha<input type="password" required minLength={10} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Pelo menos 10 caracteres" /></label><button className="primary-button wide" disabled={busy}>{busy ? "Um instante…" : mode === "signup" ? "Criar conta e continuar →" : "Entrar →"}</button>{mode === "signup" && <button type="button" className="link-button" onClick={() => setPhase("site")}>Voltar ao site</button>}</>}
    <button type="button" className="switch-auth" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}>{mode === "signup" ? "Já tem uma conta? Entrar" : "Ainda não tem conta? Começar pelo site"}</button></form></section></main>;
}

const blankBrief = { name: "", website: "", offer: "", audience: "", competitors: "", founderVoice: "", goal: "", country: "" };
type Brief = typeof blankBrief;
function BriefFields({ value, change }: { value: Brief; change: (next: Brief) => void }) {
  const field = (key: keyof Brief, label: string, placeholder: string, multiline = false) => <label key={key}>{label}{multiline ? <textarea value={value[key]} onChange={(event) => change({ ...value, [key]: event.target.value })} placeholder={placeholder} rows={3} /> : <input value={value[key]} onChange={(event) => change({ ...value, [key]: event.target.value })} placeholder={placeholder} />}</label>;
  return <div className="form-grid">{field("name", "Nome da empresa", "Ex.: Acme")}{field("website", "Site", "https://suaempresa.com")}{field("goal", "Objetivo de negócio", "Ex.: gerar conversas qualificadas", true)}{field("founderVoice", "O que só vocês sabem ou defendem?", "Cases, objeções, aprendizados e opiniões do founder", true)}</div>;
}

function BriefFieldsReadOnly({ value }: { value: Brief }) {
  const field = (key: keyof Brief, label: string, empty: string) => <label key={key}>{label}<p>{value[key] || empty}</p></label>;
  return <div className="form-grid">{field("name", "Nome da empresa", "Ainda não informado")}{field("website", "Site", "Ainda não informado")}{field("goal", "Objetivo de negócio", "Ainda não definido")}{field("founderVoice", "O que só vocês sabem ou defendem?", "Ainda não informado")}</div>;
}

function Onboarding({ initialWebsite, initialNoSite, onLogout, onCreated, error, setError }: { initialWebsite: string; initialNoSite: boolean; onLogout: () => Promise<void>; onCreated: (id: string) => Promise<void>; error: string; setError: (value: string) => void }) {
  const [website, setWebsite] = useState(initialWebsite);
  const [noSite, setNoSite] = useState(initialNoSite);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [country, setCountry] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [busyPhase, setBusyPhase] = useState<"" | "site" | "plan">("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      let companyId = createdId;
      if (!companyId) {
        setBusyPhase("site");
        const created = await api("/api/workspace", { action: "create_company", website: noSite ? "" : website.trim(), name: noSite ? name.trim() : "", summary: noSite ? summary.trim() : "", country });
        companyId = created.companyId;
        setCreatedId(companyId);
      }
      setBusyPhase("plan");
      await api("/api/workspace", { action: "build_strategy", companyId });
      await onCreated(companyId!);
    } catch (err) { setError(err instanceof Error ? err.message : "Não consegui concluir a análise. Tente novamente."); }
    finally { setBusyPhase(""); }
  }
  return <main className="onboarding-layout simplified-onboarding">
    <aside className="onboarding-aside"><div className="brand"><Mark /><span>cmo<span className="brand-period">.</span></span></div><div className="onboarding-aside-copy"><span className="eyebrow">SEU AGENTE DE INBOUND</span><h2>Uma URL.<br /><em>Um ponto de partida.</em></h2><p>Eu leio o que já existe, monto a primeira estratégia e mostro onde vale agir.</p></div><div className="onboarding-promise"><span>01 · Entender seu negócio</span><span>02 · Encontrar oportunidades</span><span>03 · Colocar o plano em movimento</span><button type="button" className="onboarding-logout" onClick={onLogout}>Sair desta conta</button></div></aside>
    <form className="onboarding-form onboarding-simple-form" onSubmit={submit}><button type="button" className="onboarding-logout mobile-only" onClick={onLogout}>Sair desta conta</button><span className="eyebrow accent">AGORA, O PRIMEIRO PLANO</span><h1>{noSite ? "Tudo bem começar sem site." : initialWebsite ? "Vamos montar seu primeiro plano." : "Qual é o site da sua empresa?"}</h1><p>{noSite ? "Uma frase basta para criar o primeiro espaço. Depois a gente melhora o contexto juntos." : initialWebsite ? "Já encontramos sua página inicial. Agora o agente vai ler o restante, entender seus compradores e propor as primeiras ações." : "Cole o endereço. O agente vai ler o site e preparar um primeiro plano para você revisar."}</p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {!noSite ? <label className="onboarding-main-field">Site da empresa<input type="text" inputMode="url" autoComplete="url" required value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="suaempresa.com" disabled={!!createdId || !!busyPhase} /><small>Pode escrever só o domínio. Vamos conferir o endereço antes de analisar.</small></label> : <div className="onboarding-fallback"><label>Nome da empresa<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome da empresa" disabled={!!createdId || !!busyPhase} /></label><label>O que a empresa faz?<textarea required minLength={10} rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Uma frase sobre seu produto ou serviço" disabled={!!createdId || !!busyPhase} /></label></div>}
      <label className="onboarding-main-field">País de atuação<select required value={country} onChange={(event) => setCountry(event.target.value)} disabled={!!createdId || !!busyPhase}><option value="" disabled>Selecione o país</option>{COUNTRIES.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}</select><small>A estratégia e as referências de mercado vão considerar este país.</small></label>
      {busyPhase && <div className="analysis-progress" role="status"><span className="pulse-dot" /><div><strong>{busyPhase === "site" ? "Lendo o site e organizando o contexto…" : "Criando seu primeiro plano…"}</strong><small>Essa análise pode levar alguns instantes.</small></div></div>}
      <div className="onboarding-actions"><button className="primary-button" disabled={!!busyPhase}>{busyPhase ? "Analisando…" : createdId ? "Continuar análise →" : "Analisar meu negócio →"}</button>{!createdId && <button type="button" className="link-button" onClick={() => { setNoSite(!noSite); setError(""); }}>{noSite ? "Tenho um site ↗" : "Ainda não tenho site"}</button>}</div>
      <p className="onboarding-assurance">Você pode corrigir o que o agente encontrar. O agente revisa e publica em canais que você ativar; pode mudar para aprovação manual em Conexões.</p>
    </form>
  </main>;
}

function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}

type ProfileEditFields = {
  productCategory: string; productType: string; businessModel: string; pricing: string;
  keyFeatures: string; primaryCta: string; techSignals: string;
  icpSegment: string; icpCompanySize: string; icpPersona: string; icpPainPoint: string;
};

function BriefForm({ company, research, confirmed, busy, onSave, onConfirm }: { company: Company; research: Research | null; confirmed: boolean; busy: string; onSave: (value: Brief, profile?: ProfileEditFields) => void; onConfirm: () => void }) {
  const [brief, setBrief] = useState<Brief>({ name: company.name, website: company.website, offer: company.offer, audience: company.audience, competitors: company.competitors, founderVoice: company.founder_voice, goal: company.goal, country: company.country });
  const [editingAll, setEditingAll] = useState(false);
  const [editingBasics, setEditingBasics] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const profile = research ? JSON.parse(research.profile_json) as {
    offer?: string; audience?: string; competitors?: string; evidence?: string[];
    productCategory?: string[]; productType?: string;
    businessModel?: string[]; pricing?: string; keyFeatures?: string[]; primaryCta?: string; techSignals?: string[];
    topCompetitors?: string[]; icp?: { segment?: string; companySize?: string; persona?: string; painPoint?: string };
  } : null;
  const joinList = (items?: string[], sep = ", ") => items?.length ? items.join(sep) : "";
  const profileDefaults = (): ProfileEditFields => ({
    productCategory: joinList(profile?.productCategory), productType: profile?.productType ?? "",
    businessModel: joinList(profile?.businessModel), pricing: profile?.pricing ?? "",
    keyFeatures: joinList(profile?.keyFeatures, "; "), primaryCta: profile?.primaryCta ?? "",
    techSignals: joinList(profile?.techSignals),
    icpSegment: profile?.icp?.segment ?? "", icpCompanySize: profile?.icp?.companySize ?? "",
    icpPersona: profile?.icp?.persona ?? "", icpPainPoint: profile?.icp?.painPoint ?? "",
  });
  const [profileEdit, setProfileEdit] = useState<ProfileEditFields>(profileDefaults());
  const source = (value: string, extracted?: string) => !value ? "A confirmar" : extracted && value === extracted ? "Lido no site" : "Informado por você";
  const isHypothesis = (provenance: string) => provenance.startsWith("Hipótese");
  const save = () => { onSave(brief, profileEdit); setEditingAll(false); };
  const cancelAll = () => { setBrief({ ...brief, offer: company.offer, audience: company.audience, competitors: company.competitors, country: company.country }); setProfileEdit(profileDefaults()); setEditingAll(false); };
  const cancelBasics = () => { setBrief({ ...brief, name: company.name, website: company.website, goal: company.goal, founderVoice: company.founder_voice }); setEditingBasics(false); };
  const valueBlock = (label: string, value: string) => {
    const isLong = value.length > 280;
    const truncated = isLong ? value.slice(0, 277).trim() : value;
    const isOpen = !!expanded[label];
    return <p>{truncated}{isLong && !isOpen && "…"}{isLong && isOpen && value.slice(truncated.length)}{isLong && <button type="button" className="link-button fact-toggle" onClick={() => setExpanded({ ...expanded, [label]: !isOpen })}>{isOpen ? "Mostrar menos" : "Ver texto completo"}</button>}</p>;
  };
  const editableFact = (key: "offer" | "audience" | "competitors" | "country", label: string, value: string, provenance: string, kind: "textarea" | "text" | "select") => <div>
    <span>{label}<small className={isHypothesis(provenance) ? "hypothesis" : undefined}>{provenance}</small></span>
    <div className="profile-fact-value">
      {editingAll ? <>
        {kind === "textarea" && <textarea rows={3} value={brief[key]} onChange={(event) => setBrief({ ...brief, [key]: event.target.value })} />}
        {kind === "text" && <input value={brief[key]} onChange={(event) => setBrief({ ...brief, [key]: event.target.value })} />}
        {kind === "select" && <select value={brief[key]} onChange={(event) => setBrief({ ...brief, [key]: event.target.value })}><option value="" disabled>Selecione o país</option>{COUNTRIES.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}</select>}
      </> : valueBlock(label, value)}
    </div>
  </div>;
  const editableProfileFact = (key: keyof ProfileEditFields, label: string, value: string, provenance: string, kind: "text" | "textarea") => <div>
    <span>{label}<small className={isHypothesis(provenance) ? "hypothesis" : undefined}>{provenance}</small></span>
    <div className="profile-fact-value">
      {editingAll
        ? kind === "textarea"
          ? <textarea rows={3} value={profileEdit[key]} onChange={(event) => setProfileEdit({ ...profileEdit, [key]: event.target.value })} />
          : <input value={profileEdit[key]} onChange={(event) => setProfileEdit({ ...profileEdit, [key]: event.target.value })} />
        : valueBlock(label, value)}
    </div>
  </div>;
  return <div className="business-profile">
    <div className="profile-source"><span className="eyebrow">O QUE O AGENTE ENTENDEU</span><span>{research ? `Site analisado: ${new URL(research.source_url).hostname}` : "Ponto de partida informado por você"}</span></div>
    <div className="profile-heading-row"><h2>{company.name}</h2>{!editingAll && <button type="button" className="profile-edit-trigger" onClick={() => setEditingAll(true)}><PencilIcon /> Editar informações</button>}</div>
    <div className="profile-facts">
      {editableFact("offer", "OFERTA", company.offer || "Ainda não identificada", source(company.offer, profile?.offer), "textarea")}
      {editableFact("audience", "COMPRADOR", company.audience || "Ainda não confirmado", source(company.audience, profile?.audience), "textarea")}
      {editableFact("competitors", "ALTERNATIVAS", company.competitors || profile?.topCompetitors?.join(", ") || "Ainda não identificadas", company.competitors ? source(company.competitors, profile?.competitors) : profile?.topCompetitors?.length ? "Hipótese do agente" : "A confirmar", "text")}
      {editableFact("country", "PAÍS DE ATUAÇÃO", countryLabel(company.country) || "A confirmar", company.country ? "Informado por você" : "A confirmar", "select")}
      {editingAll && <div className="profile-fact-actions-row"><button type="button" className="primary-button" disabled={!!busy} onClick={save}>{busy ? "Salvando…" : "Salvar alterações"}</button><button type="button" className="link-button" disabled={!!busy} onClick={cancelAll}>Cancelar</button></div>}
      {editableProfileFact("productCategory", "CATEGORIA", profile?.productCategory?.length ? profile.productCategory.join(", ") : "Ainda não identificada", profile?.productCategory?.length ? "Lido no site" : "A confirmar", "text")}
      {editableProfileFact("productType", "TIPO DE PRODUTO", profile?.productType || "Ainda não identificado", profile?.productType ? "Lido no site" : "A confirmar", "text")}
      {editableProfileFact("businessModel", "MODELO DE NEGÓCIO", profile?.businessModel?.length ? profile.businessModel.join(", ") : "Ainda não identificado", profile?.businessModel?.length ? "Lido no site" : "A confirmar", "text")}
      {editableProfileFact("pricing", "PREÇO", profile?.pricing || "Ainda não identificado", profile?.pricing ? "Lido no site" : "A confirmar", "textarea")}
      {editableProfileFact("keyFeatures", "FUNCIONALIDADES-CHAVE", profile?.keyFeatures?.length ? profile.keyFeatures.join("; ") : "Ainda não identificadas", profile?.keyFeatures?.length ? "Lido no site" : "A confirmar", "textarea")}
      {editableProfileFact("primaryCta", "CTA PRINCIPAL", profile?.primaryCta || "Ainda não identificado", profile?.primaryCta ? "Lido no site" : "A confirmar", "text")}
      {editableProfileFact("techSignals", "SINAIS TÉCNICOS", profile?.techSignals?.length ? profile.techSignals.join(", ") : "Ainda não identificados", profile?.techSignals?.length ? "Lido no site" : "A confirmar", "textarea")}
      <div>
        <span>ICP<small className="hypothesis">Hipótese do agente</small></span>
        <div className="profile-fact-value">{editingAll ? <ul className="icp-sublist icp-sublist-edit">
          <li><strong>Segmento:</strong><input value={profileEdit.icpSegment} onChange={(event) => setProfileEdit({ ...profileEdit, icpSegment: event.target.value })} /></li>
          <li><strong>Porte da empresa:</strong><input value={profileEdit.icpCompanySize} onChange={(event) => setProfileEdit({ ...profileEdit, icpCompanySize: event.target.value })} /></li>
          <li><strong>Cargo:</strong><input value={profileEdit.icpPersona} onChange={(event) => setProfileEdit({ ...profileEdit, icpPersona: event.target.value })} /></li>
          <li><strong>Dor:</strong><textarea rows={2} value={profileEdit.icpPainPoint} onChange={(event) => setProfileEdit({ ...profileEdit, icpPainPoint: event.target.value })} /></li>
        </ul> : <ul className="icp-sublist">
          <li><strong>Segmento:</strong> {profile?.icp?.segment || "A confirmar"}</li>
          <li><strong>Porte da empresa:</strong> {profile?.icp?.companySize || "A confirmar"}</li>
          <li><strong>Cargo:</strong> {profile?.icp?.persona || "A confirmar"}</li>
          <li><strong>Dor:</strong> {profile?.icp?.painPoint || "A confirmar"}</li>
        </ul>}</div>
      </div>
    </div>
    <div className="profile-basics">
      <div className="profile-heading-row">
        <span className="profile-basics-label">Nome, site, objetivo e voz do founder</span>
        {!editingBasics && <button type="button" className="profile-edit-trigger" onClick={() => setEditingBasics(true)}><PencilIcon /> Editar</button>}
      </div>
      {editingBasics ? <form className="form-panel" onSubmit={(event) => { event.preventDefault(); onSave(brief); setEditingBasics(false); }}>
        <BriefFields value={brief} change={setBrief} />
        <div className="profile-fact-actions-row"><button className="primary-button" disabled={!!busy}>{busy ? "Salvando…" : "Salvar contexto →"}</button><button type="button" className="link-button" disabled={!!busy} onClick={cancelBasics}>Cancelar</button></div>
      </form> : <div className="form-panel"><BriefFieldsReadOnly value={brief} /></div>}
    </div>
    {!confirmed && <form className="profile-mission" onSubmit={(event) => { event.preventDefault(); onSave(brief); }}><span className="eyebrow">SÓ VOCÊ PODE DEFINIR</span><h3>Qual resultado importa nos próximos meses?</h3><p>Uma frase ajuda o agente a priorizar o trabalho. Pode ajustar depois.</p><textarea rows={2} value={brief.goal} onChange={(event) => setBrief({ ...brief, goal: event.target.value })} placeholder="Ex.: gerar conversas com líderes de engenharia de empresas B2B" /><div><button className="primary-button" disabled={!!busy || !brief.goal.trim()}>{busy ? "Preparando…" : "Começar com este objetivo →"}</button><button type="button" className="link-button" disabled={!!busy} onClick={onConfirm}>Decidir depois</button></div></form>}
    {!!profile?.evidence?.length && <details className="profile-evidence"><summary>Ver trechos lidos no site</summary>{profile.evidence.map((item) => <p key={item}>↗ {item}</p>)}</details>}
  </div>;
}

function ContentCard({ item, busy, onAct, connected }: { item: Content; busy: string; onAct: (action: string, body: Record<string, unknown>) => void; connected: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const provisionalLink = /\[[^\]]+\]\(\s*(?:#|https?:\/\/(?:www\.)?example\.(?:com|org)[^)]*)\s*\)/i.test(item.body);
  return <article className="content-card"><div className="content-card-top"><span className="kind-chip">{kindLabels[item.channel] || item.channel}</span><span className={`status ${item.status}`}>{statusLabels[item.status]}</span></div><h3>{item.title}</h3><div className={expanded ? "content-body expanded" : "content-body"}><MarkdownPreview value={item.body} /></div><button className="link-button" onClick={() => setExpanded(!expanded)}>{expanded ? "Mostrar menos ↑" : "Ler conteúdo ↓"}</button>{item.status === "awaiting_approval" && provisionalLink && <p className="content-rejection" role="alert"><strong>Link provisório no rascunho.</strong> Peça um ajuste e informe o endereço real antes de aprovar.</p>}{item.status === "awaiting_approval" && (editingFeedback ? <form className="content-feedback" onSubmit={(event) => { event.preventDefault(); if (feedback.trim()) onAct("review_content", { contentId: item.id, decision: "rejected", note: feedback.trim() }); }}><label htmlFor={`feedback-${item.id}`}>O que precisa mudar?</label><textarea id={`feedback-${item.id}`} maxLength={1000} required value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Ex.: retirar a comparação sem fonte e acrescentar o case Brendi" /><div><button className="secondary-button" type="button" onClick={() => setEditingFeedback(false)}>Cancelar</button><button className="primary-button" disabled={!!busy || !feedback.trim()}>Enviar ajuste →</button></div></form> : <div className="content-buttons"><button className="secondary-button" disabled={!!busy} onClick={() => setEditingFeedback(true)}>Pedir ajuste</button><button className="primary-button" disabled={!!busy || provisionalLink} onClick={() => onAct("review_content", { contentId: item.id, decision: "approved" })}>Aprovar →</button></div>)}{item.status === "rejected" && <p className="content-rejection"><strong>Ajuste pedido:</strong> {item.rejection_note} O agente usa esse feedback na próxima execução.</p>}{item.status === "approved" && <div className="content-buttons"><button className="primary-button" disabled={!!busy || !connected} onClick={() => onAct("publish_content", { contentId: item.id })}>{connected ? item.channel === "linkedin" ? "Agendar agora ↗" : "Enviar ao Git ↗" : item.channel === "linkedin" ? "Conecte o LinkedIn" : "Aguarde a implantação do site"}</button></div>}{item.published_url?.startsWith("http") && <a className="published-link" href={item.published_url} target="_blank" rel="noreferrer">{item.status === "committed" ? "Ver commit ↗" : "Ver publicação ↗"}</a>}</article>;
}

function MarkdownPreview({ value }: { value: string }) {
  return <div className="markdown-preview">{value.split(/\n\s*\n/).map((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    const heading = trimmed.match(/^(#{1,3})\s+([^\n]+)$/);
    if (heading) return <h4 key={index}>{inlineMarkdown(heading[2])}</h4>;
    const lines = trimmed.split("\n");
    if (lines.every((line) => /^[-*]\s+/.test(line))) return <ul key={index}>{lines.map((line, lineIndex) => <li key={lineIndex}>{inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>)}</ul>;
    if (lines.every((line) => /^\|.*\|$/.test(line))) return <pre key={index}>{trimmed}</pre>;
    return <p key={index}>{inlineMarkdown(trimmed)}</p>;
  })}</div>;
}

function inlineMarkdown(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return part;
  });
}

function ConnectionPanel({ company, connections, publicationMode, google, busy, onAct }: {
  company: Company; connections: Connection[]; publicationMode: Workspace["publicationMode"]; google: GoogleProperties | null; busy: string;
  onAct: (action: string, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [postBridgeKey, setPostBridgeKey] = useState("");
  const [accounts, setAccounts] = useState<Array<{ id: number; username: string }>>([]);
  const [accountId, setAccountId] = useState("");
  const [siteUrl, setSiteUrl] = useState(google?.siteUrl || "");
  const [property, setProperty] = useState(google?.property || "");
  const connected = (kind: string) => connections.find((item) => item.kind === kind);
  async function loadLinkedInAccounts() {
    const result = await onAct("list_linkedin_accounts", { apiKey: postBridgeKey }) as { accounts?: Array<{ id: number; username: string }> } | undefined;
    if (result?.accounts) setAccounts(result.accounts);
  }
  return <div className="connection-stack">
    <section className="connection-card"><div className="connection-heading"><div><span className="eyebrow">COMO O AGENTE OPERA</span><h2>Publicação</h2></div><span className={`connection-status ${publicationMode === "automatic" ? "connected" : ""}`}>{publicationMode === "automatic" ? "● Automática" : "○ Com sua revisão"}</span></div><p>No modo automático, o agente revisa cada rascunho e o envia ao site em operação ou aos canais conectados. Textos curtos, com placeholders ou alegações sem evidência voltam para sua revisão.</p><div className="content-buttons"><button className={publicationMode === "review" ? "primary-button" : "secondary-button"} disabled={!!busy || publicationMode === "review"} onClick={() => onAct("set_publication_mode", { mode: "review" })}>Revisar antes</button><button className={publicationMode === "automatic" ? "primary-button" : "secondary-button"} disabled={!!busy || publicationMode === "automatic"} onClick={() => onAct("set_publication_mode", { mode: "automatic" })}>Agente publica sozinho</button></div></section>
    <section className="connection-card">
      <div className="connection-heading"><div><span className="eyebrow">DISTRIBUIÇÃO</span><h2>LinkedIn</h2></div><span className={`connection-status ${connected("linkedin") ? "connected" : ""}`}>{connected("linkedin") ? "● Conectado" : "○ Pendente"}</span></div>
      <p>Conecte sua conta Post Bridge e escolha o perfil LinkedIn onde os posts aprovados serão publicados.</p>
      {connected("linkedin") && <p className="connection-label">{connected("linkedin")?.label}</p>}
      <label>Chave Post Bridge<input type="password" value={postBridgeKey} onChange={(event) => setPostBridgeKey(event.target.value)} placeholder="Sua chave de API" /></label>
      <div className="content-buttons"><button className="secondary-button" type="button" disabled={!!busy || !postBridgeKey} onClick={loadLinkedInAccounts}>Ver contas →</button></div>
      {accounts.length > 0 && <div className="linkedin-picker"><label>Perfil LinkedIn<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Escolha um perfil</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.username}</option>)}</select></label><button className="primary-button" disabled={!!busy || !accountId} onClick={() => onAct("connect_linkedin", { accountId, apiKey: postBridgeKey })}>Conectar perfil →</button></div>}
    </section>
    <section className="connection-card">
      <div className="connection-heading"><div><span className="eyebrow">INTELIGÊNCIA</span><h2>Busca e tráfego</h2></div><span className={`connection-status ${google ? "connected" : ""}`}>{google ? "● Conectado" : "○ Pendente"}</span></div>
      <p>Autorize Search Console e Analytics para ver busca, todas as origens de tráfego e visitas vindas do ChatGPT.</p>
      {!google ? <a className="secondary-button" href={`/api/google/start?companyId=${company.id}`}>Conectar Google →</a> : <>
        <div className="input-pair"><label>Site no Search Console<select value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)}><option value="">Selecione</option>{google.sites.map((site) => <option key={site.siteUrl} value={site.siteUrl}>{site.siteUrl}</option>)}</select></label><label>Propriedade GA4<select value={property} onChange={(event) => setProperty(event.target.value)}><option value="">Selecione</option>{google.properties.map((item) => <option key={item.name} value={item.name}>{item.displayName}</option>)}</select></label></div>
        <div className="content-buttons"><button className="secondary-button" disabled={!!busy} onClick={() => onAct("set_google_properties", { siteUrl, property })}>Salvar seleção</button><button className="primary-button" disabled={!!busy} onClick={() => onAct("sync_google_metrics", {})}>Atualizar dados ↻</button></div>
      </>}
    </section>
  </div>;
}

function AiVisibilityPanel({ prompts, runs, busy, onAct }: { prompts: AiPrompt[]; runs: AiRun[]; busy: string; onAct: (action: string, body: Record<string, unknown>) => void }) {
  const [prompt, setPrompt] = useState("");
  return <section className="ai-panel"><div className="section-title-row"><div><span className="eyebrow">BUSCA EM IA</span><h2>Perguntas acompanhadas no ChatGPT</h2></div></div><p>Escolha perguntas que um comprador faria antes de contratar. Cada execução registra a resposta, menções à marca e links citados. É uma amostra, não uma medida de todas as respostas.</p><form onSubmit={(event) => { event.preventDefault(); onAct("add_ai_prompt", { prompt }); setPrompt(""); }}><input value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={10} required placeholder="Ex.: Qual software ajuda a auditar contratos B2B?" /><button className="primary-button" disabled={!!busy}>Adicionar</button></form><div className="prompt-list">{prompts.map((item) => <div key={item.id}><span>{item.prompt}</span><button onClick={() => onAct("remove_ai_prompt", { promptId: item.id })} aria-label={`Remover pergunta ${item.prompt}`}>×</button></div>)}</div>{runs.length > 0 && <div className="ai-run-list"><h3>Últimas verificações</h3>{runs.slice(0, 8).map((run) => <details key={run.id}><summary><span>{run.mentioned ? "● Marca mencionada" : "○ Sem menção"}{run.cited ? " · Site citado" : ""}</span>{run.prompt}</summary><p>{run.answer}</p></details>)}</div>}</section>;
}

function ChatDrawer({ company, messages, busy, onClose, onSend }: { company: Company; messages: Message[]; busy: string; onClose: () => void; onSend: (message: string) => Promise<unknown> }) {
  const [draft, setDraft] = useState("");
  async function send(event: FormEvent) { event.preventDefault(); if (!draft.trim()) return; const text = draft.trim(); setDraft(""); await onSend(text); }
  return <div className="drawer-backdrop" onMouseDown={onClose}><section className="chat-drawer" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Conversa com o agente"><header><div><span className="pulse-dot" /><strong>Agente de {company.name}</strong><small>Seu inbound em movimento</small></div><button onClick={onClose} aria-label="Fechar">×</button></header><div className="chat-messages">{messages.length === 0 && <div className="chat-empty"><span>✳</span><h2>Vamos conversar.</h2><p>Pergunte por que escolhi uma pauta, conte um case ou corrija algo sobre o seu negócio.</p></div>}{messages.map((message) => <div key={message.id} className={`chat-bubble ${message.role}`}>{message.content}</div>)}{busy === "chat" && <div className="chat-bubble assistant">Pensando…</div>}</div><form onSubmit={send}><textarea rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Converse com seu agente…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button disabled={!!busy || !draft.trim()} aria-label="Enviar mensagem">↗</button></form></section></div>;
}
