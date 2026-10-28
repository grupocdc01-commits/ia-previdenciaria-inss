import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain.ts';
import type { Analysis, CaseInput, CaseState } from '../domain.ts';
import type { Sql } from './database.ts';

type Awaitable<T> = T | Promise<T>;
export interface CaseRepository {
  create(ownerId: string, input: CaseInput): Awaitable<CaseState>;
  get(id: string, ownerId: string): Awaitable<CaseState>;
  save(state: CaseState, ownerId: string, event: string): Awaitable<void>;
  analysis(id: string, ownerId: string): Awaitable<Analysis>;
  saveAnalysis(result: Analysis, ownerId: string): Awaitable<void>;
  close(): Awaitable<void>;
}
export async function getCase(db: Sql, id: string, owner: string) {
  const row = (await db.query('SELECT state FROM cases WHERE id=$1 AND owner_id=$2', [id, owner])).rows[0];
  if (!row) throw new DomainError('Caso não encontrado.', 404);
  return JSON.parse(String(row.state)) as CaseState;
}
export class ServiceRepository implements CaseRepository {
  db: Sql;
  constructor(db: Sql) { this.db = db; }
  async create(ownerId: string, input: CaseInput): Promise<CaseState> {
    const state: CaseState = { case: { ...input, id: randomUUID(), ownerId, createdAt: new Date().toISOString(), revision: 0 }, documents: [], facts: [], messages: [] };
    await this.db.query('INSERT INTO cases(id,owner_id,state) VALUES($1,$2,$3)', [state.case.id, ownerId, JSON.stringify(state)]);
    return state;
  }
  get(id: string, ownerId: string) { return getCase(this.db, id, ownerId); }
  async save(state: CaseState, ownerId: string, event: string) {
    await this.db.transaction(async tx => {
      const current = await getCase(tx, state.case.id, ownerId);
      if (current.case.revision !== state.case.revision) throw new DomainError('Caso alterado por outra solicitação. Atualize antes de salvar.', 409);
      const next = structuredClone(state); next.case.revision += 1;
      const updated = await tx.query('UPDATE cases SET state=$1 WHERE id=$2 AND owner_id=$3 AND state=$4', [JSON.stringify(next), state.case.id, ownerId, JSON.stringify(current)]);
      if (!updated.count) throw new DomainError('Conflito de atualização.', 409);
      await tx.query('DELETE FROM analyses WHERE case_id=$1', [state.case.id]);
      await tx.query('INSERT INTO garbage_objects(object_key,delete_after) SELECT object_key,$1 FROM report_objects WHERE case_id=$2 ON CONFLICT(object_key) DO NOTHING', [Date.now(), state.case.id]);
      await tx.query('DELETE FROM report_objects WHERE case_id=$1', [state.case.id]);
      await tx.query("UPDATE analysis_jobs SET status='cancelled',lease_token=NULL,lease_until=NULL,updated_at=$1 WHERE case_id=$2 AND status IN ('queued','running')", [Date.now(), state.case.id]);
      await tx.query('INSERT INTO service_events VALUES($1,$2,$3,$4)', [randomUUID(), state.case.id, event, Date.now()]);
      if (event === 'document.registered') await tx.query('INSERT INTO text_document_expiries VALUES($1,$2) ON CONFLICT(case_id) DO UPDATE SET expires_at=excluded.expires_at', [state.case.id, Date.now() + 3_600_000]);
      state.case.revision = next.case.revision;
    });
  }
  async analysis(id: string, ownerId: string): Promise<Analysis> {
    const state = await this.get(id, ownerId);
    const row = (await this.db.query('SELECT result FROM analyses WHERE case_id=$1', [id])).rows[0];
    if (!row) throw new DomainError('Análise indisponível ou desatualizada.', 404);
    const analysis = JSON.parse(String(row.result)) as Analysis;
    if (analysis.audit.caseRevision !== state.case.revision) throw new DomainError('Análise desatualizada.', 404);
    return analysis;
  }
  async saveAnalysis(result: Analysis, ownerId: string) {
    await this.db.transaction(async tx => {
      const state = await getCase(tx, result.case_id, ownerId);
      if (state.case.revision !== result.audit.caseRevision) throw new DomainError('Análise desatualizada.', 409);
      await tx.query('INSERT INTO analyses VALUES($1,$2) ON CONFLICT(case_id) DO UPDATE SET result=excluded.result', [result.case_id, JSON.stringify(result)]);
    });
  }
  async consumeQuota(ownerId: string, limit: number, now = Date.now()): Promise<boolean> {
    const window = Math.floor(now / 60_000) * 60_000;
    const result = await this.db.query(`INSERT INTO request_quotas VALUES($1,$2,1) ON CONFLICT(owner_id,window_start) DO UPDATE SET count=request_quotas.count+1 WHERE request_quotas.count<$3 RETURNING count`, [ownerId, window, limit]);
    return result.count > 0;
  }
  close() { return this.db.close(); }
}
