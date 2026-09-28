/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — CAMADA DE CONEXÃO E POOL POSTGRESQL (E2)
 * Suporta instâncias PostgreSQL nativas (via pg.Pool) e emulador
 * em memória (pg-mem) estritamente isolado para testes unitários/offline.
 */

import pg from 'pg';
import crypto from 'crypto';
import { createRequire } from 'module';

export interface DbConfig {
  connectionString?: string;
  forceMemory?: boolean;
}

export interface DbHealthResult {
  status: 'ok' | 'error';
  provider: 'postgresql' | 'pg-mem';
  database?: string;
  timestamp: string;
  error?: string;
}

let activePool: pg.Pool | null = null;
let currentProvider: 'postgresql' | 'pg-mem' = 'postgresql';

/**
 * Cria uma instância de banco de dados e retorna o pool.
 * Em produção, exige expressamente DATABASE_URL e proíbe banco em memória.
 */
export function createPool(config?: DbConfig): { pool: pg.Pool; provider: 'postgresql' | 'pg-mem'; memoryDb?: any } {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
  const connectionString = config?.connectionString || process.env.DATABASE_URL;

  // 1. Em produção, DATABASE_URL é rigorosamente obrigatória
  if (isProduction && !connectionString) {
    throw new Error(
      'DATABASE_URL é obrigatória em ambiente de produção. O sistema PEMARA EDU não permite banco volátil em produção.'
    );
  }

  // 2. O emulador pg-mem só é permitido mediante configuração explícita de teste
  const isExplicitMemory =
    config?.forceMemory === true ||
    process.env.NODE_ENV === 'test' ||
    process.env.USE_TEST_MEMORY_DB === 'true';

  if (!connectionString && !isExplicitMemory) {
    throw new Error(
      'DATABASE_URL não configurada no ambiente. Configure DATABASE_URL no arquivo .env ou defina USE_TEST_MEMORY_DB=true para desenvolvimento/testes locais.'
    );
  }

  // 3. PostgreSQL nativo
  if (connectionString && !config?.forceMemory) {
    const pool = new pg.Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    currentProvider = 'postgresql';
    return { pool, provider: 'postgresql' };
  }

  // 4. Emulador pg-mem carregado dinamicamente via createRequire (somente em teste)
  // Isso impede que o bundle de produção falhe caso pg-mem esteja em devDependencies
  const req = createRequire(import.meta.url);
  const { newDb } = req('pg-mem');
  const db = newDb({ noAstCoverageCheck: true });

  db.registerExtension('uuid-ossp', (schema: any) => {
    schema.registerFunction({
      name: 'uuid_generate_v4',
      implementation: () => crypto.randomUUID(),
    });
  });

  db.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 16.0-pemara-mem',
  });

  db.public.registerFunction({
    name: 'current_database',
    implementation: () => 'pemara_edu',
  });

  // Funções de advisory lock simuladas no pg-mem para compatibilidade de testes
  db.public.registerFunction({
    name: 'pg_advisory_lock',
    args: ['integer'],
    implementation: () => {},
  });

  db.public.registerFunction({
    name: 'pg_advisory_unlock',
    args: ['integer'],
    returns: 'boolean',
    implementation: () => true,
  });

  db.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: ['integer'],
    implementation: () => {},
  });

  const pgAdapter = db.adapters.createPg();
  const pool = new pgAdapter.Pool();
  (pool as any).__memoryDb = db;
  currentProvider = 'pg-mem';

  return { pool, provider: 'pg-mem', memoryDb: db };
}

/**
 * Inicializa e define o pool padrão da aplicação.
 */
export function initDb(config?: DbConfig): pg.Pool {
  if (activePool) {
    return activePool;
  }
  const { pool, provider } = createPool(config);
  activePool = pool;
  currentProvider = provider;
  return activePool;
}

/**
 * Retorna o pool ativo ou inicializa o padrão.
 */
export function getPool(): pg.Pool {
  if (!activePool) {
    return initDb();
  }
  return activePool;
}

/**
 * Executa uma consulta direta no pool ativo.
 */
export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

/**
 * Executa um bloco de operações atômicas dentro de uma transação.
 * Realiza ROLLBACK automático em caso de exceção e libera o client ao término.
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
  customPool?: pg.Pool
): Promise<T> {
  const pool = customPool || getPool();
  const memoryDb = (pool as any).__memoryDb;
  const memorySnapshot = memoryDb ? memoryDb.backup() : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Falha secundária ao executar ROLLBACK:', rollbackErr);
    }
    if (memorySnapshot) {
      memorySnapshot.restore();
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verifica a saúde e conectividade do banco de dados.
 */
export async function checkDbHealth(customPool?: pg.Pool): Promise<DbHealthResult> {
  const pool = customPool || activePool;
  if (!pool) {
    return {
      status: 'error',
      provider: currentProvider,
      timestamp: new Date().toISOString(),
      error: 'Pool de banco de dados não inicializado.',
    };
  }

  try {
    const res = await pool.query('SELECT 1 as healthy, version() as ver;');
    return {
      status: 'ok',
      provider: currentProvider,
      database: 'pemara_edu',
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      status: 'error',
      provider: currentProvider,
      timestamp: new Date().toISOString(),
      error: err.message || 'Falha de comunicação com o banco de dados.',
    };
  }
}

/**
 * Encerra o pool ativo.
 */
export async function closeDb(): Promise<void> {
  if (activePool) {
    await activePool.end();
    activePool = null;
  }
}
