"use client";

import { useEffect, useState, type FormEvent } from "react";

export function PublicActions({ siteSlug, pageSlug, trackingOnly = false }: { siteSlug: string; pageSlug: string; trackingOnly?: boolean }) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!trackingOnly) return;
    let visitorId = localStorage.getItem("ai-cmo-visitor");
    if (!visitorId) { visitorId = crypto.randomUUID(); localStorage.setItem("ai-cmo-visitor", visitorId); }
    const sourceKey = `ai-cmo-source:${siteSlug}`;
    let referrer = sessionStorage.getItem(sourceKey) || "";
    if (!referrer && document.referrer) {
      try {
        const origin = new URL(document.referrer).origin;
        if (origin !== window.location.origin) { referrer = origin; sessionStorage.setItem(sourceKey, origin); }
      } catch { /* Ignore malformed referrers. */ }
    }
    fetch("/api/public-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteSlug, pageSlug, visitorId, referrer }), keepalive: true }).catch(() => {});
  }, [siteSlug, pageSlug, trackingOnly]);
  if (trackingOnly) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("Enviando…");
    try {
      const response = await fetch("/api/public-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteSlug, pageSlug, name: data.get("name"), email: data.get("email"), message: data.get("message"), website: data.get("website") }) });
      if (!response.ok) throw new Error();
      form.reset(); setStatus("Mensagem enviada. Obrigado!");
    } catch { setStatus("Não foi possível enviar. Tente novamente."); }
  }
  return <form className="public-form" onSubmit={submit}><label>Seu nome<input name="name" required maxLength={120} /></label><label>Email de trabalho<input name="email" type="email" required maxLength={254} /></label><label>Como podemos ajudar?<textarea name="message" rows={4} maxLength={3000} required /></label><input name="website" tabIndex={-1} autoComplete="off" className="public-trap" aria-hidden="true" /><button>Enviar mensagem ↗</button><p role="status">{status}</p></form>;
}
