const url = process.env.AI_CMO_URL || "http://127.0.0.1:3740";
if (!process.env.CRON_SECRET) throw new Error("Configure CRON_SECRET antes de iniciar o worker.");

async function tick() {
  try {
    const response = await fetch(`${url}/api/cron`, {
      method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: AbortSignal.timeout(5 * 60_000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    console.log(new Date().toISOString(), "Ciclo concluído:", result.results.length, "empresa(s)");
  } catch (error) { console.error(new Date().toISOString(), "Falha no ciclo:", error); }
}

await tick();
setInterval(tick, 6 * 60 * 60_000);
