import path from 'node:path';
import migrate from 'node-pg-migrate';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');
const MIGRATIONS_TABLE = 'pgmigrations';

export async function runMigrations(databaseUrl: string): Promise<void> {
  await migrate({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction: 'up',
    migrationsTable: MIGRATIONS_TABLE,
    log: (msg) => console.log(`[migrate] ${msg}`),
  });
}
