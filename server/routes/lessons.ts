/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — ROTAS DA ÁREA DO PROFESSOR (E4 / AULAS)
 * Gerencia acervo privado por professor, autosave e histórico versionado.
 */

import { Router, Request, Response } from 'express';
import pg from 'pg';
import { LessonRepository } from '../repositories/lessonRepository';
import { requireAuth } from '../auth/middleware';
import { validateLessonSpec } from '../../src/schemas/lessonValidator';
import { OptimisticLockError } from '../db/types';

function normalizeLessonSpecForStorage(rawSpec: any, context?: { title?: string; subjectCode?: string; gradeLevel?: string; lessonId?: string }): any {
  if (!rawSpec || typeof rawSpec !== 'object') {
    return rawSpec;
  }
  const spec = { ...rawSpec };
  if (!spec.schema_version) {
    spec.schema_version = '1.0';
  }
  if (!spec.renderer_version) {
    spec.renderer_version = '1.0.0';
  }
  if (!spec.lesson || typeof spec.lesson !== 'object') {
    spec.lesson = {
      id: context?.lessonId || `lesson_${Date.now()}`,
      title: context?.title || spec.title || 'Aula sem título',
      subject: context?.subjectCode || spec.subject || 'history',
      grade: context?.gradeLevel || spec.grade || '6EF',
      duration_minutes: spec.duration_minutes || 50,
    };
  } else {
    spec.lesson = { ...spec.lesson };
    if (!spec.lesson.id) spec.lesson.id = context?.lessonId || `lesson_${Date.now()}`;
    if (!spec.lesson.title) spec.lesson.title = context?.title || spec.title || 'Aula sem título';
    if (!spec.lesson.subject) spec.lesson.subject = context?.subjectCode || 'history';
    if (!spec.lesson.grade) spec.lesson.grade = context?.gradeLevel || '6EF';
    if (!spec.lesson.duration_minutes) spec.lesson.duration_minutes = 50;
  }
  if (!Array.isArray(spec.scenes)) {
    spec.scenes = [];
  } else {
    spec.scenes = spec.scenes.map((s: any, idx: number) => {
      if (!s || typeof s !== 'object') return s;
      const sc = { ...s };
      if (!sc.id) sc.id = `s${idx + 1}`;
      if (!sc.type) sc.type = 'title';
      if (!sc.title) sc.title = `Cena ${idx + 1}`;
      return sc;
    });
  }
  return spec;
}

function validateLessonSpecPayload(spec: any): { isValid: boolean; errors: string[] } {
  if (!spec || typeof spec !== 'object') {
    return { isValid: false, errors: ['spec deve ser um objeto JSON válido.'] };
  }
  if (Array.isArray(spec.scenes) && spec.scenes.length > 0) {
    return validateLessonSpec(spec);
  }
  if (!spec.schema_version) {
    return { isValid: false, errors: ['Campo obrigatório ausente: schema_version.'] };
  }
  return { isValid: true, errors: [] };
}

export function createLessonsRouter(pool: pg.Pool): Router {
  const router = Router();
  const lessonRepo = new LessonRepository(pool);

  // Todas as rotas de aulas exigem autenticação
  router.use(requireAuth);

  // GET /api/lessons (lista o acervo privado do professor logado)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const search = req.query.search as string | undefined;
      const subjectCode = req.query.subject_code as string | undefined;

      const lessons = await lessonRepo.listTeacherLessons(user.id, { search, subjectCode });
      return res.json({ lessons });
    } catch (err: any) {
      console.error('[Lessons API] Erro ao listar aulas:', err);
      return res.status(500).json({ error: 'Erro ao consultar acervo de aulas.' });
    }
  });

  // POST /api/lessons (criação de nova aula pelo professor)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { title, subjectCode, gradeLevel, topic, templateId, spec } = req.body;

      if (!title || !subjectCode || !gradeLevel || !topic || !spec) {
        return res.status(400).json({
          error: 'Campos obrigatórios ausentes: title, subjectCode, gradeLevel, topic e spec.',
        });
      }

      const normalizedSpec = normalizeLessonSpecForStorage(spec, { title, subjectCode, gradeLevel, lessonId: templateId });
      const val = validateLessonSpecPayload(normalizedSpec);
      if (!val.isValid) {
        return res.status(400).json({
          error: 'LessonSpec inválido para criação de aula.',
          validationErrors: val.errors,
        });
      }

      const result = await lessonRepo.createLesson({
        title,
        subjectCode,
        gradeLevel,
        topic,
        templateId,
        spec: normalizedSpec,
        ownerId: user.id,
      });

      return res.status(201).json({
        success: true,
        lesson: result.lesson,
        revision: result.revision,
      });
    } catch (err: any) {
      console.error('[Lessons API] Erro ao criar aula:', err);
      return res.status(500).json({ error: err.message || 'Erro ao criar aula.' });
    }
  });

  // GET /api/lessons/:id (consulta uma aula - restrito ao proprietário ou admin)
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const lessonData = await lessonRepo.getLessonWithCurrentSpec(req.params.id);

      if (!lessonData || (lessonData.lesson.is_deleted && user.role !== 'admin')) {
        return res.status(404).json({ error: 'Aula não encontrada.' });
      }

      // Restrição estrita de privacidade: professor não acessa aula de outro professor
      if (user.role !== 'admin' && lessonData.lesson.owner_id !== user.id) {
        return res.status(403).json({
          error: 'Acesso negado: você não tem permissão para visualizar o acervo de outro professor.',
          code: 'FORBIDDEN',
        });
      }

      return res.json({
        lesson: lessonData.lesson,
        currentSpec: lessonData.currentRevision.spec_json,
        currentVersion: lessonData.currentRevision.version,
        draft: lessonData.draft,
      });
    } catch (err: any) {
      console.error('[Lessons API] Erro ao obter aula:', err);
      return res.status(500).json({ error: 'Erro ao consultar aula.' });
    }
  });

  // POST /api/lessons/:id/draft (Autosave de rascunho persistente)
  router.post('/:id/draft', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { draftSpec, baseVersion = 1, expectedDraftUpdatedAt, force } = req.body;

      if (!draftSpec) {
        return res.status(400).json({ error: 'draftSpec é obrigatório para autosave.' });
      }

      const normalizedDraft = normalizeLessonSpecForStorage(draftSpec, { lessonId: req.params.id });
      const validation = validateLessonSpec(normalizedDraft);
      if (!validation.isValid || !Number.isInteger(Number(baseVersion)) || Number(baseVersion) < 1) {
        return res.status(400).json({ error: 'Rascunho inválido. O conteúdo salvo foi preservado.', details: validation.errors });
      }

      const draft = await lessonRepo.saveDraft(
        req.params.id,
        user.id,
        normalizedDraft,
        Number(baseVersion),
        { expectedDraftUpdatedAt, force: force === true }
      );
      return res.json({
        success: true,
        message: 'Rascunho salvo no PostgreSQL com sucesso.',
        savedAt: draft.updated_at,
        baseVersion: draft.base_version,
      });
    } catch (err: any) {
      if (err instanceof OptimisticLockError || err.name === 'OptimisticLockError') {
        const latest = await lessonRepo.getLessonWithCurrentSpec(req.params.id).catch(() => null);
        return res.status(409).json({
          error: err.message,
          code: 'DRAFT_CONFLICT',
          currentVersion: err.actualVersion ?? err.currentVersion,
          expectedVersion: err.expectedVersion,
          serverDraft: latest?.draft,
          currentSpec: latest?.currentRevision?.spec_json,
        });
      }
      if (err.message && err.message.includes('Permissão negada')) {
        return res.status(403).json({ error: err.message, code: 'FORBIDDEN' });
      }
      console.error('[Lessons API] Erro no autosave:', err);
      return res.status(500).json({ error: err.message || 'Erro ao persistir rascunho.' });
    }
  });

  // PUT /api/lessons/:id (Salvar versão definitiva a partir de edição)
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { spec, changeSummary, expectedVersion } = req.body;

      if (!spec) {
        return res.status(400).json({ error: 'spec é obrigatório para salvar versão.' });
      }

      const existing = await lessonRepo.getLessonWithCurrentSpec(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Aula não encontrada.' });
      }

      if (user.role !== 'admin' && existing.lesson.owner_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: não é permitido alterar aula de outro professor.', code: 'FORBIDDEN' });
      }

      const normalizedSpec = normalizeLessonSpecForStorage(spec, {
        title: existing.lesson.title,
        subjectCode: existing.lesson.subject_code,
        gradeLevel: existing.lesson.grade_level,
        lessonId: req.params.id,
      });

      const val = validateLessonSpecPayload(normalizedSpec);
      if (!val.isValid) {
        return res.status(400).json({
          error: 'LessonSpec inválido para publicação de versão.',
          validationErrors: val.errors,
        });
      }

      const expVer = expectedVersion !== undefined
        ? Number(expectedVersion)
        : (req.headers['if-match'] ? parseInt(req.headers['if-match'].replace(/"/g, ''), 10) : undefined);

      const result = await lessonRepo.saveNewVersion({
        lessonId: req.params.id,
        spec: normalizedSpec,
        changeSummary: changeSummary || 'Atualização autoral pelo professor',
        actorId: user.id,
        expectedVersion: expVer,
      });

      return res.json({
        success: true,
        lesson: result.lesson,
        revision: result.revision,
      });
    } catch (err: any) {
      if (err instanceof OptimisticLockError || err.name === 'OptimisticLockError') {
        const latest = await lessonRepo.getLessonWithCurrentSpec(req.params.id).catch(() => null);
        return res.status(409).json({
          error: err.message,
          code: 'VERSION_CONFLICT',
          currentVersion: err.actualVersion ?? err.currentVersion,
          expectedVersion: err.expectedVersion,
          currentSpec: latest?.currentRevision?.spec_json,
        });
      }
      console.error('[Lessons API] Erro ao salvar versão da aula:', err);
      return res.status(500).json({ error: err.message || 'Erro ao salvar versão.' });
    }
  });

  // DELETE /api/lessons/:id (Exclusão suave de aula)
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const existing = await lessonRepo.getLessonWithCurrentSpec(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Aula não encontrada.' });
      }

      if (user.role !== 'admin' && existing.lesson.owner_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: não é permitido excluir aula de outro professor.', code: 'FORBIDDEN' });
      }

      await lessonRepo.softDeleteLesson(req.params.id, user.id);
      return res.json({ success: true, message: 'Aula removida para a lixeira recuperável.' });
    } catch (err: any) {
      console.error('[Lessons API] Erro ao excluir aula:', err);
      return res.status(500).json({ error: 'Erro ao remover aula.' });
    }
  });

  // POST /api/lessons/:id/duplicate (Duplicar aula para o acervo próprio)
  router.post('/:id/duplicate', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const existing = await lessonRepo.getLessonWithCurrentSpec(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Aula de origem não encontrada.' });
      }

      // Duplicação permitida para a própria aula ou pelo administrador
      if (user.role !== 'admin' && existing.lesson.owner_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: não é permitido duplicar aula privada de outro professor sem autorização.', code: 'FORBIDDEN' });
      }

      const result = await lessonRepo.duplicateLesson(req.params.id, user.id);
      return res.status(201).json({
        success: true,
        lesson: result.lesson,
        revision: result.revision,
      });
    } catch (err: any) {
      console.error('[Lessons API] Erro ao duplicar aula:', err);
      return res.status(500).json({ error: err.message || 'Erro ao duplicar aula.' });
    }
  });

  // GET /api/lessons/:id/revisions (Histórico de versões da aula)
  router.get('/:id/revisions', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const existing = await lessonRepo.getLessonWithCurrentSpec(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Aula não encontrada.' });
      }

      if (user.role !== 'admin' && existing.lesson.owner_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: não é permitido consultar o histórico de aula alheia.', code: 'FORBIDDEN' });
      }

      const revisions = await lessonRepo.listLessonRevisions(req.params.id);
      return res.json({ revisions });
    } catch (err: any) {
      console.error('[Lessons API] Erro ao listar revisões:', err);
      return res.status(500).json({ error: 'Erro ao listar histórico de revisões.' });
    }
  });

  // POST /api/lessons/:id/restore-revision (Restaurar revisão como nova versão)
  router.post('/:id/restore-revision', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { revisionId, changeSummary } = req.body;

      if (!revisionId) {
        return res.status(400).json({ error: 'revisionId é obrigatório.' });
      }

      const existing = await lessonRepo.getLessonWithCurrentSpec(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Aula não encontrada.' });
      }

      if (user.role !== 'admin' && existing.lesson.owner_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: não é permitido restaurar aula de outro professor.', code: 'FORBIDDEN' });
      }

      const result = await lessonRepo.restoreRevision({
        lessonId: req.params.id,
        revisionId,
        actorId: user.id,
        changeSummary: changeSummary || 'Restauração de versão histórica',
      });

      return res.json({
        success: true,
        lesson: result.lesson,
        revision: result.revision,
      });
    } catch (err: any) {
      console.error('[Lessons API] Erro ao restaurar revisão:', err);
      return res.status(500).json({ error: err.message || 'Erro ao restaurar revisão.' });
    }
  });

  return router;
}
