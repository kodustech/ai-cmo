import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function publicAddress(address: string) {
  if (address.includes(":")) {
    const value = address.toLowerCase();
    return !(value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80") || value.startsWith("::ffff:127."));
  }
  const parts = address.split(".").map(Number);
  return !(parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] >= 224);
}

export async function validatePublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) {
    throw new Error("Informe uma URL pública HTTP ou HTTPS sem porta ou credenciais.");
  }
  if (!isIP(url.hostname) && !url.hostname.includes(".")) {
    throw new Error("Informe o domínio completo, por exemplo suaempresa.com.");
  }
  if (isIP(url.hostname)) {
    if (!publicAddress(url.hostname)) throw new Error("Endereço privado não é permitido.");
  } else {
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
      throw new Error("O domínio precisa apontar para um endereço público.");
    }
  }
  return url;
}

export type PublicPage = { url: string; title: string; text: string; links: string[]; audit: { description: string; h1: string[]; canonical: string; robots: string; issues: string[] } };

export async function readPublicPage(raw: string): Promise<PublicPage> {
  let url = await validatePublicUrl(raw);
  for (let redirect = 0; redirect < 4; redirect++) {
    const response = await fetch(url, {
      headers: { "User-Agent": "AICMOResearchBot/0.1", Accept: "text/html" },
      redirect: "manual", signal: AbortSignal.timeout(15_000), cache: "no-store",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirecionamento sem destino.");
      url = await validatePublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Site respondeu ${response.status}.`);
    if (!(response.headers.get("content-type") || "").includes("text/html")) throw new Error("A página não é HTML.");
    const html = (await response.text()).slice(0, 500_000);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || url.hostname;
    const decode = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] || "";
    const metas = html.match(/<meta\b[^>]*>/gi) || [];
    const description = decode(attribute(metas.find((tag) => attribute(tag, "name").toLowerCase() === "description") || "", "content"));
    const robots = attribute(metas.find((tag) => attribute(tag, "name").toLowerCase() === "robots") || "", "content");
    const canonical = attribute((html.match(/<link\b[^>]*>/gi) || []).find((tag) => attribute(tag, "rel").toLowerCase() === "canonical") || "", "href");
    const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => decode(match[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " "))).filter(Boolean).slice(0, 10);
    const issues = [
      !description && "Página inicial sem meta description.",
      !h1.length && "Página inicial sem H1.",
      h1.length > 1 && "Página inicial com vários H1; revisar hierarquia.",
      !canonical && "Página inicial sem canonical declarado.",
      /noindex/i.test(robots) && "Página inicial marcada como noindex.",
      title.length < 20 && "Título da página inicial muito curto.",
    ].filter((issue): issue is string => typeof issue === "string");
    const text = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot);/gi, " ")
      .replace(/\s+/g, " ").trim().slice(0, 18_000);
    const links = [...new Set((html.match(/<a\b[^>]*>/gi) || []).map((tag) => attribute(tag, "href")).map((href) => {
      try {
        const link = new URL(href, url);
        return link.origin === url.origin && link.pathname !== url.pathname ? `${link.origin}${link.pathname}` : "";
      } catch { return ""; }
    }).filter(Boolean))];
    return { url: url.toString(), title: decode(title), text, links, audit: { description, h1, canonical, robots, issues } };
  }
  throw new Error("O site redirecionou muitas vezes.");
}

export async function readCompanySite(raw: string) {
  const home = await readPublicPage(raw);
  const score = (link: string) => /\/(about|sobre|quem-somos|company)/i.test(link) ? 0
    : /\/(product|produto|platform|plataforma|solution|solucao|solucoes)/i.test(link) ? 1
      : /\/(customer|clientes|case|pricing|precos)/i.test(link) ? 2 : 10;
  const candidates = home.links.filter((link) => score(link) < 10).sort((a, b) => score(a) - score(b)).slice(0, 3);
  const results = await Promise.allSettled(candidates.map((link) => readPublicPage(link)));
  const pages = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  return { home, pages, text: [home, ...pages].map((page) => `URL: ${page.url}\nTítulo: ${page.title}\nConteúdo: ${page.text.slice(0, 7000)}`).join("\n\n") };
}
