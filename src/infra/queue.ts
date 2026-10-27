import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain.ts';
import type { Analysis } from '../domain.ts';
import { getCase } from './repository.ts';
import type { Sql, Row } from './database.ts';
import type { PrivateObjects } from './objects.ts';

export type Job = { id: string; caseId: string; ownerId: string; revision: number; status: string; attempts: number; leaseToken: string | null; createdAt: number; updatedAt: number; errorCode: string | null; reportExpiresAt: number | null };
function job(row: Row): Job { return { id: String(row.id), caseId: String(row.case_id), ownerId: String(row.owner_id), revision: Number(row.revision), status: String(row.status), attempts: Number(row.attempts), leaseToken: row.lease_token === null ? null : String(row.lease_token), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at), errorCode: row.error_code === null ? null : String(row.error_code), reportExpiresAt: row.report_expires_at == null ? null : Number(row.report_expires_at) }; }
export function publicJob(value: Job) {
  const { ownerId: _owner, leaseToken: _lease, ...result } = value;
  return { ...result, pollAfterMs: value.status === 'queued' || value.status === 'running' ? 2000 : null };
}
export class AnalysisQueue {
  db: Sql;
  maxAttempts = 3;
  leaseMs: number;
  reportTtlMs: number;
  constructor(db: Sql, leaseMs = 60_000, reportTtlMs = 3_600_000) { this.db = db; this.leaseMs = leaseMs; this.reportTtlMs = reportTtlMs; }
  async enqueue(caseId: string, ownerId: string, maxOutstanding = 3): Promise<Job> {
    return this.db.transaction(async tx => {
      if (tx.dialect === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [ownerId]);
      // Bloqueio de linha serializa submissões e atualizações concorrentes deste caso.
      if (tx.dialect === 'postgres') await tx.query('SELECT id FROM cases WHERE id=$1 AND owner_id=$2 FOR UPDATE', [caseId, ownerId]);
      const state = await getCase(tx, caseId, ownerId);
      const existing = (await tx.query('SELECT * FROM analysis_jobs WHERE case_id=$1 AND revision=$2', [caseId, state.case.revision])).rows[0];
      if (existing) {
        const report = (await tx.query('SELECT expires_at FROM report_objects WHERE case_id=$1 AND revision=$2', [caseId, state.case.revision])).rows[0];
        if (existing.status === 'completed' && (!report || report.expires_at !== null && Number(report.expires_at) <= Date.now())) {
          await tx.query("UPDATE analysis_jobs SET status='queued',attempts=0,available_at=$1,updated_at=$1,error_code=NULL WHERE id=$2", [Date.now(), existing.id]);
          return job((await tx.query('SELECT * FROM analysis_jobs WHERE id=$1', [existing.id])).rows[0]!);
        }
        return job(existing);
      }
      const active = (await tx.query("SELECT COUNT(*) AS count FROM analysis_jobs WHERE owner_id=$1 AND status IN ('queued','running')", [ownerId])).rows[0];
      if (Number(active?.count) >= maxOutstanding) throw new DomainError('Você já tem análises em andamento. Aguarde a conclusão.', 429);
      const now = Date.now(); const id = randomUUID();
      await tx.query("INSERT INTO analysis_jobs(id,case_id,owner_id,revision,status,available_at,created_at,updated_at) VALUES($1,$2,$3,$4,'queued',$5,$5,$5) ON CONFLICT(case_id,revision) DO NOTHING", [id, caseId, ownerId, state.case.revision, now]);
      return job((await tx.query('SELECT * FROM analysis_jobs WHERE case_id=$1 AND revision=$2', [caseId, state.case.revision])).rows[0]!);
    });
  }
  async get(id: string, ownerId: string) {
    const row = (await this.db.query('SELECT j.*,r.expires_at AS report_expires_at FROM analysis_jobs j LEFT JOIN report_objects r ON r.case_id=j.case_id AND r.revision=j.revision WHERE j.id=$1 AND j.owner_id=$2', [id, ownerId])).rows[0];
    if (!row) throw new DomainError('Processamento não encontrado.', 404);
    return job(row);
  }
  async claim(now = Date.now()): Promise<Job | null> {
    return this.db.transaction(async tx => {
      await tx.query("UPDATE analysis_jobs SET status='failed',error_code='RETRY_LIMIT',lease_token=NULL,lease_until=NULL,updated_at=$1 WHERE status='running' AND lease_until<$1 AND attempts>=$2", [now, this.maxAttempts]);
      const lock = tx.dialect === 'postgres' ? ' FOR UPDATE SKIP LOCKED' : '';
      const row = (await tx.query(`SELECT * FROM analysis_jobs WHERE attempts<$1 AND ((status='queued' AND available_at<=$2) OR (status='running' AND lease_until<$2)) ORDER BY available_at,created_at,id LIMIT 1${lock}`, [this.maxAttempts, now])).rows[0];
      if (!row) return null;
      const token = randomUUID();
      await tx.query("UPDATE analysis_jobs SET status='running',attempts=attempts+1,lease_token=$1,lease_until=$2,updated_at=$3,error_code=NULL WHERE id=$4", [token, now + this.leaseMs, now, row.id]);
      return job((await tx.query('SELECT * FROM analysis_jobs WHERE id=$1', [row.id])).rows[0]!);
    });
  }
  async heartbeat(value: Job) {
    return (await this.db.query("UPDATE analysis_jobs SET lease_until=$1 WHERE id=$2 AND status='running' AND lease_token=$3", [Date.now() + this.leaseMs, value.id, value.leaseToken])).count > 0;
  }
  async complete(value: Job, analysis: Analysis, objectKey: string) {
    return this.db.transaction(async tx => {
      if (tx.dialect === 'postgres') await tx.query('SELECT id FROM cases WHERE id=$1 FOR UPDATE', [value.caseId]);
      const state = await getCase(tx, value.caseId, value.ownerId);
      const lease = (await tx.query("SELECT id FROM analysis_jobs WHERE id=$1 AND status='running' AND lease_token=$2 AND lease_until>=$3" + (tx.dialect === 'postgres' ? ' FOR UPDATE' : ''), [value.id, value.leaseToken, Date.now()])).rows[0];
      if (!lease || state.case.revision !== value.revision || analysis.audit.caseRevision !== value.revision) return false;
      await tx.query('INSERT INTO analyses VALUES($1,$2) ON CONFLICT(case_id) DO UPDATE SET result=excluded.result', [value.caseId, JSON.stringify(analysis)]);
      await tx.query('INSERT INTO garbage_objects(object_key,delete_after) SELECT object_key,$1 FROM report_objects WHERE case_id=$2 AND object_key<>$3 ON CONFLICT(object_key) DO NOTHING', [Date.now(), value.caseId, objectKey]);
      await tx.query('INSERT INTO report_objects(case_id,revision,object_key,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(case_id) DO UPDATE SET revision=excluded.revision,object_key=excluded.object_key,expires_at=excluded.expires_at', [value.caseId, value.revision, objectKey, Date.now() + this.reportTtlMs]);
      await tx.query('DELETE FROM garbage_objects WHERE object_key=$1', [objectKey]);
      // O arquivo e seu texto integral não ficam no cadastro após a análise.
      for (const document of state.documents) {
        document.text = ''; document.pages = []; document.purgedAt = new Date().toISOString();
      }
      await tx.query('UPDATE cases SET state=$1 WHERE id=$2', [JSON.stringify(state), value.caseId]);
      await tx.query('INSERT INTO garbage_objects(object_key,delete_after) SELECT object_key,$1 FROM temporary_uploads WHERE case_id=$2 ON CONFLICT(object_key) DO NOTHING', [Date.now(), value.caseId]);
      await tx.query('DELETE FROM temporary_uploads WHERE case_id=$1', [value.caseId]);
      await tx.query('DELETE FROM text_document_expiries WHERE case_id=$1', [value.caseId]);
      await tx.query("UPDATE analysis_jobs SET status='completed',lease_token=NULL,lease_until=NULL,updated_at=$1 WHERE id=$2 AND lease_token=$3", [Date.now(), value.id, value.leaseToken]);
      return true;
    });
  }
  async fail(value: Job) {
    const exhausted = value.attempts >= this.maxAttempts;
    await this.db.query(`UPDATE analysis_jobs SET status=$1,available_at=$2,updated_at=$3,lease_token=NULL,lease_until=NULL,error_code='PROCESSING_FAILED' WHERE id=$4 AND lease_token=$5 AND status='running'`, [exhausted ? 'failed' : 'queued', Date.now() + Math.min(30_000, 1000 * 2 ** value.attempts), Date.now(), value.id, value.leaseToken]);
  }
  async reportKey(caseId: string, ownerId: string) {
    const state = await getCase(this.db, caseId, ownerId);
    const row = (await this.db.query('SELECT object_key FROM report_objects WHERE case_id=$1 AND revision=$2 AND (expires_at IS NULL OR expires_at>$3)', [caseId, state.case.revision, Date.now()])).rows[0];
    if (!row) throw new DomainError('Relatório ainda indisponível.', 404);
    return String(row.object_key);
  }
  async reserveTemporaryObject(key: string) {
    await this.db.query('INSERT INTO garbage_objects VALUES($1,$2) ON CONFLICT(object_key) DO NOTHING', [key, Date.now() + this.reportTtlMs]);
  }
  async registerUpload(caseId: string, ownerId: string, key: string) {
    await this.db.transaction(async tx => {
      if (tx.dialect === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [ownerId]);
      await getCase(tx, caseId, ownerId);
      const perCase = (await tx.query('SELECT COUNT(*) AS n FROM temporary_uploads WHERE case_id=$1', [caseId])).rows[0];
      const perOwner = (await tx.query('SELECT COUNT(*) AS n FROM temporary_uploads u JOIN cases c ON c.id=u.case_id WHERE c.owner_id=$1', [ownerId])).rows[0];
      if (Number(perCase?.n) >= 10 || Number(perOwner?.n) >= 30) throw new DomainError('Limite de anexos temporários atingido.', 429);
      await tx.query('INSERT INTO temporary_uploads VALUES($1,$2,$3)', [key, caseId, Date.now() + 3_600_000]);
    });
  }
  async cleanExpired(objects: PrivateObjects, now = Date.now()) {
    await this.db.transaction(async tx => {
      await tx.query('INSERT INTO garbage_objects(object_key,delete_after) SELECT object_key,$1 FROM temporary_uploads WHERE expires_at<=$1 ON CONFLICT(object_key) DO NOTHING', [now]);
      await tx.query('DELETE FROM temporary_uploads WHERE expires_at<=$1', [now]);
      const expiredCases = (await tx.query('SELECT c.id,c.state FROM cases c JOIN text_document_expiries e ON e.case_id=c.id WHERE e.expires_at<=$1' + (tx.dialect === 'postgres' ? ' FOR UPDATE OF c SKIP LOCKED' : ''), [now])).rows;
      for (const row of expiredCases) {
        const state = JSON.parse(String(row.state)) as import('../domain.ts').CaseState;
        for (const document of state.documents) { document.text = ''; document.pages = []; document.purgedAt = new Date(now).toISOString(); }
        await tx.query('UPDATE cases SET state=$1 WHERE id=$2', [JSON.stringify(state), row.id]);
        await tx.query('DELETE FROM text_document_expiries WHERE case_id=$1', [row.id]);
      }
      const rows = (await tx.query('SELECT case_id,object_key FROM report_objects WHERE expires_at<=$1' + (tx.dialect === 'postgres' ? ' FOR UPDATE SKIP LOCKED' : ''), [now])).rows;
      for (const row of rows) {
        await tx.query('INSERT INTO garbage_objects VALUES($1,$2) ON CONFLICT(object_key) DO NOTHING', [row.object_key, now]);
        await tx.query('DELETE FROM report_objects WHERE case_id=$1 AND object_key=$2', [row.case_id, row.object_key]);
      }
      await tx.query('DELETE FROM request_quotas WHERE window_start<$1', [now - 120_000]);
    });
    const pending = (await this.db.query('SELECT object_key FROM garbage_objects WHERE delete_after<=$1 LIMIT 100', [now])).rows;
    let deleted = 0;
    for (const row of pending) {
      try { await objects.delete(String(row.object_key)); await this.db.query('DELETE FROM garbage_objects WHERE object_key=$1', [row.object_key]); deleted++; }
      catch { /* Mantém pendência para tentar no próximo ciclo, sem expor dados. */ }
    }
    return deleted;
  }
}
