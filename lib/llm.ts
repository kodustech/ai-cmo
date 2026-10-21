import { z } from "zod";

type Message = { role: "system" | "user" | "assistant"; content: string };

async function complete(messages: Message[], jsonMode: boolean, maxTokens: number) {
  const base = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY não está configurada.");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "deepseek-flash",
      messages: jsonMode ? [{ role: "system", content: "Responda apenas com um objeto JSON válido. Sem markdown." }, ...messages] : messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      // Fireworks enables DeepSeek V4.1 thinking by default. Long drafts can
      // spend their entire output budget on reasoning and return empty content.
      ...(base.includes("fireworks.ai") ? { reasoning_effort: "none" } : {}),
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(90_000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`DeepSeek respondeu ${response.status}: ${JSON.stringify(payload).slice(0, 400)}`);
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    console.warn("[llm] Resposta sem conteúdo", { finishReason: payload?.choices?.[0]?.finish_reason, usage: payload?.usage });
    throw new Error("O modelo não concluiu a resposta. Tente novamente.");
  }
  return { text: text.trim(), finishReason: payload?.choices?.[0]?.finish_reason as string | undefined };
}

export async function deepseekJson<T>(messages: Message[], schema: z.ZodType<T>): Promise<T> {
  const parse = (text: string): T => {
    try { return schema.parse(JSON.parse(text)); }
    catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return schema.parse(JSON.parse(match[0]));
      throw new Error("Resposta sem objeto JSON.");
    }
  };
  const first = await complete(messages, true, 5000);
  try { return parse(first.text); }
  catch {
    console.warn("[llm] Resposta JSON precisou de correção", { finishReason: first.finishReason, length: first.text.length });
    const repaired = await complete([
      { role: "system", content: "Corrija a resposta anterior para um único objeto JSON válido e conciso. Preserve as informações e as chaves existentes, complete apenas campos interrompidos e não invente fatos. Sem markdown ou explicações." },
      { role: "user", content: first.text.slice(0, 18000) },
    ], true, 5000);
    try { return parse(repaired.text); }
    catch { throw new Error("Não consegui concluir a análise automática. Tente novamente."); }
  }
}

export async function deepseekProse(messages: Message[], maxTokens = 6000): Promise<string> {
  return (await complete(messages, false, maxTokens)).text;
}
