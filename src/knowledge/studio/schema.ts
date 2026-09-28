/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA KNOWLEDGE SCHEMA & MODELS (PostgreSQL / Relacional)
 * Especificação integral das tabelas curriculares, nós de conhecimento,
 * relações, recursos, fontes, licenças, staging, versões e content packs.
 */

export interface Source {
  id: string;
  provider: string; // 'BNCC' | 'Wikidata' | 'Wikimedia Commons' | 'Academia' | 'Internal'
  title: string;
  url?: string;
  author?: string;
  language: string;
  source_type: 'official' | 'open_data' | 'open_content' | 'encyclopedia' | 'institutional' | 'internal';
  retrieved_at: string;
  status: 'verified' | 'curated' | 'under_review';
}

export interface License {
  id: string;
  name: string;
  code: 'CC0' | 'CC BY' | 'CC BY-SA' | 'Public Domain' | 'Internal' | 'Educational Exemption';
  commercial_use: boolean;
  derivatives_allowed: boolean;
  attribution_required: boolean;
  redistribution_allowed: boolean;
  notes?: string;
}

export type KnowledgeNodeType =
  | 'concept'
  | 'event'
  | 'person'
  | 'place'
  | 'period'
  | 'formula'
  | 'process'
  | 'definition'
  | 'theory'
  | 'object';

export type KnowledgeNodeStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'DEPRECATED' | 'REJECTED';

export interface KnowledgeNodeRecord {
  id: string;
  slug: string;
  type: KnowledgeNodeType;
  title: string;
  short_description: string;
  subject_code: 'history' | 'geography' | 'science' | 'math' | 'portuguese' | 'english' | 'arts' | 'physical_education' | 'religious_education';
  grade_level: 6 | 7 | 8 | 9 | 67 | 69 | 89;
  data_json: {
    summary?: string;
    key_points?: string[];
    recommended_grades?: number[];
    visual_types?: string[];
    deep_description?: string;
    historical_dates?: string;
    tags?: string[];
    [key: string]: any;
  };
  language: 'pt-BR';
  source_id: string;
  license_id: string;
  status: KnowledgeNodeStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export type RelationType =
  | 'part_of'
  | 'contains'
  | 'located_in'
  | 'preceded_by'
  | 'followed_by'
  | 'caused_by'
  | 'influenced'
  | 'related_to'
  | 'example_of'
  | 'requires'
  | 'contrasts_with'
  | 'created_by'
  | 'occurred_in';

export interface KnowledgeRelationRecord {
  id: string;
  from_node_id: string;
  relation_type: RelationType;
  to_node_id: string;
  source_id?: string;
  status: 'ACTIVE' | 'REVIEW';
  created_at: string;
}

export interface ResourceRecord {
  id: string;
  type: 'image' | 'map' | 'diagram' | 'chart' | 'timeline' | 'comparison_table' | 'simulation' | 'quiz_asset';
  title: string;
  storage_path: string;
  mime_type: string;
  width?: number;
  height?: number;
  source_id: string;
  license_id: string;
  status: 'ACTIVE' | 'ARCHIVED';
  metadata_json: Record<string, any>;
  created_at: string;
}

export interface ResourceLink {
  id: string;
  resource_id: string;
  knowledge_node_id: string;
  role: 'main_image' | 'map' | 'comparison' | 'illustration' | 'simulation' | 'quiz_asset';
}

export interface CurriculumSkill {
  id: string;
  code: string; // Ex: 'EF06HI09'
  thematic_unit: string;
  knowledge_object: string;
  description: string;
  grade_level: 6 | 7 | 8 | 9 | 67 | 69 | 89;
  subject_code: 'history' | 'geography' | 'science' | 'math' | 'portuguese' | 'english' | 'arts' | 'physical_education' | 'religious_education';
  source_id: string;
  status: 'OFFICIAL_BNCC';
  version: string;
}

export interface CurriculumKnowledgeLink {
  id: string;
  curriculum_skill_id: string;
  knowledge_node_id: string;
  priority: number;
  required: boolean;
}

export interface StagingNodeRecord {
  id: string;
  import_batch_id: string;
  source_provider: 'Wikidata' | 'BNCC' | 'Wikimedia Commons' | 'Manual';
  external_id?: string;
  title: string;
  slug: string;
  type: KnowledgeNodeType;
  short_description: string;
  data_json: Record<string, any>;
  validation_status: 'NEW' | 'DUPLICATE' | 'CONFLICT' | 'VALID' | 'APPROVED' | 'DISCARDED';
  duplicate_candidate_id?: string;
  review_notes?: string;
  created_at: string;
}

export interface ImportBatchRecord {
  id: string;
  provider: string;
  started_at: string;
  finished_at?: string;
  records_found: number;
  records_imported: number;
  records_rejected: number;
  records_duplicates: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  log_path?: string;
}

export interface EntityVersionRecord {
  id: string;
  entity_type: 'knowledge_node' | 'content_pack' | 'relation';
  entity_id: string;
  version: number;
  snapshot_json: any;
  changed_by: string;
  changed_at: string;
  change_reason: string;
}

export interface ContentPackRecord {
  id: string;
  slug: string;
  subject_code: 'history' | 'geography' | 'science' | 'math' | 'portuguese' | 'english' | 'arts' | 'physical_education' | 'religious_education';
  grade_level: 6 | 7 | 8 | 9 | 67 | 69 | 89;
  topic_node_id: string;
  title: string;
  version: string;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED';
  created_at: string;
  published_at?: string;
}
