import { SqliteDatabase, PostgresDatabase, migrate } from './infra/database.ts';
const db = process.env.DATABASE_URL ? new PostgresDatabase(process.env.DATABASE_URL, 1) : new SqliteDatabase(process.env.DATABASE_PATH ?? '.local/development.sqlite');
try { await migrate(db); console.log('Migrações concluídas.'); }
finally { await db.close(); }
