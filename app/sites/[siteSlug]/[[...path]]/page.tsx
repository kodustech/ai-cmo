import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { firstRow, type Company } from "@/lib/db";
import { hostedPage, hostedPages, siteBySlug, siteUrl } from "@/lib/hosted";
import { PublicActions } from "./public-actions";
import "./site.css";

type Props = { params: Promise<{ siteSlug: string; path?: string[] }> };

function resolve(slug: string, path?: string[]) {
  const site = siteBySlug(slug);
  if (!site) return null;
  const company = firstRow<Company>("SELECT * FROM companies WHERE id=?", site.company_id);
  if (!company) return null;
  const pageSlug = path?.join("/") || "";
  const page = pageSlug ? hostedPage(company.id, pageSlug) : null;
  if (pageSlug && !page) return null;
  return { site, company, page, pageSlug };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { siteSlug, path } = await params;
  const result = resolve(siteSlug, path);
  if (!result) return { title: "Página não encontrada", robots: { index: false } };
  const { site, company, page, pageSlug } = result;
  const title = page ? `${page.title} | ${company.name}` : company.name;
  const description = page?.description || company.offer.slice(0, 155) || `Conheça ${company.name}`;
  const canonical = siteUrl(site, pageSlug);
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: page?.channel === "blog" ? "article" : "website" } };
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g).map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (match) return <a key={index} href={match[2]} rel="noopener noreferrer">{match[1]}</a>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

function Article({ body, title }: { body: string; title: string }) {
  const blocks = body.split(/\n\s*\n/);
  if (blocks[0]?.trim().replace(/^#\s+/, "").trim().toLowerCase() === title.trim().toLowerCase()) blocks.shift();
  return <div className="public-article">{blocks.map((block, index) => {
    const value = block.trim();
    if (!value) return null;
    const heading = value.match(/^(#{1,3})\s+(.+)$/);
    if (heading) return heading[1].length === 1 ? <h2 key={index}>{inline(heading[2])}</h2> : <h3 key={index}>{inline(heading[2])}</h3>;
    const lines = value.split("\n");
    if (lines.every((line) => /^[-*]\s+/.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^[-*]\s+/, ""))}</li>)}</ul>;
    return <p key={index}>{inline(value)}</p>;
  })}</div>;
}

export default async function PublicSite({ params }: Props) {
  const { siteSlug, path } = await params;
  const result = resolve(siteSlug, path);
  if (!result) notFound();
  const { site, company, page, pageSlug } = result;
  const pages = hostedPages(company.id);
  const jsonLd = page?.channel === "blog" ? {
    "@context": "https://schema.org", "@type": "Article", headline: page.title,
    description: page.description, datePublished: page.published_at,
    author: { "@type": "Organization", name: company.name }, mainEntityOfPage: siteUrl(site, pageSlug),
  } : { "@context": "https://schema.org", "@type": "Organization", name: company.name, url: siteUrl(site) };
  return <div className="public-site">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <header className="public-header"><a className="public-brand" href={siteUrl(site)}>{company.name}</a><nav><a href={siteUrl(site)}>Início</a><a href={`${siteUrl(site)}#conteudos`}>Conteúdos</a><a href="#contato">Contato</a></nav></header>
    <main>
      {page ? <><div className="public-hero compact"><span className="public-kicker">{page.channel === "blog" ? "ARTIGO" : "SOLUÇÃO"}</span><h1>{page.title}</h1><p>{page.description}</p></div><Article body={page.body} title={page.title} /></> : <><div className="public-hero"><span className="public-kicker">{company.name.toUpperCase()}</span><h1>{company.offer || `Conheça ${company.name}`}</h1><p>{company.audience ? `Para ${company.audience}` : "Converse com a gente para entender como podemos ajudar."}</p><a href="#contato" className="public-cta">Vamos conversar ↗</a></div><section id="conteudos" className="public-list"><span className="public-kicker">IDEIAS E SOLUÇÕES</span><h2>Explore o que fazemos</h2>{pages.length ? <div className="public-grid">{pages.map((item) => <a key={item.id} href={siteUrl(site, item.slug)}><span>{item.channel === "blog" ? "ARTIGO" : "PÁGINA"}</span><h3>{item.title}</h3><p>{item.description}</p><b>Ler mais ↗</b></a>)}</div> : <p>Novos conteúdos em breve.</p>}</section></>}
      <section id="contato" className="public-contact"><div><span className="public-kicker">PRÓXIMO PASSO</span><h2>Vamos conversar sobre o seu desafio?</h2><p>Conte um pouco do que você procura. A equipe de {company.name} recebe sua mensagem diretamente.</p></div><PublicActions siteSlug={site.slug} pageSlug={pageSlug} /></section>
    </main><footer><strong>{company.name}</strong><span>{company.website && <a href={company.website}>Site principal ↗</a>}</span></footer>
    <PublicActions siteSlug={site.slug} pageSlug={pageSlug} trackingOnly />
  </div>;
}
