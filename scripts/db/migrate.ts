/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script CLI para Execução de Migrações do Banco PEMARA EDU
 * Uso: npx tsx scripts/db/migrate.ts
 */

import dotenv from 'dotenv';
import { getPool, closeDb } from '../../server/db/pool';
import { runMigrations } from '../../server/db/migrator';

dotenv.config();

async function main() {
  console.log('--- EXECUTANDO MIGRAÇÕES DO BANCO PEMARA EDU ---');
  const pool = getPool();

  try {
    const result = await runMigrations(pool);
    console.log(`Migrações executadas: ${result.appliedCount}`);
    console.log(`Migrações já aplicadas anteriormente: ${result.alreadyAppliedCount}`);
    if (result.migrations.length > 0) {
      console.log('Arquivos aplicados nesta rodada:');
      for (const m of result.migrations) {
        console.log(`  ✔ ${m}`);
      }
    } else {
      console.log('Banco de dados já está na versão mais recente.');
    }
  } catch (err: any) {
    console.error('Falha ao aplicar migrações:', err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
