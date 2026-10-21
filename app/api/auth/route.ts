import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createUser, currentUser, endSession, startSession, verifyPassword } from "@/lib/auth";
import { firstRow } from "@/lib/db";

export const runtime = "nodejs";
const credentials = z.object({ email: z.email().max(254), password: z.string().min(10).max(200) });

export async function GET() {
  return NextResponse.json({ user: await currentUser() });
}

export async function POST(request: NextRequest) {
  try {
    const { action, ...input } = await request.json();
    if (action === "logout") { await endSession(); return NextResponse.json({ ok: true }); }
    const { email, password } = credentials.parse(input);
    if (action === "signup") {
      if (firstRow("SELECT id FROM users WHERE email=?", email.toLowerCase())) {
        return NextResponse.json({ error: "Este e-mail já tem uma conta." }, { status: 409 });
      }
      const userId = createUser(email, password);
      await startSession(userId);
      return NextResponse.json({ user: { id: userId, email: email.toLowerCase() } });
    }
    if (action === "login") {
      const user = firstRow<{ id: string; email: string; password_hash: string }>(
        "SELECT * FROM users WHERE email=?", email.toLowerCase());
      if (!user || !verifyPassword(password, user.password_hash)) {
        return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
      }
      await startSession(user.id);
      return NextResponse.json({ user: { id: user.id, email: user.email } });
    }
    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 400 });
  }
}
