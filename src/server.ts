import { buildApp } from './app.ts';
import { Store } from './storage.ts';
import { z } from 'zod';

const environment = z.object({
  DEMO_API_TOKEN: z.string().min(24),
  DATABASE_PATH: z.string().default('.local/development.sqlite'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000)
}).parse(process.env);
const app = buildApp({ store: new Store(environment.DATABASE_PATH), tokens: { [environment.DEMO_API_TOKEN]: 'local-demo' }, logger: true });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
await app.listen({ host: '127.0.0.1', port: environment.PORT });
