import { buildApp } from './app.ts';
import { configuration, infrastructure } from './infra/runtime.ts';
import { jwtAuthenticator } from './infra/auth.ts';
import { readFileSync } from 'node:fs';
const config = configuration.parse(process.env);
const runtime = await infrastructure(config);
const app = buildApp({
  store: runtime.repository, queue: runtime.queue, objects: runtime.objects, logger: true,
  researchResources: JSON.parse(readFileSync('data/library/research-resources.json', 'utf8')),
  ...(config.AUTH_MODE === 'jwt' ? { authenticate: jwtAuthenticator({ issuer: config.JWT_ISSUER!, audience: config.JWT_AUDIENCE!, jwksUrl: config.JWKS_URL! }) } : { tokens: { [config.DEMO_API_TOKEN!]: 'local-demo' } }),
  corsOrigins: config.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean),
  consumeQuota: owner => runtime.repository.consumeQuota(owner, config.REQUESTS_PER_MINUTE),
  ready: async () => { await runtime.db.query('SELECT 1'); await runtime.objects.ready?.(); }
});
// Curadoria permanece no CLI/banco local, fora das réplicas da API.
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
await app.listen({ host: config.HOST, port: config.PORT });
