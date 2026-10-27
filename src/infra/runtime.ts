import { z } from 'zod';
import { SqliteDatabase, PostgresDatabase, migrate } from './database.ts';
import { ServiceRepository } from './repository.ts';
import { AnalysisQueue } from './queue.ts';
import { LocalPrivateObjects, S3PrivateObjects } from './objects.ts';
export const configuration = z.object({
  APP_ENV: z.enum(['local', 'production']).default('local'),
  MIGRATE_ON_START: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().min(1).optional(), DATABASE_PATH: z.string().default('.local/development.sqlite'),
  PG_POOL_MAX: z.coerce.number().int().min(1).max(30).default(10),
  OBJECTS_PATH: z.string().default('.local/private-objects'),
  S3_BUCKET: z.string().min(1).optional(), S3_REGION: z.string().default('us-east-1'), S3_ENDPOINT: z.url().optional(),
  AUTH_MODE: z.enum(['demo', 'jwt']).default('demo'), DEMO_API_TOKEN: z.string().min(24).optional(),
  JWT_ISSUER: z.url().optional(), JWT_AUDIENCE: z.string().optional(), JWKS_URL: z.url().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  HOST: z.string().default('127.0.0.1'), PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  REPORT_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
  REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(120)
}).superRefine((c, ctx) => {
  const error = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (c.DATABASE_URL && !/^postgres(ql)?:\/\//.test(c.DATABASE_URL)) error('DATABASE_URL deve usar PostgreSQL.');
  if (c.AUTH_MODE === 'demo' && !c.DEMO_API_TOKEN) error('Modo local exige token de demonstração.');
  if (c.AUTH_MODE === 'jwt' && (!c.JWT_ISSUER || !c.JWT_AUDIENCE || !c.JWKS_URL)) error('JWT exige issuer, audience e JWKS.');
  if (c.APP_ENV === 'production' && (c.AUTH_MODE !== 'jwt' || !c.DATABASE_URL || !c.S3_BUCKET)) error('Produção exige JWT, PostgreSQL e bucket privado.');
  if (c.APP_ENV === 'production' && c.S3_ENDPOINT && !c.S3_ENDPOINT.startsWith('https://')) error('Endpoint S3 de produção exige HTTPS.');
  if (c.APP_ENV === 'production' && c.DEMO_API_TOKEN) error('Não configure token compartilhado em produção.');
  if (c.APP_ENV === 'production' && c.MIGRATE_ON_START === 'true') error('Execute migrações separadamente antes de iniciar réplicas.');
  if (c.APP_ENV === 'production' && c.CORS_ORIGINS.split(',').some(o => !o.trim().startsWith('https://'))) error('Front-end de produção exige origem HTTPS explícita.');
});
export type Configuration = z.infer<typeof configuration>;
export async function infrastructure(config: Configuration) {
  const db = config.DATABASE_URL ? new PostgresDatabase(config.DATABASE_URL, config.PG_POOL_MAX) : new SqliteDatabase(config.DATABASE_PATH);
  try {
    if (config.MIGRATE_ON_START === 'true') await migrate(db);
    else await db.query('SELECT id FROM analysis_jobs LIMIT 0');
  } catch (error) { await db.close(); throw error; }
  const repository = new ServiceRepository(db);
  const queue = new AnalysisQueue(db, 60_000, config.REPORT_TTL_SECONDS * 1000);
  const objects = config.S3_BUCKET ? new S3PrivateObjects({ bucket: config.S3_BUCKET, region: config.S3_REGION, ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}) }) : new LocalPrivateObjects(config.OBJECTS_PATH);
  return { db, repository, queue, objects };
}
