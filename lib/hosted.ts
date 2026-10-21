import { firstRow, listRows } from "./db";

export type HostedSite = { company_id: string; slug: string; enabled: number };
export type HostedPage = { id: string; company_id: string; content_id: string; slug: string; channel: string; title: string; body: string; description: string; published_at: string };

export function baseUrl() {
  return (process.env.PUBLIC_SITE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3740").replace(/\/+$/, "");
}

export function siteUrl(site: HostedSite, pageSlug?: string) {
  return `${baseUrl()}/sites/${site.slug}${pageSlug ? `/${pageSlug}` : ""}`;
}

export function hostedSite(companyId: string) {
  return firstRow<HostedSite>("SELECT * FROM hosted_sites WHERE company_id=? AND enabled=1", companyId);
}

export function siteBySlug(slug: string) {
  return firstRow<HostedSite>("SELECT * FROM hosted_sites WHERE slug=? AND enabled=1", slug);
}

export function hostedPages(companyId: string) {
  return listRows<HostedPage>("SELECT * FROM hosted_pages WHERE company_id=? ORDER BY published_at DESC", companyId);
}

export function hostedPage(companyId: string, slug: string) {
  return firstRow<HostedPage>("SELECT * FROM hosted_pages WHERE company_id=? AND slug=?", companyId, slug);
}

export function hostedMetrics(companyId: string) {
  const visits = firstRow<{ total: number; unique_visitors: number }>("SELECT COUNT(*) total,COUNT(DISTINCT visitor_id) unique_visitors FROM site_events WHERE company_id=?", companyId);
  const leads = firstRow<{ total: number }>("SELECT COUNT(*) total FROM leads WHERE company_id=?", companyId);
  const events = listRows<{ page_slug: string; referrer: string }>("SELECT page_slug,referrer FROM site_events WHERE company_id=? ORDER BY created_at DESC LIMIT 10000", companyId);
  const sources = new Map<string, number>();
  const pages = new Map<string, number>();
  for (const event of events) {
    let source = "Direto / desconhecido";
    if (event.referrer) {
      try {
        const hostname = new URL(event.referrer).hostname.replace(/^www\./, "");
        source = /(^|\.)chatgpt\.com$/.test(hostname) ? "ChatGPT" : /(^|\.)google\./.test(hostname) ? "Google" : hostname;
      } catch { source = "Outro"; }
    }
    sources.set(source, (sources.get(source) || 0) + 1);
    const page = event.page_slug || "Início";
    pages.set(page, (pages.get(page) || 0) + 1);
  }
  return { visits: visits?.total || 0, visitors: visits?.unique_visitors || 0, leads: leads?.total || 0,
    sources: [...sources].map(([name, visits]) => ({ name, visits })).sort((a, b) => b.visits - a.visits).slice(0, 8),
    pages: [...pages].map(([name, visits]) => ({ name, visits })).sort((a, b) => b.visits - a.visits).slice(0, 8),
  };
}
