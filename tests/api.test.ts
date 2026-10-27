import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from '../src/app.ts';
import { Store } from '../src/storage.ts';

const token = 'demo-token-usuario-um-123456789';
const other = 'demo-token-usuario-dois-123456';
const headers = { authorization: 'Bearer ' + token };
const input = { benefit: 'bpc', subtype: 'pessoa_com_deficiencia', uf: 'MG', der: '2025-01-10', denialReason: 'Renda familiar fictícia', syntheticData: true, consent: true };
const payload = { name: 'carta-ficticia.txt', mimeType: 'text/plain', kind: 'carta_indeferimento', text: 'DOCUMENTO FICTÍCIO\nRenda familiar: 1000 fictícios' };
function app() { return buildApp({ tokens: { [token]: 'owner-a', [other]: 'owner-b' } }); }

test('API exige autenticação; health anuncia limites sem expor dados', async () => {
  const api = app();
  try {
    assert.equal((await api.inject('/health')).json().realLegalAnalysisEnabled, false);
    assert.equal((await api.inject({ method: 'POST', url: '/cases', payload: input })).statusCode, 401);
  } finally { await api.close(); }
});
test('fluxo completo retorna indeterminado, análise versionada e PDF', async () => {
  const api = app();
  try {
    const created = await api.inject({ method: 'POST', url: '/cases', headers, payload: input });
    assert.equal(created.statusCode, 201); const id = created.json().case.id as string;
    const upload = await api.inject({ method: 'POST', url: `/cases/${id}/documents`, headers, payload });
    assert.equal(upload.statusCode, 201); const factId = upload.json().candidateFacts[0].id as string;
    const repeated = await api.inject({ method: 'POST', url: `/cases/${id}/documents`, headers, payload });
    assert.equal(repeated.statusCode, 200); assert.equal(repeated.json().candidateFacts.length, 1);
    const confirmed = await api.inject({ method: 'POST', url: `/cases/${id}/facts/${factId}/confirm`, headers, payload: { confirmed: true } });
    assert.equal(confirmed.statusCode, 200);
    const answer = await api.inject({ method: 'POST', url: `/cases/${id}/interview/messages`, headers, payload: { field: 'composicao_familiar', answer: 'Duas pessoas fictícias' } });
    assert.equal(answer.statusCode, 200);
    const analyzed = await api.inject({ method: 'POST', url: `/cases/${id}/analyze`, headers, payload: {} });
    assert.equal(analyzed.statusCode, 200);
    const analysis = analyzed.json();
    assert.equal(analysis.status, 'indeterminado'); assert.equal(analysis.fatos_comprovados.length, 1); assert.equal(analysis.fatos_declarados.length, 1);
    assert.equal(analysis.audit.model, 'mock-local-v1'); assert.equal(analysis.regras_executadas[0].result, 'indeterminado');
    const stored = await api.inject({ url: `/cases/${id}/analysis`, headers });
    assert.equal(stored.json().id, analysis.id);
    const pdf = await api.inject({ url: `/cases/${id}/report`, headers });
    assert.equal(pdf.statusCode, 200); assert.match(pdf.headers['content-type']!, /application\/pdf/); assert.equal(pdf.rawPayload.subarray(0, 5).toString(), '%PDF-');
    assert.equal(pdf.headers['cache-control'], 'no-store');
  } finally { await api.close(); }
});
test('outro usuário não pode ler, analisar, enviar documento ou baixar relatório', async () => {
  const api = app();
  try {
    const id = (await api.inject({ method: 'POST', url: '/cases', headers, payload: input })).json().case.id;
    const otherHeaders = { authorization: 'Bearer ' + other };
    for (const [method, path, data] of [['GET', '', undefined], ['GET', '/analysis', undefined], ['GET', '/report', undefined], ['POST', '/documents', payload], ['POST', '/analyze', {}]] as const) {
      const response = await api.inject({ method, url: `/cases/${id}${path}`, headers: otherHeaders, ...(data ? { payload: data } : {}) });
      assert.equal(response.statusCode, 404);
    }
  } finally { await api.close(); }
});
test('novas evidências invalidam análise e relatório anteriores', async () => {
  const api = app();
  try {
    const id = (await api.inject({ method: 'POST', url: '/cases', headers, payload: input })).json().case.id;
    await api.inject({ method: 'POST', url: `/cases/${id}/analyze`, headers, payload: {} });
    await api.inject({ method: 'POST', url: `/cases/${id}/documents`, headers, payload });
    assert.equal((await api.inject({ url: `/cases/${id}/analysis`, headers })).statusCode, 404);
    assert.equal((await api.inject({ url: `/cases/${id}/report`, headers })).statusCode, 404);
  } finally { await api.close(); }
});
test('modo real, campos não reconhecidos e corpo excessivo são bloqueados', async () => {
  const api = app();
  try {
    const id = (await api.inject({ method: 'POST', url: '/cases', headers, payload: input })).json().case.id;
    assert.equal((await api.inject({ method: 'POST', url: `/cases/${id}/analyze`, headers, payload: { mode: 'real' } })).statusCode, 400);
    assert.equal((await api.inject({ method: 'POST', url: '/cases', headers, payload: { ...input, ownerId: 'owner-b' } })).statusCode, 400);
    assert.equal((await api.inject({ method: 'POST', url: `/cases/${id}/documents`, headers, payload: { ...payload, text: 'x'.repeat(160_000) } })).statusCode, 413);
  } finally { await api.close(); }
});
test('SQLite conserva caso, análise e eventos ao reabrir o banco', async () => {
  const directory = mkdtempSync(join(process.cwd(), '.local-test-'));
  const path = join(directory, 'test.sqlite');
  let api = buildApp({ store: new Store(path), tokens: { [token]: 'owner-a' } });
  try {
    const id = (await api.inject({ method: 'POST', url: '/cases', headers, payload: input })).json().case.id;
    await api.inject({ method: 'POST', url: `/cases/${id}/analyze`, headers, payload: {} });
    await api.close();
    const store = new Store(path);
    api = buildApp({ store, tokens: { [token]: 'owner-a' } });
    assert.equal((await api.inject({ url: `/cases/${id}/analysis`, headers })).statusCode, 200);
    assert.equal(store.db.prepare('SELECT count(*) AS count FROM events').get()?.count, 2);
    assert.equal((await api.inject({ url: `/cases/${id}`, headers })).json().case.benefit, 'bpc');
  } finally { await api.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('atualização parcial preserva campos omitidos e invalida análise', async () => {
  const api = app();
  try {
    const id = (await api.inject({ method: 'POST', url: '/cases', headers, payload: input })).json().case.id;
    await api.inject({ method: 'POST', url: `/cases/${id}/analyze`, headers, payload: {} });
    const response = await api.inject({ method: 'PATCH', url: `/cases/${id}`, headers, payload: { noticeDate: '2025-02-10' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().case.der, input.der);
    assert.equal(response.json().case.subtype, input.subtype);
    assert.equal(response.json().case.denialReason, input.denialReason);
    assert.equal((await api.inject({ url: `/cases/${id}/analysis`, headers })).statusCode, 404);
  } finally { await api.close(); }
});
