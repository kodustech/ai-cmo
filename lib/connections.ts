import { addActivity, db, firstRow, id, type Company } from "./db";
import { decrypt, encrypt } from "./secrets";
import { commitSiteContent } from "./git-site";

export type Connection = {
  id: string; company_id: string; kind: string; status: string; label: string;
  config_json: string; secret_ciphertext: string | null; checked_at: string | null;
};

function getConnection(companyId: string, kind: string) {
  return firstRow<Connection>("SELECT * FROM connections WHERE company_id=? AND kind=?", companyId, kind);
}

function saveConnection(companyId: string, kind: string, label: string, config: object, secret: object) {
  db().prepare(`INSERT INTO connections(id,company_id,kind,status,label,config_json,secret_ciphertext,checked_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(company_id,kind) DO UPDATE SET
    status=excluded.status,label=excluded.label,config_json=excluded.config_json,
    secret_ciphertext=excluded.secret_ciphertext,checked_at=excluded.checked_at`)
    .run(id(), companyId, kind, "connected", label, JSON.stringify(config), encrypt(JSON.stringify(secret)), new Date().toISOString());
  addActivity(companyId, "connection", `${label} conectado`);
}

export async function listLinkedInAccounts(key: string) {
  if (!key.trim()) throw new Error("Informe a chave do Post Bridge.");
  const base = (process.env.POST_BRIDGE_BASE_URL || "https://api.post-bridge.com").replace(/\/+$/, "");
  const response = await fetch(`${base}/v1/social-accounts?limit=100`, {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Post Bridge respondeu ${response.status}.`);
  const payload = await response.json();
  const accounts = Array.isArray(payload) ? payload : payload.accounts || payload.data || payload.socialAccounts || payload.results || [];
  return accounts.filter((candidate: { platform?: string }) => candidate.platform?.toLowerCase().includes("linkedin")) as Array<{ id: number; username?: string; name?: string }>;
}

export async function connectLinkedIn(company: Company, accountId: number, key: string) {
  const accounts = await listLinkedInAccounts(key);
  const account = accounts.find((candidate: { id: number; platform?: string }) =>
    Number(candidate.id) === accountId);
  if (!account) throw new Error("Conta LinkedIn não encontrada no Post Bridge.");
  saveConnection(company.id, "linkedin", `LinkedIn · ${account.username || account.name || accountId}`,
    { accountId }, { apiKey: key });
  return { label: account.username || account.name || String(accountId) };
}

export async function publishContent(company: Company, content: { id: string; channel: string; title: string; body: string }) {
  if (content.channel === "blog" || content.channel === "page") {
    return commitSiteContent(company, content);
  }
  if (content.channel === "linkedin") {
    const connection = getConnection(company.id, "linkedin");
    if (!connection?.secret_ciphertext) throw new Error("Conecte o LinkedIn antes de publicar.");
    const { apiKey: key } = JSON.parse(decrypt(connection.secret_ciphertext)) as { apiKey: string };
    const { accountId } = JSON.parse(connection.config_json) as { accountId: number };
    const base = (process.env.POST_BRIDGE_BASE_URL || "https://api.post-bridge.com").replace(/\/+$/, "");
    const response = await fetch(`${base}/v1/posts`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ caption: content.body, scheduled_at: new Date(Date.now() + 60_000).toISOString(), social_accounts: [accountId] }),
      signal: AbortSignal.timeout(30_000), cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Falha ao agendar no LinkedIn (${response.status}).`);
    return result.url || result.link || `post-bridge:${result.id || content.id}`;
  }
  throw new Error("Canal não suportado.");
}
