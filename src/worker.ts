import { setTimeout } from 'node:timers/promises';
import { configuration, infrastructure } from './infra/runtime.ts';
import { workOnce } from './infra/worker.ts';
const config = configuration.parse(process.env);
const runtime = await infrastructure(config);
const shutdown = new AbortController();
let cleanup: Promise<unknown> | null = null;
const cleaner = setInterval(() => {
  if (cleanup) return;
  cleanup = runtime.queue.cleanExpired(runtime.objects).catch(() => { console.error('Limpeza temporária pendente; será tentada novamente.'); }).finally(() => { cleanup = null; });
}, 30_000);
cleaner.unref();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => shutdown.abort());
async function loop() {
  while (!shutdown.signal.aborted) {
    try {
      const worked = await workOnce(runtime.queue, runtime.objects);
      if (!worked) await setTimeout(500, undefined, { signal: shutdown.signal });
    } catch {
      if (!shutdown.signal.aborted) {
        console.error('Falha transitória no trabalhador; nova tentativa em breve.');
        await setTimeout(1000, undefined, { signal: shutdown.signal }).catch(() => {});
      }
    }
  }
}
try { await Promise.all(Array.from({ length: config.WORKER_CONCURRENCY }, () => loop())); }
finally { clearInterval(cleaner); await cleanup; await runtime.db.close(); }
