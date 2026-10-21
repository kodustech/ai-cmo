import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { finishGoogleConnect } from "@/lib/google";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/app?connection=login-required", request.url));
  const state = request.nextUrl.searchParams.get("state") || "";
  const code = request.nextUrl.searchParams.get("code") || "";
  try {
    const companyId = await finishGoogleConnect(state, code, user.id);
    return NextResponse.redirect(new URL(`/app?companyId=${companyId}&connection=google-ready`, request.url));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Falha na conexão";
    return NextResponse.redirect(new URL(`/app?connection=google-error&reason=${encodeURIComponent(reason.slice(0, 200))}`, request.url));
  }
}
