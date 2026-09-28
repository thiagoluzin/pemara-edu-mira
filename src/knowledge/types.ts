/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA KNOWLEDGE CORE ENTITIES & CONTENT PACKS
 * Camada curricular e ontológica determinística para EF Anos Finais (6º a 9º ano)
 */

export type CurriculumGrade = 6 | 7 | 8 | 9;

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

export type KnowledgeRelationType =
  | 'part_of'
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

export interface SourceMeta {
  id: string;
  name: string;
  license: string;
  version: string;
  status: 'verified' | 'curated' | 'under_review';
  last_updated: string;
  reference_url?: string;
}

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  name: string;
  short_definition: string;
  deep_description: string;
  subject: string;
  grade: CurriculumGrade;
  source_id: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeRelation {
  from_node_id: string;
  to_node_id: string;
  relation: KnowledgeRelationType;
  description?: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  type: 'svg_map' | 'diagram' | 'chart' | 'comparison_table';
  data: any;
  source_id: string;
}

export interface QuizItem {
  id: string;
  node_id: string;
  question: string;
  answers: string[];
  correct_index: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ContentPack {
  id: string;
  discipline: 'history' | 'geography' | 'science' | 'math';
  grade: CurriculumGrade;
  topic: string;
  title: string;
  bncc_skill: string; // Ex: EF06HI09
  thematic_unit: string;
  knowledge_object: string;
  sources: SourceMeta[];
  concepts: KnowledgeNode[];
  relations: KnowledgeRelation[];
  resources: ResourceItem[];
  quizzes: QuizItem[];
}
