import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { PostgresDatabase, migrate } from '../src/infra/database.ts';
import { ServiceRepository } from '../src/infra/repository.ts';
import { AnalysisQueue } from '../src/infra/queue.ts';
import { LocalPrivateObjects } from '../src/infra/objects.ts';
import { buildApp } from '../src/app.ts';

const connection = process.env.INTEGRATION_DATABASE_URL;
if (!connection) throw new Error('Configure INTEGRATION_DATABASE_URL para banco exclusivo de testes.');
const users = Number(process.env.LOAD_USERS ?? 300);
if (!Number.isInteger(users) || users < 1 || users > 1000) throw new Error('LOAD_USERS deve estar entre 1 e 1000.');
const schema = 'load_' + randomUUID().replaceAll('-', '');
const admin = new PostgresDatabase(connection, 2);
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(connection); scoped.searchParams.set('options', '-c search_path=' + schema);
const db = new PostgresDatabase(scoped.toString(), 10);
await migrate(db);
const repository = new ServiceRepository(db); const queue = new AnalysisQueue(db);
const root = resolve('.local', schema); mkdirSync(root, { recursive: true });
const objects = new LocalPrivateObjects(resolve(root, 'objects'));
const tokens = Object.fromEntries(Array.from({ length: users }, (_, n) => [`token-synthetic-load-user-${n}-123456`, 'synthetic-' + n]));
const app = buildApp({ store: repository, queue, objects, tokens, consumeQuota: owner => repository.consumeQuota(owner, 120) });
const workerEnv: NodeJS.ProcessEnv = { ...process.env, APP_ENV: 'local', AUTH_MODE: 'demo', DATABASE_URL: scoped.toString(), OBJECTS_PATH: resolve(root, 'objects'), DEMO_API_TOKEN: 'token-worker-apenas-teste-123456', PG_POOL_MAX: '5', WORKER_CONCURRENCY: '4' };
delete workerEnv.S3_BUCKET;
const child = spawn(process.execPath, ['src/worker.ts'], { cwd: process.cwd(), env: workerEnv, stdio: ['ignore','pipe','pipe'] });
let childFailure = '';
child.stderr.on('data', chunk => { childFailure = 'Trabalhador emitiu erro durante o teste.'; writeFileSync(resolve(root, 'worker-error.log'), chunk, { flag: 'a' }); });
const latencies: number[] = []; const started = performance.now();
try {
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const entries = await Promise.all(Object.keys(tokens).map(async (token, n) => {
    const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
    const request = async (url: string, payload: unknown, expected: number) => {
      const begin = performance.now(); const response = await fetch(address + url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000) });
      latencies.push(performance.now() - begin); assert.equal(response.status, expected); return response.json();
    };
    const c = await request('/cases', { benefit: 'bpc', uf: 'MG', syntheticData: true, consent: true }, 201);
    await request(`/cases/${c.case.id}/documents`, { name: 'documento-ficticio.txt', mimeType: 'text/plain', kind: 'carta_indeferimento', text: 'DOCUMENTO FICTÍCIO\nMotivo do indeferimento: teste sintético' }, 201);
    const job = await request(`/cases/${c.case.id}/analyze`, {}, 202);
    if (n % 10 === 0) assert.equal((await request(`/cases/${c.case.id}/analyze`, {}, 202)).id, job.id);
    return { headers, caseId: c.case.id, jobId: job.id };
  }));
  const acceptedMs = performance.now() - started;
  const deadline = Date.now() + 90_000;
  while (true) {
    const counts = (await db.query('SELECT status,COUNT(*) AS n FROM analysis_jobs GROUP BY status')).rows;
    assert.equal(counts.some(row => row.status === 'failed'), false);
    if (counts.some(row => row.status === 'completed' && Number(row.n) === users)) break;
    if (child.exitCode !== null) throw new Error(childFailure || 'Trabalhador encerrou antes da conclusão.');
    if (Date.now() > deadline) throw new Error('Tempo de teste esgotado.');
    await setTimeout(100);
  }
  await Promise.all(entries.map(async entry => {
    const response = await fetch(address + `/cases/${entry.caseId}/report`, { headers: entry.headers });
    assert.equal(response.status, 200); assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(), '%PDF-');
  }));
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM analysis_jobs')).rows[0]?.n), users);
  const persistedCases = (await db.query('SELECT state FROM cases')).rows;
  for (const row of persistedCases) {
    const saved = JSON.parse(String(row.state)) as import('../src/domain.ts').CaseState;
    assert.ok(saved.documents.every(document => document.text === '' && document.pages.length === 0 && document.purgedAt));
  }
  latencies.sort((a,b) => a-b);
  const result = { users, database: 'PostgreSQL real', workerProcess: 'separado', workerConcurrency: 4, apiPoolMax: 10, workerPoolMax: 5, acceptedMs: Math.round(acceptedMs), totalMs: Math.round(performance.now() - started), postRequests: latencies.length, postP95Ms: Math.round(latencies[Math.floor(latencies.length * 0.95)] ?? 0), completed: users, pdfsVerified: users, rawDocumentsDiscarded: users, duplicateJobs: 0, limitations: 'Tráfego sintético local; sem OCR, LLM ou rede de produção.' };
  writeFileSync(resolve(root, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  if (!exited()) {
    const exit = once(child, 'exit'); child.kill('SIGTERM');
    await Promise.race([exit, setTimeout(10_000, undefined, { ref: false })]);
    if (!exited()) { const killed = once(child, 'exit'); child.kill('SIGKILL'); await killed; }
  }
  await app.close(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.close();
}
