/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — SERVIÇO CLIENTE DO PAINEL ADMINISTRATIVO (E3 / E4)
 * Conexão com /api/admin para estatísticas, usuários, sessões, auditoria e acervo.
 */

import { AuthUser } from './authApi';
import { DbLessonSummary, DbLessonRevisionSummary } from './lessonsApi';

export interface AdminOverview {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  sessions: {
    activeCount: number;
  };
  security: {
    recentLoginFailures: number;
  };
  lessons: {
    totalLessons: number;
    byTeacher: Array<{
      teacherName: string;
      username: string;
      lessonsCount: number;
      draftsCount: number;
    }>;
  };
  system: {
    database: { status: string; engine?: string; version?: string };
    lastBackup: string;
  };
}

export interface AdminSession {
  id: string;
  user_id: string;
  username: string;
  name: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
  last_activity_at: string;
  is_active_account: boolean;
}

export interface AdminLogEvent {
  id: string;
  user_id: string | null;
  username_attempted: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  details_json: any;
  created_at: string;
}

export interface AdminLessonDetail extends DbLessonSummary {
  owner_name: string;
  owner_username: string;
}

export const adminApi = {
  async getOverview(): Promise<AdminOverview> {
    const res = await fetch('/api/admin/overview');
    if (!res.ok) {
      throw new Error(`Falha ao carregar visão geral administrativa (HTTP ${res.status})`);
    }
    return res.json();
  },

  async listUsers(options?: { search?: string; role?: string; is_active?: boolean }): Promise<{ users: AuthUser[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);
    if (options?.role) params.append('role', options.role);
    if (options?.is_active !== undefined) params.append('is_active', String(options.is_active));

    const res = await fetch(`/api/admin/users?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Falha ao listar usuários (HTTP ${res.status})`);
    }
    return res.json();
  },

  async createUser(data: {
    username: string;
    name: string;
    email: string;
    password: string;
    role: 'teacher' | 'editor' | 'curator' | 'admin';
  }): Promise<{ user: AuthUser }> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao criar usuário' }));
      throw new Error(err.error || `Erro ao cadastrar usuário (HTTP ${res.status})`);
    }
    return res.json();
  },

  async updateUser(id: string, data: {
    name?: string;
    email?: string;
    role?: 'teacher' | 'editor' | 'curator' | 'admin';
    is_active?: boolean;
  }): Promise<{ user: AuthUser }> {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao atualizar usuário' }));
      throw new Error(err.error || `Erro ao atualizar usuário (HTTP ${res.status})`);
    }
    return res.json();
  },

  async resetPassword(id: string, newPassword: string): Promise<{ message: string }> {
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao redefinir senha' }));
      throw new Error(err.error || `Erro ao redefinir senha (HTTP ${res.status})`);
    }
    return res.json();
  },

  async listSessions(options?: { userId?: string; activeOnly?: boolean }): Promise<{ sessions: AdminSession[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.userId) params.append('user_id', options.userId);
    if (options?.activeOnly !== undefined) params.append('active_only', String(options.activeOnly));

    const res = await fetch(`/api/admin/sessions?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Falha ao consultar sessões (HTTP ${res.status})`);
    }
    return res.json();
  },

  async revokeSession(sessionId: string): Promise<void> {
    const res = await fetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`Falha ao revogar sessão (HTTP ${res.status})`);
    }
  },

  async revokeAllUserSessions(userId: string): Promise<{ count: number }> {
    const res = await fetch(`/api/admin/users/${userId}/sessions`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`Falha ao revogar sessões do usuário (HTTP ${res.status})`);
    }
    return res.json();
  },

  async listLogs(options?: { eventType?: string; search?: string }): Promise<{ events: AdminLogEvent[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.eventType) params.append('event_type', options.eventType);
    if (options?.search) params.append('search', options.search);

    const res = await fetch(`/api/admin/logs?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Falha ao consultar logs (HTTP ${res.status})`);
    }
    return res.json();
  },

  async listLessons(options?: {
    ownerId?: string;
    subjectCode?: string;
    gradeLevel?: string;
    search?: string;
    includeDeleted?: boolean;
  }): Promise<{ lessons: AdminLessonDetail[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.ownerId) params.append('owner_id', options.ownerId);
    if (options?.subjectCode) params.append('subject_code', options.subjectCode);
    if (options?.gradeLevel) params.append('grade_level', options.gradeLevel);
    if (options?.search) params.append('search', options.search);
    if (options?.includeDeleted) params.append('include_deleted', 'true');

    const res = await fetch(`/api/admin/lessons?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Falha ao consultar acervo geral (HTTP ${res.status})`);
    }
    return res.json();
  },

  async getLessonDetails(id: string): Promise<{
    lesson: DbLessonSummary;
    currentSpec: any;
    currentVersion: number;
    revisions: DbLessonRevisionSummary[];
    activity: any[];
  }> {
    const res = await fetch(`/api/admin/lessons/${id}`);
    if (!res.ok) {
      throw new Error(`Falha ao buscar detalhes da aula (HTTP ${res.status})`);
    }
    return res.json();
  },

  async restoreRevision(lessonId: string, version: number, reason: string): Promise<void> {
    const res = await fetch(`/api/admin/lessons/${lessonId}/revisions/${version}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao restaurar revisão' }));
      throw new Error(err.error || `Erro ao restaurar revisão (HTTP ${res.status})`);
    }
  },

  async transferOwnership(lessonId: string, newOwnerId: string, reason: string): Promise<void> {
    const res = await fetch(`/api/admin/lessons/${lessonId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newOwnerId, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao transferir aula' }));
      throw new Error(err.error || `Erro ao transferir titularidade (HTTP ${res.status})`);
    }
  },

  getExportUrl(): string {
    return '/api/admin/export';
  },
};
