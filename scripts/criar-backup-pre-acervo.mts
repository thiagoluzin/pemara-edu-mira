import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { exportDatabase } from '../server/db/backup';

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
    console.log('[Backup] Gerando backup preventivo do banco...');
    const backup = await exportDatabase(pool);
    const backupDir = path.resolve('backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFile = path.join(backupDir, `backup-pre-verbatim-bncc-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`[Backup] Backup salvo com sucesso em: ${backupFile}`);
    console.log(`[Backup] Hash: ${backup.content_hash}, Tabelas: ${Object.keys(backup.table_counts).length}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[Backup] Falha ao gerar backup:', err);
  process.exit(1);
});
