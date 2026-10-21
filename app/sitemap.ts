import type { MetadataRoute } from "next";
import { listRows } from "@/lib/db";
import { baseUrl } from "@/lib/hosted";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const sites = listRows<{ slug: string; created_at: string }>("SELECT slug,created_at FROM hosted_sites WHERE enabled=1");
  const pages = listRows<{ site_slug: string; slug: string; published_at: string }>("SELECT s.slug site_slug,p.slug,p.published_at FROM hosted_pages p JOIN hosted_sites s ON s.company_id=p.company_id WHERE s.enabled=1");
  return [
    { url: baseUrl(), changeFrequency: "monthly" as const, priority: 1 },
    ...sites.map((site) => ({ url: `${baseUrl()}/sites/${site.slug}`, lastModified: site.created_at, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...pages.map((page) => ({ url: `${baseUrl()}/sites/${page.site_slug}/${page.slug}`, lastModified: page.published_at, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
