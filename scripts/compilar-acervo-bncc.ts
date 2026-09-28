/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — COMPILADOR E EXTRATOR DO ACERVO CURRICULAR BNCC OFICIAL
 * Fonte: Ministério da Educação (MEC) / Base Nacional Comum Curricular (2018)
 * Documento Oficial: BNCC_EI_EF_110518_versaofinal_site.pdf (MEC)
 * Base de Dados: BNCC_Ensino Fundamental.xlsx (exportada de downloadbncc.mec.gov.br)
 * Arquivo canônico verificado: server/curriculum/raw/bncc-ensino-fundamental-oficial.json
 * SHA-256: 892f7131657ed8706877b066c391b24cc5906c1359ec57ce68603e1b49851dfc
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { BnccSkillItem } from '../server/curriculum/bnccTypes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMP_MAP: Record<string, 'portuguese' | 'english' | 'arts' | 'physical_education' | 'math' | 'science' | 'history' | 'geography' | 'religious_education'> = {
  'ef-comp-lp': 'portuguese',
  'ef-comp-li': 'english',
  'ef-comp-ar': 'arts',
  'ef-comp-ef': 'physical_education',
  'ef-comp-ma': 'math',
  'ef-comp-ci': 'science',
  'ef-comp-ge': 'geography',
  'ef-comp-hi': 'history',
  'ef-comp-er': 'religious_education',
};

function formatSlugToLabel(slug: string, pattern: RegExp): string {
  if (!slug) return '';
  const clean = slug.replace(pattern, '').replace(/-/g, ' ').trim();
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Carrega a totalidade das 730 habilidades oficiais da BNCC para os Anos Finais (EF II: 6º ao 9º ano),
 * extraídas literalmente do conjunto de dados canônico homologado pelo MEC, com verificação de hash SHA-256
 * e localização precisa no documento PDF e na planilha oficial.
 */
export function getOfficialBnccSkills(): BnccSkillItem[] {
  let jsonPath = path.resolve(process.cwd(), 'server/curriculum/raw/bncc-ensino-fundamental-oficial.json');
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.resolve(__dirname, '../server/curriculum/raw/bncc-ensino-fundamental-oficial.json');
  }

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Arquivo canônico oficial da BNCC não encontrado em "${jsonPath}". Impossível compilar acervo sem documento oficial.`);
  }

  const rawContent = fs.readFileSync(jsonPath, 'utf8');
  
  // Verificação de integridade via SHA-256
  const computedHash = crypto.createHash('sha256').update(rawContent).digest('hex');
  const EXPECTED_HASH = '892f7131657ed8706877b066c391b24cc5906c1359ec57ce68603e1b49851dfc';
  if (computedHash !== EXPECTED_HASH) {
    throw new Error(`[BNCC] Integridade inválida: hash do arquivo difere do esperado (${computedHash} vs ${EXPECTED_HASH}).`);
  }

  const structureContent = fs.readFileSync(path.join(path.dirname(jsonPath), 'bncc-estrutura-oficial.json'), 'utf8');
  if (crypto.createHash('sha256').update(structureContent).digest('hex') !== '3c24cc32c4227ce372f39fe276216f8c6899708820156053824615706eb8bd74') {
    throw new Error('Integridade inválida na estrutura curricular da BNCC.');
  }
  const raw = JSON.parse(rawContent);
  if (!Array.isArray(raw.habilidades)) {
    throw new Error('Formato inválido do arquivo oficial da BNCC: chave "habilidades" ausente.');
  }

  // Filtra rigorosamente as habilidades dos Anos Finais (EF II: 6º ao 9º ano)
  const ef2RawSkills = raw.habilidades.filter((h: any) => {
    const anos = h.anos || [];
    return anos.some((a: number) => a >= 6 && a <= 9);
  });

  const skills: BnccSkillItem[] = ef2RawSkills.map((h: any) => {
    const anos: number[] = h.anos || [];
    let gradeLevel: 6 | 7 | 8 | 9 | 67 | 69 | 89;
    if (anos.length === 1) {
      gradeLevel = anos[0] as 6 | 7 | 8 | 9;
    } else if (anos.length === 2 && anos.includes(6) && anos.includes(7)) {
      gradeLevel = 67;
    } else if (anos.length === 2 && anos.includes(8) && anos.includes(9)) {
      gradeLevel = 89;
    } else if (anos.length === 4 && anos.includes(6) && anos.includes(9)) {
      gradeLevel = 69;
    } else {
      gradeLevel = anos[0] as 6 | 7 | 8 | 9;
    }

    const subjectCode = COMP_MAP[h.componente];
    if (!subjectCode) {
      throw new Error(`Componente curricular desconhecido "${h.componente}" para a habilidade ${h.codigo}.`);
    }

    let thematicUnit = 'Unidade Curricular BNCC';
    if (h.organizacao) {
      if (h.organizacao.unidade_tematica) {
        thematicUnit = formatSlugToLabel(h.organizacao.unidade_tematica, /^ef-comp-[a-z]+-ut-/);
      } else if (h.organizacao.campos_atuacao && h.organizacao.campos_atuacao.length > 0) {
        thematicUnit = formatSlugToLabel(h.organizacao.campos_atuacao[0], /^ef-comp-[a-z]+-catu-/);
      }
    }

    let knowledgeObject = 'Objeto de Conhecimento BNCC';
    if (Array.isArray(h.objetos_conhecimento) && h.objetos_conhecimento.length > 0) {
      knowledgeObject = h.objetos_conhecimento.map((id: string) => formatSlugToLabel(id, /^ef-comp-[a-z]+-oc-/)).join('; ');
    }

    return {
      code: h.codigo,
      thematic_unit: thematicUnit,
      knowledge_object: knowledgeObject,
      description: h.texto.trim(),
      grade_level: gradeLevel,
      subject_code: subjectCode,
      locator: h.fonte?.localizador || undefined,
      locator_pdf: h.fonte?.localizador_pdf || undefined,
      verified_at: new Date().toISOString()
    };
  });

  return skills;
}
