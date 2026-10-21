import {bnccLabel} from './bnccLabels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — CATÁLOGO CURRICULAR COMPLETO BNCC (EF II: 6º AO 9º ANO)
 * Mapeamento canônico de todos os 9 componentes curriculares da BNCC,
 * faixas multianuais e Content Packs publicados no PostgreSQL.
 */

import { Subject } from '../types/lesson';
import { matchPilotCatalog } from './pilotCatalog';

export interface CurriculumTopicEntry {
  id: string;
  slug: string;
  subject: Subject;
  subjectLabel: string;
  gradeLevel: string;
  gradeNum: number;
  title: string;
  bnccSkill: string;
  isPublished: boolean;
  statusLabel: string;
  hasSufficientContent?: boolean;
  keywords?: string[];
  searchText?: string;
  skillCodes?: string[];
  editorialStatus?: string;
}

export const CURRICULUM_CATALOG: CurriculumTopicEntry[] = [
  // -------------------------------------------------------------------------
  // 1. HISTÓRIA (history)
  // -------------------------------------------------------------------------
  {
    id: 'pack-hist-6-greece',
    slug: 'history-6-grecia-antiga',
    subject: 'history',
    subjectLabel: 'História',
    gradeLevel: '6EF',
    gradeNum: 6,
    title: 'Grécia Antiga: Pólis, Democracia e Sociedade',
    bnccSkill: bnccLabel('EF06HI09'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo (v2.0)'
  },
  {
    id: 'pack-hist-7-renaissance',
    slug: 'history-7-renascimento-humanismo',
    subject: 'history',
    subjectLabel: 'História',
    gradeLevel: '7EF',
    gradeNum: 7,
    title: 'O Renascimento Cultural e o Humanismo',
    bnccSkill: bnccLabel('EF07HI04'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-hist-8-industrial',
    slug: 'history-8-revolucao-industrial',
    subject: 'history',
    subjectLabel: 'História',
    gradeLevel: '8EF',
    gradeNum: 8,
    title: 'A Revolução Industrial: Trabalho, Máquinas e Cidades',
    bnccSkill: bnccLabel('EF08HI03'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-hist-9-republic',
    slug: 'history-9-republica-brasil',
    subject: 'history',
    subjectLabel: 'História',
    gradeLevel: '9EF',
    gradeNum: 9,
    title: 'A Proclamação da República e a Política dos Governadores',
    bnccSkill: bnccLabel('EF09HI01'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },

  // -------------------------------------------------------------------------
  // 2. GEOGRAFIA (geography)
  // -------------------------------------------------------------------------
  {
    id: 'pack-geo-6-climates',
    slug: 'geography-6-climas-paisagens',
    subject: 'geography',
    subjectLabel: 'Geografia',
    gradeLevel: '6EF',
    gradeNum: 6,
    title: 'Climas do Brasil, Zonas Térmicas e Biomas',
    bnccSkill: bnccLabel('EF06GE03'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-geo-7-urban',
    slug: 'geography-7-urbanizacao-industrializacao',
    subject: 'geography',
    subjectLabel: 'Geografia',
    gradeLevel: '7EF',
    gradeNum: 7,
    title: 'Urbanização Brasileira e a Rede de Cidades',
    bnccSkill: bnccLabel('EF07GE04'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-geo-8-globalization',
    slug: 'geography-8-geopolitica-globalizacao',
    subject: 'geography',
    subjectLabel: 'Geografia',
    gradeLevel: '8EF',
    gradeNum: 8,
    title: 'Globalização e a Divisão Internacional do Trabalho',
    bnccSkill: bnccLabel('EF08GE05'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-geo-9-europe-asia',
    slug: 'geography-9-europa-asia-oceania',
    subject: 'geography',
    subjectLabel: 'Geografia',
    gradeLevel: '9EF',
    gradeNum: 9,
    title: 'Geopolítica Contemporânea: União Europeia e Potências Asiáticas',
    bnccSkill: bnccLabel('EF09GE08'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },

  // -------------------------------------------------------------------------
  // 3. CIÊNCIAS (science)
  // -------------------------------------------------------------------------
  {
    id: 'pack-sci-6-solarsystem',
    slug: 'science-6-sistema-solar',
    subject: 'science',
    subjectLabel: 'Ciências',
    gradeLevel: '6EF',
    gradeNum: 6,
    title: 'O Sistema Solar e os Movimentos da Terra',
    bnccSkill: bnccLabel('EF06CI14'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-sci-7-thermal',
    slug: 'science-7-maquinas-termicas',
    subject: 'science',
    subjectLabel: 'Ciências',
    gradeLevel: '7EF',
    gradeNum: 7,
    title: 'Máquinas Térmicas, Calor e Transformações Energéticas',
    bnccSkill: bnccLabel('EF07CI01'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-sci-8-reproduction',
    slug: 'science-8-reproducao-sexualidade',
    subject: 'science',
    subjectLabel: 'Ciências',
    gradeLevel: '8EF',
    gradeNum: 8,
    title: 'Reprodução Biológica, Sexualidade e Hormônios',
    bnccSkill: bnccLabel('EF08CI07'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-sci-9-chemistry',
    slug: 'science-9-materia-reacoes-quimicas',
    subject: 'science',
    subjectLabel: 'Ciências',
    gradeLevel: '9EF',
    gradeNum: 9,
    title: 'Estrutura Atômica, Tabela Periódica e Reações Químicas',
    bnccSkill: bnccLabel('EF09CI02'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },

  // -------------------------------------------------------------------------
  // 4. MATEMÁTICA (math)
  // -------------------------------------------------------------------------
  {
    id: 'pack-math-6-fractions',
    slug: 'math-6-fracoes-decimais',
    subject: 'math',
    subjectLabel: 'Matemática',
    gradeLevel: '6EF',
    gradeNum: 6,
    title: 'Frações, Decimais e Números Racionais',
    bnccSkill: bnccLabel('EF06MA07'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-math-7-integers',
    slug: 'math-7-numeros-inteiros',
    subject: 'math',
    subjectLabel: 'Matemática',
    gradeLevel: '7EF',
    gradeNum: 7,
    title: 'Números Inteiros, Reta Numérica e Operações',
    bnccSkill: bnccLabel('EF07MA03'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-math-8-equations',
    slug: 'math-8-equacoes-primeiro-grau',
    subject: 'math',
    subjectLabel: 'Matemática',
    gradeLevel: '8EF',
    gradeNum: 8,
    title: 'Equações Lineares e Sistemas de 1º Grau',
    bnccSkill: bnccLabel('EF08MA07'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-math-9-quadratic',
    slug: 'math-9-funcao-quadratica',
    subject: 'math',
    subjectLabel: 'Matemática',
    gradeLevel: '9EF',
    gradeNum: 9,
    title: 'Função Quadrática e a Parábola: y = ax² + bx + c',
    bnccSkill: bnccLabel('EF09MA06'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },

  // -------------------------------------------------------------------------
  // 5. LÍNGUA PORTUGUESA (portuguese)
  // -------------------------------------------------------------------------
  {
    id: 'pack-port-67-news',
    slug: 'portuguese-67-noticia-fake-news',
    subject: 'portuguese',
    subjectLabel: 'Língua Portuguesa',
    gradeLevel: '67EF',
    gradeNum: 67,
    title: 'Gênero Notícia, Fact-Checking e Desinformação',
    bnccSkill: bnccLabel('EF67LP01'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-port-89-opinion',
    slug: 'portuguese-89-artigo-opiniao',
    subject: 'portuguese',
    subjectLabel: 'Língua Portuguesa',
    gradeLevel: '89EF',
    gradeNum: 89,
    title: 'Artigo de Opinião: Tese, Argumentação e Contra-argumento',
    bnccSkill: bnccLabel('EF89LP03'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },

  // -------------------------------------------------------------------------
  // 6. LÍNGUA INGLESA (english)
  // -------------------------------------------------------------------------
  {
    id: 'pack-eng-6-routines',
    slug: 'english-6-daily-routines',
    subject: 'english',
    subjectLabel: 'Língua Inglesa',
    gradeLevel: '6EF',
    gradeNum: 6,
    title: 'Daily Routines and the Simple Present',
    bnccSkill: bnccLabel('EF06LI19'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-eng-7-past',
    slug: 'english-7-past-events',
    subject: 'english',
    subjectLabel: 'Língua Inglesa',
    gradeLevel: '7EF',
    gradeNum: 7,
    title: 'Talking About Past Events: Simple Past and Biographies',
    bnccSkill: bnccLabel('EF07LI15'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },

  // -------------------------------------------------------------------------
  // 7. ARTE (arts)
  // -------------------------------------------------------------------------
  {
    id: 'pack-art-69-visual',
    slug: 'arts-69-elementos-visuais',
    subject: 'arts',
    subjectLabel: 'Arte',
    gradeLevel: '69EF',
    gradeNum: 69,
    title: 'Elementos da Linguagem Visual e a Arte Brasileira',
    bnccSkill: bnccLabel('EF69AR04'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },

  // -------------------------------------------------------------------------
  // 8. EDUCAÇÃO FÍSICA (physical_education)
  // -------------------------------------------------------------------------
  {
    id: 'pack-pe-67-invasion',
    slug: 'physical_education-67-esportes-invasao',
    subject: 'physical_education',
    subjectLabel: 'Educação Física',
    gradeLevel: '67EF',
    gradeNum: 67,
    title: 'Esportes de Invasão, Táticas Coletivas e Fair Play',
    bnccSkill: bnccLabel('EF67EF04'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },

  // -------------------------------------------------------------------------
  // 9. ENSINO RELIGIOSO (religious_education)
  // -------------------------------------------------------------------------
  {
    id: 'pack-re-6-tradition',
    slug: 'religious_education-6-tradicao-oral-escrita',
    subject: 'religious_education',
    subjectLabel: 'Ensino Religioso',
    gradeLevel: '6EF',
    gradeNum: 6,
    title: 'Tradição Oral, Textos Sagrados e Diversidade Cultural',
    bnccSkill: bnccLabel('EF06ER01'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-eng-8-future',
    slug: 'english-8-future-plans-predictions',
    subject: 'english',
    subjectLabel: 'Língua Inglesa',
    gradeLevel: '8EF',
    gradeNum: 8,
    title: 'Future Plans, Intentions and Predictions: Will vs. Going to',
    bnccSkill: bnccLabel('EF08LI12'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-eng-9-conditionals',
    slug: 'english-9-global-issues-conditionals',
    subject: 'english',
    subjectLabel: 'Língua Inglesa',
    gradeLevel: '9EF',
    gradeNum: 9,
    title: 'Global Challenges and Conditionals: If Clauses in Debate',
    bnccSkill: bnccLabel('EF09LI14'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-ef-89-lutas-aventura',
    slug: 'physical_education-89-lutas-mundo-aventura',
    subject: 'physical_education',
    subjectLabel: 'Educação Física',
    gradeLevel: '89EF',
    gradeNum: 8,
    title: 'Lutas do Mundo e Práticas Corporais de Aventura na Natureza',
    bnccSkill: bnccLabel('EF89EF14'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-pt-6-narrativa',
    slug: 'portuguese-6-narrativa-ficcional-enredo',
    subject: 'portuguese',
    subjectLabel: 'Língua Portuguesa',
    gradeLevel: '6EF',
    gradeNum: 6,
    title: 'Narrativa Ficcional: Estrutura do Enredo, Personagens e Tempo',
    bnccSkill: bnccLabel('EF06LP06'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-pt-7-dramatico',
    slug: 'portuguese-7-texto-dramatico-teatro',
    subject: 'portuguese',
    subjectLabel: 'Língua Portuguesa',
    gradeLevel: '7EF',
    gradeNum: 7,
    title: 'O Texto Dramático: Rubricas, Diálogos e Encenação Teatral',
    bnccSkill: bnccLabel('EF07LP12'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-pt-8-reportagem',
    slug: 'portuguese-8-reportagem-investigativa-etica',
    subject: 'portuguese',
    subjectLabel: 'Língua Portuguesa',
    gradeLevel: '8EF',
    gradeNum: 8,
    title: 'Reportagem Investigativa: Apuração, Vozes Sociais e Ética Jornalística',
    bnccSkill: bnccLabel('EF08LP01'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-pt-9-cronica',
    slug: 'portuguese-9-cronica-argumentacao-estilo',
    subject: 'portuguese',
    subjectLabel: 'Língua Portuguesa',
    gradeLevel: '9EF',
    gradeNum: 9,
    title: 'A Crônica Literária e o Editorial: Argumentação, Ironia e Cotidiano',
    bnccSkill: bnccLabel('EF09LP03'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-pt-69-hipertexto',
    slug: 'portuguese-69-hipertexto-cultura-digital',
    subject: 'portuguese',
    subjectLabel: 'Língua Portuguesa',
    gradeLevel: '69EF',
    gradeNum: 6,
    title: 'Cultura Digital, Multissemiose e Curadoria Crítica de Conteúdo',
    bnccSkill: bnccLabel('EF69LP06'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-er-7-liderancas',
    slug: 'religious_education-7-liderancas-eticas-sociais',
    subject: 'religious_education',
    subjectLabel: 'Ensino Religioso',
    gradeLevel: '7EF',
    gradeNum: 7,
    title: 'Lideranças Religiosas, Ética e Transformação Social no Mundo',
    bnccSkill: bnccLabel('EF07ER01'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-er-8-ritos',
    slug: 'religious_education-8-crencas-ritos-passagem',
    subject: 'religious_education',
    subjectLabel: 'Ensino Religioso',
    gradeLevel: '8EF',
    gradeNum: 8,
    title: 'Crenças, Filosofias de Vida e Ritos de Passagem nas Culturas',
    bnccSkill: bnccLabel('EF08ER02'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },
  {
    id: 'pack-er-9-direitos-humanos',
    slug: 'religious_education-9-direitos-humanos-laicidade',
    subject: 'religious_education',
    subjectLabel: 'Ensino Religioso',
    gradeLevel: '9EF',
    gradeNum: 9,
    title: 'Direitos Humanos, Princípios Éticos e Laicidade do Estado',
    bnccSkill: bnccLabel('EF09ER01'),
    isPublished: true,
    statusLabel: 'Disponível no Acervo'
  },

  // -------------------------------------------------------------------------
  // PILOTOS PRESERVADOS DO ENSINO MÉDIO
  // -------------------------------------------------------------------------
  {
    id: 'physics-1em-lancamento-obliquo',
    slug: 'physics-1em-lancamento-obliquo',
    subject: 'physics',
    subjectLabel: 'Física',
    gradeLevel: '1EM',
    gradeNum: 10,
    title: 'Cinemática Vetorial: Lançamento Oblíquo de Projéteis',
    bnccSkill: 'EM13CNT204: Elaborar explicações e cálculos dos movimentos de objetos na Terra.',
    isPublished: true,
    statusLabel: 'Piloto EM Preservado'
  }
];

export function isGradeCompatible(inputGrade?: string, entryGrade?: string): boolean {
  if (!inputGrade || !entryGrade) return false;
  const cleanG = inputGrade.toUpperCase().replace(/\s/g, '');
  const cleanEG = entryGrade.toUpperCase().replace(/\s/g, '');
  if (cleanG === cleanEG) return true;
  // Faixas multianuais: 67EF é compatível com 6EF e 7EF; 69EF com 6, 7, 8, 9; 89EF com 8, 9
  if (cleanEG === '67EF' && (cleanG === '6EF' || cleanG === '7EF')) return true;
  if (cleanEG === '69EF' && (cleanG === '6EF' || cleanG === '7EF' || cleanG === '8EF' || cleanG === '9EF')) return true;
  if (cleanEG === '89EF' && (cleanG === '8EF' || cleanG === '9EF')) return true;
  return false;
}

export function getTopicsForSubjectAndGrade(subject: Subject, grade?: string, catalog = CURRICULUM_CATALOG): CurriculumTopicEntry[] {
  return catalog.filter(entry => {
    if (!entry.isPublished || entry.hasSufficientContent === false) return false;
    if (entry.subject !== subject) return false;
    return !grade || isGradeCompatible(grade, entry.gradeLevel);
  });
}

export function normalizeTopicQuery(text: string): string {
  return text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Busca em todos os anos da disciplina; resultados nunca alteram o ano selecionado. */
export function searchCurriculumTopics(subject: Subject, query: string, catalog: CurriculumTopicEntry[]): CurriculumTopicEntry[] {
  const singular = (word: string) => word.endsWith('ais') ? word.slice(0,-3)+'al' : word.endsWith('oes') ? word.slice(0,-3)+'ao' : word.endsWith('s') && word.length>4 ? word.slice(0,-1) : word;
  const tokens = normalizeTopicQuery(query).split(' ').filter(t => t && !['a','o','os','as','de','do','da','dos','das','sobre','e','aula'].includes(t)).map(singular);
  if (!tokens.length) return [];
  return catalog.filter(entry => entry.subject === subject && entry.isPublished && entry.hasSufficientContent !== false).map(entry => {
    const title = normalizeTopicQuery(entry.title);
    const words = normalizeTopicQuery([entry.title, ...(entry.keywords || []), ...(entry.skillCodes || []), entry.bnccSkill, entry.searchText || ''].join(' ')).split(' ').map(singular);
    const match = tokens.every(token => words.some(word => word === token || (token.length >= 4 && (word.startsWith(token) || token.startsWith(word) && word.length >= 4))));
    return { entry, score: title === normalizeTopicQuery(query) ? 3 : title.includes(normalizeTopicQuery(query)) ? 2 : 1, match };
  }).filter(hit => hit.match).sort((a,b) => b.score-a.score || a.entry.gradeNum-b.entry.gradeNum || a.entry.title.localeCompare(b.entry.title,'pt-BR')).map(hit => hit.entry);
}

export function findTopicBySlug(slug: string): CurriculumTopicEntry | undefined {
  return CURRICULUM_CATALOG.find(entry => entry.slug === slug);
}

export function resolvePackSlugForInput(subject: Subject, grade: string, rawTopic: string, catalog = CURRICULUM_CATALOG): string | null {
  if (!rawTopic || !rawTopic.trim()) return null;
  const normTopic = rawTopic.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Filtra candidatos estritamente por componente E compatibilidade com a série/faixa solicitada
  const candidates = getTopicsForSubjectAndGrade(subject, grade, catalog);

  // 1. Busca exata por slug
  const bySlug = candidates.find(entry => entry.slug.toLowerCase() === normTopic);
  if (bySlug) return bySlug.slug;

  // 2. Busca exata por título (normalizado)
  const byExactTitle = candidates.find(entry => {
    const normTitle = entry.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return normTitle === normTopic;
  });
  if (byExactTitle) return byExactTitle.slug;

  // 3. Busca por inclusão mútua significativa (mínimo 4 caracteres úteis)
  if (normTopic.length >= 4) {
    const bySubTitle = candidates.filter(entry => {
      const normTitle = entry.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      return normTitle.split(':')[0].trim() === normTopic;
    });
    if (bySubTitle.length === 1) return bySubTitle[0].slug;
  }

  // Aliases legados somente se o próprio pacote estiver neste catálogo publicado.
  const legacy = matchPilotCatalog(subject, rawTopic, grade);
  if (legacy.isSupported && legacy.demo && legacy.demo.aliases.some(alias =>
    alias.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === normTopic)) {
    return candidates.find(entry => entry.slug === legacy.demo!.id)?.slug || null;
  }

  // NUNCA fazer fallback silencioso para o primeiro tema da série ou outra matéria!
  // Se o tema não consta no catálogo publicado para a série/faixa informada, retorna null.
  return null;
}

/**
 * Atualiza ou complementa o catálogo curricular com os pacotes ativamente publicados
 * no PostgreSQL, garantindo que o frontend reflita o acervo canônico dinamicamente.
 */
export function syncCatalogWithPublishedPacks(publishedPacks: any[]): void {
  if (!Array.isArray(publishedPacks)) return;
  for (const pack of publishedPacks) {
    if (!pack || !pack.slug) continue;
    const existing = CURRICULUM_CATALOG.find(e => e.slug === pack.slug);
    if (existing) {
      existing.title = pack.title || existing.title;
      existing.bnccSkill = pack.bncc_skill || existing.bnccSkill;
      existing.isPublished = true;
    } else {
      CURRICULUM_CATALOG.push({
        id: pack.id || `pack-${pack.slug}`,
        slug: pack.slug,
        subject: pack.subject_code,
        subjectLabel: pack.subject_label || pack.subject_code,
        gradeLevel: typeof pack.grade_level === 'number' ? `${pack.grade_level}EF` : pack.grade_level,
        gradeNum: typeof pack.grade_level === 'number' ? pack.grade_level : 6,
        title: pack.title,
        bnccSkill: pack.bncc_skill || 'BNCC',
        isPublished: true,
        statusLabel: 'Publicado no Acervo'
      });
    }
  }
}

