import type {RequestHandler} from 'express';
import type pg from 'pg';
import {randomBytes, randomUUID} from 'node:crypto';
import {hashPassword} from './passwords';
import {UserRepository} from '../repositories/userRepository';
import type {DbUser, SafeUser} from '../db/types';

// Internal relational ownership only; there is no registration step.
// Reuse the earliest owner to preserve materials from the personal edition.
export async function ensureLocalOwner(pool: pg.Pool): Promise<SafeUser> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
    let owner = (await client.query<DbUser>('SELECT * FROM users ORDER BY created_at, id LIMIT 1')).rows[0];
    if (!owner) {
      owner = (await client.query<DbUser>(
        `INSERT INTO users (id,username,name,email,password_hash,role,is_active)
         VALUES ($1,'local.workspace','Acervo deste computador','local@pemara.local',$2,'admin',TRUE) RETURNING *`,
        [randomUUID(), hashPassword(randomBytes(48).toString('hex'))],
      )).rows[0];
    }
    await client.query('COMMIT');
    return {...new UserRepository(pool).toSafeUser(owner), role:'admin', is_active:true};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export function createLocalWorkspaceMiddleware(getOwner: () => SafeUser | undefined): RequestHandler {
  return (req, res, next) => {
    const hosts = ['127.0.0.1','localhost','[::1]','::1'];
    const peers = ['127.0.0.1','::1','::ffff:127.0.0.1'];
    // Restrict password-free access to this PC and same-origin browser requests.
    if (!hosts.includes(req.hostname) || !peers.includes(req.socket.remoteAddress || '')) {
      return res.status(403).json({error:'Abra o PEMARA neste computador.'});
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({error:'Origem não autorizada.'});
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).origin !== `${req.protocol}://${req.get('host')}`) {
          return res.status(403).json({error:'Origem não autorizada.'});
        }
      } catch { return res.status(403).json({error:'Origem inválida.'}); }
    }
    const owner = getOwner();
    if (!owner) return res.status(503).json({error:'Acervo local ainda não está pronto.'});
    req.user = owner;
    next();
  };
}
