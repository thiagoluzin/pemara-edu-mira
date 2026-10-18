/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — SEED INICIAL DE USUÁRIOS E PERFIS (E3)
 * Popula usuários canônicos com papéis administrativos, editoriais e docentes
 * de forma 100% idempotente no PostgreSQL.
 */

import pg from 'pg';
import crypto from 'crypto';
import { hashPassword } from '../../auth/passwords';

export interface SeedUserDef {
  username: string;
  name: string;
  email: string;
  passwordText: string;
  role: 'admin' | 'curator' | 'editor' | 'teacher';
}

export const INITIAL_USERS: SeedUserDef[] = [
  {
    username: 'admin',
    name: 'Administrador Geral',
    email: 'admin@pemara.local',
    passwordText: 'admin',
    role: 'admin',
  },
  {
    username: 'curador.ana',
    name: 'Ana Curadora de Conteúdo',
    email: 'ana.curadoria@pemara.local',
    passwordText: 'ana123',
    role: 'curator',
  },
  {
    username: 'editor.bruno',
    name: 'Bruno Editor Didático',
    email: 'bruno.editor@pemara.local',
    passwordText: 'bruno123',
    role: 'editor',
  },
  {
    username: 'prof.helena',
    name: 'Prof. Helena Nogueira (História)',
    email: 'helena.nogueira@escola.local',
    passwordText: 'helena123',
    role: 'teacher',
  },
  {
    username: 'prof.carlos',
    name: 'Prof. Carlos Silva (Matemática)',
    email: 'carlos.silva@escola.local',
    passwordText: 'carlos123',
    role: 'teacher',
  },
];

/**
 * Insere os usuários canônicos no banco relacional caso ainda não existam.
 */
export async function seedInitialUsers(pool: pg.Pool): Promise<{ createdCount: number; existingCount: number }> {
  if(process.env.PEMARA_SINGLE_TEACHER==='true')return {createdCount:0,existingCount:0};
  let createdCount = 0;
  let existingCount = 0;

  // Em produção estrita sem flag de demonstração, apenas o administrador inicial é criado no bootstrap
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDemoUsers = !isProduction || process.env.SEED_DEMO_USERS === 'true' || process.env.TEST_MODE === 'true';

  const usersToSeed = allowDemoUsers ? INITIAL_USERS : [INITIAL_USERS[0]];

  for (const user of usersToSeed) {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1;', [user.username]);
    if (existing.rows.length > 0) {
      existingCount++;
      continue;
    }

    const id = crypto.randomUUID();
    const passwordHash = hashPassword(user.passwordText);

    await pool.query(
      `INSERT INTO users (id, username, name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE);`,
      [id, user.username, user.name, user.email, passwordHash, user.role]
    );
    createdCount++;
  }

  return { createdCount, existingCount };
}
