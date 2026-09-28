/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — REPOSITÓRIO DE EVENTOS DE AUTENTICAÇÃO E AUDITORIA (E3)
 * Registra eventos em formato imutável e sanitizado em PostgreSQL.
 */

import pg from 'pg';
import crypto from 'crypto';
import { getPool } from '../db/pool';
import { DbAuthEvent } from '../db/types';

export class AuthEventRepository {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool || getPool();
  }

  /**
   * Sanitiza strings de entrada não confiáveis (prevenção contra XSS/injeção em logs).
   */
  private sanitizeString(input: string, maxLength = 64): string {
    if (!input || typeof input !== 'string') return '';
    return input
      .trim()
      .replace(/[<>'"&]/g, '')
      .slice(0, maxLength);
  }

  /**
   * Registra um evento de auditoria de autenticação.
   */
  async recordEvent(params: {
    userId?: string | null;
    usernameAttempted: string;
    eventType:
      | 'LOGIN_SUCCESS'
      | 'LOGIN_FAILED'
      | 'LOGOUT'
      | 'SESSION_REVOKED'
      | 'ALL_SESSIONS_REVOKED'
      | 'PASSWORD_CHANGE'
      | 'PASSWORD_RESET'
      | 'ROLE_CHANGE'
      | 'ACCOUNT_CREATED'
      | 'ACCOUNT_ACTIVATED'
      | 'ACCOUNT_DEACTIVATED'
      | 'LESSON_TRANSFERRED'
      | 'LESSON_RESTORED'
      | 'ARCHIVE_EXPORTED';
    ip?: string | null;
    userAgent?: string | null;
    details?: Record<string, any>;
  }, client?: pg.PoolClient): Promise<DbAuthEvent> {
    const executor = client || this.pool;
    const id = `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const sanitizedUser = this.sanitizeString(params.usernameAttempted, 64);
    const sanitizedIp = this.sanitizeString(params.ip || '', 45) || null;
    const sanitizedUa = (params.userAgent || '').slice(0, 255) || null;
    const detailsJson = JSON.stringify(params.details || {});

    try {
      const res = await executor.query<DbAuthEvent>(
        `INSERT INTO auth_events (id, user_id, username_attempted, event_type, ip_address, user_agent, details_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING *;`,
        [id, params.userId || null, sanitizedUser, params.eventType, sanitizedIp, sanitizedUa, detailsJson]
      );
      return res.rows[0];
    } catch (err: any) {
      if (err?.code === '42P01') {
        // Fallback transitório se a tabela auth_events não existir em banco sem migrations
        return {
          id,
          user_id: params.userId || null,
          username_attempted: sanitizedUser,
          event_type: params.eventType,
          ip_address: sanitizedIp,
          user_agent: sanitizedUa,
          details_json: params.details || {},
          created_at: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  /**
   * Verifica e atualiza o limite de tentativas de login por identificador (IP ou username).
   * Retorna { isBlocked: boolean; remainingSeconds: number }.
   */
  async checkRateLimit(identifier: string, maxAttempts = 5, lockMinutes = 5): Promise<{ isBlocked: boolean; remainingSeconds: number }> {
    const key = this.sanitizeString(identifier.toLowerCase(), 128);
    if (!key) return { isBlocked: false, remainingSeconds: 0 };

    try {
      const res = await this.pool.query<{ failed_attempts: number; locked_until: string | null }>(
        `SELECT failed_attempts, locked_until FROM login_rate_limits WHERE identifier = $1;`,
        [key]
      );

      if (res.rows.length === 0) {
        return { isBlocked: false, remainingSeconds: 0 };
      }

      const row = res.rows[0];
      if (row.locked_until) {
        const lockTime = new Date(row.locked_until).getTime();
        const now = Date.now();
        if (lockTime > now) {
          return {
            isBlocked: true,
            remainingSeconds: Math.ceil((lockTime - now) / 1000),
          };
        }
      }

      return { isBlocked: false, remainingSeconds: 0 };
    } catch {
      return { isBlocked: false, remainingSeconds: 0 };
    }
  }

  /**
   * Registra uma tentativa falha e atualiza o bloqueio se atingir o limiar.
   */
  async recordFailedAttempt(identifier: string, maxAttempts = 5, lockMinutes = 5): Promise<{ isNowBlocked: boolean; remainingSeconds: number }> {
    const key = this.sanitizeString(identifier.toLowerCase(), 128);
    if (!key) return { isNowBlocked: false, remainingSeconds: 0 };

    try {
      const lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000).toISOString();

      const existing = await this.pool.query<{ failed_attempts: number }>(
        `SELECT failed_attempts FROM login_rate_limits WHERE identifier = $1;`,
        [key]
      );

      if (existing.rows.length === 0) {
        await this.pool.query(
          `INSERT INTO login_rate_limits (identifier, failed_attempts, locked_until, last_attempt_at)
           VALUES ($1, 1, NULL, CURRENT_TIMESTAMP);`,
          [key]
        );
        return { isNowBlocked: false, remainingSeconds: 0 };
      }

      const nextAttempts = existing.rows[0].failed_attempts + 1;
      const isNowBlocked = nextAttempts >= maxAttempts;

      await this.pool.query(
        `UPDATE login_rate_limits
         SET failed_attempts = $1,
             locked_until = $2,
             last_attempt_at = CURRENT_TIMESTAMP
         WHERE identifier = $3;`,
        [nextAttempts, isNowBlocked ? lockUntil : null, key]
      );

      return { isNowBlocked, remainingSeconds: isNowBlocked ? lockMinutes * 60 : 0 };
    } catch {
      return { isNowBlocked: false, remainingSeconds: 0 };
    }
  }

  /**
   * Limpa o contador de tentativas após um login bem-sucedido.
   */
  async clearFailedAttempts(identifier: string): Promise<void> {
    const key = this.sanitizeString(identifier.toLowerCase(), 128);
    if (!key) return;
    try {
      await this.pool.query(`DELETE FROM login_rate_limits WHERE identifier = $1;`, [key]);
    } catch {}
  }

  /**
   * Lista eventos paginados para o painel administrativo.
   */
  async listEvents(options?: {
    eventType?: string;
    userId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ events: DbAuthEvent[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (options?.eventType) {
      conditions.push(`event_type = $${idx++}`);
      values.push(options.eventType);
    }

    if (options?.userId) {
      conditions.push(`user_id = $${idx++}`);
      values.push(options.userId);
    }

    if (options?.search) {
      const q = `%${this.sanitizeString(options.search).toLowerCase()}%`;
      conditions.push(`LOWER(username_attempted) LIKE $${idx++}`);
      values.push(q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const countRes = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM auth_events ${whereClause};`,
        values
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;

      const dataRes = await this.pool.query<DbAuthEvent>(
        `SELECT id, user_id, username_attempted, event_type, ip_address, user_agent, details_json, created_at
         FROM auth_events
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${idx++} OFFSET $${idx++};`,
        [...values, limit, offset]
      );

      return { events: dataRes.rows, total };
    } catch {
      return { events: [], total: 0 };
    }
  }
}
