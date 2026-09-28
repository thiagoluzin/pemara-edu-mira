/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — CONTRATOS E TIPOS DO BANCO RELACIONAL POSTGRESQL (E2)
 */

export interface DbUser {
  id: string;
  username: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'teacher' | 'editor' | 'curator' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SafeUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'teacher' | 'editor' | 'curator' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSession {
  id: string;
  user_id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  expires_at: string;
  created_at: string;
  last_activity_at?: string;
  revoked_at?: string | null;
  token_hash?: string | null;
}

export interface DbAuthEvent {
  id: string;
  user_id?: string | null;
  username_attempted: string;
  event_type: string;
  ip_address?: string | null;
  user_agent?: string | null;
  details_json: any;
  created_at: string;
}

export interface DbLesson {
  id: string;
  owner_id: string;
  title: string;
  subject_code: string;
  grade_level: string;
  topic: string;
  template_id?: string | null;
  current_version: number;
  status: 'DRAFT' | 'SAVED' | 'PUBLISHED' | 'ARCHIVED';
  is_deleted: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbLessonRevision {
  id: string;
  lesson_id: string;
  version: number;
  spec_json: any;
  content_hash: string;
  renderer_version: string;
  created_by?: string | null;
  change_summary?: string | null;
  created_at: string;
}

export interface DbLessonDraft {
  lesson_id: string;
  owner_id: string;
  draft_spec_json: any;
  base_version: number;
  updated_at: string;
}

export interface DbGenerationAttempt {
  id: string;
  user_id?: string | null;
  lesson_id?: string | null;
  requested_mode: string;
  executed_mode: string;
  fallback_reason?: string | null;
  parameters_json: any;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED';
  error_message?: string | null;
  created_at: string;
}

export interface DbActivityHistory {
  id: string;
  entity_type: 'lesson' | 'user' | 'pack' | 'knowledge_node' | 'staging_node';
  entity_id: string;
  action: string;
  actor_id?: string | null;
  version?: number | null;
  details_json: any;
  created_at: string;
}

export interface DbKnowledgeNode {
  id: string;
  slug: string;
  type: string;
  title: string;
  short_description: string;
  subject_code: string;
  grade_level: number;
  data_json: any;
  language: string;
  source_id?: string | null;
  license_id?: string | null;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'DEPRECATED' | 'REJECTED';
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DbContentPackVersion {
  id: string;
  pack_id: string;
  version: string;
  schema_version: string;
  content_hash: string;
  manifest_json: any;
  payload_json: any;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  published_at?: string | null;
  created_at: string;
}

export class OptimisticLockError extends Error {
  public code = '409_CONFLICT';
  public entity: string;
  public entityId: string;
  public expectedVersion: number;
  public actualVersion: number;

  constructor(entity: string, id: string, expectedVersion: number, actualVersion: number) {
    super(`Conflito de versão em ${entity} (${id}): versão esperada ${expectedVersion}, versão atual no banco ${actualVersion}.`);
    this.name = 'OptimisticLockError';
    this.entity = entity;
    this.entityId = id;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

