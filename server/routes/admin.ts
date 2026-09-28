/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — ROTAS DO PAINEL ADMINISTRATIVO (E3 / E4)
 * Acesso geral com auditoria imutável, gestão de contas, sessões,
 * proteção do último administrador e restauração de acervo.
 */

import { Router, Request, Response } from 'express';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { UserRepository } from '../repositories/userRepository';
import { SessionRepository } from '../repositories/sessionRepository';
import { AuthEventRepository } from '../repositories/authEventRepository';
import { LessonRepository } from '../repositories/lessonRepository';
import { hashPassword } from '../auth/passwords';
import { requireAuth, requireRole } from '../auth/middleware';
import { checkDbHealth, withTransaction } from '../db/pool';
import { DbUser } from '../db/types';

export function createAdminRouter(pool: pg.Pool): Router {
  const router = Router();
  const userRepo = new UserRepository(pool);
  const sessionRepo = new SessionRepository(pool);
  const authEventRepo = new AuthEventRepository(pool);
  const lessonRepo = new LessonRepository(pool);

  // Todo o roteador /api/admin é estritamente restrito a administradores
  router.use(requireAuth, requireRole('admin'));

  // ====================================================================
  // 1. VISÃO GERAL (OVERVIEW)
  // ====================================================================
  router.get('/overview', async (req: Request, res: Response) => {
    try {
      // 1. Contas ativas e inativas
      const allUsers = await userRepo.listAll({ activeOnly: false });
      const activeUsers = allUsers.filter((u) => u.is_active).length;
      const inactiveUsers = allUsers.length - activeUsers;

      // 2. Sessões ativas
      const sessionsData = await sessionRepo.listAdminSessions({ activeOnly: true });
      const activeSessionsCount = sessionsData.total;

      // 3. Falhas recentes de login (últimas 24h)
      const recentEvents = await authEventRepo.listEvents({ eventType: 'LOGIN_FAILED', limit: 100 });
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const recentLoginFailures = recentEvents.events.filter(
        (e) => new Date(e.created_at).getTime() >= oneDayAgo
      ).length;

      // 4. Aulas e rascunhos por professor
      const lessonsData = await lessonRepo.listAllLessonsAdmin({ includeDeleted: false, limit: 1000 });
      const lessonsByTeacher: Record<string, { teacherName: string; username: string; lessonsCount: number; draftsCount: number }> = {};

      for (const l of lessonsData.lessons) {
        if (!lessonsByTeacher[l.owner_id]) {
          lessonsByTeacher[l.owner_id] = {
            teacherName: l.owner_name || 'Desconhecido',
            username: l.owner_username || 'desconhecido',
            lessonsCount: 0,
            draftsCount: 0,
          };
        }
        lessonsByTeacher[l.owner_id].lessonsCount++;
        if (l.has_draft) {
          lessonsByTeacher[l.owner_id].draftsCount++;
        }
      }

      // 5. Situação do banco e último backup
      const dbHealth = await checkDbHealth();

      let lastBackupStatus = 'não configurado';
      const backupDir = path.resolve('backups');
      if (fs.existsSync(backupDir)) {
        const backupFiles = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json') || f.endsWith('.enc'));
        if (backupFiles.length > 0) {
          backupFiles.sort().reverse();
          lastBackupStatus = `Disponível (${backupFiles[0]})`;
        }
      }

      return res.json({
        users: {
          total: allUsers.length,
          active: activeUsers,
          inactive: inactiveUsers,
        },
        sessions: {
          activeCount: activeSessionsCount,
        },
        security: {
          recentLoginFailures,
        },
        lessons: {
          totalLessons: lessonsData.total,
          byTeacher: Object.values(lessonsByTeacher),
        },
        system: {
          database: dbHealth,
          lastBackup: lastBackupStatus,
        },
      });
    } catch (err: any) {
      console.error('[Admin API] Erro no overview:', err);
      return res.status(500).json({ error: 'Erro ao gerar visão geral administrativa.' });
    }
  });

  // ====================================================================
  // 2. USUÁRIOS E PERMISSÕES
  // ====================================================================

  // GET /api/admin/users (listar e pesquisar contas)
  router.get('/users', async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const role = req.query.role as string | undefined;
      const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await userRepo.listFiltered({ search, role, isActive, limit, offset });
      return res.json(result);
    } catch (err: any) {
      console.error('[Admin API] Erro ao listar usuários:', err);
      return res.status(500).json({ error: 'Erro ao consultar usuários.' });
    }
  });

  // POST /api/admin/users (cadastrar novo professor ou usuário)
  router.post('/users', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const { username, name, email, password, role = 'teacher', is_active = true } = req.body;

      if (!username || !name || !email || !password) {
        return res.status(400).json({ error: 'Campos username, name, email e password são obrigatórios.' });
      }

      if (typeof password !== 'string' || password.length < 4) {
        return res.status(400).json({ error: 'A senha inicial deve ter no mínimo 4 caracteres.' });
      }

      const existingUser = await userRepo.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: `O nome de usuário "${username}" já está em uso.` });
      }

      const existingEmail = await userRepo.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: `O e-mail "${email}" já está cadastrado.` });
      }

      const passwordHash = hashPassword(password);
      const created = await userRepo.create({
        username: username.trim().toLowerCase(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        role,
        is_active,
      });

      await authEventRepo.recordEvent({
        userId: created.id,
        usernameAttempted: created.username,
        eventType: 'ACCOUNT_CREATED',
        ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] as string,
        details: { createdByAdminId: admin.id, role },
      });

      return res.status(201).json({
        success: true,
        user: userRepo.toSafeUser(created),
      });
    } catch (err: any) {
      console.error('[Admin API] Erro ao criar usuário:', err);
      return res.status(500).json({ error: err.message || 'Erro ao cadastrar usuário.' });
    }
  });

  // PATCH /api/admin/users/:id (atualizar dados, ativar/desativar, atribuir papéis)
  router.patch('/users/:id', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const targetId = req.params.id;
      const { name, email, role, is_active } = req.body;

      // Execução transacional para proteger o último administrador contra concorrência
      const updatedUser = await withTransaction<DbUser>(async (client: pg.PoolClient): Promise<DbUser> => {
        // Bloqueia a linha do usuário alvo para leitura e modificação
        const targetRes = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE;', [targetId]);
        if (targetRes.rows.length === 0) {
          throw new Error('USER_NOT_FOUND');
        }
        const targetUser = targetRes.rows[0];

        // Se o usuário alvo for administrador ativo e a operação tentar desativá-lo ou rebaixá-lo:
        const isDemotingOrDeactivating =
          targetUser.role === 'admin' &&
          targetUser.is_active === true &&
          ((is_active === false) || (role && role !== 'admin'));

        if (isDemotingOrDeactivating) {
          // Lock transacional exclusivo para serializar qualquer alteração em contas de administradores (R2)
          await client.query(`SELECT pg_advisory_xact_lock(739282);`);
          const activeAdminsCount = await userRepo.countActiveAdmins(client);

          if (activeAdminsCount <= 1) {
            throw new Error('LAST_ACTIVE_ADMIN_PROTECTED');
          }
        }

        const updated = await userRepo.update(targetId, { name, email, role, is_active }, client);

        // Se foi desativado, revoga todas as sessões ativas imediatamente
        if (is_active === false) {
          await sessionRepo.revokeAllUserSessions(targetId, client);
        }

        // Registrar auditoria atomicamente dentro da mesma transação (B1 item 9)
        const eventType = is_active === false ? 'ACCOUNT_DEACTIVATED' : (is_active === true ? 'ACCOUNT_ACTIVATED' : 'ROLE_CHANGE');
        await authEventRepo.recordEvent({
          userId: targetId,
          usernameAttempted: updated.username,
          eventType,
          details: { updatedByAdminId: admin.id, changes: { name, email, role, is_active } },
        }, client);

        return updated;
      }, pool);

      return res.json({
        success: true,
        user: userRepo.toSafeUser(updatedUser),
      });
    } catch (err: any) {
      if (err.message === 'LAST_ACTIVE_ADMIN_PROTECTED') {
        return res.status(409).json({
          error: 'Operação bloqueada: não é permitido desativar ou rebaixar o único administrador ativo do sistema.',
          code: 'LAST_ADMIN_PROTECTED',
        });
      }
      if (err.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }
      console.error('[Admin API] Erro ao atualizar usuário:', err);
      return res.status(500).json({ error: err.message || 'Erro ao atualizar usuário.' });
    }
  });

  // POST /api/admin/users/:id/reset-password (redefinir senha de um professor pelo admin)
  router.post('/users/:id/reset-password', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const targetId = req.params.id;
      const { newPassword } = req.body;

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres.' });
      }

      const targetUser = await userRepo.findById(targetId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const newHash = hashPassword(newPassword);

      const revoked = await withTransaction(async (client) => {
        await userRepo.updatePassword(targetId, newHash, client);
        // Redefinição revoga todas as sessões anteriores imediatamente
        const count = await sessionRepo.revokeAllUserSessions(targetId, client);
        await authEventRepo.recordEvent({
          userId: targetId,
          usernameAttempted: targetUser.username,
          eventType: 'PASSWORD_RESET',
          details: { resetByAdminId: admin.id, revokedSessionsCount: count },
        }, client);
        return count;
      }, pool);

      // Nunca exibir a senha ou hash após o cadastro
      return res.json({
        success: true,
        message: `Senha redefinida com sucesso. ${revoked} sessão(ões) revogada(s).`,
      });
    } catch (err: any) {
      console.error('[Admin API] Erro ao resetar senha:', err);
      return res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
    }
  });

  // ====================================================================
  // 3. SESSÕES E REGISTROS DE LOGIN
  // ====================================================================

  // GET /api/admin/sessions (listar sessões)
  router.get('/sessions', async (req: Request, res: Response) => {
    try {
      const userId = req.query.user_id as string | undefined;
      const activeOnly = req.query.active_only !== 'false';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await sessionRepo.listAdminSessions({ userId, activeOnly, limit, offset });
      return res.json(result);
    } catch (err: any) {
      console.error('[Admin API] Erro ao listar sessões:', err);
      return res.status(500).json({ error: 'Erro ao consultar sessões.' });
    }
  });

  // DELETE /api/admin/sessions/:sessionId (revogar sessão específica)
  router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const sessionId = req.params.sessionId;

      const success = await sessionRepo.revokeSession(sessionId);
      if (success) {
        await authEventRepo.recordEvent({
          usernameAttempted: 'sistema',
          eventType: 'SESSION_REVOKED',
          details: { sessionId, revokedByAdminId: admin.id },
        });
      }

      return res.json({ success: true, message: 'Sessão revogada com sucesso.' });
    } catch (err: any) {
      console.error('[Admin API] Erro ao revogar sessão:', err);
      return res.status(500).json({ error: 'Erro ao revogar sessão.' });
    }
  });

  // POST /api/admin/sessions/:sessionId/revoke (revogar sessão específica via POST)
  router.post('/sessions/:sessionId/revoke', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const sessionId = req.params.sessionId;

      const success = await sessionRepo.revokeSession(sessionId);
      if (success) {
        await authEventRepo.recordEvent({
          usernameAttempted: 'sistema',
          eventType: 'SESSION_REVOKED',
          details: { sessionId, revokedByAdminId: admin.id },
        });
      }

      return res.json({ success: true, message: 'Sessão revogada com sucesso.' });
    } catch (err: any) {
      console.error('[Admin API] Erro ao revogar sessão:', err);
      return res.status(500).json({ error: 'Erro ao revogar sessão.' });
    }
  });

  // DELETE /api/admin/users/:userId/sessions (revogar todas as sessões de um usuário)
  router.delete('/users/:userId/sessions', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const userId = req.params.userId;

      const count = await sessionRepo.revokeAllUserSessions(userId);
      await authEventRepo.recordEvent({
        userId,
        usernameAttempted: 'sistema',
        eventType: 'ALL_SESSIONS_REVOKED',
        details: { count, revokedByAdminId: admin.id },
      });

      return res.json({ success: true, count, message: `${count} sessão(ões) revogada(s).` });
    } catch (err: any) {
      console.error('[Admin API] Erro ao revogar sessões do usuário:', err);
      return res.status(500).json({ error: 'Erro ao revogar sessões do usuário.' });
    }
  });

  // GET /api/admin/logs (registros de eventos de autenticação e segurança paginados)
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const eventType = req.query.event_type as string | undefined;
      const userId = req.query.user_id as string | undefined;
      const search = req.query.search as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await authEventRepo.listEvents({ eventType, userId, search, limit, offset });
      return res.json(result);
    } catch (err: any) {
      console.error('[Admin API] Erro ao listar logs:', err);
      return res.status(500).json({ error: 'Erro ao consultar registros de auditoria.' });
    }
  });

  // ====================================================================
  // 4. AULAS E HISTÓRICO GERAL (ACERVO INTEGRADO)
  // ====================================================================

  // GET /api/admin/lessons (consultar aulas de todos os professores)
  router.get('/lessons', async (req: Request, res: Response) => {
    try {
      const ownerId = req.query.owner_id as string | undefined;
      const subjectCode = req.query.subject_code as string | undefined;
      const gradeLevel = req.query.grade_level as string | undefined;
      const search = req.query.search as string | undefined;
      const includeDeleted = req.query.include_deleted === 'true';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await lessonRepo.listAllLessonsAdmin({
        ownerId,
        subjectCode,
        gradeLevel,
        search,
        includeDeleted,
        limit,
        offset,
      });

      return res.json(result);
    } catch (err: any) {
      console.error('[Admin API] Erro ao listar aulas:', err);
      return res.status(500).json({ error: 'Erro ao consultar aulas.' });
    }
  });

  // GET /api/admin/lessons/:id (detalhes da aula e histórico de atividades)
  router.get('/lessons/:id', async (req: Request, res: Response) => {
    try {
      const lessonData = await lessonRepo.getLessonWithCurrentSpec(req.params.id);
      if (!lessonData) {
        return res.status(404).json({ error: 'Aula não encontrada.' });
      }

      const revisions = await lessonRepo.listLessonRevisions(req.params.id);
      const activity = await lessonRepo.getLessonActivityHistory(req.params.id);

      return res.json({
        lesson: lessonData.lesson,
        currentSpec: lessonData.currentRevision.spec_json,
        currentVersion: lessonData.currentRevision.version,
        draft: lessonData.draft,
        revisions,
        activity,
      });
    } catch (err: any) {
      console.error('[Admin API] Erro ao obter aula:', err);
      return res.status(500).json({ error: 'Erro ao consultar aula.' });
    }
  });

  // GET /api/admin/lessons/:id/revisions (histórico de revisões da aula)
  router.get('/lessons/:id/revisions', async (req: Request, res: Response) => {
    try {
      const revisions = await lessonRepo.listLessonRevisions(req.params.id);
      return res.json({ revisions });
    } catch (err: any) {
      console.error('[Admin API] Erro ao obter revisões:', err);
      return res.status(500).json({ error: 'Erro ao consultar histórico de revisões.' });
    }
  });

  // POST /api/admin/lessons/:id/restore (restaurar versão via body { revisionNumber, reason })
  router.post('/lessons/:id/restore', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const { revisionNumber, version, reason } = req.body;
      const targetVersion = Number(revisionNumber || version || 1);

      const revisions = await lessonRepo.listLessonRevisions(req.params.id);
      const revToRestore = revisions.find((r) => r.version === targetVersion);
      if (!revToRestore) {
        return res.status(404).json({ error: `Revisão v${targetVersion} não encontrada.` });
      }

      const changeSummary = `Restauração da revisão v${targetVersion} pelo administrador ${admin.name} (motivo: ${reason || 'Não informado'})`;

      const result = await lessonRepo.saveNewVersion({
        lessonId: req.params.id,
        spec: revToRestore.spec_json,
        changeSummary,
        actorId: admin.id,
        isRestore: true,
      });

      await authEventRepo.recordEvent({
        userId: admin.id,
        usernameAttempted: admin.username,
        eventType: 'LESSON_RESTORED',
        details: {
          lessonId: req.params.id,
          restoredFromVersion: targetVersion,
          newVersion: result.lesson.current_version,
          reason,
        },
      });

      return res.json({
        success: true,
        message: `Versão ${targetVersion} restaurada com sucesso como revisão v${result.lesson.current_version}.`,
        lesson: result.lesson,
        revision: result.revision,
      });
    } catch (err: any) {
      console.error('[Admin API] Erro ao restaurar revisão:', err);
      return res.status(500).json({ error: err.message || 'Erro ao restaurar revisão.' });
    }
  });

  // POST /api/admin/lessons/:id/revisions/:version/restore (restaurar uma versão como nova revisão)
  router.post('/lessons/:id/revisions/:version/restore', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const { reason } = req.body;
      const targetVersion = parseInt(req.params.version, 10);

      const revisions = await lessonRepo.listLessonRevisions(req.params.id);
      const revToRestore = revisions.find((r) => r.version === targetVersion);
      if (!revToRestore) {
        return res.status(404).json({ error: `Revisão v${targetVersion} não encontrada.` });
      }

      const changeSummary = `Restauração administrativa da revisão v${targetVersion} por ${admin.name} (motivo: ${reason || 'Não informado'})`;

      const result = await lessonRepo.saveNewVersion({
        lessonId: req.params.id,
        spec: revToRestore.spec_json,
        changeSummary,
        actorId: admin.id,
        isRestore: true,
      });

      await authEventRepo.recordEvent({
        userId: admin.id,
        usernameAttempted: admin.username,
        eventType: 'LESSON_RESTORED',
        details: {
          lessonId: req.params.id,
          restoredFromVersion: targetVersion,
          newVersion: result.lesson.current_version,
          reason,
        },
      });

      return res.json({
        success: true,
        message: `Versão ${targetVersion} restaurada com sucesso como revisão v${result.lesson.current_version}.`,
        lesson: result.lesson,
        revision: result.revision,
      });
    } catch (err: any) {
      console.error('[Admin API] Erro ao restaurar revisão:', err);
      return res.status(500).json({ error: err.message || 'Erro ao restaurar revisão.' });
    }
  });

  // POST /api/admin/lessons/:id/transfer (transferência administrativa de titularidade de aula)
  router.post('/lessons/:id/transfer', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const { newOwnerId, reason } = req.body;

      if (!newOwnerId || !reason) {
        return res.status(400).json({ error: 'Campos newOwnerId e reason são obrigatórios para transferência.' });
      }

      const newOwner = await userRepo.findById(newOwnerId);
      if (!newOwner) {
        return res.status(404).json({ error: 'Novo professor proprietário não encontrado.' });
      }

      const transferred = await lessonRepo.transferOwnership({
        lessonId: req.params.id,
        newOwnerId,
        adminActorId: admin.id,
        reason,
      });

      await authEventRepo.recordEvent({
        userId: admin.id,
        usernameAttempted: admin.username,
        eventType: 'LESSON_TRANSFERRED',
        details: {
          lessonId: req.params.id,
          toUserId: newOwnerId,
          toUsername: newOwner.username,
          reason,
        },
      });

      return res.json({
        success: true,
        message: `Titularidade da aula transferida para ${newOwner.name} (${newOwner.username}).`,
        lesson: transferred,
      });
    } catch (err: any) {
      console.error('[Admin API] Erro ao transferir titularidade:', err);
      return res.status(500).json({ error: err.message || 'Erro ao transferir titularidade da aula.' });
    }
  });

  // GET /api/admin/export (exportação administrativa segura do acervo e histórico)
  router.get('/export', async (req: Request, res: Response) => {
    try {
      const admin = req.user!;
      const lessonsData = await lessonRepo.listAllLessonsAdmin({ includeDeleted: true, limit: 10000 });
      const usersData = await userRepo.listAll({ activeOnly: false });
      const eventsData = await authEventRepo.listEvents({ limit: 10000 });

      // NUNCA incluir segredos, senhas ou tokens
      const exportEnvelope = {
        metadata: {
          exported_at: new Date().toISOString(),
          exported_by_admin: {
            id: admin.id,
            username: admin.username,
            name: admin.name,
          },
          total_lessons: lessonsData.total,
          total_users: usersData.length,
          total_events: eventsData.total,
        },
        users: usersData,
        lessons: lessonsData.lessons,
        audit_events: eventsData.events,
      };

      await authEventRepo.recordEvent({
        userId: admin.id,
        usernameAttempted: admin.username,
        eventType: 'ARCHIVE_EXPORTED',
        details: {
          exportedCount: lessonsData.total,
        },
      });

      res.setHeader('Content-Disposition', `attachment; filename="pemara_admin_export_${Date.now()}.json"`);
      return res.json(exportEnvelope);
    } catch (err: any) {
      console.error('[Admin API] Erro ao exportar acervo:', err);
      return res.status(500).json({ error: 'Erro ao exportar acervo administrativo.' });
    }
  });

  return router;
}
