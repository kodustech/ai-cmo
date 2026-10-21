import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/hosted";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/sites/"], disallow: ["/api/", "/app"] },
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
