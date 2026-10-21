import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, firstRow, id, type Company, type User } from "./db";

const COOKIE = "ai_cmo_session";
const MONTH = 30 * 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + MONTH);
  db().prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)")
    .run(hashToken(token), userId, expires.toISOString());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", expires,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token_hash=?").run(hashToken(token));
  store.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return firstRow<User>(
    "SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    hashToken(token), new Date().toISOString(),
  ) ?? null;
}

export async function accessibleCompany(companyId: string): Promise<Company | null> {
  const user = await currentUser();
  if (!user) return null;
  const company = firstRow<Company>("SELECT * FROM companies WHERE id=?", companyId);
  if (!company) return null;
  const operators = (process.env.OPERATOR_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase());
  if (company.owner_id !== user.id && !(company.plan_mode === "managed" && operators.includes(user.email.toLowerCase()))) return null;
  return company;
}

export function createUser(email: string, password: string) {
  const userId = id();
  db().prepare("INSERT INTO users(id,email,password_hash) VALUES(?,?,?)")
    .run(userId, email.toLowerCase(), hashPassword(password));
  return userId;
}
