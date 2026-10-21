import { spawn } from "node:child_process";

const port = Number(process.env.PORT || 3740);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT inválida.");
if (!process.env.APP_SECRET || !process.env.CRON_SECRET || !process.env.LLM_API_KEY) {
  throw new Error("Configure APP_SECRET, CRON_SECRET e LLM_API_KEY antes de iniciar.");
}

const web = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "0.0.0.0"], {
  stdio: "inherit", env: process.env,
});
let worker;
let stopping = false;

async function awaitWeb() {
  for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return true;
    } catch { /* Web process is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function shutdown(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  worker?.kill(signal);
  web.kill(signal);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
web.on("exit", (code) => { shutdown(); process.exitCode = code || 1; });

if (await awaitWeb()) {
  worker = spawn(process.execPath, ["scripts/worker.mjs"], {
    stdio: "inherit", env: { ...process.env, AI_CMO_URL: `http://127.0.0.1:${port}` },
  });
  worker.on("exit", (code) => {
    if (!stopping) {
      console.error(`Worker encerrado inesperadamente (${code}).`);
      shutdown();
      process.exitCode = 1;
    }
  });
} else {
  console.error("Servidor não ficou pronto para iniciar o worker.");
  shutdown();
  process.exitCode = 1;
}
