/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — CLIENTE HTTP DA API DO KNOWLEDGE CORE (E3)
 * Conecta o Knowledge Studio diretamente ao PostgreSQL via rotas REST seguras.
 */

import {
  KnowledgeNodeRecord,
  KnowledgeRelationRecord,
  Source,
  License,
  CurriculumSkill,
  StagingNodeRecord,
  ImportBatchRecord,
  ContentPackRecord,
} from '../knowledge/studio/schema';
import type { CurriculumTopicEntry } from '../catalog/curriculumCatalog';

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: any;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(endpoint, {
    credentials: options.credentials || 'same-origin',
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(errorBody.error || `Erro HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    err.code = errorBody.code;
    err.details = errorBody.details;
    throw err;
  }

  return res.json() as Promise<T>;
}

export const knowledgeApi = {
  getCoverage(): Promise<{ subjects: { subject_code: string; skills: number; linked_skills: number }[] }> {
    return request('/api/knowledge/coverage');
  },
  async getCatalog(signal?: AbortSignal): Promise<CurriculumTopicEntry[]> {
    const result = await request<{ catalog: CurriculumTopicEntry[] }>('/api/knowledge/catalog', { signal });
    if (!Array.isArray(result.catalog)) throw new Error('O catálogo do acervo retornou uma resposta inválida.');
    return result.catalog;
  },
  async getAllNodes(): Promise<{ nodes: KnowledgeNodeRecord[]; total: number }> {
    const nodes: KnowledgeNodeRecord[] = [];
    let total = 0;
    do {
      const page = await knowledgeApi.getNodes({ limit: 200, offset: nodes.length });
      total = page.total;
      if (!page.nodes.length) break;
      nodes.push(...page.nodes);
    } while (nodes.length < total);
    return { nodes, total };
  },
  // Nós de Conhecimento
  async getNodes(filters?: {
    subject_code?: string;
    grade_level?: string | number;
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ nodes: KnowledgeNodeRecord[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.subject_code && filters.subject_code !== 'all') params.set('subject_code', filters.subject_code);
    if (filters?.grade_level && filters.grade_level !== 'all') params.set('grade_level', String(filters.grade_level));
    if (filters?.type && filters.type !== 'all') params.set('type', filters.type);
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters?.search && filters.search.trim()) params.set('search', filters.search.trim());
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const qs = params.toString();
    return request<{ nodes: KnowledgeNodeRecord[]; total: number }>(`/api/knowledge/nodes${qs ? `?${qs}` : ''}`);
  },

  async getNodeById(id: string): Promise<KnowledgeNodeRecord> {
    const data = await request<{ node: KnowledgeNodeRecord }>(`/api/knowledge/nodes/${id}`);
    return data.node;
  },

  async createNode(payload: {
    title: string;
    slug: string;
    type: string;
    short_description: string;
    subject_code: string;
    grade_level: number;
    summary?: string;
    key_points?: string | string[];
    source_id?: string;
    license_id?: string;
    status?: string;
  }): Promise<KnowledgeNodeRecord> {
    const data = await request<{ success: boolean; node: KnowledgeNodeRecord }>('/api/knowledge/nodes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.node;
  },

  async updateNode(
    id: string,
    payload: {
      expected_version: number;
      title?: string;
      short_description?: string;
      data_json?: any;
      status?: string;
      reason?: string;
    }
  ): Promise<KnowledgeNodeRecord> {
    const data = await request<{ success: boolean; node: KnowledgeNodeRecord }>(`/api/knowledge/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return data.node;
  },

  async getNodeVersions(id: string): Promise<any[]> {
    const data = await request<{ versions: any[] }>(`/api/knowledge/nodes/${id}/versions`);
    return data.versions;
  },

  // Relações Ontológicas
  async getRelations(nodeId?: string): Promise<KnowledgeRelationRecord[]> {
    const qs = nodeId ? `?node_id=${encodeURIComponent(nodeId)}` : '';
    const data = await request<{ relations: KnowledgeRelationRecord[] }>(`/api/knowledge/relations${qs}`);
    return data.relations;
  },

  async createRelation(payload: {
    from_node_id: string;
    relation_type: string;
    to_node_id: string;
    source_id?: string;
  }): Promise<KnowledgeRelationRecord> {
    const data = await request<{ success: boolean; relation: KnowledgeRelationRecord }>('/api/knowledge/relations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.relation;
  },

  async deleteRelation(id: string): Promise<void> {
    await request<{ success: boolean }>(`/api/knowledge/relations/${id}`, {
      method: 'DELETE',
    });
  },

  // Fontes e Licenças
  async getSources(): Promise<Source[]> {
    const data = await request<{ sources: Source[] }>('/api/knowledge/sources');
    return data.sources;
  },

  async createSource(payload: Partial<Source>): Promise<Source> {
    const data = await request<{ success: boolean; source: Source }>('/api/knowledge/sources', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.source;
  },

  async getLicenses(): Promise<License[]> {
    const data = await request<{ licenses: License[] }>('/api/knowledge/licenses');
    return data.licenses;
  },

  async createLicense(payload: Partial<License>): Promise<License> {
    const data = await request<{ success: boolean; license: License }>('/api/knowledge/licenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.license;
  },

  // Currículo e Recursos
  async getCurriculum(filters?: { subject_code?: string; grade_level?: number; search?: string }): Promise<CurriculumSkill[]> {
    const params = new URLSearchParams();
    if (filters?.subject_code) params.set('subject_code', filters.subject_code);
    if (filters?.grade_level) params.set('grade_level', String(filters.grade_level));
    if (filters?.search) params.set('search', filters.search);
    const qs = params.toString();
    const data = await request<{ curriculum: CurriculumSkill[] }>(`/api/knowledge/curriculum${qs ? `?${qs}` : ''}`);
    return data.curriculum;
  },

  async getResources(nodeId?: string): Promise<any[]> {
    const qs = nodeId ? `?node_id=${encodeURIComponent(nodeId)}` : '';
    const data = await request<{ resources: any[] }>(`/api/knowledge/resources${qs}`);
    return data.resources;
  },

  // Staging e Ingestão
  async getStaging(status?: string): Promise<StagingNodeRecord[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const data = await request<{ staging: StagingNodeRecord[] }>(`/api/knowledge/staging${qs}`);
    return data.staging;
  },

  async approveStaging(id: string): Promise<{ node: KnowledgeNodeRecord; duplicateHandled: boolean; message: string }> {
    return request<{ success: boolean; node: KnowledgeNodeRecord; duplicateHandled: boolean; message: string }>(
      `/api/knowledge/staging/${id}/approve`,
      { method: 'POST' }
    );
  },

  async discardStaging(id: string, reason?: string): Promise<any> {
    return request<{ success: boolean; item: any }>(`/api/knowledge/staging/${id}/discard`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getBatches(): Promise<ImportBatchRecord[]> {
    const data = await request<{ batches: ImportBatchRecord[] }>('/api/knowledge/batches');
    return data.batches;
  },

  async runImport(provider = 'Wikidata', topic = 'Grécia Antiga', limit = 4): Promise<{ batch: ImportBatchRecord; importedItems: any[] }> {
    return request<{ success: boolean; batch: ImportBatchRecord; importedItems: any[] }>('/api/knowledge/import', {
      method: 'POST',
      body: JSON.stringify({ provider, topic, limit }),
    });
  },

  // Content Packs
  async getPacks(): Promise<ContentPackRecord[]> {
    const data = await request<{ packs: ContentPackRecord[] }>('/api/knowledge/packs');
    return data.packs;
  },

  async getActivePack(slug: string): Promise<any> {
    const data = await request<{ success: boolean; version: any }>(`/api/knowledge/packs/${slug}/active`);
    return data.version;
  },

  async publishPackVersion(slug: string): Promise<any> {
    const data = await request<{ success: boolean; version: any }>(`/api/knowledge/packs/${slug}/publish-version`, {
      method: 'POST',
    });
    return data.version;
  },

  async composeLesson(composerInput: any, packSlug = 'history-6-grecia-antiga'): Promise<{ lesson: any; packVersion: number; contentHash: string }> {
    return request<{ success: boolean; lesson: any; packVersion: number; contentHash: string }>('/api/knowledge/compose-lesson', {
      method: 'POST',
      body: JSON.stringify({ composerInput, packSlug }),
    });
  },

  async importWikidata(qids: string[], topic = 'Grécia Antiga'): Promise<{ batch: any; importedItems: any[]; errors: any[] }> {
    return request<{ success: boolean; batch: any; importedItems: any[]; errors: any[] }>('/api/knowledge/import/wikidata', {
      method: 'POST',
      body: JSON.stringify({ qids, topic }),
    });
  },

  // Dump JSON
  async getDumpJson(): Promise<any> {
    return request<any>('/api/knowledge/dump');
  },

  // Verificação de Integridade do PostgreSQL
  async checkDatabaseHealth(): Promise<{ healthy: boolean; details?: any }> {
    try {
      const res = await fetch('/ready');
      if (!res.ok) return { healthy: false };
      const data = await res.json();
      return {
        healthy: data.database?.status === 'ok',
        details: data.database,
      };
    } catch {
      return { healthy: false };
    }
  },
};
