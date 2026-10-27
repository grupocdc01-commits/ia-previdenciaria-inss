import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store } from '../src/storage.ts';
import { LegalLibrary } from '../src/library.ts';

const root = resolve(import.meta.dirname, '..');
const store = new Store(process.env.DATABASE_PATH ?? resolve(root, '.local/development.sqlite'));
try {
  const catalog: unknown = JSON.parse(readFileSync(resolve(root, 'data/library/catalog.json'), 'utf8'));
  const library = new LegalLibrary(store.db, catalog, resolve(root, 'data/legal-sources'));
  const imported = library.importAll('local-import-cli');
  const sources = library.list();
  if (process.argv.includes('--write-manifest')) writeFileSync(resolve(root, 'data/library/index.json'), JSON.stringify({ extractionVersion: 'html-v2', archivedVersions: sources.reduce((n, source) => n + source.versions.length, 0), passages: sources.reduce((n, source) => n + source.versions.reduce((sum, v) => sum + v.passageCount, 0), 0), sources }, null, 2) + '\n');
  console.log(JSON.stringify({ imported, sources, notice: 'Todas as versões novas permanecem draft; nenhuma regra foi ativada.' }, null, 2));
} finally { store.close(); }
