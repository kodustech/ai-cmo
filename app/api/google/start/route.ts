import { NextRequest, NextResponse } from "next/server";
import { accessibleCompany, currentUser } from "@/lib/auth";
import { googleConnectUrl } from "@/lib/google";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const user = await currentUser();
  const companyId = request.nextUrl.searchParams.get("companyId") || "";
  if (!user || !await accessibleCompany(companyId)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  try { return NextResponse.redirect(googleConnectUrl(companyId, user.id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erro de configuração." }, { status: 400 }); }
}
