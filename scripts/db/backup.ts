/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script CLI de Backup do Banco PEMARA EDU
 * Uso: npx tsx scripts/db/backup.ts [caminho_saida]
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getPool, closeDb } from '../../server/db/pool';
import { exportDatabase } from '../../server/db/backup';

dotenv.config();

async function main() {
  console.log('--- INICIANDO BACKUP DO BANCO PEMARA EDU ---');
  const pool = getPool();

  try {
    const backup = await exportDatabase(pool);
    const targetDir = path.resolve('backups');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const customPath = process.argv[2];
    const filename = customPath || path.join(targetDir, `pemara_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

    fs.writeFileSync(filename, JSON.stringify(backup, null, 2), 'utf8');

    console.log(`Backup gravado com sucesso em: ${filename}`);
    console.log(`SHA-256 Checksum: ${backup.content_hash}`);
    console.log('Contagem de registros por tabela:');
    for (const [table, count] of Object.entries(backup.table_counts)) {
      if (count > 0) {
        console.log(`  - ${table}: ${count}`);
      }
    }
  } catch (err: any) {
    console.error('Falha ao gerar backup:', err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
