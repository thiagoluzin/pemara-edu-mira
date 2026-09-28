/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — ROTAS DE AUTENTICAÇÃO E SESSÃO LOCAL (E3)
 * Login individual de professores e administradores em PostgreSQL sem dependência externa.
 * Sessões exclusivamente via cookies HttpOnly/SameSite e sem exposição de hashes de senha.
 */

import { Router, Request, Response } from 'express';
import pg from 'pg';
import { UserRepository } from '../repositories/userRepository';
import { SessionRepository } from '../repositories/sessionRepository';
import { AuthEventRepository } from '../repositories/authEventRepository';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { requireAuth, requireRole, extractToken } from '../auth/middleware';
import { withTransaction } from '../db/pool';

export function createAuthRouter(pool: pg.Pool): Router {
  const router = Router();
  const userRepo = new UserRepository(pool);
  const sessionRepo = new SessionRepository(pool);
  const authEventRepo = new AuthEventRepository(pool);

  // POST /api/auth/login
  router.post('/login', async (req: Request, res: Response) => {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'Unknown';

    try {
      const { usernameOrEmail, username, email, password } = req.body || {};
      const identifier = (usernameOrEmail || username || email || '').trim();

      if (!identifier || !password) {
        return res.status(400).json({ error: 'Credenciais incompletas: usuário/e-mail e senha são obrigatórios.' });
      }

      // 1. Verificação de Rate Limit contra ataques de força bruta
      const userLimit = await authEventRepo.checkRateLimit(identifier);
      const ipLimit = await authEventRepo.checkRateLimit(ipAddress);
      if (userLimit.isBlocked || ipLimit.isBlocked) {
        const remaining = Math.max(userLimit.remainingSeconds, ipLimit.remainingSeconds);
        return res.status(429).json({
          error: `Muitas tentativas incorretas. Conta ou IP temporariamente bloqueados. Tente novamente em ${remaining} segundos.`,
          code: 'RATE_LIMITED',
          remainingSeconds: remaining,
        });
      }

      // 2. Buscar por username ou email
      let user = await userRepo.findByUsername(identifier);
      if (!user) {
        user = await userRepo.findByEmail(identifier);
      }

      // Se usuário não existir
      if (!user) {
        await authEventRepo.recordFailedAttempt(identifier);
        await authEventRepo.recordFailedAttempt(ipAddress);
        await authEventRepo.recordEvent({
          usernameAttempted: identifier,
          eventType: 'LOGIN_FAILED',
          ip: ipAddress,
          userAgent,
          details: { reason: 'user_not_found' },
        });
        return res.status(401).json({ error: 'Credenciais inválidas: usuário ou senha incorretos.' });
      }

      // Se a conta estiver desativada
      if (!user.is_active) {
        await authEventRepo.recordEvent({
          userId: user.id,
          usernameAttempted: identifier,
          eventType: 'LOGIN_FAILED',
          ip: ipAddress,
          userAgent,
          details: { reason: 'account_inactive' },
        });
        return res.status(403).json({ error: 'Conta de usuário desativada. Contate o administrador.' });
      }

      // 3. Validação estrita de senha criptográfica
      const isValidPassword = verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        await authEventRepo.recordFailedAttempt(identifier);
        await authEventRepo.recordFailedAttempt(ipAddress);
        await authEventRepo.recordEvent({
          userId: user.id,
          usernameAttempted: identifier,
          eventType: 'LOGIN_FAILED',
          ip: ipAddress,
          userAgent,
          details: { reason: 'invalid_password' },
        });
        return res.status(401).json({ error: 'Credenciais inválidas: usuário ou senha incorretos.' });
      }

      // 4. Sucesso: limpar contadores de falhas
      await authEventRepo.clearFailedAttempts(identifier);
      await authEventRepo.clearFailedAttempts(ipAddress);

      // Criar sessão de 7 dias com separação de identificador público e secretToken
      const { session, secretToken } = await sessionRepo.createSession(user.id, {
        ip: ipAddress,
        userAgent,
        ttlHours: 7 * 24,
      });

      // 5. Registrar evento de sucesso
      await authEventRepo.recordEvent({
        userId: user.id,
        usernameAttempted: user.username,
        eventType: 'LOGIN_SUCCESS',
        ip: ipAddress,
        userAgent,
      });

      // 6. Definir cookie seguro local (HttpOnly) transmitindo exclusivamente o secretToken (R4)
      res.cookie('pemara_session', secretToken, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
        path: '/',
      });

      // DTO estritamente seguro: NUNCA expor password_hash ou o token de sessão no corpo JSON
      const safeUser = userRepo.toSafeUser(user);

      return res.json({
        success: true,
        user: safeUser,
      });
    } catch (err: any) {
      console.error('[Auth] Erro no login:', err);
      return res.status(500).json({ error: 'Erro interno ao autenticar usuário.' });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (req: Request, res: Response) => {
    try {
      const token = extractToken(req) || req.session?.id;
      const userId = req.user?.id || req.session?.user_id;
      const username = req.user?.username || 'desconhecido';
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      if (token) {
        await sessionRepo.revokeSession(token);
      }

      if (userId) {
        await authEventRepo.recordEvent({
          userId,
          usernameAttempted: username,
          eventType: 'LOGOUT',
          ip: ipAddress,
          userAgent: req.headers['user-agent'] as string,
        });
      }

      res.clearCookie('pemara_session', { path: '/' });
      return res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
    } catch (err: any) {
      console.error('[Auth] Erro no logout:', err);
      return res.status(500).json({ error: 'Erro interno ao encerrar sessão.' });
    }
  });

  // GET /api/auth/me (requer autenticação)
  router.get('/me', requireAuth, async (req: Request, res: Response) => {
    const user = req.user;
    return res.json({
      authenticated: true,
      user, // SafeUser: password_hash nunca incluído
    });
  });

  // POST /api/auth/change-password (alteração da própria senha)
  router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const user = req.user!;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 4) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres.' });
      }

      const fullUser = await userRepo.findById(user.id);
      if (!fullUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const isCurrentValid = verifyPassword(currentPassword, fullUser.password_hash);
      if (!isCurrentValid) {
        return res.status(401).json({ error: 'Senha atual incorreta.' });
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'Unknown';

      // Transação atômica: atualização de senha, revogação de sessões antigas, criação de nova sessão e auditoria
      const { newSecretToken } = await withTransaction(async (client) => {
        const newHash = hashPassword(newPassword);
        await userRepo.updatePassword(user.id, newHash, client);
        await sessionRepo.revokeAllUserSessions(user.id, client);
        const created = await sessionRepo.createSession(user.id, { ip: ipAddress, userAgent, ttlHours: 7 * 24 }, client);
        await authEventRepo.recordEvent({
          userId: user.id,
          usernameAttempted: user.username,
          eventType: 'PASSWORD_CHANGE',
          ip: ipAddress,
          userAgent,
        }, client);
        return { newSecretToken: created.secretToken };
      }, pool);

      res.cookie('pemara_session', newSecretToken, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
        path: '/',
      });

      return res.json({ success: true, message: 'Senha alterada com sucesso.' });
    } catch (err: any) {
      console.error('[Auth] Erro ao trocar senha:', err);
      return res.status(500).json({ error: 'Erro interno ao alterar senha.' });
    }
  });

  // GET /api/auth/users (exclusivo para administrador - RBAC estrito)
  router.get('/users', requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
    try {
      const users = await userRepo.listAll();
      return res.json({ users });
    } catch (err: any) {
      console.error('[Auth] Erro ao listar usuários:', err);
      return res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
  });

  return router;
}
