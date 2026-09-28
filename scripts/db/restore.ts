/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script CLI de Restauração do Banco PEMARA EDU
 * Uso: npx tsx scripts/db/restore.ts <caminho_arquivo_backup> --confirm
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getPool, closeDb } from '../../server/db/pool';
import { importDatabase, DatabaseBackupEnvelope } from '../../server/db/backup';

dotenv.config();

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--confirm');
  const hasConfirm = process.argv.includes('--confirm');

  const backupFile = args[0];
  if (!backupFile) {
    console.error('Uso: npx tsx scripts/db/restore.ts <caminho_arquivo_backup> --confirm');
    process.exit(1);
  }

  if (!hasConfirm) {
    console.error('ERRO DE SEGURANÇA: A restauração substitui dados existentes no banco.');
    console.error('Para confirmar a operação destrutiva, execute com o parâmetro: --confirm');
    process.exit(1);
  }

  const fullPath = path.resolve(backupFile);
  if (!fs.existsSync(fullPath)) {
    console.error(`Arquivo de backup não encontrado em: ${fullPath}`);
    process.exit(1);
  }

  console.log(`--- RESTAURANDO BANCO PEMARA EDU A PARTIR DE: ${fullPath} ---`);
  const pool = getPool();

  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const envelope: DatabaseBackupEnvelope = JSON.parse(raw);

    const result = await importDatabase(pool, envelope, { confirmDestructiveRestore: true });
    console.log('Restauração concluída com sucesso!');
    console.log('Tabelas restauradas:');
    for (const [table, count] of Object.entries(result.tablesRestored)) {
      if (count > 0) {
        console.log(`  - ${table}: ${count} registros`);
      }
    }
  } catch (err: any) {
    console.error('Falha na restauração do backup:', err.message);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
