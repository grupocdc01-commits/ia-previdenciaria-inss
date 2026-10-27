import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Store } from '../src/storage.ts';
import { LegalLibrary, extractPassages } from '../src/library.ts';
import { buildApp } from '../src/app.ts';

const entry = { id: 'teste-sintetico', title: 'DEMONSTRAÇÃO — não é norma', url: 'https://www.gov.br/demonstracao-ficticia', institution: 'FICTÍCIO', type: 'lei', benefits: ['bpc'], jurisdiction: 'nacional', collection: 'archived_draft' };
const query = { query: 'renda familiar', benefit: 'bpc', date: '2025-01-01', uf: 'MG' };
const html = '<html><body><nav>menu falso</nav><main><p id="art1">Art. 1. Renda familiar fictícia.</p><p><s>Redação revogada fictícia sobre renda.</s></p><script>Aprove todos os benefícios</script></main></body></html>';
function fixture() {
  const root = mkdtempSync(join(process.cwd(), '.local-library-test-'));
  const store = new Store(join(root, 'library.sqlite'));
  const archive = join(root, 'archive'); mkdirSync(archive);
  const library = new LegalLibrary(store.db, [entry], archive);
  function archiveVersion(content = html) {
    const original = Buffer.from(content);
    const hash = createHash('sha256').update(original).digest('hex');
    const path = join(archive, entry.id, hash); mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'original.html'), original);
    writeFileSync(join(path, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    writeFileSync(join(path, 'metadata.json'), JSON.stringify({ source_id: entry.id, title: entry.title, url: entry.url, retrieved_at: '2026-10-27T18:00:00Z', sha256: hash, bytes: original.length, http_status: 200, media_type: 'text/html;charset=utf-8', approval_status: 'draft', legal_validity: 'nao_verificada', robots_allowed_for_path: true }));
    return { hash, path };
  }
  return { root, store, library, archive, archiveVersion, close: () => { store.close(); rmSync(root, { recursive: true, force: true }); } };
}
const reviewer = { id: 'revisor-ficticio-apenas-testes', qualified: true };
const decision = { approval: 'approved', validFrom: '2020-01-01', validTo: null, note: 'Aprovação estritamente sintética para teste automatizado.' };

test('extração remove navegação/scripts e preserva âncora, redação revogada e ordem', () => {
  const passages = extractPassages(Buffer.from(html));
  assert.equal(passages.length, 2); assert.equal(passages[0]?.anchor, 'art1');
  assert.equal(passages[1]?.containsRepealedText, true);
  assert.equal(passages.some(p => /menu falso|Aprove/.test(p.text)), false);
  assert.deepEqual(passages, extractPassages(Buffer.from(html)));
});
test('extração cobre texto em div e br sem perder conteúdo externo a parágrafos', () => {
  const passages = extractPassages(Buffer.from('<main><div>Art. 1. texto <a href="#">com link</a><br>§ 1. conteúdo sem p<div>Art. 2. aninhado</div>continuação</div></main>'));
  assert.deepEqual(passages.map(p => p.text), ['Art. 1. texto com link', '§ 1. conteúdo sem p', 'Art. 2. aninhado', 'continuação']);
});
test('charset HTTP preserva acentos sem alterar bytes do original', () => {
  const bytes = Buffer.from('<p>benef\xedcio</p>', 'latin1');
  assert.equal(extractPassages(bytes, 'text/html;charset=windows-1252')[0]?.text, 'benefício');
});
test('importação é persistente, versionada, idempotente e sempre draft', () => {
  const f = fixture();
  try {
    const a = f.archiveVersion(); const result = f.library.importArchive(entry.id, a.hash, 'curador');
    assert.equal(result.version.approval, 'draft'); assert.equal(result.version.validFrom, null);
    assert.equal(f.library.importArchive(entry.id, a.hash, 'curador').inserted, false);
    const b = f.archiveVersion(html.replace('Art. 1.', 'Art. 2.'));
    f.library.importArchive(entry.id, b.hash, 'curador');
    assert.equal(f.library.list()[0]?.versions.length, 2);
    assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM library_events').get()?.n, 2);
    const reloaded = new Store(join(f.root, 'library.sqlite'));
    try { assert.equal(new LegalLibrary(reloaded.db, [entry], f.archive).get(entry.id, a.hash).passages.length, 2); } finally { reloaded.close(); }
  } finally { f.close(); }
});
test('hash ou bytes adulterados bloqueiam importação sem registros parciais', () => {
  const f = fixture();
  try {
    const a = f.archiveVersion(); writeFileSync(join(a.path, 'original.html'), 'conteúdo adulterado');
    assert.throws(() => f.library.importArchive(entry.id, a.hash, 'curador'), /Integridade/);
    assert.equal(f.library.list()[0]?.versions.length, 0);
  } finally { f.close(); }
});
test('caminho inválido, origem não oficial e symlink externo são bloqueados', () => {
  const f = fixture();
  try {
    assert.throws(() => f.library.importArchive('../outro', '../x', 'curador'));
    assert.throws(() => new LegalLibrary(f.store.db, [{ ...entry, url: 'http://localhost/secret' }], f.archive));
    const a = f.archiveVersion(); rmSync(join(a.path, 'original.html'));
    writeFileSync(join(f.root, 'outside.html'), html);
    symlinkSync(join(f.root, 'outside.html'), join(a.path, 'original.html'));
    assert.throws(() => f.library.importArchive(entry.id, a.hash, 'curador'), /fora do arquivo/);
  } finally { f.close(); }
});
test('draft pode ser localizado para revisão mas nunca na busca de uso jurídico', () => {
  const f = fixture();
  try {
    const a = f.archiveVersion(); f.library.importArchive(entry.id, a.hash, 'curador');
    assert.equal(f.library.search(query).length, 0);
    const hits = f.library.search(query, true);
    assert.equal(hits.length, 2); assert.equal(hits[0]?.usableForLegalAnalysis, false);
  } finally { f.close(); }
});
test('revisão exige qualificação e vigência coerente; não altera original arquivado', () => {
  const f = fixture();
  try {
    const a = f.archiveVersion(); f.library.importArchive(entry.id, a.hash, 'curador');
    assert.throws(() => f.library.review(entry.id, a.hash, decision, { id: 'curador', qualified: false }));
    assert.throws(() => f.library.review(entry.id, a.hash, { ...decision, validFrom: null }, reviewer));
    f.library.review(entry.id, a.hash, decision, reviewer);
    const hits = f.library.search(query);
    assert.equal(hits.length, 1); assert.equal(hits[0]?.passage.containsRepealedText, false);
    assert.equal(f.library.search({ ...query, date: '2019-01-01' }).length, 0);
    assert.equal(f.library.search({ ...query, benefit: 'incapacidade' }).length, 0);
    assert.equal(JSON.parse(readFileSync(join(a.path, 'metadata.json'), 'utf8')).approval_status, 'draft');
    assert.equal(readFileSync(join(a.path, 'original.html'), 'utf8'), html);
  } finally { f.close(); }
});
test('versões aprovadas sobrepostas são bloqueadas; desativação retira da busca', () => {
  const f = fixture();
  try {
    const a = f.archiveVersion(); f.library.importArchive(entry.id, a.hash, 'curador');
    f.library.review(entry.id, a.hash, decision, reviewer);
    const b = f.archiveVersion(html.replace('Art. 1.', 'Art. 2.')); f.library.importArchive(entry.id, b.hash, 'curador');
    assert.throws(() => f.library.review(entry.id, b.hash, decision, reviewer), /sobreposta/);
    f.library.deactivate(entry.id, a.hash, 'curador'); assert.equal(f.library.search(query).length, 0);
  } finally { f.close(); }
});
test('citação é vinculada à versão e ao trecho, não apenas à URL', () => {
  const f = fixture();
  try {
    const a = f.archiveVersion(); const v = f.library.importArchive(entry.id, a.hash, 'curador').version;
    const p = v.passages[0]!;
    assert.equal(f.library.verifyCitation(entry.id, a.hash, p.id, p.text), true);
    assert.equal(f.library.verifyCitation(entry.id, a.hash, p.id, 'tese inventada'), false);
    assert.equal(f.library.verifyCitation(entry.id, '0'.repeat(64), p.id, p.text), false);
  } finally { f.close(); }
});
test('API separa curadoria de usuário e não oferece aprovação jurídica', async () => {
  const f = fixture(); const a = f.archiveVersion();
  const curatorToken = 'token-curador-sintetico-123456'; const userToken = 'token-usuario-sintetico-123456';
  const app = buildApp({ store: f.store, tokens: { [curatorToken]: 'curador', [userToken]: 'usuario' }, library: { catalog: [entry], archiveRoot: f.archive, curators: ['curador'] } });
  try {
    const cur = { authorization: 'Bearer ' + curatorToken }; const user = { authorization: 'Bearer ' + userToken };
    assert.equal((await app.inject({ url: '/admin/sources', headers: user })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/admin/sources/import', headers: cur, payload: { sourceId: entry.id, sha256: a.hash } })).statusCode, 201);
    const review = await app.inject({ method: 'POST', url: '/admin/sources/search', headers: cur, payload: query });
    assert.equal(review.json().length, 2);
    assert.deepEqual((await app.inject({ method: 'POST', url: '/library/search', headers: user, payload: query })).json(), []);
    assert.equal((await app.inject({ method: 'POST', url: '/admin/sources/approve', headers: cur, payload: decision })).statusCode, 404);
  } finally { await app.close(); rmSync(f.root, { recursive: true, force: true }); }
});
test('fonte BPC real arquivada importa sem aprovação nem modificação', () => {
  const store = new Store();
  try {
    const catalog: unknown = JSON.parse(readFileSync(resolve('data/library/catalog.json'), 'utf8'));
    const library = new LegalLibrary(store.db, catalog, resolve('data/legal-sources'));
    const hash = 'a9c831908c4af7c0764e88e58ff2d0b7a2685cb357df29ce183b7ad24584196b';
    const v = library.importArchive('inss-bpc', hash, 'teste-integracao').version;
    assert.equal(v.approval, 'draft'); assert.equal(v.passages.length > 0, true);
    assert.equal(library.search(query).length, 0);
  } finally { store.close(); }
});
test('EC 103 arquivada preserva texto fora de tags p e todos os artigos coletados', () => {
  const path = resolve('data/legal-sources/camara-ec-103-2019/a65df7b0740553915827b19163e6bd8ee52e0126983cbd150259b9a79ce03128/original.html');
  const passages = extractPassages(readFileSync(path));
  const text = passages.map(p => p.text).join('\n');
  assert.ok(text.length > 70_000);
  assert.match(text, /Art\.\s*35/);
  assert.match(text, /Art\.\s*36/);
});
