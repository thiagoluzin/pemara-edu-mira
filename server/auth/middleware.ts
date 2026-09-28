/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — MIDDLEWARE DE AUTENTICAÇÃO E PERMISSÕES (E3)
 * Valida sessões ativas no PostgreSQL e impõe controle de acesso baseado em papéis (RBAC).
 */

import { Request, Response, NextFunction } from 'express';
import pg from 'pg';
import { SessionRepository } from '../repositories/sessionRepository';
import { SafeUser, DbSession } from '../db/types';

// Estende a interface Request do Express com usuário e sessão tipados
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      session?: DbSession;
    }
  }
}

/**
 * Extrai o token de sessão do cabeçalho da requisição.
 * Suporta `Authorization: Bearer <token>`, `x-session-id: <token>` e cookie `pemara_session`.
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const customHeader = req.headers['x-session-id'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const sessionCookie = cookies.find((c) => c.startsWith('pemara_session='));
    if (sessionCookie) {
      return sessionCookie.substring('pemara_session='.length).trim();
    }
  }

  return null;
}

/**
 * Middleware que identifica o usuário autenticado caso um token de sessão válido seja fornecido.
 * Não interrompe a requisição caso o token esteja ausente.
 */
export function createAuthMiddleware(sessionRepoOrPool: SessionRepository | pg.Pool) {
  const sessionRepo = sessionRepoOrPool instanceof SessionRepository
    ? sessionRepoOrPool
    : new SessionRepository(sessionRepoOrPool);

  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) {
      return next();
    }

    try {
      const authData = await sessionRepo.getSessionWithUser(token);
      if (authData) {
        req.user = authData.user;
        req.session = authData.session;
      }
    } catch (err) {
      console.error('[AuthMiddleware] Erro ao validar sessão:', err);
    }

    next();
  };
}

/**
 * Middleware que exige autenticação obrigatória.
 * Retorna 401 Unauthorized caso o usuário não esteja logado.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Autenticação necessária para acessar este recurso.',
      code: 'UNAUTHORIZED',
    });
  }
  next();
}

/**
 * Middleware que restringe o acesso a papéis específicos (RBAC).
 * Retorna 403 Forbidden caso o usuário autenticado não possua o papel requerido.
 */
export function requireRole(...allowedRoles: SafeUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Autenticação necessária para acessar este recurso.',
        code: 'UNAUTHORIZED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acesso negado: o perfil "${req.user.role}" não tem permissão para esta operação. Perfis permitidos: ${allowedRoles.join(', ')}.`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}
