/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CONTENT PACK: HISTÓRIA — 6º ANO — GRÉCIA ANTIGA (Obrigatório V1)
 * Alinhado com a BNCC: EF06HI09 (Conceito de Pólis, Democracia Ateniense e Cidadania)
 * Registro canônico com fontes, licenças, relações e recursos determinísticos.
 */

import { ContentPack } from '../types';

export const CONTENT_PACK_GRECIA_ANTIGA: ContentPack = {
  id: 'history-6-grecia-antiga',
  discipline: 'history',
  grade: 6,
  topic: 'grecia_antiga',
  title: 'Grécia Antiga: Pólis, Democracia e Sociedade',
  bncc_skill: 'EF06HI09: Discutir o conceito de Antiguidade Clássica, seu alcance e limite na tradição ocidental, assim como os impactos sobre a noção de cidadania.',
  thematic_unit: 'Antiguidade Clássica: Grécia e Roma',
  knowledge_object: 'O conceito de pólis, a democracia ateniense e a oligarquia espartana',
  sources: [
    {
      id: 'src-bncc-mec-2018',
      name: 'Base Nacional Comum Curricular (BNCC/MEC)',
      license: 'Domínio Público / Governo Federal',
      version: '2018.3',
      status: 'verified',
      last_updated: '2026-01-15',
      reference_url: 'http://basenacionalcomum.mec.gov.br/'
    },
    {
      id: 'src-vernant-mito-pensamento',
      name: 'Jean-Pierre Vernant — As Origens do Pensamento Grego',
      license: 'Citação Acadêmica / Difusão Pedagógica',
      version: 'Ed. Paz e Terra',
      status: 'curated',
      last_updated: '2025-11-20'
    }
  ],
  concepts: [
    {
      id: 'node-polis',
      type: 'concept',
      name: 'Pólis (Cidade-Estado)',
      short_definition: 'Comunidade política independente, autônoma, com suas próprias leis, moeda e governo.',
      deep_description: 'A pólis grega não era apenas um centro geográfico murado, mas o coletivo de cidadãos (politai) que decidiam seu próprio destino. Apesar de compartilharem língua e religião (culto aos deuses do Olimpo), cada pólis tinha soberania total.',
      subject: 'history',
      grade: 6,
      source_id: 'src-bncc-mec-2018'
    },
    {
      id: 'node-atenas',
      type: 'place',
      name: 'Atenas',
      short_definition: 'Pólis da península da Ática conhecida pelo comércio marítimo e pelo nascimento da Democracia direta.',
      deep_description: 'Atenas desenvolveu uma economia mercantil e naval. Na Eclésia (assembleia dos cidadãos), votava-se diretamente as leis. No entanto, mulheres, escravizados e metecos (estrangeiros) estavam excluídos da cidadania.',
      subject: 'history',
      grade: 6,
      source_id: 'src-vernant-mito-pensamento'
    },
    {
      id: 'node-esparta',
      type: 'place',
      name: 'Esparta',
      short_definition: 'Pólis da Lacônia (Peloponeso), de organização oligárquica, agrária e militarista.',
      deep_description: 'Esparta foi fundada pelos dórios e voltada para a guerra. Apenas os esparciatas governavam (Gerúsia e Ápela), enquanto a terra era cultivada pelos hilotas (população servil dominada pelo Estado).',
      subject: 'history',
      grade: 6,
      source_id: 'src-bncc-mec-2018'
    },
    {
      id: 'node-democracia',
      type: 'theory',
      name: 'Democracia Direta Ateniense',
      short_definition: 'Demos (povo) + Kratos (poder): sistema onde os cidadãos livres votavam diretamente na praça pública (Ágora).',
      deep_description: 'Reformada por Clístenes em 508 a.C., estabeleceu o sorteio para cargos públicos (Isegoria: direito igual à palavra). Diferente da democracia representativa atual, na grega o cidadão não elegia deputados; ele mesmo exercia o voto.',
      subject: 'history',
      grade: 6,
      source_id: 'src-bncc-mec-2018'
    }
  ],
  relations: [
    {
      from_node_id: 'node-atenas',
      to_node_id: 'node-polis',
      relation: 'example_of',
      description: 'Atenas é o principal exemplo histórico de pólis democrática.'
    },
    {
      from_node_id: 'node-esparta',
      to_node_id: 'node-polis',
      relation: 'example_of',
      description: 'Esparta é o principal exemplo de pólis oligárquica e militar.'
    },
    {
      from_node_id: 'node-atenas',
      to_node_id: 'node-esparta',
      relation: 'contrasts_with',
      description: 'Atenas (mercantil, cultural e democrática) e Esparta (agrária, rígida e militarista) representam modelos opostos de organização social.'
    },
    {
      from_node_id: 'node-democracia',
      to_node_id: 'node-atenas',
      relation: 'part_of',
      description: 'A democracia floresceu no contexto cívico da pólis de Atenas.'
    }
  ],
  resources: [
    {
      id: 'map-greece-001',
      title: 'Mapa do Mar Egeu e da Grécia Antiga',
      type: 'svg_map',
      source_id: 'src-bncc-mec-2018',
      data: {
        region: 'Bálcãs e Mar Egeu',
        focus_points: [
          { name: 'Atenas', lat: 37.98, lon: 23.72, region: 'Ática', role: 'Democracia e Marinha' },
          { name: 'Esparta', lat: 37.07, lon: 22.42, region: 'Peloponeso', role: 'Militarismo e Oligarquia' },
          { name: 'Olímpia', lat: 37.64, lon: 21.62, region: 'Élide', role: 'Jogos Pan-Helênicos' },
          { name: 'Delfos', lat: 38.48, lon: 22.50, region: 'Fócida', role: 'Oráculo de Apolo' }
        ]
      }
    },
    {
      id: 'comparison-atenas-esparta',
      title: 'Quadro Comparativo: Atenas vs Esparta',
      type: 'comparison_table',
      source_id: 'src-vernant-mito-pensamento',
      data: {
        columns: ['Critério', 'Atenas', 'Esparta'],
        rows: [
          { criteria: 'Forma de Governo', atenas: 'Democracia Direta (Eclésia)', esparta: 'Oligarquia Militar (Gerúsia)' },
          { criteria: 'Economia Base', atenas: 'Comércio marítimo e manufaturas', esparta: 'Agricultura pelas terras estatais' },
          { criteria: 'Educação (Paideia)', atenas: 'Filosofia, artes, retórica e corpo', esparta: 'Agogê: disciplina militar e armas' },
          { criteria: 'Papel da Mulher', atenas: 'Restrita ao espaço doméstico (Gineceu)', esparta: 'Treino físico, liberdade e gestão' },
          { criteria: 'Trabalho Produtivo', atenas: 'Escravizados e artesãos livres', esparta: 'Hilotas (servos públicos dominados)' }
        ]
      }
    }
  ],
  quizzes: [
    {
      id: 'quiz-grecia-01',
      node_id: 'node-democracia',
      question: 'Na democracia da Atenas Antiga, quem tinha o direito de participar das votações na Eclésia?',
      answers: [
        'Todos os habitantes que residiam na cidade',
        'Apenas os cidadãos (homens livres, adultos e filhos de pais atenienses)',
        'Apenas os proprietários de grandes navios e filósofos',
        'Homens e mulheres que possuíssem propriedades rurais'
      ],
      correct_index: 1,
      explanation: 'A cidadania ateniense era restrita: mulheres, estrangeiros (metecos) e escravizados estavam excluídos da vida política.',
      difficulty: 'easy'
    },
    {
      id: 'quiz-grecia-02',
      node_id: 'node-polis',
      question: 'O que caracterizava primordialmente a "Pólis" grega?',
      answers: [
        'Um império centralizado sob o comando de um único rei',
        'Uma colônia governada diretamente pelo imperador persa',
        'Uma cidade-estado soberana com leis, moedas e governo próprios',
        'Uma província unificada sem autonomia militar'
      ],
      correct_index: 2,
      explanation: 'Cada pólis grega possuía completa autonomia política e jurídica, embora compartilhassem a língua e os deuses.',
      difficulty: 'easy'
    }
  ]
};

export const CONTENT_PACKS_REGISTRY: Record<string, ContentPack> = {
  'history-6-grecia-antiga': CONTENT_PACK_GRECIA_ANTIGA
};
