import { addActivity, firstRow, listRows, type Company } from "./db";
import { buildStrategy, reviewPerformance, runNextTask } from "./agent";
import { maybeAutoPublish, publishApproved } from "./publishing";
import { syncGoogleMetrics } from "./google";
import { syncChatGptVisibility, syncSemrush } from "./market";
import { siteReady } from "./git-site";

function daysAgo(days: number) { return new Date(Date.now() - days * 86_400_000).toISOString(); }

export async function runCompanyCycle(company: Company) {
  const actions: string[] = [];
  const errors: string[] = [];
  if (!company.onboarding_complete) return { actions, errors };

  const awaitingAuto = listRows<{ id: string }>("SELECT id FROM content WHERE company_id=? AND status='awaiting_approval' AND channel IN ('page','blog','linkedin') ORDER BY created_at LIMIT 3", company.id);
  for (const item of awaitingAuto) {
    try { if (await maybeAutoPublish(company, item.id)) actions.push(`auto_published:${item.id}`); }
    catch (error) { errors.push(`auto_publish:${item.id}:${error instanceof Error ? error.message : "erro"}`); }
  }

  // Approved content is safe to publish; the founder explicitly approved it.
  const approved = listRows<{ id: string; work_item_id: string | null; channel: string; title: string; body: string }>(
    "SELECT id,work_item_id,channel,title,body FROM content WHERE company_id=? AND status='approved' ORDER BY created_at LIMIT 3", company.id);
  for (const item of approved) {
    const ready = item.channel === "linkedin"
      ? !!firstRow("SELECT id FROM connections WHERE company_id=? AND kind='linkedin' AND status='connected'", company.id)
      : siteReady(company.id);
    if (!ready) continue;
    try {
      await publishApproved(company, item.id);
      actions.push(`published:${item.id}`);
    } catch (error) { errors.push(`publish:${item.id}:${error instanceof Error ? error.message : "erro"}`); }
  }

  const recentMetrics = firstRow<{ id: string }>(
    "SELECT id FROM activity WHERE company_id=? AND kind='metrics' AND created_at>? LIMIT 1", company.id, daysAgo(7));
  if (!recentMetrics) {
    for (const [source, run] of [
      ["google", () => syncGoogleMetrics(company)],
      ["semrush", () => syncSemrush(company)],
      ["chatgpt", () => syncChatGptVisibility(company)],
    ] as const) {
      if (source === "google" && !firstRow("SELECT id FROM connections WHERE company_id=? AND kind='google'", company.id)) continue;
      if (source === "semrush" && !process.env.SEMRUSH_API_KEY) continue;
      if (source === "chatgpt" && !(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)) continue;
      try { await run(); actions.push(`metrics:${source}`); }
      catch (error) { errors.push(`metrics:${source}:${error instanceof Error ? error.message : "erro"}`); }
    }
  }

  const recentReview = firstRow<{ id: string }>(
    "SELECT id FROM reviews WHERE company_id=? AND created_at>? LIMIT 1", company.id, daysAgo(7));
  if (!recentReview) {
    try { await reviewPerformance(company); actions.push("review:weekly"); }
    catch (error) { errors.push(`review:${error instanceof Error ? error.message : "erro"}`); }
  }

  const strategyAge = company.strategy_updated_at ? new Date(company.strategy_updated_at).getTime() : 0;
  if (Date.now() - strategyAge > 30 * 86_400_000) {
    try { await buildStrategy(company); actions.push("strategy:refreshed"); }
    catch (error) { errors.push(`strategy:${error instanceof Error ? error.message : "erro"}`); }
  }

  const awaiting = firstRow<{ count: number }>("SELECT COUNT(*) AS count FROM content WHERE company_id=? AND status='awaiting_approval'", company.id)?.count || 0;
  const recentDraft = firstRow<{ id: string }>("SELECT id FROM content WHERE company_id=? AND created_at>? LIMIT 1", company.id, daysAgo(3));
  if (awaiting < 2 && !recentDraft) {
    try { const result = await runNextTask(company); if (result.contentId) { actions.push(`draft:${result.contentId}`); if (await maybeAutoPublish(company, result.contentId)) actions.push(`auto_published:${result.contentId}`); } }
    catch (error) { errors.push(`draft:${error instanceof Error ? error.message : "erro"}`); }
  }
  addActivity(company.id, "cycle", errors.length ? "Ciclo concluído com pendências" : "Ciclo automático concluído", JSON.stringify({ actions, errors }));
  return { actions, errors };
}

export async function runAllCycles() {
  const companies = listRows<Company>("SELECT * FROM companies WHERE onboarding_complete=1 ORDER BY created_at LIMIT 100");
  const results = [];
  for (const company of companies) results.push({ companyId: company.id, ...(await runCompanyCycle(company)) });
  return results;
}
