/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — REPOSITÓRIO DE USUÁRIOS E PROFESSORES (E2)
 */

import pg from 'pg';
import crypto from 'crypto';
import { getPool } from '../db/pool';
import { DbUser, SafeUser } from '../db/types';

export class UserRepository {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool || getPool();
  }

  async create(user: {
    id?: string;
    username: string;
    name: string;
    email: string;
    password_hash: string;
    role?: 'teacher' | 'editor' | 'curator' | 'admin';
    is_active?: boolean;
  }, client?: pg.PoolClient): Promise<DbUser> {
    const executor = client || this.pool;
    const id = user.id || crypto.randomUUID();
    const role = user.role || 'teacher';
    const isActive = user.is_active ?? true;

    const res = await executor.query<DbUser>(
      `INSERT INTO users (id, username, name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [id, user.username, user.name, user.email, user.password_hash, role, isActive]
    );

    return res.rows[0];
  }

  async findById(id: string, client?: pg.PoolClient): Promise<DbUser | null> {
    const executor = client || this.pool;
    const res = await executor.query<DbUser>(
      'SELECT * FROM users WHERE id = $1;',
      [id]
    );
    return res.rows[0] || null;
  }

  async findByUsername(username: string, client?: pg.PoolClient): Promise<DbUser | null> {
    const executor = client || this.pool;
    const res = await executor.query<DbUser>(
      'SELECT * FROM users WHERE username = $1;',
      [username]
    );
    return res.rows[0] || null;
  }

  async findByEmail(email: string, client?: pg.PoolClient): Promise<DbUser | null> {
    const executor = client || this.pool;
    const res = await executor.query<DbUser>(
      'SELECT * FROM users WHERE email = $1;',
      [email]
    );
    return res.rows[0] || null;
  }

  toSafeUser(user: DbUser): SafeUser {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async countActiveAdmins(client?: pg.PoolClient): Promise<number> {
    const executor = client || this.pool;
    const res = await executor.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = TRUE;`
    );
    return parseInt(res.rows[0].count, 10);
  }

  async update(id: string, updates: Partial<Pick<DbUser, 'name' | 'email' | 'password_hash' | 'role' | 'is_active'>>, client?: pg.PoolClient): Promise<DbUser> {
    const executor = client || this.pool;
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(updates.email);
    }
    if (updates.password_hash !== undefined) {
      fields.push(`password_hash = $${idx++}`);
      values.push(updates.password_hash);
    }
    if (updates.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(updates.role);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(updates.is_active);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const res = await executor.query<DbUser>(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`,
      values
    );

    if (res.rows.length === 0) {
      throw new Error(`Usuário ${id} não encontrado.`);
    }

    return res.rows[0];
  }

  async updatePassword(id: string, passwordHash: string, client?: pg.PoolClient): Promise<void> {
    const executor = client || this.pool;
    const res = await executor.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
      [passwordHash, id]
    );
    if ((res.rowCount ?? 0) === 0) {
      throw new Error(`Usuário ${id} não encontrado.`);
    }
  }

  async deactivate(id: string, client?: pg.PoolClient): Promise<DbUser> {
    const executor = client || this.pool;
    const res = await executor.query<DbUser>(
      `UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new Error(`Usuário ${id} não encontrado.`);
    }

    return res.rows[0];
  }

  async listAll(options?: { activeOnly?: boolean }, client?: pg.PoolClient): Promise<SafeUser[]> {
    const executor = client || this.pool;
    const activeFilter = options?.activeOnly !== false ? 'WHERE is_active = TRUE' : '';
    const res = await executor.query<DbUser>(
      `SELECT id, username, name, email, role, is_active, created_at, updated_at 
       FROM users ${activeFilter} 
       ORDER BY name ASC;`
    );
    return res.rows.map((u) => this.toSafeUser(u));
  }

  async listFiltered(filter?: {
    search?: string;
    role?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }, client?: pg.PoolClient): Promise<{ users: SafeUser[]; total: number }> {
    const executor = client || this.pool;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter?.search) {
      const q = `%${filter.search.toLowerCase()}%`;
      conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(username) LIKE $${idx} OR LOWER(email) LIKE $${idx})`);
      values.push(q);
      idx++;
    }

    if (filter?.role) {
      conditions.push(`role = $${idx++}`);
      values.push(filter.role);
    }

    if (filter?.isActive !== undefined) {
      conditions.push(`is_active = $${idx++}`);
      values.push(filter.isActive);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await executor.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM users ${whereClause};`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;

    const dataRes = await executor.query<DbUser>(
      `SELECT id, username, name, email, role, is_active, created_at, updated_at 
       FROM users 
       ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${idx++} OFFSET $${idx++};`,
      [...values, limit, offset]
    );

    return {
      users: dataRes.rows.map((u) => this.toSafeUser(u)),
      total,
    };
  }

  async delete(id: string, client?: pg.PoolClient): Promise<void> {
    const executor = client || this.pool;
    await executor.query('DELETE FROM users WHERE id = $1;', [id]);
  }
}

