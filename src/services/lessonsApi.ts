/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — SERVIÇO CLIENTE DE AULAS DO PROFESSOR (E4)
 * Conexão com /api/lessons para biblioteca, autosave e revisões.
 */

import { LessonSpec } from '../types/lesson';

export interface DbLessonSummary {
  id: string;
  owner_id: string;
  title: string;
  subject_code: string;
  grade_level: string;
  topic: string;
  current_version: number;
  status: 'DRAFT' | 'SAVED' | 'PUBLISHED' | 'ARCHIVED';
  is_deleted: boolean;
  has_draft: boolean;
  draft_updated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DbLessonRevisionSummary {
  id: string;
  lesson_id: string;
  version: number;
  content_hash: string;
  renderer_version: string;
  created_by?: string;
  change_summary?: string;
  created_at: string;
}

const draftStamps=new Map<string,string>();
const draftQueues=new Map<string,Promise<unknown>>();
let sessionEpoch=0;
const draftControllers=new Set<AbortController>();
export const lessonsApi = {
  clearSessionCache(){sessionEpoch++;draftStamps.clear();draftQueues.clear();for(const c of draftControllers)c.abort();draftControllers.clear();},
  /**
   * Lista as aulas do professor logado.
   */
  async listMyLessons(options?: { search?: string; subjectCode?: string; signal?: AbortSignal }): Promise<DbLessonSummary[]> {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);
    if (options?.subjectCode) params.append('subject_code', options.subjectCode);

    const res = await fetch(`/api/lessons?${params.toString()}`, { signal: options?.signal });
    if (!res.ok) {
      throw new Error(`Falha ao carregar aulas do professor (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.lessons || [];
  },

  /**
   * Obtém os detalhes completos e o spec da aula.
   */
  async getLesson(lessonId: string, options?: { signal?: AbortSignal }): Promise<{
    lesson: DbLessonSummary;
    currentSpec: LessonSpec;
    currentVersion: number;
    draft: { draft_spec_json: LessonSpec; base_version: number; updated_at: string } | null;
  }> {
    const epoch=sessionEpoch;
    const res = await fetch(`/api/lessons/${lessonId}`, { signal: options?.signal });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao buscar aula' }));
      throw new Error(err.error || `Erro ao consultar aula (HTTP ${res.status})`);
    }
    const data = await res.json();
    if(epoch===sessionEpoch){if(data.draft?.updated_at)draftStamps.set(lessonId,data.draft.updated_at);else draftStamps.delete(lessonId);}
    // A primeira revisão pode guardar o ID temporário do compositor.
    // A edição usa a identidade do registro carregado, sem alterar o snapshot histórico.
    data.currentSpec = { ...data.currentSpec, lesson: { ...data.currentSpec.lesson, id: data.lesson.id } };
    if (data.draft?.draft_spec_json) {
      data.draft = { ...data.draft, draft_spec_json: {
        ...data.draft.draft_spec_json, lesson: { ...data.draft.draft_spec_json.lesson, id: data.lesson.id }
      } };
    }
    return data;
  },

  /**
   * Cria uma nova aula no PostgreSQL.
   */
  async createLesson(params: {
    title: string;
    subjectCode: string;
    gradeLevel: string;
    topic: string;
    templateId?: string;
    spec: LessonSpec;
  }, options?: { signal?: AbortSignal }): Promise<{ lesson: DbLessonSummary }> {
    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: options?.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao criar aula' }));
      throw new Error(err.error || `Erro ao salvar aula (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Salva rascunho de autosave no PostgreSQL.
   */
  async saveDraft(
    lessonId: string,
    draftSpec: LessonSpec,
    baseVersion?: number,
    options?: { expectedDraftUpdatedAt?: string; force?: boolean; signal?: AbortSignal }
  ): Promise<{ savedAt: string; baseVersion: number }> {
    const epoch=sessionEpoch;
    const pending=(draftQueues.get(lessonId)||Promise.resolve()).catch(()=>{}).then(async()=>{
      if(epoch!==sessionEpoch)throw new DOMException('Sessão alterada','AbortError');
      const controller=new AbortController();draftControllers.add(controller);
      try {
    const res = await fetch(`/api/lessons/${lessonId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftSpec,
        baseVersion,
        expectedDraftUpdatedAt: options?.expectedDraftUpdatedAt ?? draftStamps.get(lessonId),
        force: options?.force,
      }),
      signal: options?.signal ? AbortSignal.any([options.signal,controller.signal]) : controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha no autosave' }));
      const error: any = new Error(err.error || `Erro no autosave (HTTP ${res.status})`);
      error.status = res.status;
      error.code = err.code;
      error.serverDraft = err.serverDraft;
      error.currentSpec = err.currentSpec;
      throw error;
    }
    const data=await res.json();
    if(epoch===sessionEpoch)draftStamps.set(lessonId,data.savedAt);
    return data;
      } finally {draftControllers.delete(controller);}
    });
    draftQueues.set(lessonId,pending);
    try{return await pending;}finally{if(draftQueues.get(lessonId)===pending)draftQueues.delete(lessonId);}
  },

  /**
   * Salva versão definitiva no PostgreSQL com verificação otimista de versão.
   */
  async saveVersion(
    lessonId: string,
    spec: LessonSpec,
    changeSummary?: string,
    expectedVersion?: number
  ): Promise<{ lesson: DbLessonSummary }> {
    const epoch=sessionEpoch;
    await draftQueues.get(lessonId);
    if(epoch!==sessionEpoch)throw new DOMException('Sessão alterada','AbortError');
    const res = await fetch(`/api/lessons/${lessonId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(expectedVersion !== undefined ? { 'If-Match': `"${expectedVersion}"` } : {}),
      },
      body: JSON.stringify({ spec, changeSummary, expectedVersion }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao salvar versão' }));
      const error: any = new Error(err.error || `Erro ao salvar versão (HTTP ${res.status})`);
      error.status = res.status;
      error.code = err.code;
      error.currentVersion = err.currentVersion;
      error.expectedVersion = err.expectedVersion;
      error.currentSpec = err.currentSpec;
      throw error;
    }
    if(epoch===sessionEpoch)draftStamps.delete(lessonId);
    return res.json();
  },

  /**
   * Restaura uma versão anterior de uma aula como nova revisão.
   */
  async restoreRevision(lessonId: string, revisionId: string, changeSummary?: string): Promise<{ lesson: DbLessonSummary }> {
    const res = await fetch(`/api/lessons/${lessonId}/restore-revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionId, changeSummary }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao restaurar revisão' }));
      throw new Error(err.error || `Erro ao restaurar revisão (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Remove a aula (soft delete).
   */
  async deleteLesson(lessonId: string): Promise<void> {
    const res = await fetch(`/api/lessons/${lessonId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao excluir aula' }));
      throw new Error(err.error || `Erro ao excluir aula (HTTP ${res.status})`);
    }
  },

  /**
   * Duplica uma aula para a conta atual.
   */
  async duplicateLesson(lessonId: string): Promise<{ lesson: DbLessonSummary }> {
    const res = await fetch(`/api/lessons/${lessonId}/duplicate`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao duplicar aula' }));
      throw new Error(err.error || `Erro ao duplicar aula (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Lista histórico de revisões imutáveis.
   */
  async listRevisions(lessonId: string): Promise<DbLessonRevisionSummary[]> {
    const res = await fetch(`/api/lessons/${lessonId}/revisions`);
    if (!res.ok) {
      throw new Error(`Erro ao consultar revisões (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.revisions || [];
  },
};
