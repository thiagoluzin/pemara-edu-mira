/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — REPOSITÓRIO DE AULAS, REVISÕES E RASCUNHOS (E4 / ADMIN)
 * Persiste aulas autorais, revisões imutáveis, rascunhos de autosave
 * e histórico no PostgreSQL relacional com isolamento por professor.
 */

import pg from 'pg';
import crypto from 'crypto';
import { getPool, withTransaction } from '../db/pool';
import { DbLesson, DbLessonRevision, DbLessonDraft, OptimisticLockError } from '../db/types';

export interface LessonSummaryView extends DbLesson {
  owner_name?: string;
  owner_username?: string;
  has_draft?: boolean;
  draft_updated_at?: string;
}

export class LessonRepository {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool || getPool();
  }

  private calculateHash(data: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Obtém uma aula pelo seu identificador primário.
   */
  async getLessonById(id: string, client?: pg.PoolClient): Promise<DbLesson | null> {
    const executor = client || this.pool;
    const res = await executor.query<DbLesson>('SELECT * FROM lessons WHERE id = $1;', [id]);
    return res.rows[0] || null;
  }

  /**
   * Obtém uma revisão específica de uma aula pelo número de versão.
   */
  async getLessonRevision(lessonId: string, version: number, client?: pg.PoolClient): Promise<DbLessonRevision | null> {
    const executor = client || this.pool;
    const res = await executor.query<DbLessonRevision>(
      'SELECT * FROM lesson_revisions WHERE lesson_id = $1 AND version = $2;',
      [lessonId, version]
    );
    return res.rows[0] || null;
  }

  /**
   * Cria uma nova aula e sua primeira revisão imutável (v1).
   */
  async createLesson(params: {
    id?: string;
    title: string;
    subjectCode: string;
    gradeLevel: string;
    topic: string;
    templateId?: string;
    spec: any;
    ownerId: string;
  }, client?: pg.PoolClient): Promise<{ lesson: DbLesson; revision: DbLessonRevision }> {
    const lessonId = params.id || `lesson-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const revisionId = `rev-${lessonId}-v1`;
    const contentHash = this.calculateHash(params.spec);
    const rendererVersion = params.spec?.renderer_version || '1.0.0';

    const work = async (c: pg.PoolClient) => {
      // 1. Inserir aula
      const lessonRes = await c.query<DbLesson>(
        `INSERT INTO lessons (id, owner_id, title, subject_code, grade_level, topic, template_id, current_version, status, is_deleted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'SAVED', FALSE)
         RETURNING *;`,
        [lessonId, params.ownerId, params.title, params.subjectCode, params.gradeLevel, params.topic, params.templateId || null]
      );

      // 2. Inserir primeira revisão
      const revRes = await c.query<DbLessonRevision>(
        `INSERT INTO lesson_revisions (id, lesson_id, version, spec_json, content_hash, renderer_version, created_by, change_summary)
         VALUES ($1, $2, 1, $3::jsonb, $4, $5, $6, 'Criação inicial da aula')
         RETURNING *;`,
        [revisionId, lessonId, JSON.stringify(params.spec), contentHash, rendererVersion, params.ownerId]
      );

      // 3. Registrar no histórico de atividades
      const actId = `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await c.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
         VALUES ($1, 'lesson', $2, 'LESSON_CREATED', $3, 1, $4::jsonb);`,
        [actId, lessonId, params.ownerId, JSON.stringify({ title: params.title, subject: params.subjectCode })]
      );

      return { lesson: lessonRes.rows[0], revision: revRes.rows[0] };
    };

    if (client) {
      return work(client);
    }
    return withTransaction(work, this.pool);
  }

  /**
   * Salva ou atualiza um rascunho de autosave no servidor com controle de concorrência.
   */
  async saveDraft(
    lessonId: string,
    ownerId: string,
    draftSpec: any,
    baseVersion: number,
    options?: { expectedDraftUpdatedAt?: string; force?: boolean },
    client?: pg.PoolClient
  ): Promise<DbLessonDraft> {
    const work = async (executor: pg.PoolClient): Promise<DbLessonDraft> => {
      const lessonRes = await executor.query<{owner_id:string;current_version:number}>(
        'SELECT owner_id, current_version FROM lessons WHERE id = $1 AND is_deleted = FALSE FOR UPDATE;', [lessonId]);
      const lesson=lessonRes.rows[0];
      if(!lesson)throw new Error('Aula não encontrada.');
      if(lesson.owner_id!==ownerId)throw new Error('Permissão negada: esta aula pertence a outro professor.');
      const previous=await executor.query<{updated_at:string}>('SELECT updated_at FROM lesson_drafts WHERE lesson_id = $1;', [lessonId]);
      const stamp=previous.rows[0]?.updated_at;
      const expected=options?.expectedDraftUpdatedAt;
      if(!options?.force && (baseVersion!==lesson.current_version || (stamp ? !expected || new Date(stamp).getTime()!==new Date(expected).getTime() : !!expected))) {
        throw new OptimisticLockError('lesson_draft',lessonId,baseVersion,lesson.current_version);
      }
      // Token em milissegundos, estritamente crescente mesmo para gravações rápidas.
      const savedAt=new Date(Math.max(Date.now(),stamp?new Date(stamp).getTime()+1:0)).toISOString();
      const res=await executor.query<DbLessonDraft>(
        `INSERT INTO lesson_drafts (lesson_id,owner_id,draft_spec_json,base_version,updated_at)
         VALUES ($1,$2,$3::jsonb,$4,$5)
         ON CONFLICT (lesson_id) DO UPDATE SET draft_spec_json=EXCLUDED.draft_spec_json,base_version=EXCLUDED.base_version,updated_at=EXCLUDED.updated_at RETURNING *;`,
        [lessonId,ownerId,JSON.stringify(draftSpec),baseVersion,savedAt]);
      return res.rows[0];
    };
    return client?work(client):withTransaction(work,this.pool);
  }

  /**
   * Obtém o rascunho persistente de uma aula.
   */
  async getDraft(lessonId: string, ownerId: string, client?: pg.PoolClient): Promise<DbLessonDraft | null> {
    const executor = client || this.pool;
    const res = await executor.query<DbLessonDraft>(
      `SELECT * FROM lesson_drafts WHERE lesson_id = $1 AND owner_id = $2;`,
      [lessonId, ownerId]
    );
    return res.rows[0] || null;
  }

  /**
   * Salva uma nova versão imutável da aula e descarta o rascunho pendente.
   * Suporta validação otimista de versão (expectedVersion).
   */
  async saveNewVersion(params: {
    lessonId: string;
    spec: any;
    changeSummary: string;
    actorId: string;
    ownerId?: string;
    expectedVersion?: number;
    isRestore?: boolean;
    title?: string;
    topic?: string;
    subjectCode?: string;
    gradeLevel?: string;
  }, client?: pg.PoolClient): Promise<{ lesson: DbLesson; revision: DbLessonRevision }> {
    const work = async (c: pg.PoolClient) => {
      // 1. Obter aula atual com lock pessimista para incremento seguro de versão
      const curRes = await c.query<DbLesson>(
        `SELECT * FROM lessons WHERE id = $1 FOR UPDATE;`,
        [params.lessonId]
      );

      if (curRes.rows.length === 0) {
        throw new Error(`Aula ${params.lessonId} não encontrada.`);
      }

      const currentLesson = curRes.rows[0];

      // Verificação de permissão do proprietário (se ownerId for especificado)
      if (params.ownerId && currentLesson.owner_id !== params.ownerId) {
        throw new Error('Permissão negada: esta aula pertence a outro professor.');
      }

      // Verificação de controle otimista de versão (R6)
      if (params.expectedVersion !== undefined && currentLesson.current_version !== params.expectedVersion) {
        throw new OptimisticLockError('lesson', params.lessonId, params.expectedVersion, currentLesson.current_version);
      }

      const newVersion = currentLesson.current_version + 1;
      const revisionId = `rev-${params.lessonId}-v${newVersion}`;
      const contentHash = this.calculateHash(params.spec);
      const rendererVersion = params.spec?.renderer_version || '1.0.0';

      const title = params.title || params.spec?.title || params.spec?.lesson?.title || currentLesson.title;
      const topic = params.topic || params.spec?.topic || params.spec?.lesson?.topic || currentLesson.topic;
      const subjectCode = params.subjectCode || params.spec?.subject_code || params.spec?.lesson?.subject || currentLesson.subject_code;
      const gradeLevel = params.gradeLevel || params.spec?.grade_level || params.spec?.lesson?.grade || currentLesson.grade_level;

      // 2. Inserir nova revisão imutável
      const revRes = await c.query<DbLessonRevision>(
        `INSERT INTO lesson_revisions (id, lesson_id, version, spec_json, content_hash, renderer_version, created_by, change_summary)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
         RETURNING *;`,
        [revisionId, params.lessonId, newVersion, JSON.stringify(params.spec), contentHash, rendererVersion, params.actorId, params.changeSummary]
      );

      // 3. Atualizar registro mestre da aula
      const updatedLessonRes = await c.query<DbLesson>(
        `UPDATE lessons SET
           title = $1,
           topic = $2,
           subject_code = $3,
           grade_level = $4,
           current_version = $5,
           status = 'SAVED',
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *;`,
        [title, topic, subjectCode, gradeLevel, newVersion, params.lessonId]
      );

      // 4. Limpar rascunho de autosave correspondente
      await c.query('DELETE FROM lesson_drafts WHERE lesson_id = $1;', [params.lessonId]);

      // 5. Registrar no histórico de atividades
      const actId = `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const actionName = params.isRestore ? 'LESSON_RESTORED' : 'LESSON_VERSION_SAVED';
      await c.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
         VALUES ($1, 'lesson', $2, $3, $4, $5, $6::jsonb);`,
        [actId, params.lessonId, actionName, params.actorId, newVersion, JSON.stringify({ changeSummary: params.changeSummary })]
      );

      return { lesson: updatedLessonRes.rows[0], revision: revRes.rows[0] };
    };

    if (client) {
      return work(client);
    }
    return withTransaction(work, this.pool);
  }

  /**
   * Atualização de aula com controle concorrente otimista (Optimistic Locking).
   * Lança OptimisticLockError caso a versão esperada seja divergente da atual.
   */
  async updateLessonWithOptimisticLock(params: {
    lessonId: string;
    expectedVersion: number;
    spec: any;
    actorId: string;
    changeSummary?: string;
    title?: string;
    topic?: string;
    subjectCode?: string;
    gradeLevel?: string;
    beforeCommitHook?: () => Promise<void>;
  }, client?: pg.PoolClient): Promise<{ lesson: DbLesson; revision: DbLessonRevision }> {
    const work = async (c: pg.PoolClient) => {
      const cur = await c.query<DbLesson>('SELECT * FROM lessons WHERE id = $1 FOR UPDATE;', [params.lessonId]);
      if (cur.rows.length === 0) {
        throw new Error(`Aula ${params.lessonId} não encontrada.`);
      }
      const currentLesson = cur.rows[0];
      if (currentLesson.current_version !== params.expectedVersion) {
        throw new OptimisticLockError('lesson', params.lessonId, params.expectedVersion, currentLesson.current_version);
      }

      if (params.title) {
        params.spec.title = params.title;
        if (params.spec.lesson) params.spec.lesson.title = params.title;
      }

      if (params.beforeCommitHook) {
        await params.beforeCommitHook();
      }

      return this.saveNewVersion({
        lessonId: params.lessonId,
        spec: params.spec,
        changeSummary: params.changeSummary || 'Atualização concorrente',
        actorId: params.actorId,
        title: params.title,
        topic: params.topic,
        subjectCode: params.subjectCode,
        gradeLevel: params.gradeLevel,
      }, c);
    };

    if (client) {
      return work(client);
    }
    return withTransaction(work, this.pool);
  }

  /**
   * Alias para updateLessonWithOptimisticLock mantendo compatibilidade de API.
   */
  async updateLessonOptimistic(params: {
    lessonId: string;
    expectedVersion: number;
    spec: any;
    actorId: string;
    changeSummary?: string;
    title?: string;
    topic?: string;
    subjectCode?: string;
    gradeLevel?: string;
    beforeCommitHook?: () => Promise<void>;
  }, client?: pg.PoolClient): Promise<{ lesson: DbLesson; revision: DbLessonRevision }> {
    return this.updateLessonWithOptimisticLock(params, client);
  }

  /**
   * Lista aulas autorais do professor com estado de rascunho associado.
   */
  async listTeacherLessons(ownerId: string, options?: {
    search?: string;
    subjectCode?: string;
  }, client?: pg.PoolClient): Promise<LessonSummaryView[]> {
    const executor = client || this.pool;
    const conditions: string[] = ['l.owner_id = $1', 'l.is_deleted = FALSE'];
    const values: any[] = [ownerId];
    let idx = 2;

    if (options?.search) {
      conditions.push(`(LOWER(l.title) LIKE $${idx} OR LOWER(l.topic) LIKE $${idx})`);
      values.push(`%${options.search.toLowerCase()}%`);
      idx++;
    }

    if (options?.subjectCode) {
      conditions.push(`l.subject_code = $${idx++}`);
      values.push(options.subjectCode);
    }

    const res = await executor.query<{
      id: string;
      owner_id: string;
      title: string;
      subject_code: string;
      grade_level: string;
      topic: string;
      template_id: string | null;
      current_version: number;
      status: DbLesson['status'];
      is_deleted: boolean;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
      has_draft: boolean;
      draft_updated_at: string | null;
    }>(
      `SELECT 
         l.*,
         (d.lesson_id IS NOT NULL) AS has_draft,
         d.updated_at AS draft_updated_at
       FROM lessons l
       LEFT JOIN lesson_drafts d ON l.id = d.lesson_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.updated_at DESC;`,
      values
    );

    return res.rows.map((r) => ({
      ...r,
      has_draft: Boolean(r.has_draft),
      draft_updated_at: r.draft_updated_at || undefined,
    }));
  }

  /**
   * Obtém detalhes da aula, sua revisão atual e rascunho opcional.
   */
  async getLessonWithCurrentSpec(lessonId: string, client?: pg.PoolClient): Promise<{
    lesson: DbLesson;
    currentRevision: DbLessonRevision;
    draft: DbLessonDraft | null;
  } | null> {
    const executor = client || this.pool;
    const lRes = await executor.query<DbLesson>(
      'SELECT * FROM lessons WHERE id = $1;',
      [lessonId]
    );

    if (lRes.rows.length === 0) return null;
    const lesson = lRes.rows[0];

    const revRes = await executor.query<DbLessonRevision>(
      'SELECT * FROM lesson_revisions WHERE lesson_id = $1 AND version = $2;',
      [lessonId, lesson.current_version]
    );

    if (revRes.rows.length === 0) return null;
    const currentRevision = revRes.rows[0];

    const draftRes = await executor.query<DbLessonDraft>(
      'SELECT * FROM lesson_drafts WHERE lesson_id = $1;',
      [lessonId]
    );

    return {
      lesson,
      currentRevision,
      draft: draftRes.rows[0] || null,
    };
  }

  /**
   * Lista todas as revisões de uma aula (histórico de versões).
   */
  async listLessonRevisions(lessonId: string, client?: pg.PoolClient): Promise<DbLessonRevision[]> {
    const executor = client || this.pool;
    const res = await executor.query<DbLessonRevision>(
      `SELECT * FROM lesson_revisions WHERE lesson_id = $1 ORDER BY version DESC;`,
      [lessonId]
    );
    return res.rows;
  }

  /**
   * Alias de listLessonRevisions.
   */
  async listRevisions(lessonId: string, client?: pg.PoolClient): Promise<DbLessonRevision[]> {
    return this.listLessonRevisions(lessonId, client);
  }

  /**
   * Restaura uma revisão histórica gerando uma nova versão com histórico preservado.
   */
  async restoreRevision(params: {
    lessonId: string;
    revisionId: string;
    actorId: string;
    changeSummary?: string;
  }, client?: pg.PoolClient): Promise<{ lesson: DbLesson; revision: DbLessonRevision }> {
    const executor = client || this.pool;
    const revRes = await executor.query<DbLessonRevision>(
      'SELECT * FROM lesson_revisions WHERE id = $1 AND lesson_id = $2;',
      [params.revisionId, params.lessonId]
    );
    if (revRes.rows.length === 0) {
      throw new Error(`Revisão ${params.revisionId} não encontrada para a aula ${params.lessonId}.`);
    }

    const targetRev = revRes.rows[0];
    return this.saveNewVersion({
      lessonId: params.lessonId,
      spec: targetRev.spec_json,
      changeSummary: params.changeSummary || `Restauração da revisão v${targetRev.version}`,
      actorId: params.actorId,
      isRestore: true,
    }, client);
  }

  /**
   * Exclusão suave (soft delete) da aula mantendo integridade e histórico.
   */
  async softDeleteLesson(lessonId: string, actorId: string, client?: pg.PoolClient): Promise<boolean> {
    const executor = client || this.pool;
    const res = await executor.query(
      `UPDATE lessons SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND is_deleted = FALSE;`,
      [lessonId]
    );

    if ((res.rowCount ?? 0) > 0) {
      const actId = `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await executor.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, details_json)
         VALUES ($1, 'lesson', $2, 'LESSON_DELETED', $3, $4::jsonb);`,
        [actId, lessonId, actorId, JSON.stringify({ softDelete: true })]
      );
      return true;
    }
    return false;
  }

  /**
   * Restauração de aula excluída via soft delete.
   */
  async restoreSoftDeletedLesson(lessonId: string, actorId: string, client?: pg.PoolClient): Promise<boolean> {
    const executor = client || this.pool;
    const res = await executor.query(
      `UPDATE lessons SET is_deleted = FALSE, deleted_at = NULL WHERE id = $1 AND is_deleted = TRUE;`,
      [lessonId]
    );

    if ((res.rowCount ?? 0) > 0) {
      const actId = `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await executor.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, details_json)
         VALUES ($1, 'lesson', $2, 'LESSON_RECOVERED', $3, $4::jsonb);`,
        [actId, lessonId, actorId, JSON.stringify({ recovered: true })]
      );
      return true;
    }
    return false;
  }

  /**
   * Duplica uma aula para um professor.
   */
  async duplicateLesson(sourceLessonId: string, targetOwnerId: string, client?: pg.PoolClient): Promise<{ lesson: DbLesson; revision: DbLessonRevision }> {
    const source = await this.getLessonWithCurrentSpec(sourceLessonId, client);
    if (!source) {
      throw new Error(`Aula original ${sourceLessonId} não encontrada.`);
    }

    const newSpec = structuredClone(source.currentRevision.spec_json);
    const newId = `lesson-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    if (newSpec.lesson) {
      newSpec.lesson.id = newId;
      newSpec.lesson.title = `${newSpec.lesson.title} (Cópia)`;
    }

    return this.createLesson({
      id: newId,
      title: `${source.lesson.title} (Cópia)`,
      subjectCode: source.lesson.subject_code,
      gradeLevel: source.lesson.grade_level,
      topic: source.lesson.topic,
      templateId: source.lesson.template_id || undefined,
      spec: newSpec,
      ownerId: targetOwnerId,
    }, client);
  }

  /**
   * Transferência administrativa de acervo entre contas com motivo e auditoria.
   */
  async transferOwnership(params: {
    lessonId: string;
    newOwnerId: string;
    adminActorId: string;
    reason: string;
  }, client?: pg.PoolClient): Promise<DbLesson> {
    const work = async (c: pg.PoolClient) => {
      const cur = await c.query<DbLesson>('SELECT * FROM lessons WHERE id = $1 FOR UPDATE;', [params.lessonId]);
      if (cur.rows.length === 0) {
        throw new Error(`Aula ${params.lessonId} não encontrada.`);
      }

      const prevOwnerId = cur.rows[0].owner_id;

      // Transferir a aula
      const res = await c.query<DbLesson>(
        `UPDATE lessons SET owner_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;`,
        [params.newOwnerId, params.lessonId]
      );

      // Mover ou remover rascunhos para evitar vazamento
      await c.query(`DELETE FROM lesson_drafts WHERE lesson_id = $1;`, [params.lessonId]);

      // Registrar auditoria
      const actId = `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await c.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, details_json)
         VALUES ($1, 'lesson', $2, 'LESSON_TRANSFERRED', $3, $4::jsonb);`,
        [actId, params.lessonId, params.adminActorId, JSON.stringify({
          fromUserId: prevOwnerId,
          toUserId: params.newOwnerId,
          reason: params.reason,
        })]
      );

      return res.rows[0];
    };

    if (client) {
      return work(client);
    }
    return withTransaction(work, this.pool);
  }

  /**
   * Consulta administrativa ampla de aulas de todos os professores.
   */
  async listAllLessonsAdmin(options?: {
    ownerId?: string;
    subjectCode?: string;
    gradeLevel?: string;
    search?: string;
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }, client?: pg.PoolClient): Promise<{ lessons: LessonSummaryView[]; total: number }> {
    const executor = client || this.pool;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (!options?.includeDeleted) {
      conditions.push('l.is_deleted = FALSE');
    }

    if (options?.ownerId) {
      conditions.push(`l.owner_id = $${idx++}`);
      values.push(options.ownerId);
    }

    if (options?.subjectCode) {
      conditions.push(`l.subject_code = $${idx++}`);
      values.push(options.subjectCode);
    }

    if (options?.gradeLevel) {
      conditions.push(`l.grade_level = $${idx++}`);
      values.push(options.gradeLevel);
    }

    if (options?.search) {
      conditions.push(`(LOWER(l.title) LIKE $${idx} OR LOWER(l.topic) LIKE $${idx})`);
      values.push(`%${options.search.toLowerCase()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await executor.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM lessons l ${whereClause};`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const dataRes = await executor.query<{
      id: string;
      owner_id: string;
      title: string;
      subject_code: string;
      grade_level: string;
      topic: string;
      template_id: string | null;
      current_version: number;
      status: DbLesson['status'];
      is_deleted: boolean;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
      owner_name: string;
      owner_username: string;
      has_draft: boolean;
    }>(
      `SELECT 
         l.*,
         u.name AS owner_name,
         u.username AS owner_username,
         (d.lesson_id IS NOT NULL) AS has_draft
       FROM lessons l
       JOIN users u ON l.owner_id = u.id
       LEFT JOIN lesson_drafts d ON l.id = d.lesson_id
       ${whereClause}
       ORDER BY l.updated_at DESC
       LIMIT $${idx++} OFFSET $${idx++};`,
      [...values, limit, offset]
    );

    return {
      lessons: dataRes.rows.map((r) => ({
        ...r,
        has_draft: Boolean(r.has_draft),
      })),
      total,
    };
  }

  /**
   * Obtém histórico completo de atividades de uma aula.
   */
  async getLessonActivityHistory(lessonId: string, client?: pg.PoolClient) {
    const executor = client || this.pool;
    const res = await executor.query(
      `SELECT h.*, u.name AS actor_name, u.username AS actor_username
       FROM activity_history h
       LEFT JOIN users u ON h.actor_id = u.id
       WHERE h.entity_type = 'lesson' AND h.entity_id = $1
       ORDER BY h.created_at DESC;`,
      [lessonId]
    );
    return res.rows;
  }
}
