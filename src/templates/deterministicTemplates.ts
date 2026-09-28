/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA TEMPLATES DETERMINÍSTICOS (MODO A — SEM IA)
 * Biblioteca canônica de templates e Content Packs integrados (EF 6º a 9º ano + Médio)
 */

import { LessonSpec } from '../types/lesson';
import { LessonComposer } from '../composer/lessonComposer';

export const TEMPLATE_GREECE_6EF: LessonSpec = LessonComposer.compose({
  discipline: 'history',
  grade: 6,
  topic: 'grecia_antiga',
  duration: 45,
  teaching_method: 'visual'
});

export const TEMPLATE_PROJECTILE_MOTION: LessonSpec = {
  schema_version: '1.0',
  lesson_version: 1,
  renderer_version: '0.3.0',
  lesson: {
    id: 'pemara-template-projectile-01',
    subject: 'physics',
    grade: '1EM',
    topic: 'projectile_motion',
    title: 'Lançamento Oblíquo: Trajetória e Vetores',
    duration_minutes: 45,
    language: 'pt-BR',
    author: 'Prof. Thiago Luzin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    generation_mode: 'MODE_A_NO_AI',
    didactic_style: 'visual',
    visual_status: 'READY'
  },
  objectives: [
    'Compreender a decomposição vetorial de velocidade no plano bidimensional',
    'Diferenciar o movimento retilíneo uniforme no eixo horizontal (Vx constante) e uniformemente variado no eixo vertical (Vy sob ação da gravidade)',
    'Calcular e visualizar a altura máxima (Vy = 0) e o alcance horizontal total'
  ],
  scenes: [
    {
      id: 'sc-proj-01',
      type: 'title',
      layout_id: '01_title',
      title: 'Lançamento Oblíquo',
      subtitle: 'Cinemática Vetorial e Gravidade na Prática',
      badge: 'Física • 1º Ano do Ensino Médio',
      teacher_notes: 'Diga aos alunos: imagine chutar uma bola de futebol para o alto. O movimento não é só para frente nem só para cima; é a combinação simultânea de dois movimentos independentes.'
    },
    {
      id: 'sc-proj-02',
      type: 'text',
      layout_id: '02_title_body',
      title: 'O Princípio da Independência de Galileu',
      content: [
        'Galileu Galilei descobriu que um projétil no ar realiza simultaneamente dois movimentos que não interferem um no outro:',
        '1. Eixo X (Horizontal): Não há forças atuando (desprezando a resistência do ar). Logo, é um Movimento Retilíneo Uniforme (MRU) com Vx = V0 · cos(θ) constante.',
        '2. Eixo Y (Vertical): A aceleração da gravidade (g ≈ 9.81 m/s²) puxa constantemente para baixo. É um Movimento Uniformemente Variado (MUV) com Vy = V0 · sin(θ) - g · t.'
      ],
      callout: 'No ponto mais alto da trajetória, a velocidade vertical Vy se anula momentaneamente (Vy = 0), mas o projétil continua se movendo para frente com Vx!',
      teacher_notes: 'Reforce que a gravidade só altera a componente vertical Vy. Ela não freia nem acelera o movimento horizontal Vx.'
    },
    {
      id: 'sc-proj-03',
      type: 'physics_projectile',
      layout_id: '09_simulation',
      title: 'Simulação Determinística de Trajetória',
      params: {
        velocity: 25,
        angle: 45,
        gravity: 9.81,
        initial_height: 0,
        show_vectors: true,
        show_graphs: true,
        show_trajectory: true,
        time_scale: 1.0
      },
      pedagogical_focus: 'Observe os vetores: Vx (verde) permanece idêntico em todo o percurso. Vy (azul) diminui até sumir no topo e inverte na queda.',
      teacher_notes: 'Experimente alterar o ângulo para 30° e 60°: mostre que ângulos complementares (30° e 60°) atingem o mesmo alcance horizontal se a velocidade for mantida!'
    },
    {
      id: 'sc-proj-04',
      type: 'quiz',
      layout_id: '10_quiz',
      title: 'Verificação Rápida de Aprendizagem',
      question: 'O que acontece com a velocidade vertical (Vy) exatamente no ponto mais alto (ápice) de um lançamento oblíquo?',
      answers: [
        'Atinge o seu valor máximo positivo',
        'Permanece idêntica à velocidade horizontal Vx',
        'Torna-se momentaneamente zero (Vy = 0 m/s)',
        'Inverte instantaneamente de direção mantendo o módulo'
      ],
      correct_index: 2,
      explanation: 'Correto! No ápice da trajetória, toda a energia cinética vertical foi convertida em energia potencial gravitacional. Assim, a velocidade vertical é nula (Vy = 0), e a velocidade total do projétil é igual a Vx.',
      teacher_notes: 'Pegadinha comum: muitos alunos acham que a velocidade total é zero. Lembre que o corpo ainda tem velocidade horizontal Vx!'
    }
  ]
};

export const TEMPLATE_SOLAR_SYSTEM: LessonSpec = {
  schema_version: '1.0',
  lesson_version: 1,
  renderer_version: '0.3.0',
  lesson: {
    id: 'pemara-template-solar-01',
    subject: 'science',
    grade: '6EF',
    topic: 'solar_system',
    title: 'O Sistema Solar e os Movimentos da Terra',
    duration_minutes: 45,
    language: 'pt-BR',
    author: 'Prof. Thiago Luzin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    generation_mode: 'MODE_A_NO_AI',
    didactic_style: 'visual',
    visual_status: 'READY'
  },
  objectives: [
    'Compreender a estrutura heliocêntrica do Sistema Solar',
    'Reconhecer as características dos planetas rochosos e gigantes gasosos',
    'Diferenciar os movimentos terrestres de rotação (dias e noites) e translação (anos e estações)'
  ],
  scenes: [
    {
      id: 'sc-solar-01',
      type: 'title',
      layout_id: '01_title',
      title: 'O Sistema Solar',
      subtitle: 'Nosso Bairro Cósmico no Braço de Órion',
      badge: 'Ciências • Astronomia Didática',
      teacher_notes: 'Pergunte aos alunos: quantos planetas existem? Por que Plutão deixou de ser considerado planeta em 2006?'
    },
    {
      id: 'sc-solar-02',
      type: 'text',
      layout_id: '02_title_body',
      title: 'Estrutura e Leis de Kepler',
      content: [
        'O Sol concentra mais de 99.8% de toda a massa do Sistema Solar, mantendo 8 planetas principais em órbitas estáveis pela atração gravitacional.',
        'Planetas Rochosos (Telúricos): Mercúrio, Vênus, Terra e Marte — compostos por rochas e metais, mais próximos do Sol.',
        'Planetas Gasosos e Gigantes de Gelo: Júpiter, Saturno, Urano e Netuno — compostos por hidrogênio, hélio, água, amônia e metano.'
      ],
      callout: 'A Terra leva aproximadamente 365 dias e 6 horas para dar uma volta completa ao redor do Sol (translação). Esse quarto de dia acumulado gera o ano bissexto a cada 4 anos!',
      teacher_notes: 'Destaque que o modelo aceito hoje é o Heliocêntrico, consolidado por Copérnico, Galileu e Kepler.'
    },
    {
      id: 'sc-solar-03',
      type: 'solar_system',
      layout_id: '09_simulation',
      title: 'Mapa Interativo das Órbitas Planetárias',
      params: {
        central_body: 'Sun',
        focused_planet: 'Earth',
        speed_multiplier: 1.0,
        show_orbits: true,
        show_labels: true,
        show_data_cards: true,
        scale_mode: 'didactic'
      },
      teacher_notes: 'Clique na Terra para abrir a ficha técnica: mostre a distância em UA (Unidades Astronômicas) e o período orbital de 365 dias.'
    },
    {
      id: 'sc-solar-04',
      type: 'quiz',
      layout_id: '10_quiz',
      title: 'Quiz de Astronomia',
      question: 'Qual é o principal fator responsável pelas quatro estações do ano na Terra?',
      answers: [
        'A distância variável da Terra ao Sol ao longo da órbita elíptica',
        'A inclinação do eixo de rotação da Terra (23.5°) em relação ao plano de translação',
        'A atividade de manchas solares que varia ciclicamente',
        'A passagem da Lua entre a Terra e o Sol bloqueando radiação'
      ],
      correct_index: 1,
      explanation: 'Excelente! A inclinação de 23.5° do eixo da Terra faz com que diferentes hemisférios recebam incidência solar com ângulos diferentes ao longo do ano, originando as estações.',
      teacher_notes: 'Desfaça o mito clássico de que o verão ocorre porque a Terra está "mais perto do Sol". No afélio (ponto mais distante), é verão no hemisfério Norte!'
    }
  ]
};

export const TEMPLATE_MATH_FUNCTION: LessonSpec = {
  schema_version: '1.0',
  lesson_version: 1,
  renderer_version: '0.3.0',
  lesson: {
    id: 'pemara-template-math-01',
    subject: 'math',
    grade: '9EF',
    topic: 'quadratic_function',
    title: 'Função Quadrática e a Parábola: y = ax² + bx + c',
    duration_minutes: 45,
    language: 'pt-BR',
    author: 'Prof. Thiago Luzin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    generation_mode: 'MODE_A_NO_AI',
    didactic_style: 'visual',
    visual_status: 'READY'
  },
  objectives: [
    'Identificar os coeficientes a, b e c na equação quadrática',
    'Compreender o papel do discriminante Delta (Δ = b² - 4ac) na existência de raízes',
    'Localizar o vértice da parábola e determinar pontos de máximo e mínimo'
  ],
  scenes: [
    {
      id: 'sc-math-01',
      type: 'title',
      layout_id: '01_title',
      title: 'A Parábola da Função Quadrática',
      subtitle: 'Análise Gráfica dos Coeficientes e Raízes',
      badge: 'Matemática • Álgebra e Geometria Analítica'
    },
    {
      id: 'sc-math-02',
      type: 'math_function',
      layout_id: '08_chart',
      title: 'Explorador Interativo de Parábola',
      params: {
        function_type: 'parabola',
        a: 1,
        b: -2,
        c: -3,
        x_min: -6,
        x_max: 6,
        show_roots: true,
        show_vertex: true,
        show_grid: true
      },
      teacher_notes: 'Mova o slider "a": mostre que quando a > 0 a concavidade é para cima (formato de U), e quando a < 0 a concavidade é para baixo.'
    },
    {
      id: 'sc-math-03',
      type: 'quiz',
      layout_id: '10_quiz',
      title: 'Teste de Conceito',
      question: 'Se em uma função quadrática o discriminante for negativo (Δ < 0), o que acontece com o gráfico da parábola?',
      answers: [
        'A parábola corta o eixo x em exatamente um ponto',
        'A parábola não intercepta o eixo x em nenhum ponto real',
        'A parábola se torna uma reta horizontal',
        'O vértice da parábola coincide com a origem (0,0)'
      ],
      correct_index: 1,
      explanation: 'Correto! Quando Δ < 0, a equação não possui raízes reais (apenas raízes complexas conjugadas), logo o gráfico não toca nem cruza o eixo x.',
      teacher_notes: 'Conecte isso com a fórmula de Bhaskara: raiz quadrada de número negativo não pertence aos números reais.'
    }
  ]
};

export const TEMPLATES_LIBRARY: Record<string, LessonSpec> = {
  grecia_antiga: TEMPLATE_GREECE_6EF,
  projectile_motion: TEMPLATE_PROJECTILE_MOTION,
  solar_system: TEMPLATE_SOLAR_SYSTEM,
  quadratic_function: TEMPLATE_MATH_FUNCTION
};

export function getTemplateByTopicOrSubject(subject: string, topic?: string): LessonSpec {
  if (topic && TEMPLATES_LIBRARY[topic]) {
    return JSON.parse(JSON.stringify(TEMPLATES_LIBRARY[topic]));
  }
  if (subject === 'history') return JSON.parse(JSON.stringify(TEMPLATE_GREECE_6EF));
  if (subject === 'physics') return JSON.parse(JSON.stringify(TEMPLATE_PROJECTILE_MOTION));
  if (subject === 'science') return JSON.parse(JSON.stringify(TEMPLATE_SOLAR_SYSTEM));
  if (subject === 'math') return JSON.parse(JSON.stringify(TEMPLATE_MATH_FUNCTION));
  
  return JSON.parse(JSON.stringify(TEMPLATE_GREECE_6EF));
}
