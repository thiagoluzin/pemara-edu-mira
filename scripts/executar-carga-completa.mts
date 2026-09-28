import fs from 'node:fs';
import pg from 'pg';
import { runCurriculumIngestion } from './carregar-acervo-curricular-completo';

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
    console.log('[Carga] Iniciando ingestão do acervo curricular completo e oficial...');
    await runCurriculumIngestion(pool);
    console.log('[Carga] Ingestão concluída com sucesso!');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[Carga] Erro fatal durante a carga:', err);
  process.exit(1);
});
