import {bnccLabel} from './bnccLabels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA CATÁLOGO CANÔNICO DO PILOTO V1
 * Define rigorosamente os temas, séries e disciplinas suportados no piloto escolar.
 * Impede substituição silenciosa de conteúdo e de ano escolar.
 */

export interface PilotDemo {
  id: string;
  subject: 'history' | 'physics' | 'science' | 'math';
  subjectLabel: string;
  canonicalGrade: string;
  allowedGrades: string[];
  topicId: string;
  canonicalTopic: string;
  aliases: string[];
  title: string;
  bnccSkill: string;
}

export const PILOT_DEMOS: Record<string, PilotDemo> = {
  greece_6ef: {
    id: 'history-6-grecia-antiga',
    subject: 'history',
    subjectLabel: 'História',
    canonicalGrade: '6EF',
    allowedGrades: ['6', '6EF', '6º ano', '6o ano', '6° ano', '6 ano', '6º', '6°', '6o', '6º ano fundamental'],
    topicId: 'grecia_antiga',
    canonicalTopic: 'Grécia Antiga',
    aliases: ['grecia antiga', 'grécia antiga', 'grecia_antiga', 'pólis', 'polis', 'atenas e esparta', 'democracia ateniense'],
    title: 'Grécia Antiga: Pólis, Democracia e Sociedade',
    bnccSkill: bnccLabel('EF06HI09')
  },
  projectile_1em: {
    id: 'physics-1em-lancamento-obliquo',
    subject: 'physics',
    subjectLabel: 'Física',
    canonicalGrade: '1EM',
    allowedGrades: ['1EM', '1 EM', '1º EM', '1o EM', '1° EM', '1º ano EM', '1o ano EM', '1 ano EM', '1º ano médio', '1o ano medio'],
    topicId: 'lancamento_obliquo',
    canonicalTopic: 'Lançamento Oblíquo',
    aliases: ['lançamento oblíquo', 'lancamento obliquo', 'movimento oblíquo', 'movimento obliquo', 'cinemática vetorial', 'projétil', 'projetil'],
    title: 'Cinemática Vetorial: Lançamento Oblíquo de Projéteis',
    bnccSkill: 'EM13CNT204: Elaborar explicações, previsões e cálculos a respeito dos movimentos de objetos na Terra.'
  },
  solar_system_6ef: {
    id: 'science-6-sistema-solar',
    subject: 'science',
    subjectLabel: 'Ciências',
    canonicalGrade: '6EF',
    allowedGrades: ['6', '6EF', '6º ano', '6o ano', '6° ano', '6 ano', '6º', '6°', '6o', '6º ano fundamental'],
    topicId: 'sistema_solar',
    canonicalTopic: 'Sistema Solar',
    aliases: ['sistema solar', 'sistema_solar', 'planetas', 'órbitas planetárias', 'orbitas planetarias', 'astronomia fundamental'],
    title: 'O Sistema Solar: Dinâmica Orbital e Escalas Planetárias',
    bnccSkill: bnccLabel('EF06CI14')
  },
  quadratic_function_9ef: {
    id: 'math-9-funcao-quadratica',
    subject: 'math',
    subjectLabel: 'Matemática',
    canonicalGrade: '9EF',
    allowedGrades: ['9', '9EF', '9º ano', '9o ano', '9° ano', '9 ano', '9º', '9°', '9o', '9º ano fundamental'],
    topicId: 'funcao_quadratica',
    canonicalTopic: 'Função Quadrática',
    aliases: ['função quadrática', 'funcao quadratica', 'funcao_quadratica', 'parábola', 'parabola', 'equação do 2º grau', 'equação do segundo grau', 'equacao do 2 grau', 'y = ax² + bx + c', 'grafico da parabola'],
    title: 'Função Quadrática e a Parábola: y = ax² + bx + c',
    bnccSkill: bnccLabel('EF09MA06')
  }
};

export interface CatalogMatchResult {
  isSupported: boolean;
  demo?: PilotDemo;
  error?: string;
}

function normalizeStr(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Valida a requisição de geração contra o catálogo oficial do piloto.
 * Retorna se o tema, disciplina e série são suportados ou um erro explicativo detalhado.
 */
export function matchPilotCatalog(
  rawSubject: string,
  rawTopic: string,
  rawGrade: string | number
): CatalogMatchResult {
  const normSubject = normalizeStr(rawSubject);
  const normTopic = normalizeStr(rawTopic);
  const normGrade = String(rawGrade || '').toUpperCase().trim();

  // Mapear disciplina
  let subjectKey: 'history' | 'physics' | 'science' | 'math' | null = null;
  if (normSubject === 'history' || normSubject === 'historia') subjectKey = 'history';
  else if (normSubject === 'physics' || normSubject === 'fisica') subjectKey = 'physics';
  else if (normSubject === 'science' || normSubject === 'ciencias') subjectKey = 'science';
  else if (normSubject === 'math' || normSubject === 'matematica') subjectKey = 'math';

  if (!subjectKey) {
    return {
      isSupported: false,
      error: `Tema ou disciplina não suportado no Content Pack do piloto: disciplina "${rawSubject}" não está disponível. Disciplinas suportadas: História, Física, Ciências e Matemática.`
    };
  }

  // Identificar demo correspondente
  let matchedDemo: PilotDemo | null = null;

  if (subjectKey === 'history') {
    const isGreece = PILOT_DEMOS.greece_6ef.aliases.some((a) => normTopic.includes(normalizeStr(a)));
    if (isGreece) {
      matchedDemo = PILOT_DEMOS.greece_6ef;
    } else {
      return {
        isSupported: false,
        error: `Tema ou disciplina não suportado no Content Pack do piloto: tema histórico "${rawTopic}" não suportado. O piloto suporta exclusivamente: "Grécia Antiga" (6º ano).`
      };
    }
  } else if (subjectKey === 'physics') {
    const isProjectile = PILOT_DEMOS.projectile_1em.aliases.some((a) => normTopic.includes(normalizeStr(a)));
    if (isProjectile) {
      matchedDemo = PILOT_DEMOS.projectile_1em;
    } else {
      return {
        isSupported: false,
        error: `Tema ou disciplina não suportado no Content Pack do piloto: tema de física "${rawTopic}" não suportado. O piloto suporta exclusivamente: "Lançamento Oblíquo" (1º ano EM).`
      };
    }
  } else if (subjectKey === 'science') {
    const isSolar = PILOT_DEMOS.solar_system_6ef.aliases.some((a) => normTopic.includes(normalizeStr(a)));
    if (isSolar) {
      matchedDemo = PILOT_DEMOS.solar_system_6ef;
    } else {
      return {
        isSupported: false,
        error: `Tema ou disciplina não suportado no Content Pack do piloto: tema de ciências "${rawTopic}" não suportado. O piloto suporta exclusivamente: "Sistema Solar" (6º ano).`
      };
    }
  } else if (subjectKey === 'math') {
    // Rejeitar explicitamente outros tipos de função como seno, afim, linear, exponencial
    const unsupportedMath = ['seno', 'cosseno', 'tangente', 'trigonometria', 'linear', 'afim', 'exponencial', 'logaritmo'];
    if (unsupportedMath.some((u) => normTopic.includes(u))) {
      return {
        isSupported: false,
        error: `Tema ou disciplina não suportado no Content Pack do piloto: tema matemático "${rawTopic}" não suportado. O piloto suporta exclusivamente "Função Quadrática / Parábola" para o 9º ano (9EF).`
      };
    }

    const isQuadratic = PILOT_DEMOS.quadratic_function_9ef.aliases.some((a) => normTopic.includes(normalizeStr(a))) ||
      normTopic === 'funcao quadratica' || normTopic === 'parabola';
    if (isQuadratic) {
      matchedDemo = PILOT_DEMOS.quadratic_function_9ef;
    } else {
      return {
        isSupported: false,
        error: `Tema ou disciplina não suportado no Content Pack do piloto: tema matemático "${rawTopic}" não suportado. O piloto suporta exclusivamente: "Função Quadrática / Parábola" (9º ano).`
      };
    }
  }

  if (!matchedDemo) {
    return {
      isSupported: false,
      error: `Tema ou disciplina não suportado no Content Pack do piloto: tema "${rawTopic}" não suportado para ${rawSubject}.`
    };
  }

function normalizeGradeToken(grade: string | number): string {
  return String(grade || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/º|°/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

  // Validação estrita da série escolar: comparação exata de tokens sem startsWith
  const cleanNormGrade = normalizeGradeToken(rawGrade);
  const isGradeValid = matchedDemo.allowedGrades.some(
    (allowed) => normalizeGradeToken(allowed) === cleanNormGrade
  );

  if (!isGradeValid) {
    return {
      isSupported: false,
      error: `Tema ou disciplina não suportado no Content Pack do piloto: incompatibilidade de série escolar. O tema "${matchedDemo.canonicalTopic}" (${matchedDemo.subjectLabel}) é suportado exclusivamente para a série "${matchedDemo.canonicalGrade}". A série solicitada foi "${rawGrade}". O sistema escolar não permite substituição silenciosa de série.`
    };
  }

  return {
    isSupported: true,
    demo: matchedDemo
  };
}
