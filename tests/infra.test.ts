import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { caseInput } from '../src/domain.ts';
import { SqliteDatabase, migrate } from '../src/infra/database.ts';
import { ServiceRepository } from '../src/infra/repository.ts';
import { AnalysisQueue } from '../src/infra/queue.ts';
import { LocalPrivateObjects } from '../src/infra/objects.ts';
import { workOnce } from '../src/infra/worker.ts';
import { DemoInvestigator } from '../src/investigation.ts';
import { buildApp } from '../src/app.ts';
import { configuration } from '../src/infra/runtime.ts';
import { registerDocument } from '../src/documents.ts';

const input = caseInput.parse({ benefit: 'bpc', uf: 'MG', syntheticData: true, consent: true });
async function fixture() {
  const root = mkdtempSync(join(process.cwd(), '.local-infra-test-'));
  const db = new SqliteDatabase(join(root, 'test.sqlite')); await migrate(db);
  return { root, db, repository: new ServiceRepository(db), queue: new AnalysisQueue(db), objects: new LocalPrivateObjects(join(root, 'objects')), close: async () => { await db.close(); rmSync(root, { recursive: true, force: true }); } };
}
test('submissões simultâneas do mesmo caso são idempotentes e sobrevivem à reabertura', async () => {
  const f = await fixture();
  try {
    const c = await f.repository.create('a', input);
    const jobs = await Promise.all(Array.from({ length: 50 }, () => f.queue.enqueue(c.case.id, 'a')));
    assert.equal(new Set(jobs.map(j => j.id)).size, 1);
    const other = new SqliteDatabase(join(f.root, 'test.sqlite'));
    try { assert.equal((await new AnalysisQueue(other).get(jobs[0]!.id, 'a')).status, 'queued'); } finally { await other.close(); }
    await assert.rejects(() => f.queue.get(jobs[0]!.id, 'b'), /não encontrado/);
  } finally { await f.close(); }
});
test('trabalhadores concorrentes não recebem a mesma tarefa', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 10; i++) { const c = await f.repository.create('u' + i, input); await f.queue.enqueue(c.case.id, 'u' + i); }
    const claimed = (await Promise.all(Array.from({ length: 20 }, () => f.queue.claim()))).filter(j => j !== null);
    assert.equal(claimed.length, 10); assert.equal(new Set(claimed.map(j => j.id)).size, 10);
  } finally { await f.close(); }
});
test('lease expirado é recuperado e trabalhador antigo não publica resultado', async () => {
  const f = await fixture();
  try {
    const c = await f.repository.create('a', input); await f.queue.enqueue(c.case.id, 'a');
    const old = (await f.queue.claim())!;
    await f.db.query('UPDATE analysis_jobs SET lease_until=0 WHERE id=$1', [old.id]);
    const fresh = (await f.queue.claim())!;
    assert.equal(fresh.id, old.id); assert.notEqual(fresh.leaseToken, old.leaseToken);
    assert.equal(await f.queue.complete(old, new DemoInvestigator().analyze(c), 'reports/old.pdf'), false);
    assert.equal(await f.queue.complete(fresh, new DemoInvestigator().analyze(c), 'reports/new.pdf'), true);
  } finally { await f.close(); }
});
test('alteração de evidência cancela tarefa e impede publicar análise antiga', async () => {
  const f = await fixture();
  try {
    const c = await f.repository.create('a', input); const submitted = await f.queue.enqueue(c.case.id, 'a'); const claimed = (await f.queue.claim())!;
    const oldAnalysis = new DemoInvestigator().analyze(c);
    c.case.denialReason = 'novo dado'; await f.repository.save(c, 'a', 'case.updated');
    assert.equal((await f.queue.get(submitted.id, 'a')).status, 'cancelled');
    assert.equal(await f.queue.complete(claimed, oldAnalysis, 'reports/old.pdf'), false);
    assert.notEqual((await f.queue.enqueue(c.case.id, 'a')).id, submitted.id);
  } finally { await f.close(); }
});
test('atualizações concorrentes retornam conflito em vez de perder dados', async () => {
  const f = await fixture();
  try {
    const c = await f.repository.create('a', input); const x = await f.repository.get(c.case.id, 'a'); const y = await f.repository.get(c.case.id, 'a');
    x.case.denialReason = 'primeiro'; y.case.denialReason = 'segundo';
    await f.repository.save(x, 'a', 'case.updated');
    await assert.rejects(() => f.repository.save(y, 'a', 'case.updated'), /alterado/);
    assert.equal((await f.repository.get(c.case.id, 'a')).case.denialReason, 'primeiro');
  } finally { await f.close(); }
});
test('falhas têm tentativas limitadas e não expõem conteúdo dos documentos', async () => {
  const f = await fixture();
  try {
    const c = await f.repository.create('a', input); const j = await f.queue.enqueue(c.case.id, 'a');
    for (let i = 0; i < 3; i++) {
      const claim = (await f.queue.claim())!; assert.ok(claim);
      await f.queue.fail(claim); await f.db.query('UPDATE analysis_jobs SET available_at=0 WHERE id=$1', [j.id]);
    }
    assert.equal((await f.queue.get(j.id, 'a')).status, 'failed');
    assert.equal(await f.queue.claim(), null);
  } finally { await f.close(); }
});
test('limite por usuário bloqueia excesso e quotas são atômicas', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 3; i++) { const c = await f.repository.create('a', input); await f.queue.enqueue(c.case.id, 'a'); }
    const extra = await f.repository.create('a', input); await assert.rejects(() => f.queue.enqueue(extra.case.id, 'a'), /andamento/);
    const accepted = await Promise.all(Array.from({ length: 20 }, () => f.repository.consumeQuota('a', 5, 60_000)));
    assert.equal(accepted.filter(Boolean).length, 5);
  } finally { await f.close(); }
});
test('API retorna 202, acompanhamento protegido e PDF pronto após processamento', async () => {
  const f = await fixture(); const token = 'token-local-infraestrutura-123456'; const other = 'token-outro-infraestrutura-123456';
  const app = buildApp({ store: f.repository, queue: f.queue, objects: f.objects, tokens: { [token]: 'a', [other]: 'b' }, corsOrigins: ['http://localhost:5173'] });
  const headers = { authorization: 'Bearer ' + token };
  try {
    const id = (await app.inject({ method: 'POST', url: '/cases', headers, payload: input })).json().case.id;
    const submitted = await app.inject({ method: 'POST', url: `/cases/${id}/analyze`, headers, payload: {} });
    assert.equal(submitted.statusCode, 202); assert.ok(submitted.headers.location);
    assert.equal(submitted.json().leaseToken, undefined);
    const url = '/jobs/' + submitted.json().id;
    assert.equal((await app.inject({ url, headers: { authorization: 'Bearer ' + other } })).statusCode, 404);
    assert.equal((await app.inject({ url: `/cases/${id}/report`, headers })).statusCode, 404);
    await workOnce(f.queue, f.objects);
    assert.equal((await app.inject({ url, headers })).json().status, 'completed');
    const pdf = await app.inject({ url: `/cases/${id}/report`, headers });
    assert.equal(pdf.statusCode, 200); assert.equal(pdf.rawPayload.subarray(0, 5).toString(), '%PDF-');
    const cors = await app.inject({ method: 'OPTIONS', url: `/cases/${id}/analyze`, headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
    assert.equal(cors.statusCode, 204); assert.equal(cors.headers['access-control-allow-origin'], 'http://localhost:5173');
    const evil = await app.inject({ url: '/health', headers: { origin: 'https://evil.invalid' } });
    assert.equal(evil.headers['access-control-allow-origin'], undefined);
  } finally { await app.close(); rmSync(f.root, { recursive: true, force: true }); }
});
test('modo produção recusa configuração local e chaves não escapam da pasta privada', async () => {
  assert.throws(() => configuration.parse({ APP_ENV: 'production', DEMO_API_TOKEN: 'token-apenas-local-123456789' }));
  const f = await fixture();
  try { await assert.rejects(() => f.objects.get('../secret.pdf')); }
  finally { await f.close(); }
});
test('readiness informa falha sem expor detalhes internos', async () => {
  const app = buildApp({ tokens: { 'token-local-ready-123456789': 'a' }, ready: async () => { throw new Error('segredo de conexão'); } });
  try { const r = await app.inject('/ready'); assert.equal(r.statusCode, 503); assert.equal(r.body.includes('segredo'), false); } finally { await app.close(); }
});
test('PDF expirado é excluído e pode ser regenerado sem repetir análise', async () => {
  const f = await fixture();
  try {
    const c = await f.repository.create('a', input); const submitted = await f.queue.enqueue(c.case.id, 'a');
    await workOnce(f.queue, f.objects);
    const oldKey = await f.queue.reportKey(c.case.id, 'a');
    assert.ok((await f.queue.get(submitted.id, 'a')).reportExpiresAt);
    await f.db.query('UPDATE report_objects SET expires_at=0 WHERE case_id=$1', [c.case.id]);
    await assert.rejects(() => f.queue.reportKey(c.case.id, 'a'));
    assert.equal(await f.queue.cleanExpired(f.objects), 1);
    await assert.rejects(() => f.objects.get(oldKey));
    assert.equal((await f.queue.enqueue(c.case.id, 'a')).status, 'queued');
    await workOnce(f.queue, f.objects, { analyze() { throw new Error('Não deve analisar novamente.'); } });
    assert.equal((await f.queue.get(submitted.id, 'a')).status, 'completed');
    assert.notEqual(await f.queue.reportKey(c.case.id, 'a'), oldKey);
  } finally { await f.close(); }
});
test('texto integral dos anexos é descartado ao concluir e também por expiração sem análise', async () => {
  const f = await fixture();
  try {
    const c = await f.repository.create('a', input);
    registerDocument(c, { name: 'ficticio.txt', kind: 'outro', mimeType: 'text/plain', text: 'CONTEÚDO FICTÍCIO A DESCARTAR' });
    await f.repository.save(c, 'a', 'document.registered');
    await f.queue.enqueue(c.case.id, 'a'); await workOnce(f.queue, f.objects);
    const doc = (await f.repository.get(c.case.id, 'a')).documents[0]!;
    assert.equal(doc.text, ''); assert.deepEqual(doc.pages, []); assert.ok(doc.purgedAt);
    const abandoned = await f.repository.create('b', input);
    registerDocument(abandoned, { name: 'ficticio.txt', kind: 'outro', mimeType: 'text/plain', text: 'OUTRO CONTEÚDO A DESCARTAR' });
    await f.repository.save(abandoned, 'b', 'document.registered');
    await f.db.query('UPDATE text_document_expiries SET expires_at=0 WHERE case_id=$1', [abandoned.case.id]);
    await f.queue.cleanExpired(f.objects);
    assert.equal((await f.repository.get(abandoned.case.id, 'b')).documents[0]?.text, '');
  } finally { await f.close(); }
});
