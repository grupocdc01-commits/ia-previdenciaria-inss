import { readFileSync, realpathSync, readdirSync, statSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { loadBuffer } from 'cheerio';
import { z } from 'zod';
import { benefitSchema, DomainError, isoDate, ufSchema } from './domain.ts';

export const catalogSchema = z.array(z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1), url: z.url(),
  institution: z.string().min(1), type: z.enum(['constituicao', 'emenda', 'lei', 'decreto', 'orientacao_administrativa']),
  benefits: z.array(benefitSchema).min(1), jurisdiction: z.enum(['nacional', ...ufSchema.options]),
  collection: z.enum(['pending_permission_check', 'archived_draft'])
}).strict());
export type CatalogEntry = z.infer<typeof catalogSchema>[number];
const metadataSchema = z.object({
  source_id: z.string(), title: z.string(), url: z.url(), retrieved_at: z.iso.datetime({ offset: true }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.int().positive().max(5_000_000),
  http_status: z.literal(200), media_type: z.string().regex(/^text\/html/i),
  approval_status: z.literal('draft'), legal_validity: z.literal('nao_verificada'),
  robots_allowed_for_path: z.literal(true)
}).passthrough();
export type Passage = { id: string; ordinal: number; text: string; anchor: string | null; locator: string; containsRepealedText: boolean };
export type LibraryVersion = {
  sourceId: string; sha256: string; metadata: Record<string, unknown>;
  approval: 'draft' | 'approved' | 'rejected'; validFrom: string | null; validTo: string | null;
  reviewer: string | null; reviewNote: string | null; passages: Passage[]; extractionVersion: 'html-v1' | 'html-v2'
};
export const librarySearchSchema = z.object({
  query: z.string().trim().min(2).max(500), benefit: benefitSchema,
  date: isoDate, uf: ufSchema, limit: z.coerce.number().int().min(1).max(50).default(10)
}).strict();
export function extractPassages(bytes: Buffer, mediaType = 'text/html;charset=utf-8'): Passage[] {
  const charset = /charset\s*=\s*["']?([^;"'\s]+)/i.exec(mediaType)?.[1] ?? 'utf-8';
  const $ = loadBuffer(bytes, { encoding: { transportLayerEncodingLabel: charset } });
  $('script, style, nav, header, footer, form, iframe, noscript').remove();
  const specific = $('#parent-fieldname-text').first();
  const main = $('main').first();
  const scope = specific.length ? specific : main.length ? main : $('body');
  const passages: Passage[] = [];
  type HtmlNode = { type: string; data?: string; name?: string; attribs?: Record<string, string>; children?: HtmlNode[] };
  const boundaries = new Set(['p', 'div', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'br', 'hr', 'tr', 'section', 'article', 'ul', 'ol', 'table']);
  let text = ''; let anchor: string | null = null; let repealed = false;
  const flush = () => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized) {
      const ordinal = passages.length + 1;
      const id = createHash('sha256').update(`${ordinal}\0${normalized}`).digest('hex');
      passages.push({ id, ordinal, text: normalized, anchor, locator: `html-v2:block:${ordinal}`, containsRepealedText: repealed });
    }
    text = ''; anchor = null; repealed = false;
  };
  const visit = (node: HtmlNode, inheritedAnchor: string | null = null, inheritedRepeal = false) => {
    if (node.type === 'text') {
      if (!text.trim()) anchor = inheritedAnchor;
      text += node.data ?? '';
      repealed ||= inheritedRepeal;
      return;
    }
    const tag = node.name ?? '';
    const block = boundaries.has(tag);
    if (block) flush();
    const localAnchor = node.attribs?.id || node.attribs?.name || inheritedAnchor;
    if (localAnchor && !text.trim()) anchor = localAnchor;
    const localRepeal = inheritedRepeal || ['s', 'strike', 'del'].includes(tag);
    for (const child of node.children ?? []) visit(child, localAnchor, localRepeal);
    if (block) flush();
  };
  for (const node of scope.toArray()) visit(node);
  flush();
  if (!passages.length || passages.length > 20_000) throw new DomainError('Conteúdo HTML vazio ou com excesso de trechos.');
  return passages;
}
function safeFile(root: string, path: string): Buffer {
  let base: string; let target: string;
  try { base = realpathSync(root); target = realpathSync(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new DomainError('Arquivo de fonte não encontrado.', 404);
    throw error;
  }
  const rel = relative(base, target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new DomainError('Caminho fora do arquivo de fontes.');
  if (!statSync(target).isFile() || statSync(target).size > 5_000_000) throw new DomainError('Arquivo inválido ou maior que 5 MB.');
  return readFileSync(target);
}
export class LegalLibrary {
  db: DatabaseSync;
  catalog: CatalogEntry[];
  archiveRoot: string;
  constructor(db: DatabaseSync, catalog: unknown, archiveRoot: string) {
    this.db = db; this.catalog = catalogSchema.parse(catalog); this.archiveRoot = archiveRoot;
    for (const entry of this.catalog) {
      const url = new URL(entry.url);
      if (url.protocol !== 'https:' || url.username || url.password || !['www.gov.br', 'www.planalto.gov.br', 'www2.camara.leg.br'].includes(url.hostname)) throw new DomainError('Origem fora dos portais oficiais configurados.');
    }
    if (new Set(this.catalog.map(s => s.id)).size !== this.catalog.length) throw new DomainError('Identificadores duplicados no catálogo.');
    this.db.exec(`CREATE TABLE IF NOT EXISTS legal_sources (id TEXT PRIMARY KEY, record TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS source_versions (source_id TEXT NOT NULL REFERENCES legal_sources(id), sha256 TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(source_id,sha256));
      CREATE TABLE IF NOT EXISTS legal_passages (source_id TEXT NOT NULL, sha256 TEXT NOT NULL, id TEXT NOT NULL, text TEXT NOT NULL, PRIMARY KEY(source_id,sha256,id), FOREIGN KEY(source_id,sha256) REFERENCES source_versions(source_id,sha256));
      CREATE TABLE IF NOT EXISTS library_events (id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, sha256 TEXT NOT NULL, actor TEXT NOT NULL, event TEXT NOT NULL, created_at TEXT NOT NULL);`);
    for (const entry of this.catalog) this.db.prepare('INSERT INTO legal_sources VALUES (?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record').run(entry.id, JSON.stringify(entry));
  }
  list() {
    return this.catalog.map(entry => ({ ...entry, versions: (this.db.prepare('SELECT sha256,record FROM source_versions WHERE source_id=? ORDER BY sha256').all(entry.id)).map(row => {
      const version = JSON.parse(String(row.record)) as LibraryVersion;
      return { sha256: row.sha256, approval: version.approval, passageCount: version.passages.length, retrievedAt: version.metadata.retrieved_at };
    }) }));
  }
  get(sourceId: string, sha256: string): LibraryVersion {
    const row = this.db.prepare('SELECT record FROM source_versions WHERE source_id=? AND sha256=?').get(sourceId, sha256);
    if (!row) throw new DomainError('Versão não encontrada.', 404);
    return JSON.parse(String(row.record)) as LibraryVersion;
  }
  importArchive(sourceId: string, sha256: string, actor: string): { version: LibraryVersion; inserted: boolean; reindexed: boolean } {
    const entry = this.catalog.find(s => s.id === sourceId);
    if (!entry || !/^[a-f0-9]{64}$/.test(sha256)) throw new DomainError('Fonte ou hash inválido.');
    const directory = join(this.archiveRoot, entry.id, sha256);
    const metadata = metadataSchema.parse(JSON.parse(safeFile(this.archiveRoot, join(directory, 'metadata.json')).toString('utf8')));
    const original = safeFile(this.archiveRoot, join(directory, 'original.html'));
    const robots = safeFile(this.archiveRoot, join(directory, 'robots.txt'));
    if (!robots.length || metadata.source_id !== entry.id || metadata.url !== entry.url || metadata.sha256 !== sha256 || original.length !== metadata.bytes || createHash('sha256').update(original).digest('hex') !== sha256) throw new DomainError('Integridade ou proveniência da fonte inválida.');
    const stored = this.db.prepare('SELECT 1 FROM source_versions WHERE source_id=? AND sha256=?').get(sourceId, sha256);
    if (stored) {
      const previous = this.get(sourceId, sha256);
      if (previous.extractionVersion === 'html-v2') return { version: previous, inserted: false, reindexed: false };
      if (previous.approval !== 'draft') throw new DomainError('Reindexação de versão já revisada exige migração explícita.', 409);
    }
    const version: LibraryVersion = { sourceId, sha256, metadata, approval: 'draft', validFrom: null, validTo: null, reviewer: null, reviewNote: null, passages: extractPassages(original, metadata.media_type), extractionVersion: 'html-v2' };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (stored) {
        this.db.prepare('DELETE FROM legal_passages WHERE source_id=? AND sha256=?').run(sourceId, sha256);
        this.db.prepare('UPDATE source_versions SET record=? WHERE source_id=? AND sha256=?').run(JSON.stringify(version), sourceId, sha256);
      } else this.db.prepare('INSERT INTO source_versions VALUES (?,?,?)').run(sourceId, sha256, JSON.stringify(version));
      for (const p of version.passages) this.db.prepare('INSERT INTO legal_passages VALUES (?,?,?,?)').run(sourceId, sha256, p.id, p.text);
      this.event(sourceId, sha256, actor, stored ? 'version.reindexed.draft' : 'version.imported.draft');
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return { version, inserted: !stored, reindexed: Boolean(stored) };
  }
  importAll(actor: string) {
    const results: { sourceId: string; sha256: string; inserted: boolean; passages: number }[] = [];
    for (const entry of this.catalog) {
      let hashes: string[];
      try { hashes = readdirSync(join(this.archiveRoot, entry.id)); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
      for (const hash of hashes.sort().filter(hash => /^[a-f0-9]{64}$/.test(hash))) {
        const result = this.importArchive(entry.id, hash, actor);
        results.push({ sourceId: entry.id, sha256: hash, inserted: result.inserted, passages: result.version.passages.length });
      }
    }
    return results;
  }
  review(sourceId: string, sha256: string, input: unknown, reviewer: { id: string; qualified: boolean }) {
    if (!reviewer.qualified || !reviewer.id.trim()) throw new DomainError('Revisão exige profissional qualificado configurado.', 403);
    const decision = z.object({ approval: z.enum(['approved', 'rejected']), validFrom: isoDate.nullable(), validTo: isoDate.nullable(), note: z.string().trim().min(20).max(5000) }).strict().parse(input);
    if (decision.approval === 'approved' && (!decision.validFrom || decision.validTo && decision.validTo < decision.validFrom)) throw new DomainError('Aprovação exige vigência validada e coerente.');
    const version = this.get(sourceId, sha256);
    if (version.approval !== 'draft') throw new DomainError('Decisão já registrada; use desativação para retirar aprovação.', 409);
    if (decision.approval === 'approved') {
      const others = this.db.prepare('SELECT record FROM source_versions WHERE source_id=? AND sha256<>?').all(sourceId, sha256);
      if (others.some(row => {
        const other = JSON.parse(String(row.record)) as LibraryVersion;
        return other.approval === 'approved' && other.validFrom !== null && (decision.validTo === null || other.validFrom <= decision.validTo) && (other.validTo === null || decision.validFrom! <= other.validTo);
      })) throw new DomainError('Há outra versão aprovada com vigência sobreposta; revise os períodos antes da aprovação.', 409);
    }
    Object.assign(version, { approval: decision.approval, validFrom: decision.validFrom, validTo: decision.validTo, reviewer: reviewer.id, reviewNote: decision.note });
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE source_versions SET record=? WHERE source_id=? AND sha256=?').run(JSON.stringify(version), sourceId, sha256);
      this.event(sourceId, sha256, reviewer.id, 'version.' + decision.approval);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return version;
  }
  deactivate(sourceId: string, sha256: string, actor: string) {
    const version = this.get(sourceId, sha256);
    version.approval = 'rejected';
    this.db.prepare('UPDATE source_versions SET record=? WHERE source_id=? AND sha256=?').run(JSON.stringify(version), sourceId, sha256);
    this.event(sourceId, sha256, actor, 'version.deactivated');
  }
  search(input: unknown, forReview = false) {
    const options = librarySearchSchema.parse(input);
    const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
    const terms = [...new Set(normalize(options.query).match(/[a-z0-9]+/g) ?? [])];
    const results: { sourceId: string; sha256: string; title: string; url: string; passage: Passage; approval: string; usableForLegalAnalysis: boolean; score: number }[] = [];
    for (const row of this.db.prepare('SELECT record FROM source_versions').all()) {
      const v = JSON.parse(String(row.record)) as LibraryVersion;
      const source = this.catalog.find(s => s.id === v.sourceId);
      if (!source || !source.benefits.includes(options.benefit) || source.jurisdiction !== 'nacional' && source.jurisdiction !== options.uf) continue;
      const eligible = v.approval === 'approved' && v.validFrom !== null && v.validFrom <= options.date && (v.validTo === null || v.validTo >= options.date);
      if (!forReview && !eligible || forReview && v.approval === 'rejected') continue;
      for (const p of v.passages) {
        if (!forReview && p.containsRepealedText) continue;
        const words = new Set(normalize(p.text).match(/[a-z0-9]+/g) ?? []);
        const score = terms.filter(term => words.has(term)).length / Math.max(1, terms.length);
        if (score > 0) results.push({ sourceId: v.sourceId, sha256: v.sha256, title: source.title, url: source.url, passage: p, approval: v.approval, usableForLegalAnalysis: eligible && !p.containsRepealedText, score });
      }
    }
    return results.sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId) || a.sha256.localeCompare(b.sha256) || a.passage.ordinal - b.passage.ordinal).slice(0, options.limit);
  }
  verifyCitation(sourceId: string, hash: string, passageId: string, quote: string): boolean {
    if (!quote.trim()) return false;
    try { return this.get(sourceId, hash).passages.some(p => p.id === passageId && p.text.includes(quote)); } catch (error) { if (error instanceof DomainError && error.statusCode === 404) return false; throw error; }
  }
  private event(sourceId: string, hash: string, actor: string, event: string) {
    this.db.prepare('INSERT INTO library_events(source_id,sha256,actor,event,created_at) VALUES(?,?,?,?,?)').run(sourceId, hash, actor, event, new Date().toISOString());
  }
}
