/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — REPOSITÓRIO DE SESSÕES LOCAIS DE USUÁRIOS (E3)
 * Persiste sessões com tokens criptográficos aleatórios na tabela `sessions`
 * com tempo de expiração e expurgação segura.
 */

import pg from 'pg';
import crypto from 'crypto';
import { getPool } from '../db/pool';
import { DbSession, SafeUser } from '../db/types';

export interface AdminSessionView extends DbSession {
  username: string;
  name: string;
  is_active_account: boolean;
}

export class SessionRepository {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool || getPool();
  }

  /**
   * Cria uma nova sessão para o usuário especificado.  /**
   * Cria uma nova sessão para o usuário especificado.
   * Separa o identificador público de gestão (id) do token secreto (secretToken).
   * O banco armazena exclusivamente o hash SHA-256 do token (R4).
   * TTL padrão: 24 horas.
   */
  async createSession(
    userId: string,
    options?: { ip?: string; userAgent?: string; ttlHours?: number },
    client?: pg.PoolClient
  ): Promise<{ session: DbSession; secretToken: string }> {
    const executor = client || this.pool;
    const sessionId = 'sess_' + crypto.randomBytes(16).toString('hex');
    const secretToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(secretToken).digest('hex');
    const ttlHours = options?.ttlHours ?? 24;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

    const res = await executor.query<DbSession>(
      `INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at, created_at, last_activity_at, token_hash)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6)
       RETURNING *;`,
      [sessionId, userId, options?.ip || null, options?.userAgent || null, expiresAt, tokenHash]
    );

    return { session: res.rows[0], secretToken };
  }

  /**
   * Obtém a sessão ativa e o usuário associado (sem expor password_hash ou secretToken).
   * Retorna null se a sessão não existir, estiver revogada, expirada ou se o usuário estiver inativo.
   */
  async getSessionWithUser(
    token: string,
    client?: pg.PoolClient
  ): Promise<{ session: DbSession; user: SafeUser } | null> {
    const executor = client || this.pool;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const res = await executor.query<{
      s_id: string;
      s_user_id: string;
      s_ip: string | null;
      s_ua: string | null;
      s_expires_at: string;
      s_created_at: string;
      s_last_activity_at?: string;
      s_revoked_at?: string | null;
      s_token_hash?: string | null;
      u_id: string;
      u_username: string;
      u_name: string;
      u_email: string;
      u_role: SafeUser['role'];
      u_is_active: boolean;
      u_created_at: string;
      u_updated_at: string;
    }>(
      `SELECT 
         s.id AS s_id, s.user_id AS s_user_id, s.ip_address AS s_ip, s.user_agent AS s_ua, 
         s.expires_at AS s_expires_at, s.created_at AS s_created_at,
         s.last_activity_at AS s_last_activity_at, s.revoked_at AS s_revoked_at,
         s.token_hash AS s_token_hash,
         u.id AS u_id, u.username AS u_username, u.name AS u_name, u.email AS u_email, 
         u.role AS u_role, u.is_active AS u_is_active, u.created_at AS u_created_at, u.updated_at AS u_updated_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE (s.token_hash = $1 OR (s.token_hash IS NULL AND s.id = $2)) AND u.is_active = TRUE;`,
      [tokenHash, token]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];

    // Se estiver revogada explicitamente
    if (row.s_revoked_at) {
      return null;
    }

    // Validação estrita de expiração imune a diferenças de fuso horário / dialeto
    if (new Date(row.s_expires_at).getTime() <= Date.now()) {
      return null;
    }

    // Atualizar última atividade em background (sem bloquear retorno)
    this.updateLastActivity(row.s_id).catch(() => {});

    const session: DbSession = {
      id: row.s_id,
      user_id: row.s_user_id,
      ip_address: row.s_ip,
      user_agent: row.s_ua,
      expires_at: row.s_expires_at,
      created_at: row.s_created_at,
      last_activity_at: row.s_last_activity_at,
      revoked_at: row.s_revoked_at,
    };

    const user: SafeUser = {
      id: row.u_id,
      username: row.u_username,
      name: row.u_name,
      email: row.u_email,
      role: row.u_role,
      is_active: row.u_is_active,
      created_at: row.u_created_at,
      updated_at: row.u_updated_at,
    };

    return { session, user };
  }

  /**
   * Atualiza o timestamp de última atividade da sessão.
   */
  async updateLastActivity(sessionId: string, client?: pg.PoolClient): Promise<void> {
    const executor = client || this.pool;
    try {
      await executor.query(
        `UPDATE sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL;`,
        [sessionId]
      );
    } catch (_) {
      // Ignora caso a coluna não exista em ambientes de teste sem migração aplicada
    }
  }

  /**
   * Revoga uma sessão ativa pelo ID público ou pelo token.
   */
  async revokeSession(sessionIdOrToken: string, client?: pg.PoolClient): Promise<boolean> {
    const executor = client || this.pool;
    const tokenHash = crypto.createHash('sha256').update(sessionIdOrToken).digest('hex');
    const res = await executor.query(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE (id = $1 OR token_hash = $2) AND revoked_at IS NULL;`,
      [sessionIdOrToken, tokenHash]
    );
    if ((res.rowCount ?? 0) > 0) return true;
    // Fallback: se já excluída ou não atualizada, tenta delete físico
    return this.deleteSession(sessionIdOrToken, client);
  }

  /**
   * Revoga todas as sessões de um determinado usuário (ex: após troca de senha ou desativação).
   */
  async revokeAllUserSessions(userId: string, client?: pg.PoolClient): Promise<number> {
    const executor = client || this.pool;
    const res = await executor.query(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL;`,
      [userId]
    );
    return res.rowCount ?? 0;
  }

  /**
   * Remove uma sessão ativa (logout físico).
   */
  async deleteSession(sessionIdOrToken: string, client?: pg.PoolClient): Promise<boolean> {
    const executor = client || this.pool;
    const tokenHash = crypto.createHash('sha256').update(sessionIdOrToken).digest('hex');
    const res = await executor.query('DELETE FROM sessions WHERE id = $1 OR token_hash = $2;', [sessionIdOrToken, tokenHash]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Remove todas as sessões de um determinado usuário.
   */
  async deleteUserSessions(userId: string, client?: pg.PoolClient): Promise<number> {
    const executor = client || this.pool;
    const res = await executor.query('DELETE FROM sessions WHERE user_id = $1;', [userId]);
    return res.rowCount ?? 0;
  }

  /**
   * Lista sessões detalhadas para auditoria e painel administrativo.
   */
  async listAdminSessions(options?: {
    userId?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }, client?: pg.PoolClient): Promise<{ sessions: AdminSessionView[]; total: number }> {
    const executor = client || this.pool;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (options?.userId) {
      conditions.push(`s.user_id = $${idx++}`);
      values.push(options.userId);
    }

    if (options?.activeOnly !== false) {
      conditions.push(`s.revoked_at IS NULL AND s.expires_at > $${idx++}`);
      values.push(new Date().toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await executor.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM sessions s ${whereClause};`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const dataRes = await executor.query<{
      id: string;
      user_id: string;
      ip_address: string | null;
      user_agent: string | null;
      expires_at: string;
      created_at: string;
      last_activity_at: string | null;
      revoked_at: string | null;
      username: string;
      name: string;
      is_active_account: boolean;
    }>(
      `SELECT 
         s.id, s.user_id, s.ip_address, s.user_agent, s.expires_at, s.created_at, 
         s.last_activity_at, s.revoked_at,
         u.username, u.name, u.is_active AS is_active_account
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++};`,
      [...values, limit, offset]
    );

    return {
      sessions: dataRes.rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        ip_address: r.ip_address,
        user_agent: r.user_agent,
        expires_at: r.expires_at,
        created_at: r.created_at,
        last_activity_at: r.last_activity_at || r.created_at,
        revoked_at: r.revoked_at,
        username: r.username,
        name: r.name,
        is_active_account: r.is_active_account,
      })),
      total,
    };
  }

  /**
   * Limpa sessões expiradas.
   */
  async cleanExpiredSessions(client?: pg.PoolClient): Promise<number> {
    const executor = client || this.pool;
    const res = await executor.query('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP;');
    return res.rowCount ?? 0;
  }
}
