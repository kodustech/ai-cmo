import { firstRow, type Company } from "./db";

export type SiteRepository = {
  company_id: string; repository: string; branch: string; content_root: string;
  preview_url: string; live_url: string; updated_at: string;
};

export function siteRepository(companyId: string) {
  return firstRow<SiteRepository>("SELECT * FROM site_repositories WHERE company_id=?", companyId);
}

export function siteReady(companyId: string) {
  return !!siteRepository(companyId) && firstRow<{ stage: string }>("SELECT stage FROM site_projects WHERE company_id=?", companyId)?.stage === "operating";
}

function githubToken() {
  const token = process.env.GITHUB_SITE_TOKEN;
  if (!token) throw new Error("Configure GITHUB_SITE_TOKEN antes de operar sites no Git.");
  return token;
}

async function github(path: string, init?: RequestInit) {
  const base = (process.env.GITHUB_API_BASE_URL || "https://api.github.com").replace(/\/+$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GitHub recusou a operação (${response.status}): ${typeof result.message === "string" ? result.message.slice(0, 180) : "verifique acesso e configuração"}`);
  return result;
}

function safeSegment(value: string) {
  return /^[A-Za-z0-9._-]+$/.test(value) && value !== "." && value !== "..";
}

export async function verifySiteRepository(repository: string, branch: string, contentRoot: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || repository.split("/").some((part) => !safeSegment(part))) throw new Error("Informe o repositório como owner/repo.");
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.split("/").some((part) => !safeSegment(part))) throw new Error("Branch inválida.");
  if (!contentRoot || contentRoot.split("/").some((part) => !safeSegment(part))) throw new Error("Pasta de conteúdo inválida.");
  const contract = await github(`/repos/${repository}/contents/ai-cmo.json?ref=${encodeURIComponent(branch)}`) as { content?: string; encoding?: string };
  if (contract.encoding !== "base64" || !contract.content) throw new Error("O repositório precisa do arquivo ai-cmo.json.");
  const manifest = JSON.parse(Buffer.from(contract.content.replace(/\s/g, ""), "base64").toString("utf8")) as { version?: number; contentRoot?: string };
  if (manifest.version !== 1 || manifest.contentRoot !== contentRoot) throw new Error("ai-cmo.json deve ter version 1 e contentRoot igual à pasta configurada.");
}

function slug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "conteudo";
}

export async function commitSiteContent(company: Company, content: { id: string; channel: string; title: string; body: string }) {
  const site = siteRepository(company.id);
  if (!site) throw new Error("A equipe precisa conectar o repositório do site antes de publicar páginas e artigos.");
  if (!siteReady(company.id)) throw new Error("A equipe precisa concluir a implantação antes de enviar conteúdo ao site.");
  if (content.channel !== "blog" && content.channel !== "page") throw new Error("Canal de site inválido.");
  const folder = content.channel === "blog" ? "blog" : "pages";
  const filename = `${slug(content.title)}-${content.id.slice(0, 8)}.md`;
  const path = `${site.content_root}/${folder}/${filename}`;
  const markdown = `---\ntitle: ${JSON.stringify(content.title)}\ndescription: ${JSON.stringify(content.body.replace(/[#*`\[\]()]/g, "").replace(/\s+/g, " ").trim().slice(0, 155))}\ncontentId: ${JSON.stringify(content.id)}\n---\n\n${content.body.trim()}\n`;
  const result = await github(`/repos/${site.repository}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `content: add ${content.channel} ${content.title.slice(0, 70)}`, content: Buffer.from(markdown).toString("base64"), branch: site.branch }),
  }) as { commit?: { html_url?: string }; content?: { html_url?: string } };
  const url = result.commit?.html_url || result.content?.html_url;
  if (!url) throw new Error("GitHub não retornou o link do commit.");
  return url;
}
