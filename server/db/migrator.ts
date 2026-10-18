/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — EXECUTOR DE MIGRAÇÕES VERSIONADAS POSTGRESQL (E2)
 * Garante idempotência, controle transacional, cálculo e conferência estrita
 * de checksums SHA-256 e lock de concorrência com advisory lock.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import pg from 'pg';
import { getPool, withTransaction } from './pool';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Identificador único para advisory lock de migração no PostgreSQL
const MIGRATION_ADVISORY_LOCK_ID = 739281;

export interface MigrationResult {
  appliedCount: number;
  alreadyAppliedCount: number;
  migrations: string[];
}

export interface MigrationEntry {
  version: string;
  name: string;
  filename: string;
  filepath: string;
  checksum: string;
  windowsChecksum: string;
}

/**
 * Lê e ordena os arquivos de migração do diretório de migrações.
 */
export function getAvailableMigrations(migrationsDir?: string): MigrationEntry[] {
  const dir = migrationsDir || path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  return files.map((filename) => {
    const filepath = path.join(dir, filename);
    const content = fs.readFileSync(filepath, 'utf8');
    const normalized=content.replace(/\r\n/g,'\n');
    const checksum = crypto.createHash('sha256').update(normalized).digest('hex');
    // Aceita apenas a diferença CRLF/LF de instalações Windows anteriores.
    const windowsChecksum=crypto.createHash('sha256').update(normalized.replace(/\n/g,'\r\n')).digest('hex');
    const parts = filename.split('_');
    const version = parts[0];
    const name = parts.slice(1).join('_').replace('.sql', '');

    return {
      version,
      name,
      filename,
      filepath,
      checksum,
      windowsChecksum,
    };
  });
}

/**
 * Executa todas as migrações pendentes em ordem sequencial e transacional.
 * Protegido por advisory lock para evitar corrida entre processos paralelos.
 */
export async function runMigrations(customPool?: pg.Pool, migrationsDir?: string): Promise<MigrationResult> {
  const pool = customPool || getPool();

  const lockClient = await pool.connect();
  let lockAcquired = false;

  try {
    try {
      await lockClient.query(`SELECT pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_ID});`);
      lockAcquired = true;
    } catch (_) {
      // Ignora caso o provedor não suporte advisory lock
    }

    // 1. Assegurar tabela de controle de migrações
    await lockClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      );
    `);

    // 2. Obter migrações já registradas
    const appliedRes = await lockClient.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version ASC;'
    );
    const appliedMap = new Map<string, string>();
    for (const row of appliedRes.rows) {
      appliedMap.set(row.version, row.checksum);
    }

    const available = getAvailableMigrations(migrationsDir);
    let appliedCount = 0;
    let alreadyAppliedCount = 0;
    const appliedList: string[] = [];

    // 3. Conferir e aplicar cada migração
    for (const mig of available) {
      if (appliedMap.has(mig.version)) {
        const storedChecksum = appliedMap.get(mig.version);
        // Conferência estrita de checksum: migração aplicada não pode ser adulterada
        if (storedChecksum !== mig.checksum && storedChecksum !== mig.windowsChecksum) {
          throw new Error(
            `Inconsistência de integridade na migração "${mig.filename}" (versão ${mig.version}): ` +
            `o checksum registrado no banco ("${storedChecksum}") diverge do checksum do arquivo local ("${mig.checksum}"). ` +
            `Migrações já aplicadas são imutáveis e não podem ser alteradas.`
          );
        }
        alreadyAppliedCount++;
        continue;
      }

      const sqlContent = fs.readFileSync(mig.filepath, 'utf8');

      await withTransaction(async (client) => {
        // Executa o script DDL
        await client.query(sqlContent);

        // Registra na tabela schema_migrations
        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3);`,
          [mig.version, mig.name, mig.checksum]
        );
      }, pool);

      appliedCount++;
      appliedList.push(mig.filename);
    }

    return {
      appliedCount,
      alreadyAppliedCount,
      migrations: appliedList,
    };
  } finally {
    if (lockAcquired) {
      try {
        await lockClient.query(`SELECT pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_ID});`);
      } catch (_) {}
    }
    lockClient.release();
  }
}
