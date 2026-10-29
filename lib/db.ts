import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const databasePath = process.env.AI_CMO_DATABASE_PATH || join(process.env.RAILWAY_VOLUME_MOUNT_PATH || join(process.cwd(), "data"), "ai-cmo.sqlite");
let singleton: DatabaseSync | undefined;

export function db(): DatabaseSync {
  if (singleton) return singleton;
  mkdirSync(dirname(databasePath), { recursive: true });
  const connection = new DatabaseSync(databasePath);
  connection.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  connection.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_states (
      state_hash TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL, website TEXT NOT NULL DEFAULT '', offer TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '', competitors TEXT NOT NULL DEFAULT '',
      founder_voice TEXT NOT NULL DEFAULT '', goal TEXT NOT NULL DEFAULT '',
      plan_mode TEXT NOT NULL DEFAULT 'agent', onboarding_complete INTEGER NOT NULL DEFAULT 0,
      strategy_json TEXT NOT NULL DEFAULT '{}', strategy_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, status TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
      config_json TEXT NOT NULL DEFAULT '{}', secret_ciphertext TEXT,
      checked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, kind)
    );
    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, title TEXT NOT NULL, rationale TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', priority INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'planned', source TEXT NOT NULL DEFAULT 'agent',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      work_item_id TEXT REFERENCES work_items(id) ON DELETE SET NULL,
      channel TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'awaiting_approval', published_url TEXT,
      rejection_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      role TEXT NOT NULL, content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      source TEXT NOT NULL, metric TEXT NOT NULL, value REAL NOT NULL,
      period TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, source, metric, period, label)
    );
    CREATE TABLE IF NOT EXISTS ai_prompts (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_runs (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      prompt_id TEXT NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
      answer TEXT NOT NULL, mentioned INTEGER NOT NULL, cited INTEGER NOT NULL,
      citations_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      summary TEXT NOT NULL, lesson TEXT NOT NULL, decision TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS site_audits (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      url TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      h1_json TEXT NOT NULL, canonical TEXT NOT NULL, robots TEXT NOT NULL,
      issues_json TEXT NOT NULL, checked_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS company_research (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL DEFAULT '', profile_json TEXT NOT NULL DEFAULT '{}',
      checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS profile_confirmations (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      confirmed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hosted_sites (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS site_projects (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      stage TEXT NOT NULL DEFAULT 'diagnosis',
      brief TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS site_repositories (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      repository TEXT NOT NULL,
      branch TEXT NOT NULL,
      content_root TEXT NOT NULL,
      preview_url TEXT NOT NULL DEFAULT '',
      live_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS publication_settings (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      mode TEXT NOT NULL DEFAULT 'review', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS hosted_pages (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      content_id TEXT NOT NULL UNIQUE REFERENCES content(id) ON DELETE CASCADE,
      slug TEXT NOT NULL, channel TEXT NOT NULL, title TEXT NOT NULL,
      body TEXT NOT NULL, description TEXT NOT NULL,
      published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, slug)
    );
    CREATE TABLE IF NOT EXISTS site_events (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      page_slug TEXT NOT NULL, visitor_id TEXT NOT NULL,
      referrer TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      page_slug TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS work_company_idx ON work_items(company_id, status);
    CREATE INDEX IF NOT EXISTS content_company_idx ON content(company_id, status);
    CREATE INDEX IF NOT EXISTS signal_company_idx ON signals(company_id, period);
    CREATE INDEX IF NOT EXISTS site_events_company_idx ON site_events(company_id, created_at);
    CREATE INDEX IF NOT EXISTS leads_company_idx ON leads(company_id, created_at);
  `);
  // Retire credentials for the removed CMS integration from existing installations.
  connection.prepare("DELETE FROM connections WHERE kind=?").run("wordpress");
  try { connection.exec("ALTER TABLE companies ADD COLUMN country TEXT NOT NULL DEFAULT ''"); } catch { /* column already exists */ }
  singleton = connection;
  return connection;
}

export const id = () => crypto.randomUUID();

export type User = { id: string; email: string };
export type Company = {
  id: string; owner_id: string; name: string; website: string; offer: string;
  audience: string; competitors: string; founder_voice: string; goal: string; country: string;
  plan_mode: "agent" | "managed"; onboarding_complete: number;
  strategy_json: string; strategy_updated_at: string | null; created_at: string;
};

export function listRows<T>(query: string, ...params: Array<string | number>): T[] {
  return db().prepare(query).all(...params) as T[];
}

export function firstRow<T>(query: string, ...params: Array<string | number>): T | undefined {
  return db().prepare(query).get(...params) as T | undefined;
}

export function addActivity(companyId: string, kind: string, title: string, detail = "") {
  db().prepare("INSERT INTO activity(id, company_id, kind, title, detail) VALUES(?,?,?,?,?)")
    .run(id(), companyId, kind, title, detail);
}
