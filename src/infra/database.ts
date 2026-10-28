import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

export type Row = Record<string, unknown>;
export interface Sql {
  dialect: 'sqlite' | 'postgres';
  query(sql: string, values?: unknown[]): Promise<{ rows: Row[]; count: number }>;
  transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export class SqliteDatabase implements Sql {
  dialect = 'sqlite' as const;
  db: DatabaseSync;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  }
  private run(sql: string, values: unknown[] = []) {
    const args: (string | number | null)[] = [];
    const statement = this.db.prepare(sql.replace(/\$(\d+)/g, (_match, n: string) => {
      args.push(values[Number(n) - 1] as string | number | null); return '?';
    }));
    if (statement.columns().length) { const rows = statement.all(...args) as Row[]; return { rows, count: rows.length }; }
    const result = statement.run(...args); return { rows: [], count: Number(result.changes) };
  }
  private exclusive<T>(work: () => Promise<T> | T): Promise<T> {
    const result = this.tail.then(work); this.tail = result.catch(() => {}); return result;
  }
  query(sql: string, values?: unknown[]) { return this.exclusive(() => this.run(sql, values)); }
  transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      this.db.exec('BEGIN IMMEDIATE');
      const scoped: Sql = { dialect: this.dialect, query: async (sql, args) => this.run(sql, args), transaction: async () => { throw new Error('Transação aninhada não permitida.'); }, close: async () => {} };
      try { const result = await work(scoped); this.db.exec('COMMIT'); return result; }
      catch (error) { this.db.exec('ROLLBACK'); throw error; }
    });
  }
  async close() { await this.tail; this.db.close(); }
}
export class PostgresDatabase implements Sql {
  dialect = 'postgres' as const;
  pool: pg.Pool;
  constructor(connectionString: string, max = 10) {
    this.pool = new pg.Pool({ connectionString, max, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000, statement_timeout: 15_000 });
    this.pool.on('error', () => { console.error('Falha de conexão ociosa com PostgreSQL.'); });
  }
  async query(sql: string, values?: unknown[]) {
    const result = await this.pool.query(sql, values); return { rows: result.rows as Row[], count: result.rowCount ?? 0 };
  }
  async transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const scoped: Sql = { dialect: this.dialect, query: async (sql, values) => {
      const result = await client.query(sql, values); return { rows: result.rows as Row[], count: result.rowCount ?? 0 };
    }, transaction: async () => { throw new Error('Transação aninhada não permitida.'); }, close: async () => {} };
    try { await client.query('BEGIN'); const value = await work(scoped); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async close() { await this.pool.end(); }
}

// Migração idempotente, compartilhada pelos adaptadores. Executar antes de iniciar réplicas.
export async function migrate(db: Sql) {
  const statements = [
    'CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, state TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS analyses (case_id TEXT PRIMARY KEY REFERENCES cases(id), result TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS service_events (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), kind TEXT NOT NULL, created_at BIGINT NOT NULL)',
    `CREATE TABLE IF NOT EXISTS analysis_jobs (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), owner_id TEXT NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, available_at BIGINT NOT NULL, lease_until BIGINT, lease_token TEXT, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, error_code TEXT, UNIQUE(case_id,revision))`,
    'CREATE INDEX IF NOT EXISTS jobs_claim ON analysis_jobs(status,available_at,lease_until)',
    'CREATE INDEX IF NOT EXISTS jobs_owner ON analysis_jobs(owner_id,case_id)',
    'CREATE INDEX IF NOT EXISTS cases_owner ON cases(owner_id)',
    'CREATE TABLE IF NOT EXISTS report_objects (case_id TEXT PRIMARY KEY REFERENCES cases(id), revision INTEGER NOT NULL, object_key TEXT NOT NULL, expires_at BIGINT)',
    'CREATE TABLE IF NOT EXISTS garbage_objects (object_key TEXT PRIMARY KEY, delete_after BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS temporary_uploads (object_key TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), expires_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS text_document_expiries (case_id TEXT PRIMARY KEY REFERENCES cases(id), expires_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS request_quotas (owner_id TEXT NOT NULL, window_start BIGINT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(owner_id,window_start))'
  ];
  await db.transaction(async tx => {
    if (tx.dialect === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(117311019)');
    for (const statement of statements) await tx.query(statement);
    const columns = tx.dialect === 'postgres' ? (await tx.query("SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='report_objects'")).rows : (await tx.query('PRAGMA table_info(report_objects)')).rows;
    if (!columns.some(row => row.name === 'expires_at')) await tx.query('ALTER TABLE report_objects ADD COLUMN expires_at BIGINT');
  });
}
