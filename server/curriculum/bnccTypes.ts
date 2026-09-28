/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — CONTRATOS DO ACERVO CURRICULAR BNCC OFICIAL
 */

export interface BnccSkillItem {
  code: string;
  thematic_unit: string;
  knowledge_object: string;
  description: string;
  grade_level: 6 | 7 | 8 | 9 | 67 | 69 | 89;
  subject_code: 'portuguese' | 'english' | 'arts' | 'physical_education' | 'math' | 'science' | 'history' | 'geography' | 'religious_education';
  locator?: string;
  locator_pdf?: string;
  verified_at?: string;
}

export interface BnccSourceMeta {
  id: string;
  provider: string;
  title: string;
  url: string;
  author: string;
  language: string;
  source_type: 'official';
  status: 'verified';
  version: string;
  documentHash: string;
  datasetHash: string;
  structureHash: string;
  retrievedAt: string;
}

export const OFFICIAL_BNCC_SOURCE: BnccSourceMeta = {
  id: 'src-bncc-mec-2018',
  provider: 'Ministério da Educação / Secretaria de Educação Básica (MEC/SEB)',
  title: 'Base Nacional Comum Curricular (BNCC) — Ensino Fundamental: Anos Finais (6º ao 9º ano)',
  url: 'https://cdn.mec.gov.br/basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
  author: 'MEC / CNE — Conselho Nacional de Educação',
  language: 'pt-BR',
  source_type: 'official',
  status: 'verified',
  version: '2018.3',
  documentHash: 'ad623d7b33986a4e87e1441a4e675064cd30db3650b86a75caefa476e802272b',
  datasetHash: '892f7131657ed8706877b066c391b24cc5906c1359ec57ce68603e1b49851dfc', // bncc-ensino-fundamental-oficial.json
  structureHash: '3c24cc32c4227ce372f39fe276216f8c6899708820156053824615706eb8bd74', // bncc-estrutura-oficial.json
  retrievedAt: '2026-09-27T00:00:00.000Z',
};

