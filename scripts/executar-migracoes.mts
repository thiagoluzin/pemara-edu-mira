import fs from 'node:fs';
import pg from 'pg';
import { runMigrations } from '../server/db/migrator';

async function main() {
  const c = JSON.parse(fs.readFileSync('.local-demo/config.json', 'utf8'));
  const pool = new pg.Pool({
    host: '127.0.0.1',
    port: c.dbPort,
    user: 'postgres',
    password: c.password,
    database: 'pemara_demo_utf8'
  });

  try {
    const res = await runMigrations(pool);
    console.log('[Migrator] Migrações aplicadas:', res);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
