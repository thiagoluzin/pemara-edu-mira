/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — BACKUP E RESTAURAÇÃO DE BANCO DE DADOS (E2)
 * Exporta envelope estruturado com snapshot consistente em transação,
 * hash SHA-256 e validação de schema. Restaura de forma atômica, segura
 * e com verificação estrita de whitelist de colunas.
 */

import pg from 'pg';
import crypto from 'crypto';
import { withTransaction } from './pool';

export interface DatabaseBackupEnvelope {
  format_version: '1.0';
  schema_version: '1.0';
  provider: string;
  created_at: string;
  content_hash: string;
  table_counts: Record<string, number>;
  data: Record<string, any[]>;
}

export interface RestoreOptions {
  confirmDestructiveRestore?: boolean;
  targetDatabase?: string;
}

// Ordem estrita de dependência para inserção e restauração relacional
export const TABLES_IN_DEPENDENCY_ORDER = [
  'schema_migrations',
  'sources',
  'licenses',
  'curriculum_skills',
  'users',
  'teacher_materials',
  'sessions',
  'auth_events',
  'login_rate_limits',
  'knowledge_nodes',
  'knowledge_relations',
  'curriculum_knowledge_links',
  'resources',
  'resource_links',
  'import_batches',
  'staging_nodes',
  'entity_versions',
  'content_packs',
  'content_pack_versions',
  'content_pack_entity_links',
  'lessons',
  'lesson_revisions',
  'lesson_drafts',
  'generation_attempts',
  'activity_history',
];

// Whitelist canônica de colunas para prevenção de injeção e adulteração de schema
export const CANONICAL_TABLE_COLUMNS: Record<string, string[]> = {
  teacher_materials: ['id','owner_id','filename','sha256','byte_length','original_base64','extraction_json','created_at'],
  schema_migrations: ['version', 'name', 'applied_at', 'checksum'],
  sources: ['id', 'provider', 'title', 'url', 'author', 'language', 'source_type', 'retrieved_at', 'status'],
  licenses: ['id', 'name', 'code', 'url', 'commercial_use', 'derivatives_allowed', 'attribution_required', 'redistribution_allowed', 'verified', 'notes'],
  curriculum_skills: ['id', 'code', 'thematic_unit', 'knowledge_object', 'description', 'grade_level', 'subject_code', 'source_id', 'status', 'version', 'locator', 'locator_pdf', 'verified_at'],
  users: ['id', 'username', 'name', 'email', 'password_hash', 'role', 'is_active', 'created_at', 'updated_at'],
  sessions: ['id', 'user_id', 'ip_address', 'user_agent', 'expires_at', 'created_at', 'last_activity_at', 'revoked_at', 'token_hash'],
  auth_events: ['id', 'user_id', 'username_attempted', 'event_type', 'ip_address', 'user_agent', 'details_json', 'created_at'],
  login_rate_limits: ['identifier', 'failed_attempts', 'locked_until', 'last_attempt_at'],
  knowledge_nodes: ['id', 'slug', 'type', 'title', 'short_description', 'subject_code', 'grade_level', 'data_json', 'language', 'source_id', 'license_id', 'status', 'version', 'created_at', 'updated_at'],
  knowledge_relations: ['id', 'from_node_id', 'relation_type', 'to_node_id', 'source_id', 'status', 'created_at'],
  curriculum_knowledge_links: ['id', 'curriculum_skill_id', 'knowledge_node_id', 'priority', 'required'],
  resources: ['id', 'type', 'title', 'storage_path', 'mime_type', 'width', 'height', 'source_id', 'license_id', 'status', 'metadata_json', 'created_at'],
  resource_links: ['id', 'resource_id', 'knowledge_node_id', 'role'],
  import_batches: ['id', 'provider', 'started_at', 'finished_at', 'records_found', 'records_imported', 'records_rejected', 'records_duplicates', 'status', 'log_path'],
  staging_nodes: ['id', 'import_batch_id', 'source_provider', 'external_id', 'title', 'slug', 'type', 'short_description', 'data_json', 'validation_status', 'duplicate_candidate_id', 'review_notes', 'created_at'],
  entity_versions: ['id', 'entity_type', 'entity_id', 'version', 'snapshot_json', 'changed_by', 'changed_at', 'change_reason'],
  content_packs: ['id', 'slug', 'subject_code', 'grade_level', 'topic_node_id', 'title', 'status', 'created_at'],
  content_pack_versions: ['id', 'pack_id', 'version', 'schema_version', 'content_hash', 'manifest_json', 'payload_json', 'status', 'published_at', 'created_at'],
  content_pack_entity_links: ['id', 'pack_version_id', 'entity_type', 'entity_id', 'entity_version'],
  lessons: ['id', 'owner_id', 'title', 'subject_code', 'grade_level', 'topic', 'template_id', 'current_version', 'status', 'is_deleted', 'deleted_at', 'created_at', 'updated_at'],
  lesson_revisions: ['id', 'lesson_id', 'version', 'spec_json', 'content_hash', 'renderer_version', 'created_by', 'change_summary', 'created_at'],
  lesson_drafts: ['lesson_id', 'owner_id', 'draft_spec_json', 'base_version', 'updated_at'],
  generation_attempts: ['id', 'user_id', 'lesson_id', 'requested_mode', 'executed_mode', 'fallback_reason', 'parameters_json', 'status', 'error_message', 'created_at'],
  activity_history: ['id', 'entity_type', 'entity_id', 'action', 'actor_id', 'version', 'details_json', 'created_at'],
};

/**
 * Exporta o estado relacional completo do banco em um envelope com hash SHA-256.
 * Executa dentro de um snapshot consistente (REPEATABLE READ) e falha imediatamente
 * caso qualquer consulta ou tabela falhe, sem mascarar erros.
 */
export async function exportDatabase(pool: pg.Pool): Promise<DatabaseBackupEnvelope> {
  const client = await pool.connect();

  try {
    // 1. Inicia transação com isolamento para garantir snapshot consistente entre tabelas
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;');
    } catch (_) {
      await client.query('BEGIN;');
    }

    const data: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};

    // 2. Extrai cada tabela obrigatória. Qualquer falha deve lançar exceção!
    for (const table of TABLES_IN_DEPENDENCY_ORDER) {
      const res = await client.query(`SELECT * FROM ${table};`);
      data[table] = res.rows;
      tableCounts[table] = res.rows.length;
    }

    // 3. Obter provedor e versão do banco
    let provider = 'postgresql';
    try {
      const verRes = await client.query('SELECT version() as ver;');
      if (verRes.rows[0]?.ver?.includes('pemara-mem')) {
        provider = 'pg-mem';
      }
    } catch (_) {}

    await client.query('COMMIT;');

    const serializedData = JSON.stringify(data);
    const contentHash = crypto.createHash('sha256').update(serializedData).digest('hex');

    return {
      format_version: '1.0',
      schema_version: '1.0',
      provider,
      created_at: new Date().toISOString(),
      content_hash: contentHash,
      table_counts: tableCounts,
      data,
    };
  } catch (err: any) {
    try {
      await client.query('ROLLBACK;');
    } catch (_) {}
    throw new Error(`Falha crítica na exportação do backup: ${err.message}`);
  } finally {
    client.release();
  }
}

/**
 * Restaura o estado relacional a partir de um envelope de backup de forma atômica.
 * Exige confirmação explícita e valida cada coluna contra a whitelist de segurança.
 */
export async function importDatabase(
  pool: pg.Pool,
  backup: DatabaseBackupEnvelope,
  options?: RestoreOptions
): Promise<{ success: boolean; tablesRestored: Record<string, number> }> {
  // 1. Verificação de proteção contra restauração acidental
  if (options?.confirmDestructiveRestore !== true) {
    throw new Error(
      'Operação de restauração abortada por segurança: o parâmetro confirmDestructiveRestore deve ser explicitamente true.'
    );
  }

  // 2. Verificação de versão do formato do envelope
  if (backup.format_version !== '1.0' || (backup.schema_version !== '1.0' && backup.schema_version !== '1.1')) {
    throw new Error(
      `Versão incompatível do backup: esperado format_version="1.0" e schema_version="1.0"|"1.1", recebido "${backup.format_version}" / "${backup.schema_version}".`
    );
  }

  // 3. Verificação de integridade criptográfica
  const serialized = JSON.stringify(backup.data);
  const computedHash = crypto.createHash('sha256').update(serialized).digest('hex');

  if (computedHash !== backup.content_hash) {
    throw new Error('Falha crítica de integridade: o hash SHA-256 do backup não coincide com o conteúdo fornecido.');
  }

  // 4. Validação estrita de completude estrutural, tabelas obrigatórias e contagens ANTES de qualquer mutação
  if (!backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
    throw new Error('Formato inválido do backup: o campo data deve ser um objeto contendo as tabelas canônicas.');
  }

  if (!backup.table_counts || typeof backup.table_counts !== 'object' || Array.isArray(backup.table_counts)) {
    throw new Error('Formato inválido do backup: o campo table_counts deve ser um objeto contendo as contagens das tabelas.');
  }

  // Compatibilidade com backups gerados antes da inclusão de auth_events / login_rate_limits
  if (!backup.data.auth_events) {
    backup.data.auth_events = [];
    backup.table_counts.auth_events = 0;
  }
  if (!backup.data.login_rate_limits) {
    backup.data.login_rate_limits = [];
    backup.table_counts.login_rate_limits = 0;
  }
  if (!backup.data.teacher_materials) {
    backup.data.teacher_materials=[];
    backup.table_counts.teacher_materials=0;
  }

  for (const table of TABLES_IN_DEPENDENCY_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(backup.data, table)) {
      throw new Error(
        `Tabela canônica obrigatória ausente no backup: "${table}". Restauração rejeitada antes de qualquer mutação.`
      );
    }

    const rows = backup.data[table];
    if (!Array.isArray(rows)) {
      throw new Error(
        `Dados inválidos para a tabela "${table}": esperado array de registros, recebido ${typeof rows}. Restauração rejeitada.`
      );
    }

    if (!Object.prototype.hasOwnProperty.call(backup.table_counts, table)) {
      throw new Error(
        `Contagem ausente para a tabela "${table}" em table_counts. Restauração rejeitada antes de qualquer mutação.`
      );
    }

    const declaredCount = backup.table_counts[table];
    if (typeof declaredCount !== 'number' || !Number.isInteger(declaredCount) || declaredCount < 0) {
      throw new Error(
        `Contagem de registros inválida para a tabela "${table}": esperado número inteiro >= 0, recebido ${declaredCount}.`
      );
    }

    if (rows.length !== declaredCount) {
      throw new Error(
        `Inconsistência pré-restauração na tabela "${table}": contagem declarada em table_counts (${declaredCount}) diverge da quantidade real de registros (${rows.length}). Restauração abortada sem modificar dados.`
      );
    }

    const allowedColumns = new Set(CANONICAL_TABLE_COLUMNS[table] || []);
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(
          `Registro corrompido ou inválido na tabela "${table}". Restauração rejeitada.`
        );
      }
      for (const col of Object.keys(row)) {
        if (!allowedColumns.has(col)) {
          throw new Error(
            `Coluna inválida ou não reconhecida "${col}" na tabela "${table}". Restauração rejeitada por segurança.`
          );
        }
      }
    }
  }

  const tablesRestored: Record<string, number> = {};

  await withTransaction(async (client) => {
    // 5. Limpar tabelas em ordem reversa de dependência (sem engolir erros)
    const reverseTables = [...TABLES_IN_DEPENDENCY_ORDER].reverse();
    for (const table of reverseTables) {
      await client.query(`DELETE FROM ${table};`);
    }

    // 6. Restaurar dados na ordem direta de dependência
    for (const table of TABLES_IN_DEPENDENCY_ORDER) {
      const rows = backup.data[table];
      tablesRestored[table] = 0;

      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row).map((val) => {
          if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });
        const quotedCols = columns.map((c) => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        await client.query(
          `INSERT INTO ${table} (${quotedCols}) VALUES (${placeholders});`,
          values
        );
        tablesRestored[table]++;
      }

      // 7. Conferir contagem de registros restaurados (inclusive para tabelas vazias)
      const expectedCount = backup.table_counts[table];
      if (tablesRestored[table] !== expectedCount) {
        throw new Error(
          `Divergência de contagem na tabela "${table}": esperado ${expectedCount}, restaurados ${tablesRestored[table]}.`
        );
      }
    }

    // 8. Política de recuperação de sessões (R3 / B3):
    // Invalida todas as sessões ativas restauradas para evitar reativação de acessos
    await client.query(`UPDATE sessions SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP);`);
  }, pool);

  return {
    success: true,
    tablesRestored,
  };
}
