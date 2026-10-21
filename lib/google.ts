import { createHash, randomBytes } from "node:crypto";
import { addActivity, db, firstRow, id, type Company } from "./db";
import { encrypt, decrypt } from "./secrets";

type GoogleConfig = {
  sites: Array<{ siteUrl: string; permissionLevel: string }>;
  properties: Array<{ name: string; displayName: string; websiteUrl?: string }>;
  siteUrl?: string; property?: string;
};
type GoogleSecret = { refreshToken: string; accessToken?: string; expiresAt?: number };
type GoogleConnection = { config_json: string; secret_ciphertext: string };
const stateHash = (value: string) => createHash("sha256").update(value).digest("hex");

function oauthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI.");
  return { clientId, clientSecret, redirectUri };
}

export function googleConnectUrl(companyId: string, userId: string) {
  const { clientId, redirectUri } = oauthConfig();
  const state = randomBytes(32).toString("base64url");
  db().prepare("INSERT INTO oauth_states(state_hash,company_id,user_id,expires_at) VALUES(?,?,?,?)")
    .run(stateHash(state), companyId, userId, new Date(Date.now() + 10 * 60_000).toISOString());
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", state,
    scope: "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly",
    access_type: "offline", prompt: "consent", include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function googleRequest<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25_000), cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Google API respondeu ${response.status}: ${JSON.stringify(result).slice(0, 250)}`);
  return result as T;
}

export async function finishGoogleConnect(state: string, code: string, userId: string) {
  const record = firstRow<{ company_id: string; user_id: string; expires_at: string }>(
    "SELECT company_id,user_id,expires_at FROM oauth_states WHERE state_hash=?", stateHash(state));
  db().prepare("DELETE FROM oauth_states WHERE state_hash=?").run(stateHash(state));
  if (!record || record.user_id !== userId || record.expires_at < new Date().toISOString()) throw new Error("Conexão expirada. Tente novamente.");
  const { clientId, clientSecret, redirectUri } = oauthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(25_000), cache: "no-store",
  });
  const tokens = await response.json();
  if (!response.ok || !tokens.refresh_token) throw new Error("O Google não concedeu acesso contínuo. Remova o acesso anterior e tente novamente.");
  const [sitesResponse, propertiesResponse] = await Promise.all([
    googleRequest<{ siteEntry?: GoogleConfig["sites"] }>("https://www.googleapis.com/webmasters/v3/sites", tokens.access_token),
    googleRequest<{ accountSummaries?: Array<{ propertySummaries?: Array<{ property: string; displayName: string }> }> }>(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", tokens.access_token).catch(() => ({ accountSummaries: [] })),
  ]);
  const sites = sitesResponse.siteEntry || [];
  const properties = (propertiesResponse.accountSummaries || []).flatMap((account) =>
    (account.propertySummaries || []).map((property) => ({ name: property.property, displayName: property.displayName })));
  const secret: GoogleSecret = { refreshToken: tokens.refresh_token, accessToken: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
  const config: GoogleConfig = { sites, properties, siteUrl: sites[0]?.siteUrl, property: properties[0]?.name };
  db().prepare(`INSERT INTO connections(id,company_id,kind,status,label,config_json,secret_ciphertext,checked_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(company_id,kind) DO UPDATE SET
    status=excluded.status,label=excluded.label,config_json=excluded.config_json,
    secret_ciphertext=excluded.secret_ciphertext,checked_at=excluded.checked_at`)
    .run(id(), record.company_id, "google", "connected", "Google Search Console + Analytics", JSON.stringify(config), encrypt(JSON.stringify(secret)), new Date().toISOString());
  addActivity(record.company_id, "connection", "Google conectado", `${sites.length} sites e ${properties.length} propriedades encontrados`);
  return record.company_id;
}

export function googleProperties(companyId: string): GoogleConfig | null {
  const connection = firstRow<GoogleConnection>("SELECT config_json,secret_ciphertext FROM connections WHERE company_id=? AND kind='google'", companyId);
  return connection ? JSON.parse(connection.config_json) as GoogleConfig : null;
}

export function setGoogleProperties(companyId: string, siteUrl: string, property: string) {
  const config = googleProperties(companyId);
  if (!config) throw new Error("Conecte o Google primeiro.");
  if (siteUrl && !config.sites.some((site) => site.siteUrl === siteUrl)) throw new Error("Site fora da conta conectada.");
  if (property && !config.properties.some((item) => item.name === property)) throw new Error("Propriedade fora da conta conectada.");
  config.siteUrl = siteUrl; config.property = property;
  db().prepare("UPDATE connections SET config_json=? WHERE company_id=? AND kind='google'").run(JSON.stringify(config), companyId);
}

async function accessToken(companyId: string) {
  const connection = firstRow<GoogleConnection>("SELECT config_json,secret_ciphertext FROM connections WHERE company_id=? AND kind='google'", companyId);
  if (!connection) throw new Error("Conecte o Google primeiro.");
  const secret = JSON.parse(decrypt(connection.secret_ciphertext)) as GoogleSecret;
  if (secret.accessToken && secret.expiresAt && secret.expiresAt > Date.now() + 60_000) return { token: secret.accessToken, config: JSON.parse(connection.config_json) as GoogleConfig };
  const { clientId, clientSecret } = oauthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: secret.refreshToken, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(25_000), cache: "no-store",
  });
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) throw new Error("A conexão Google expirou. Reconecte a conta.");
  secret.accessToken = tokens.access_token; secret.expiresAt = Date.now() + tokens.expires_in * 1000;
  db().prepare("UPDATE connections SET secret_ciphertext=?,checked_at=? WHERE company_id=? AND kind='google'")
    .run(encrypt(JSON.stringify(secret)), new Date().toISOString(), companyId);
  return { token: secret.accessToken as string, config: JSON.parse(connection.config_json) as GoogleConfig };
}

export function saveSignal(companyId: string, source: string, metric: string, value: number, period: string, label = "") {
  db().prepare(`INSERT INTO signals(id,company_id,source,metric,value,period,label) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(company_id,source,metric,period,label) DO UPDATE SET value=excluded.value,created_at=CURRENT_TIMESTAMP`)
    .run(id(), companyId, source, metric, value, period, label);
}

export async function syncGoogleMetrics(company: Company) {
  const { token, config } = await accessToken(company.id);
  const endDate = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const period = `${startDate} — ${endDate}`;
  const outcomes: string[] = [];
  if (config.siteUrl) {
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`;
    const result = await googleRequest<{ rows?: Array<{ clicks: number; impressions: number; keys?: string[] }> }>(url, token, {
      method: "POST", body: JSON.stringify({ startDate, endDate, rowLimit: 100 }),
    });
    const total = result.rows?.[0];
    saveSignal(company.id, "Search Console", "clicks", total?.clicks || 0, period, "Cliques na busca Google");
    saveSignal(company.id, "Search Console", "impressions", total?.impressions || 0, period, "Impressões na busca Google");
    outcomes.push("Search Console");
  }
  if (config.property) {
    const url = `https://analyticsdata.googleapis.com/v1beta/${config.property}:runReport`;
    const dateRanges = [{ startDate, endDate }];
    const [totalResult, result] = await Promise.all([
      googleRequest<{ rows?: Array<{ metricValues?: Array<{ value: string }> }> }>(url, token, {
        method: "POST", body: JSON.stringify({ dateRanges, metrics: [{ name: "sessions" }] }),
      }),
      googleRequest<{ rows?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }> }>(url, token, {
        method: "POST", body: JSON.stringify({ dateRanges, dimensions: [{ name: "sessionSourceMedium" }], metrics: [{ name: "sessions" }], limit: 1000 }),
      }),
    ]);
    const total = Number(totalResult.rows?.[0]?.metricValues?.[0]?.value || 0);
    let chatgpt = 0;
    for (const row of result.rows || []) {
      const source = row.dimensionValues?.[0]?.value || "(not set)";
      const sessions = Number(row.metricValues?.[0]?.value || 0);
      if (/(chatgpt\.com|chat\.openai\.com)/i.test(source)) chatgpt += sessions;
      if (sessions > 0) saveSignal(company.id, "Analytics", "sessions_by_source", sessions, period, source);
    }
    saveSignal(company.id, "Analytics", "sessions", total, period, "Sessões de todas as origens");
    saveSignal(company.id, "Analytics", "chatgpt_referrals", chatgpt, period, "Sessões vindas do ChatGPT");
    outcomes.push("Analytics");
  }
  addActivity(company.id, "metrics", "Dados atualizados", outcomes.join(" + "));
  return { period, sources: outcomes };
}
