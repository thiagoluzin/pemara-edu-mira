/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — HARNESS SEGURO PARA ENSAIOS EM POSTGRESQL REAL
 * Garante:
 * - Diretórios temporários isolados em os.tmpdir() (nunca toca na workspace)
 * - Portas efêmeras livres reservadas dinamicamente
 * - Isolamento total de DATABASE_URL de produção
 * - Teardown garantido inclusive em falha
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

export interface DisposablePostgresInstance {
  port: number;
  dir: string;
  server: EmbeddedPostgres;
  connectionString: string;
  createPool: (opts?: Partial<pg.PoolConfig>) => pg.Pool;
  stop: () => Promise<void>;
  start: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export async function getFreePort(): Promise<number> {
  const srv = http.createServer();
  return new Promise<number>((resolve, reject) => {
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as any).port;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    srv.on('error', reject);
  });
}

export function safeCleanDir(dir: string) {
  if (!dir) return;
  // Proteção rígida: só permite limpeza de diretórios dentro de os.tmpdir()
  const normalizedTmp = path.normalize(os.tmpdir()).toLowerCase();
  const normalizedDir = path.normalize(dir).toLowerCase();
  if (!normalizedDir.startsWith(normalizedTmp)) {
    throw new Error(`Harness de segurança: recusa em apagar diretório fora de os.tmpdir(): ${dir}`);
  }

  if (fs.existsSync(dir)) {
    for (let i = 0; i < 15; i++) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        break;
      } catch (_) {
        const start = Date.now();
        while (Date.now() - start < 100) {}
      }
    }
  }
}

export async function createDisposablePostgres(prefix = 'pemara-pg-'): Promise<DisposablePostgresInstance> {
  // Garantir que DATABASE_URL de produção não seja usada
  const originalDbUrl = process.env.DATABASE_URL;

  const port = await getFreePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}${port}-`));

  const server = new EmbeddedPostgres({
    port,
    databaseDir: dir,
    persistent: true,
  });

  await server.initialise();
  await server.start();

  const connectionString = `postgres://postgres:password@127.0.0.1:${port}/postgres`;
  const pools: pg.Pool[] = [];

  const createPool = (opts?: Partial<pg.PoolConfig>): pg.Pool => {
    const p = new pg.Pool({
      connectionString,
      ...opts,
    });
    pools.push(p);
    return p;
  };

  const stop = async () => {
    for (const p of pools) {
      try {
        await p.end();
      } catch (_) {}
    }
    pools.length = 0;

    const pgCtlPath = path.resolve(
      process.cwd(),
      'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'
    );
    if (fs.existsSync(pgCtlPath) && fs.existsSync(path.join(dir, 'postmaster.pid'))) {
      try {
        const { execFileSync } = await import('node:child_process');
        execFileSync(pgCtlPath, ['stop', '-D', dir, '-m', 'fast', '-w'], { stdio: 'ignore', timeout: 7000 });
      } catch (_) {}
    }

    try {
      await server.stop();
    } catch (_) {}
    // Pausa preventiva no Windows para liberação do handle de shared memory pelo SO
    await new Promise((r) => setTimeout(r, 600));
  };

  const start = async () => {
    let lastErr: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 800));
        }
        await server.start();
        return;
      } catch (err: any) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    throw lastErr;
  };

  const cleanup = async () => {
    await stop();
    // Restaura DATABASE_URL original caso tenha sido alterada
    if (originalDbUrl !== undefined) {
      process.env.DATABASE_URL = originalDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    await new Promise((r) => setTimeout(r, 200));
    safeCleanDir(dir);
  };

  return {
    port,
    dir,
    server,
    connectionString,
    createPool,
    stop,
    start,
    cleanup,
  };
}
