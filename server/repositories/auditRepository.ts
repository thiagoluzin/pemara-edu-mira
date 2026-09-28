/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — REPOSITÓRIO DE AUDITORIA E TENTATIVAS DE GERAÇÃO (E2)
 */

import pg from 'pg';
import crypto from 'crypto';
import { getPool } from '../db/pool';
import { DbActivityHistory, DbGenerationAttempt } from '../db/types';

export class AuditRepository {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool || getPool();
  }

  async recordActivity(entry: {
    entityType: DbActivityHistory['entity_type'];
    entityId: string;
    action: string;
    actorId?: string | null;
    version?: number | null;
    details?: any;
  }): Promise<DbActivityHistory> {
    const id = crypto.randomUUID();
    const detailsJson = entry.details ? JSON.stringify(entry.details) : '{}';

    const res = await this.pool.query<DbActivityHistory>(
      `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [id, entry.entityType, entry.entityId, entry.action, entry.actorId || null, entry.version || null, detailsJson]
    );

    return res.rows[0];
  }

  async listActivity(entityType: string, entityId: string): Promise<DbActivityHistory[]> {
    const res = await this.pool.query<DbActivityHistory>(
      `SELECT * FROM activity_history 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY created_at DESC;`,
      [entityType, entityId]
    );
    return res.rows;
  }

  async recordGenerationAttempt(attempt: {
    id?: string;
    userId?: string | null;
    lessonId?: string | null;
    requestedMode: string;
    executedMode: string;
    fallbackReason?: string | null;
    parametersJson?: any;
    status: 'SUCCESS' | 'FAILED' | 'REJECTED';
    errorMessage?: string | null;
  }): Promise<DbGenerationAttempt> {
    const id = attempt.id || crypto.randomUUID();
    const params = attempt.parametersJson ? JSON.stringify(attempt.parametersJson) : '{}';

    const res = await this.pool.query<DbGenerationAttempt>(
      `INSERT INTO generation_attempts (id, user_id, lesson_id, requested_mode, executed_mode, fallback_reason, parameters_json, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *;`,
      [
        id,
        attempt.userId || null,
        attempt.lessonId || null,
        attempt.requestedMode,
        attempt.executedMode,
        attempt.fallbackReason || null,
        params,
        attempt.status,
        attempt.errorMessage || null,
      ]
    );

    return res.rows[0];
  }

  async listGenerationAttempts(userId?: string): Promise<DbGenerationAttempt[]> {
    let queryText = 'SELECT * FROM generation_attempts ORDER BY created_at DESC;';
    const params: any[] = [];

    if (userId) {
      queryText = 'SELECT * FROM generation_attempts WHERE user_id = $1 ORDER BY created_at DESC;';
      params.push(userId);
    }

    const res = await this.pool.query<DbGenerationAttempt>(queryText, params);
    return res.rows;
  }
}
