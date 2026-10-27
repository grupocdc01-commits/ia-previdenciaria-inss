import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DomainError } from './domain.ts';
import type { Analysis, CaseInput, CaseState } from './domain.ts';

// Banco local. Não é uma substituição de RLS/criptografia de produção.
export class Store {
  db: DatabaseSync;
  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS analyses (case_id TEXT PRIMARY KEY REFERENCES cases(id), result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), kind TEXT NOT NULL, created_at TEXT NOT NULL);`);
  }
  create(ownerId: string, input: CaseInput): CaseState {
    const state: CaseState = { case: { ...input, id: randomUUID(), ownerId, createdAt: new Date().toISOString(), revision: 0 }, documents: [], facts: [], messages: [] };
    this.db.prepare('INSERT INTO cases VALUES (?, ?, ?)').run(state.case.id, ownerId, JSON.stringify(state));
    this.event(state.case.id, 'case.created');
    return state;
  }
  get(id: string, ownerId: string): CaseState {
    const row = this.db.prepare('SELECT state FROM cases WHERE id=? AND owner_id=?').get(id, ownerId);
    if (!row) throw new DomainError('Caso não encontrado.', 404);
    return JSON.parse(String(row.state)) as CaseState;
  }
  save(state: CaseState, ownerId: string, event: string): void {
    this.get(state.case.id, ownerId);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      state.case.revision += 1;
      this.db.prepare('UPDATE cases SET state=? WHERE id=? AND owner_id=?').run(JSON.stringify(state), state.case.id, ownerId);
      this.db.prepare('DELETE FROM analyses WHERE case_id=?').run(state.case.id);
      this.event(state.case.id, event);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  analysis(id: string, ownerId: string): Analysis {
    this.get(id, ownerId);
    const row = this.db.prepare('SELECT result FROM analyses WHERE case_id=?').get(id);
    if (!row) throw new DomainError('Análise indisponível ou desatualizada. Execute a análise novamente.', 404);
    return JSON.parse(String(row.result)) as Analysis;
  }
  saveAnalysis(result: Analysis, ownerId: string): void {
    this.get(result.case_id, ownerId);
    this.db.prepare('INSERT OR REPLACE INTO analyses VALUES (?, ?)').run(result.case_id, JSON.stringify(result));
    this.event(result.case_id, 'analysis.created');
  }
  event(caseId: string, kind: string): void {
    // Eventos não recebem textos de documentos, respostas, nomes ou identificadores pessoais.
    this.db.prepare('INSERT INTO events(case_id,kind,created_at) VALUES (?,?,?)').run(caseId, kind, new Date().toISOString());
  }
  close(): void { this.db.close(); }
}
