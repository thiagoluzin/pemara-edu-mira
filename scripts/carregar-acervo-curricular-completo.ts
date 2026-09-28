/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — CARGA DO ACERVO CURRICULAR COMPLETO BNCC (EF II: 6º AO 9º ANO)
 * Executa a ordem formal de preenchimento curricular real em PostgreSQL:
 * 1. Fontes formais e Licenças
 * 2. Matriz completa de habilidades oficiais BNCC (721 habilidades em 9 componentes)
 * 3. Nós de conhecimento pedagógicos originais em português com conceitos e quizzes
 * 4. Vínculos ontológicos e curriculares (curriculum_knowledge_links)
 * 5. Recursos visuais contextualizados (mapas, tabelas comparativas, diagramas)
 * 6. Publicação íntegra de Content Packs (payload_json completo, sem objetos vazios)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { getOfficialBnccSkills } from './compilar-acervo-bncc';
import { OFFICIAL_BNCC_SOURCE } from '../server/curriculum/bnccTypes';

interface TopicSeed {
  slug: string;
  title: string;
  subjectCode: 'portuguese' | 'english' | 'arts' | 'physical_education' | 'math' | 'science' | 'history' | 'geography' | 'religious_education';
  gradeLevel: number;
  skillCodes: string[];
  nodes: {
    slug: string;
    type: 'concept' | 'event' | 'person' | 'place' | 'period' | 'formula' | 'process' | 'definition' | 'theory' | 'object';
    title: string;
    shortDescription: string;
    deepDescription: string;
    keyPoints: string[];
    example?: string;
  }[];
  relations?: { fromSlug: string; type: string; toSlug: string }[];
  resources?: {
    id: string;
    type: string;
    title: string;
    storagePath: string;
    mimeType: string;
    metadata: any;
    linkToSlug: string;
    role: string;
  }[];
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export const CURRICULAR_TOPICS: TopicSeed[] = [
  // -------------------------------------------------------------------------
  // HISTÓRIA
  // -------------------------------------------------------------------------
  {
    slug: 'history-6-grecia-antiga',
    title: 'Grécia Antiga: Pólis, Democracia e Sociedade',
    subjectCode: 'history',
    gradeLevel: 6,
    skillCodes: ['EF06HI09', 'EF06HI10'],
    nodes: [
      {
        slug: 'node-grecia-antiga-core',
        type: 'period',
        title: 'Grécia Antiga',
        shortDescription: 'Civilização clássica do Mediterrâneo oriental caracterizada pela autonomia das cidades-estado.',
        deepDescription: 'A civilização grega desenvolveu-se na bacia do Mar Egeu, combinando fragmentação política com identidade cultural comum manifestada nos jogos pan-helênicos e nos mitos.',
        keyPoints: ['Relevo montanhoso estimulou cidades autônomas', 'Identidade cultural unificada pela língua e religião', 'Berço dos conceitos ocidentais de cidadania e filosofia']
      },
      {
        slug: 'node-polis-core',
        type: 'concept',
        title: 'A Pólis Grega',
        shortDescription: 'Cidade-estado autônoma com território, leis e moeda próprios.',
        deepDescription: 'A pólis representava o centro da vida comunitária grega, estruturada em torno da ágora (praça pública) e da acrópole (cidadela fortificada).',
        keyPoints: ['Autonomia política e religiosa', 'Espaço cívico centrado na ágora', 'Modelo de organização cidadã']
      },
      {
        slug: 'node-democracia-ateniense',
        type: 'concept',
        title: 'Democracia Ateniense',
        shortDescription: 'Sistema de governo direto no qual cidadãos participavam da tomada de decisões na Eclésia.',
        deepDescription: 'Criada pelas reformas de Clístenes e consolidada por Péricles, a democracia ateniense era direta, porém restritiva: mulheres, escravizados e estrangeiros (metecos) não eram considerados cidadãos.',
        keyPoints: ['Democracia direta na assembleia', 'Restrição a homens livres filhos de pais atenienses', 'Isonomia e isegoria como princípios']
      },
      {
        slug: 'node-esparta-oligarquia',
        type: 'concept',
        title: 'Esparta e a Sociedade Militar',
        shortDescription: 'Pólis oligárquica de organização militar rigorosa no Peloponeso.',
        deepDescription: 'Esparta baseava sua estrutura na disciplina militar (agoge), governada por uma diarquia e pelo conselho de anciãos (Gerúsia), sustentada pelo trabalho compulsório dos hilotas.',
        keyPoints: ['Governo oligárquico da Gerúsia', 'Educação militarizada estatal', 'População servil dos hilotas']
      }
    ],
    relations: [
      { fromSlug: 'node-polis-core', type: 'part_of', toSlug: 'node-grecia-antiga-core' },
      { fromSlug: 'node-democracia-ateniense', type: 'example_of', toSlug: 'node-polis-core' },
      { fromSlug: 'node-esparta-oligarquia', type: 'contrasts_with', toSlug: 'node-democracia-ateniense' }
    ],
    resources: [
      {
        id: 'res-mapa-egeu-hist',
        type: 'map',
        title: 'Mapa do Mar Egeu e Principais Pólis',
        storagePath: '/storage/assets/maps/mar-egeu.svg',
        mimeType: 'image/svg+xml',
        metadata: { center: [38.0, 24.0], locations: ['Atenas', 'Esparta', 'Delfos', 'Olímpia'] },
        linkToSlug: 'node-grecia-antiga-core',
        role: 'map'
      }
    ],
    quiz: {
      question: 'Qual era a principal característica da democracia em Atenas no século V a.C.?',
      options: [
        'Era representativa, elegendo senadores por voto popular universal.',
        'Era direta, com cidadãos votando na ágora, mas excluía mulheres, escravizados e estrangeiros.',
        'Permitia voto a todos os habitantes da pólis, independentemente de renda ou gênero.',
        'Baseava-se em uma monarquia hereditária com conselho consultivo de guerreiros.'
      ],
      correctIndex: 1,
      explanation: 'A democracia ateniense era direta para os cidadãos (homens livres nascidos de pai e mãe atenienses), excluindo mulheres, escravos e metecos.'
    }
  },
  {
    slug: 'history-7-renascimento-humanismo',
    title: 'O Renascimento Cultural e o Humanismo',
    subjectCode: 'history',
    gradeLevel: 7,
    skillCodes: ['EF07HI04', 'EF07HI05'],
    nodes: [
      {
        slug: 'node-renascimento-cultural',
        type: 'period',
        title: 'Renascimento Cultural',
        shortDescription: 'Movimento artístico, científico e literário dos séculos XIV a XVI iniciado na Península Itálica.',
        deepDescription: 'Marcado pela valorização da cultura greco-romana, pelo mecenato da burguesia e pelo surgimento da perspectiva linear nas artes visuais.',
        keyPoints: ['Retomada dos ideais clássicos', 'Apoio financeiro de mecenas', 'Desenvolvimento da perspectiva geométrica']
      },
      {
        slug: 'node-humanismo',
        type: 'theory',
        title: 'O Humanismo',
        shortDescription: 'Corrente de pensamento que colocou o ser humano no centro das reflexões (antropocentrismo).',
        deepDescription: 'Diferenciou-se do teocentrismo medieval sem negar a religiosidade, enfatizando o racionalismo, a observação da natureza e o pensamento crítico.',
        keyPoints: ['Antropocentrismo e racionalismo', 'Observação empírica e método experimental', 'Valorização da dignidade humana']
      },
      {
        slug: 'node-imprensa-gutenberg',
        type: 'object',
        title: 'A Imprensa de Tipos Móveis de Gutenberg',
        shortDescription: 'Invenção tecnológica que revolucionou a reprodução e circulação de livros e ideias.',
        deepDescription: 'Por volta de 1450, Johannes Gutenberg criou os tipos móveis metálicos, barateando a produção textual e acelerando a difusão do conhecimento renascentista e das Reformas.',
        keyPoints: ['Multiplicação veloz de exemplares', 'Queda no custo dos livros', 'Democratização do acesso à leitura']
      }
    ],
    relations: [
      { fromSlug: 'node-humanismo', type: 'influenced', toSlug: 'node-renascimento-cultural' },
      { fromSlug: 'node-imprensa-gutenberg', type: 'caused_by', toSlug: 'node-renascimento-cultural' }
    ],
    resources: [
      {
        id: 'res-comp-teocentrismo-antropocentrismo',
        type: 'comparison_table',
        title: 'Comparativo: Pensamento Medieval vs Humanismo Renascentista',
        storagePath: '/storage/assets/charts/renascimento-comp.json',
        mimeType: 'application/json',
        metadata: { aspects: ['Visão de mundo', 'Critério da verdade', 'Natureza', 'Arte'] },
        linkToSlug: 'node-humanismo',
        role: 'comparison'
      }
    ],
    quiz: {
      question: 'Qual a principal diferença entre o teocentrismo medieval e o antropocentrismo renascentista?',
      options: [
        'O Renascimento aboliu totalmente a fé em Deus e perseguiu as ordens religiosas.',
        'O antropocentrismo valorizou as capacidades racionais e a observação da natureza pelo ser humano.',
        'O teocentrismo colocava o dinheiro e a burguesia no centro das decisões sociais.',
        'Não houve diferença, pois os intelectuais renascentistas mantiveram os mesmos métodos escolásticos.'
      ],
      correctIndex: 1,
      explanation: 'O antropocentrismo valorizou a razão humana e a investigação empírica sem necessariamente abandonar a fé religiosa.'
    }
  },
  {
    slug: 'history-8-revolucao-industrial',
    title: 'A Revolução Industrial: Trabalho, Máquinas e Cidades',
    subjectCode: 'history',
    gradeLevel: 8,
    skillCodes: ['EF08HI03', 'EF08HI04'],
    nodes: [
      {
        slug: 'node-revolucao-industrial-core',
        type: 'process',
        title: 'A Primeira Revolução Industrial',
        shortDescription: 'Transição da produção artesanal e manufatureira para a maquinofatura com energia a vapor.',
        deepDescription: 'Iniciada na Inglaterra na segunda metade do século XVIII, alicerçada no carvão mineral, no ferro e na mecanização da indústria têxtil.',
        keyPoints: ['Pioneirismo inglês (capital, matérias-primas e mão de obra)', 'Máquina a vapor como força motriz', 'Separação entre capital e trabalho']
      },
      {
        slug: 'node-proletariado-urbano',
        type: 'concept',
        title: 'O Proletariado e as Condições Fabris',
        shortDescription: 'Classe trabalhadora assalariada submetida a longas jornadas e ambientes insalubres.',
        deepDescription: 'Operários, incluindo mulheres e crianças, trabalhavam até 16 horas diárias sem direitos trabalhistas, culminando no surgimento das primeiras associações sindicais (trade unions).',
        keyPoints: ['Jornadas exaustivas e exploração infantil', 'Insalubridade fabril', 'Gênese dos movimentos operários (Ludismo e Cartismo)']
      }
    ],
    quiz: {
      question: 'Qual fator foi determinante para o pioneirismo da Inglaterra na Primeira Revolução Industrial?',
      options: [
        'A ausência total de minas de carvão e a dependência de energia solar.',
        'A acumulação prévia de capitais, ricas jazidas de carvão e ferro e cercamento dos campos.',
        'O controle absoluto da Igreja Católica sobre os portos e frotas mercantes britânicas.',
        'O fechamento das indústrias têxteis em favor de plantações exclusivas de especiarias.'
      ],
      correctIndex: 1,
      explanation: 'A Inglaterra reuniu capitais do comércio colonial, reservas de carvão/ferro e mão de obra expropriada do campo pelos cercamentos.'
    }
  },
  {
    slug: 'history-9-republica-brasil',
    title: 'A Proclamação da República e a Política dos Governadores',
    subjectCode: 'history',
    gradeLevel: 9,
    skillCodes: ['EF09HI01', 'EF09HI02'],
    nodes: [
      {
        slug: 'node-proclamacao-republica',
        type: 'event',
        title: 'A Proclamação da República (1889)',
        shortDescription: 'Golpe cívico-militar que pôs fim ao Império de D. Pedro II e instituiu o regime republicano federativo.',
        deepDescription: 'Conduzida pelo Marechal Deodoro da Fonseca sob apoio de cafeicultores paulistas e militares positivistas, sem participação popular direta.',
        keyPoints: ['15 de novembro de 1889', 'Aliança entre oligarquias cafeeiras e Exército', 'Afastamento das massas populares no processo']
      },
      {
        slug: 'node-coronelismo-voto-cabresto',
        type: 'concept',
        title: 'Coronelismo e o Voto de Cabresto',
        shortDescription: 'Mecanismo de controle eleitoral exercido pelos chefes políticos locais na República Oligárquica.',
        deepDescription: 'Por meio de coação, clientelismo e manipulação de títulos eleitorais abertos (não secretos), os coronéis garantiam a vitória dos candidatos oficiais.',
        keyPoints: ['Voto aberto facilitava intimidação', 'Rede de favores e violência local', 'Base da Política dos Governadores']
      }
    ],
    quiz: {
      question: 'Como funcionava o "voto de cabresto" durante a Primeira República no Brasil?',
      options: [
        'Votação eletrônica com auditoria pública independente e sigilo total.',
        'Eleitores eram coagidos pelos coronéis locais a votar nos candidatos da situação, pois o voto era aberto.',
        'Somente imigrantes europeus alfabetizados tinham direito de escolher o presidente da República.',
        'O presidente escolhia diretamente todos os prefeitos e deputados sem necessidade de urnas.'
      ],
      correctIndex: 1,
      explanation: 'O voto aberto permitia aos coronéis fiscalizar e coagir os eleitores que dependiam de favores, terras ou proteção local.'
    }
  },

  // -------------------------------------------------------------------------
  // GEOGRAFIA
  // -------------------------------------------------------------------------
  {
    slug: 'geography-6-climas-paisagens',
    title: 'Climas do Brasil, Zonas Térmicas e Biomas',
    subjectCode: 'geography',
    gradeLevel: 6,
    skillCodes: ['EF06GE03', 'EF06GE05'],
    nodes: [
      {
        slug: 'node-zonas-termicas-terra',
        type: 'concept',
        title: 'Zonas Térmicas da Terra',
        shortDescription: 'Divisão do globo em faixas climáticas segundo a inclinação dos raios solares.',
        deepDescription: 'A esfericidade e a inclinação do eixo terrestre determinam as zonas polar, temperada e tropical, moldando as temperaturas e estações do ano.',
        keyPoints: ['Zona Tropical ou Intertropical', 'Zonas Temperadas Norte e Sul', 'Zonas Polares']
      },
      {
        slug: 'node-climas-brasil',
        type: 'concept',
        title: 'Domínios Climáticos Brasileiros',
        shortDescription: 'Conjunto de tipos climáticos que cobrem o território brasileiro: equatorial, tropical, semiárido e subtropical.',
        deepDescription: 'A maior parte do Brasil situa-se na zona intertropical, conferindo predomínio de altas temperaturas médias, com regimes de chuva influenciados por massas de ar como a mEc e a mPa.',
        keyPoints: ['Equatorial úmido na Amazônia', 'Tropical típico com estação seca no Centro-Oeste', 'Semiárido no Sertão', 'Subtropical no Sul']
      }
    ],
    resources: [
      {
        id: 'res-mapa-climas-brasil',
        type: 'map',
        title: 'Mapa dos Tipos Climáticos do Brasil',
        storagePath: '/storage/assets/maps/climas-brasil.svg',
        mimeType: 'image/svg+xml',
        metadata: { projection: 'Sirgas2000', regions: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'] },
        linkToSlug: 'node-climas-brasil',
        role: 'map'
      }
    ],
    quiz: {
      question: 'Qual característica define o clima semiárido predominante no interior do Nordeste brasileiro?',
      options: [
        'Chuvas abundantes e distribuídas regularmente durante todos os doze meses do ano.',
        'Altas temperaturas médias, baixos índices pluviométricos e chuvas irregulares e concentradas.',
        'Temperaturas negativas no inverno com ocorrência de precipitação em forma de neve.',
        'Alta umidade constante decorrente da forte evapotranspiração da floresta equatorial.'
      ],
      correctIndex: 1,
      explanation: 'O semiárido caracteriza-se por precipitações reduzidas e irregulares e temperaturas elevadas ao longo de todo o ano.'
    }
  },
  {
    slug: 'geography-7-urbanizacao-industrializacao',
    title: 'Urbanização Brasileira e a Rede de Cidades',
    subjectCode: 'geography',
    gradeLevel: 7,
    skillCodes: ['EF07GE04', 'EF07GE08'],
    nodes: [
      {
        slug: 'node-urbanizacao-brasileira',
        type: 'process',
        title: 'O Processo de Urbanização no Brasil',
        shortDescription: 'Crescimento acelerado da população urbana a partir da década de 1950 com a industrialização.',
        deepDescription: 'O êxodo rural impulsionado pela mecanização do campo e atração das indústrias concentrou mais de 85% dos brasileiros nas cidades, gerando metrópoles e periferização.',
        keyPoints: ['Êxodo rural intenso pós-1950', 'Concentração industrial no Sudeste', 'Desafios urbanos de saneamento, habitação e mobilidade']
      }
    ],
    quiz: {
      question: 'Qual fator impulsionou a rápida transferência da população do campo para as cidades no Brasil no século XX?',
      options: [
        'A criação generalizada de empregos agrícolas manuais de alta remuneração no interior.',
        'A mecanização agrícola associada à atração de postos de trabalho no setor industrial urbano.',
        'A proibição do comércio e de escolas nas zonas rurais por decretos federais.',
        'A perda das terras agrícolas devido ao congelamento do solo no Centro-Oeste.'
      ],
      correctIndex: 1,
      explanation: 'O êxodo rural foi movido pela modernização das lavouras (mecanização) e pelo crescimento das fábricas nas metrópoles.'
    }
  },
  {
    slug: 'geography-8-geopolitica-globalizacao',
    title: 'Globalização e a Divisão Internacional do Trabalho',
    subjectCode: 'geography',
    gradeLevel: 8,
    skillCodes: ['EF08GE01', 'EF08GE05'],
    nodes: [
      {
        slug: 'node-globalizacao-dit',
        type: 'theory',
        title: 'A Globalização e as Cadeias Produtivas',
        shortDescription: 'Integração econômica, cultural e informacional planetária acelerada pelos avanços nos transportes e telecomunicações.',
        deepDescription: 'A nova Divisão Internacional do Trabalho organiza a produção global: países centrais lideram tecnologia e design, enquanto países periféricos fornecem commodities e mão de obra industrial.',
        keyPoints: ['Revolução técnico-científico-informacional', 'Multinacionais e dispersão das etapas fabris', 'Assimetria nas trocas globais']
      }
    ],
    quiz: {
      question: 'Como a Nova Divisão Internacional do Trabalho (DIT) organiza a produção das empresas multinacionais?',
      options: [
        'Cada país produz exclusivamente o que consome, abolindo o comércio marítimo internacional.',
        'Países desenvolvidos concentram tecnologia e pesquisa, enquanto etapas produtivas são descentralizadas para países com custos menores.',
        'Todos os países fabricam os mesmos componentes em cotas idênticas estabelecidas pela ONU.',
        'As sedes das corporações foram transferidas integralmente para áreas desérticas não habitadas.'
      ],
      correctIndex: 1,
      explanation: 'A globalização permitiu fragmentar a cadeia produtiva, retendo pesquisa nos países ricos e descentralizando a montagem para onde custos operacionais são menores.'
    }
  },
  {
    slug: 'geography-9-europa-asia-oceania',
    title: 'Geopolítica Contemporânea: União Europeia e Potências Asiáticas',
    subjectCode: 'geography',
    gradeLevel: 9,
    skillCodes: ['EF09GE08', 'EF09GE10'],
    nodes: [
      {
        slug: 'node-uniao-europeia-geopolitica',
        type: 'concept',
        title: 'A Integração Europeia e a União Europeia',
        shortDescription: 'Maior bloco econômico e político mundial, baseado em livre circulação e moeda única.',
        deepDescription: 'Nascida para assegurar a paz após a Segunda Guerra Mundial, a União Europeia instituiu o mercado comum, a zona do euro e o espaço Schengen, enfrentando desafios contemporâneos como o Brexit e fluxos migratórios.',
        keyPoints: ['Livre circulação de mercadorias, serviços e cidadãos', 'Moeda comum (Euro)', 'Desafios migratórios e identitários']
      }
    ],
    quiz: {
      question: 'Qual objetivo histórico inicial motivou a criação dos primeiros acordos de integração na Europa (como a CECA)?',
      options: [
        'Conquistar colônias na Antártida para extração de urânio.',
        'Promover a cooperação econômica no carvão e aço para impedir novos conflitos bélicos entre Alemanha e França.',
        'Criar uma barreira sanitária obrigatória contra produtos manufaturados americanos.',
        'Instituir uma monarquia absolutista unificada em todo o continente europeu.'
      ],
      correctIndex: 1,
      explanation: 'A Comunidade Europeia do Carvão e do Aço (1951) integrou matérias-primas de guerra para tornar um conflito entre nações vizinhas materialmente impossível.'
    }
  },

  // -------------------------------------------------------------------------
  // CIÊNCIAS (Biologia, Física e Química no EF II)
  // -------------------------------------------------------------------------
  {
    slug: 'science-6-sistema-solar',
    title: 'O Sistema Solar e os Movimentos da Terra',
    subjectCode: 'science',
    gradeLevel: 6,
    skillCodes: ['EF06CI14'],
    nodes: [
      {
        slug: 'node-sistema-solar-core',
        type: 'concept',
        title: 'Estrutura do Sistema Solar',
        shortDescription: 'Conjunto de corpos celestes que orbitam a estrela central, o Sol, unidos pela gravidade.',
        deepDescription: 'Compreende 8 planetas principais, divididos entre telúricos (rochosos: Mercúrio, Vênus, Terra e Marte) e jovianos (gasosos/gelo: Júpiter, Saturno, Urano e Netuno), além de planetas anões e asteroides.',
        keyPoints: ['Sol concentra mais de 99,8% da massa', 'Planetas rochosos internos e gigantes gasosos externos', 'Cinturão de asteroides entre Marte e Júpiter']
      },
      {
        slug: 'node-movimentos-terra',
        type: 'process',
        title: 'Movimentos de Rotação e Translação',
        shortDescription: 'Dinâmicas orbitais da Terra responsáveis pela sucessão de dias/noites e pelas quatro estações.',
        deepDescription: 'A rotação em torno do próprio eixo (24 horas) determina os dias e noites. A translação elíptica em torno do Sol (365 dias e 6 horas) combinada à inclinação de 23,5º do eixo causa as quatro estações.',
        keyPoints: ['Rotação dura 24h e gera o ciclo dia/noite', 'Translação dura 365,25 dias e gera as estações', 'Inclinação axial determina desigualdade na insolação']
      }
    ],
    resources: [
      {
        id: 'res-diagrama-sistema-solar',
        type: 'diagram',
        title: 'Diagrama Orbital do Sistema Solar',
        storagePath: '/storage/assets/diagrams/sistema-solar.svg',
        mimeType: 'image/svg+xml',
        metadata: { planets: ['Mercúrio', 'Vênus', 'Terra', 'Marte', 'Júpiter', 'Saturno', 'Urano', 'Netuno'] },
        linkToSlug: 'node-sistema-solar-core',
        role: 'illustration'
      }
    ],
    quiz: {
      question: 'Por que ocorrem as diferentes estações do ano na Terra?',
      options: [
        'Porque a Terra se aproxima e se afasta do Sol devido à sua órbita extremamente alongada.',
        'Pela combinação entre o movimento de translação e a inclinação constante do eixo terrestre.',
        'Porque a velocidade de rotação da Terra varia conforme a quantidade de nuvens na atmosfera.',
        'Pela sombra projetada pela Lua sobre os continentes durante os solstícios.'
      ],
      correctIndex: 1,
      explanation: 'A inclinação de aproximadamente 23,5° do eixo da Terra faz com que cada hemisfério receba insolação de modo desigual ao longo da órbita anual de translação.'
    }
  },
  {
    slug: 'science-7-maquinas-termicas',
    title: 'Máquinas Térmicas, Calor e Transformações Energéticas',
    subjectCode: 'science',
    gradeLevel: 7,
    skillCodes: ['EF07CI01', 'EF07CI03'],
    nodes: [
      {
        slug: 'node-maquinas-termicas',
        type: 'concept',
        title: 'Máquinas Térmicas e Energia',
        shortDescription: 'Dispositivos que convertem energia térmica (calor) em energia mecânica (trabalho).',
        deepDescription: 'Desde as primeiras máquinas a vapor até os motores a combustão interna, as máquinas térmicas operam entre uma fonte quente e uma fonte fria, de acordo com as leis da termodinâmica.',
        keyPoints: ['Conversão de calor em trabalho mecânico', 'Necessidade de fonte quente e fonte fria', 'Rendimento térmico sempre inferior a 100%']
      }
    ],
    quiz: {
      question: 'Qual é o princípio fundamental de funcionamento de uma máquina térmica?',
      options: [
        'Converter 100% do calor em trabalho mecânico sem dissipação de energia para a fonte fria.',
        'Aproveitar o fluxo de calor da fonte de maior temperatura para a fonte fria para realizar trabalho mecânico.',
        'Gerar energia a partir do nada violando o princípio da conservação da energia.',
        'Funcionar apenas em temperaturas próximas do zero absoluto sem combustível.'
      ],
      correctIndex: 1,
      explanation: 'Uma máquina térmica opera recebendo calor de uma fonte de alta temperatura, convertendo parte em trabalho mecânico e descarregando o restante em uma fonte fria.'
    }
  },
  {
    slug: 'science-8-reproducao-sexualidade',
    title: 'Reprodução Biológica, Sexualidade e Hormônios',
    subjectCode: 'science',
    gradeLevel: 8,
    skillCodes: ['EF08CI07', 'EF08CI08'],
    nodes: [
      {
        slug: 'node-reproducao-biologica',
        type: 'concept',
        title: 'Reprodução Sexuada e Assexuada',
        shortDescription: 'Mecanismos biológicos que asseguram a continuidade das espécies com ou sem variabilidade genética.',
        deepDescription: 'A reprodução assexuada gera clones geneticamente idênticos com baixo gasto energético. A reprodução sexuada combina gametas haploides, gerando variabilidade essencial para a adaptação evolutiva.',
        keyPoints: ['Reprodução sexuada: fecundação de gametas e variabilidade genética', 'Reprodução assexuada: bipartição, brotamento e rapidez na clonagem', 'Papel dos hormônios testosterona, estrogênio e progesterona']
      }
    ],
    quiz: {
      question: 'Qual é a principal vantagem evolutiva propiciada pela reprodução sexuada?',
      options: [
        'Garantir que todos os descendentes sejam cópias idênticas e sem mutações.',
        'Gerar variabilidade genética nos descendentes, aumentando a capacidade de adaptação a mudanças ambientais.',
        'Dispensar a necessidade de parceiros e economizar toda a energia biológica do organismo.',
        'Diminuir a velocidade de divisão celular para impedir o envelhecimento dos tecidos.'
      ],
      correctIndex: 1,
      explanation: 'A recombinação genética na fecundação amplia a diversidade de características na população, favorecendo a sobrevivência da espécie frente a epidemias ou alterações ecológicas.'
    }
  },
  {
    slug: 'science-9-materia-reacoes-quimicas',
    title: 'Estrutura Atômica, Tabela Periódica e Reações Químicas',
    subjectCode: 'science',
    gradeLevel: 9,
    skillCodes: ['EF09CI01', 'EF09CI02'],
    nodes: [
      {
        slug: 'node-estrutura-atomica',
        type: 'concept',
        title: 'Modelos Atômicos e Estrutura da Matéria',
        shortDescription: 'Constituição submicroscópica da matéria formada por prótons, nêutrons e elétrons.',
        deepDescription: 'A evolução histórica dos modelos atômicos (Dalton, Thomson, Rutherford e Bohr) explica a organização dos elementos na Tabela Periódica e as forças de ligação interatômicas.',
        keyPoints: ['Núcleo atômico com prótons (+) e nêutrons (neutros)', 'Eletrosfera com elétrons (-)', 'Número atômico (Z) define o elemento químico']
      },
      {
        slug: 'node-reacoes-quimicas-lavoisier',
        type: 'theory',
        title: 'Reações Químicas e a Lei de Conservação da Massa',
        shortDescription: 'Processos de recombinação atômica onde reagentes se transformam em novas substâncias.',
        deepDescription: 'Segundo a Lei de Lavoisier ("Na natureza nada se cria, nada se perde, tudo se transforma"), a massa total dos reagentes é rigorosamente igual à massa total dos produtos em sistema fechado.',
        keyPoints: ['Ruptura e formação de ligações químicas', 'Conservação do número de átomos', 'Massa total dos reagentes = Massa total dos produtos']
      }
    ],
    quiz: {
      question: 'De acordo com a Lei de Conservação da Massa formulada por Antoine Lavoisier em um sistema fechado:',
      options: [
        'A massa dos produtos é sempre o dobro da massa dos reagentes que sofreram combustão.',
        'A massa total dos reagentes que reagem é igual à soma das massas dos produtos formados.',
        'Átomos são destruídos durante as reações para liberar radiação atômica.',
        'A massa das substâncias diminui conforme o fogo queima os compostos orgânicos.'
      ],
      correctIndex: 1,
      explanation: 'A Lei de Lavoisier estabelece que os átomos não são criados nem destruídos nas reações químicas convencionais, apenas rearranjados; logo, a massa se conserva.'
    }
  },

  // -------------------------------------------------------------------------
  // MATEMÁTICA
  // -------------------------------------------------------------------------
  {
    slug: 'math-6-fracoes-decimais',
    title: 'Frações, Decimais e Números Racionais',
    subjectCode: 'math',
    gradeLevel: 6,
    skillCodes: ['EF06MA07', 'EF06MA08'],
    nodes: [
      {
        slug: 'node-fracoes-significados',
        type: 'concept',
        title: 'Significados e Operações com Frações',
        shortDescription: 'Representação de partes de um todo, quociente de divisão e razão entre grandezas.',
        deepDescription: 'Compreende frações próprias, impróprias e aparentes, frações equivalentes por simplificação/multiplicação e conversão direta para números decimais finitos e dízimas periódicas.',
        keyPoints: ['Numerador e denominador', 'Equivalência de frações', 'Conversão fração-decimal']
      }
    ],
    quiz: {
      question: 'A fração 3/4 equivale a qual representação decimal e percentual?',
      options: [
        '0,34 e 34%',
        '0,75 e 75%',
        '0,43 e 43%',
        '1,33 e 133%'
      ],
      correctIndex: 1,
      explanation: 'Dividindo 3 por 4 obtém-se exatamente 0,75, o que corresponde a 75 centésimos ou 75%.'
    }
  },
  {
    slug: 'math-7-numeros-inteiros',
    title: 'Números Inteiros, Reta Numérica e Operações',
    subjectCode: 'math',
    gradeLevel: 7,
    skillCodes: ['EF07MA03', 'EF07MA04'],
    nodes: [
      {
        slug: 'node-conjunto-inteiros',
        type: 'concept',
        title: 'O Conjunto dos Números Inteiros (Z)',
        shortDescription: 'Extensão dos números naturais englobando números negativos, o zero e positivos.',
        deepDescription: 'Utilizados para indicar saldo bancário, profundidades marinhas, temperaturas abaixo de zero e fuso horário, regidos pelas regras formais de adição e multiplicação de sinais.',
        keyPoints: ['Representação geométrica na reta numerada', 'Módulo ou valor absoluto', 'Regra de sinais na multiplicação e divisão']
      }
    ],
    quiz: {
      question: 'Qual é o resultado da operação (-8) × (-3) + (-10)?',
      options: [
        '-34',
        '+14',
        '-14',
        '+34'
      ],
      correctIndex: 1,
      explanation: '(-8) × (-3) = +24 (multiplicação de sinais iguais resulta em positivo). Em seguida, 24 + (-10) = 14.'
    }
  },
  {
    slug: 'math-8-equacoes-primeiro-grau',
    title: 'Equações Lineares e Sistemas de 1º Grau',
    subjectCode: 'math',
    gradeLevel: 8,
    skillCodes: ['EF08MA07', 'EF08MA08'],
    nodes: [
      {
        slug: 'node-sistemas-lineares-1grau',
        type: 'formula',
        title: 'Sistemas de Equações do 1º Grau',
        shortDescription: 'Conjunto de equações lineares com duas incógnitas que devem ser satisfeitas simultaneamente.',
        deepDescription: 'Resolução algébrica pelos métodos da substituição e da adição, associando a solução ao ponto de interseção de duas retas concorrentes no plano cartesiano.',
        keyPoints: ['Método da substituição', 'Método da adição', 'Interpretação geométrica no plano cartesiano']
      }
    ],
    quiz: {
      question: 'Se a soma de dois números é 15 e a diferença entre eles é 3, quais são esses números?',
      options: [
        '10 e 5',
        '9 e 6',
        '8 e 7',
        '12 e 3'
      ],
      correctIndex: 1,
      explanation: 'Se x + y = 15 e x - y = 3, somando as equações temos 2x = 18 => x = 9. Logo, y = 15 - 9 = 6.'
    }
  },
  {
    slug: 'math-9-funcao-quadratica',
    title: 'Função Quadrática e a Parábola: y = ax² + bx + c',
    subjectCode: 'math',
    gradeLevel: 9,
    skillCodes: ['EF09MA06'],
    nodes: [
      {
        slug: 'node-funcao-quadratica-core',
        type: 'formula',
        title: 'A Função Polinomial do 2º Grau',
        shortDescription: 'Função da forma f(x) = ax² + bx + c, com a diferente de zero, cujo gráfico é uma curva parabólica.',
        deepDescription: 'Modela trajetórias balísticas, lucro máximo em economia e áreas geométricas. A concavidade depende do sinal de "a", e as raízes são dadas pela fórmula quadrática (Bhaskara).',
        keyPoints: ['Gráfico em forma de parábola', 'Vértice (Xv, Yv) define ponto de máximo ou mínimo', 'Discriminante Delta determina a quantidade de raízes reais']
      }
    ],
    quiz: {
      question: 'Para a função f(x) = -2x² + 4x + 6, o que podemos afirmar sobre sua concavidade e o vértice?',
      options: [
        'A concavidade é voltada para cima e o vértice é um ponto de mínimo.',
        'A concavidade é voltada para baixo (a < 0) e o vértice representa o valor máximo da função.',
        'O gráfico é uma linha reta oblíqua sem curvas.',
        'A função não possui raízes reais pois o coeficiente "a" é negativo.'
      ],
      correctIndex: 1,
      explanation: 'Como o coeficiente a = -2 é negativo, a parábola tem concavidade voltada para baixo, fazendo do vértice o ponto mais alto (ponto de máximo).'
    }
  },

  // -------------------------------------------------------------------------
  // LÍNGUA PORTUGUESA
  // -------------------------------------------------------------------------
  {
    slug: 'portuguese-67-noticia-fake-news',
    title: 'Gênero Notícia, Fact-Checking e Desinformação',
    subjectCode: 'portuguese',
    gradeLevel: 67,
    skillCodes: ['EF67LP01', 'EF67LP02'],
    nodes: [
      {
        slug: 'node-genero-noticia',
        type: 'concept',
        title: 'O Gênero Notícia e o Lide (Lead)',
        shortDescription: 'Texto informativo jornalístico sobre fatos atuais e de interesse público.',
        deepDescription: 'Estrutura-se a partir da pirâmide invertida: o primeiro parágrafo (lide) responde às perguntas fundamentais: Quem? O quê? Onde? Quando? Como? Por quê?',
        keyPoints: ['Objetividade e clareza textual', 'Estrutura de pirâmide invertida', 'Perguntas clássicas do lide jornalístico']
      },
      {
        slug: 'node-fact-checking-desinformacao',
        type: 'process',
        title: 'Checagem de Fatos e Combate à Desinformação',
        shortDescription: 'Metodologias de verificação de fontes, dados e procedência de conteúdos digitais.',
        deepDescription: 'As agências de checagem analisam boatos, títulos sensacionalistas (clickbait) e montagens descontextualizadas para assegurar o direito à informação verídica.',
        keyPoints: ['Verificação da autoria e da data original', 'Cruzamento de fontes primárias e veículos confiáveis', 'Identificação de títulos sensacionalistas']
      }
    ],
    resources: [
      {
        id: 'res-tabela-criterios-noticia',
        type: 'comparison_table',
        title: 'Critérios de Checagem: Notícia Confiável vs Boato Viral',
        storagePath: '/storage/assets/charts/fact-checking.json',
        mimeType: 'application/json',
        metadata: { indicators: ['Autor conhecido', 'Fontes identificadas', 'Tom emocional apelativo', 'Data do evento'] },
        linkToSlug: 'node-fact-checking-desinformacao',
        role: 'comparison'
      }
    ],
    quiz: {
      question: 'Qual das alternativas apresenta uma atitude correta de checagem de fatos ao receber uma notícia alarmante nas redes sociais?',
      options: [
        'Compartilhar imediatamente nos grupos de mensagens antes de qualquer confirmação.',
        'Verificar se o texto possui autor, data, fontes consultáveis e checar a informação em portais de notícias reconhecidos.',
        'Acreditar automaticamente se o texto estiver escrito em letras maiúsculas e com pontos de exclamação.',
        'Concluir que se a mensagem veio de um parente próximo, os dados são necessariamente verídicos.'
      ],
      correctIndex: 1,
      explanation: 'A checagem exige verificação de autoria, data e consulta a órgãos oficiais ou agências de jornalismo profissional.'
    }
  },
  {
    slug: 'portuguese-89-artigo-opiniao',
    title: 'Artigo de Opinião: Tese, Argumentação e Contra-argumento',
    subjectCode: 'portuguese',
    gradeLevel: 89,
    skillCodes: ['EF89LP03', 'EF89LP04'],
    nodes: [
      {
        slug: 'node-artigo-opiniao-estrutura',
        type: 'concept',
        title: 'A Estrutura do Artigo de Opinião',
        shortDescription: 'Gênero dissertativo-argumentativo assinado pelo autor que defende um ponto de vista sobre tema controverso.',
        deepDescription: 'Compreende a apresentação da tese, encadeamento de argumentos de autoridade, dados estatísticos, contra-argumentação para refutar objeções e conclusão propositiva.',
        keyPoints: ['Tese central explícita', 'Uso de conectivos argumentativos', 'Refutação de contra-argumentos']
      }
    ],
    quiz: {
      question: 'Qual é o objetivo principal de incluir uma contra-argumentação em um artigo de opinião?',
      options: [
        'Confundir o leitor fazendo-o esquecer a proposta original do autor.',
        'Reconhecer um ponto de vista contrário e refutá-lo com dados para fortalecer a própria tese.',
        'Copiar os argumentos de outros escritores sem atribuir créditos.',
        'Preencher espaço no texto quando não houver ideias suficientes.'
      ],
      correctIndex: 1,
      explanation: 'Ao antecipar e refutar objeções da posição contrária, o articulista demonstra domínio do debate e torna sua tese mais persuasiva.'
    }
  },

  // -------------------------------------------------------------------------
  // LÍNGUA INGLESA
  // -------------------------------------------------------------------------
  {
    slug: 'english-6-daily-routines',
    title: 'Daily Routines and the Simple Present',
    subjectCode: 'english',
    gradeLevel: 6,
    skillCodes: ['EF06LI01', 'EF06LI19'],
    nodes: [
      {
        slug: 'node-simple-present-routines',
        type: 'concept',
        title: 'Simple Present Tense and Daily Life',
        shortDescription: 'Uso do presente simples para descrever hábitos, rotinas e fatos cotidianos.',
        deepDescription: 'Emprego dos pronomes pessoais, verbos de ação frequentes (wake up, study, eat, sleep) e a terminação "-s / -es" na terceira pessoa do singular (he, she, it).',
        keyPoints: ['Rotinas com advérbios de frequência (always, usually, never)', 'Terceira pessoa do singular com flexão "-s"', 'Uso dos auxiliares "do" e "does"']
      }
    ],
    quiz: {
      question: 'Choose the correct sentence in the Simple Present according to standard grammar rules:',
      options: [
        'She wake up at seven o\'clock every morning.',
        'She wakes up at seven o\'clock every morning.',
        'She waking up at seven o\'clock every morning.',
        'She is wake up at seven o\'clock every morning.'
      ],
      correctIndex: 1,
      explanation: 'In the Simple Present, affirmative sentences with the 3rd person singular subject (he/she/it) require the verb ending "-s" or "-es" (wakes up).'
    }
  },
  {
    slug: 'english-7-past-events',
    title: 'Talking About Past Events: Simple Past and Biographies',
    subjectCode: 'english',
    gradeLevel: 7,
    skillCodes: ['EF07LI15', 'EF07LI16'],
    nodes: [
      {
        slug: 'node-simple-past-verbs',
        type: 'concept',
        title: 'Simple Past: Regular and Irregular Verbs',
        shortDescription: 'Estruturação de sentenças para relatar acontecimentos e biografias concluídas no passado.',
        deepDescription: 'Distingue a formação regular com desinência "-ed" (work -> worked) das formas irregulares que alteram o radical (go -> went, see -> saw, write -> wrote).',
        keyPoints: ['Verbos regulares com desinência "-ed"', 'Verbos irregulares e memorização contextualizada', 'Auxiliar did/didn\'t em interrogativas e negativas']
      }
    ],
    quiz: {
      question: 'Complete correctly: "Albert Einstein ______ (write) groundbreaking papers and ______ (discover) the photoelectric effect."',
      options: [
        'writed / discovered',
        'wrote / discovered',
        'written / discover',
        'writes / discovers'
      ],
      correctIndex: 1,
      explanation: '"Write" is an irregular verb with past tense "wrote"; "discover" is regular with past tense "discovered".'
    }
  },

  // -------------------------------------------------------------------------
  // ARTE
  // -------------------------------------------------------------------------
  {
    slug: 'arts-69-elementos-visuais',
    title: 'Elementos da Linguagem Visual e a Arte Brasileira',
    subjectCode: 'arts',
    gradeLevel: 69,
    skillCodes: ['EF69AR01', 'EF69AR04'],
    nodes: [
      {
        slug: 'node-elementos-linguagem-visual',
        type: 'concept',
        title: 'Os Elementos Fundamentais da Linguagem Visual',
        shortDescription: 'Componentes básicos que formam qualquer composição artística: ponto, linha, cor, forma e textura.',
        deepDescription: 'Investiga as propriedades cromáticas (matiz, saturação, brilho), contraste, planos de profundidade e o diálogo com obras de pintores brasileiros como Tarsila do Amaral e Candido Portinari.',
        keyPoints: ['Ponto e linha como elementos geradores', 'Teoria das cores (primárias, secundárias e complementares)', 'Textura visual versus tátil']
      }
    ],
    quiz: {
      question: 'Quais cores formam o conjunto clássico de cores primárias pigmentares?',
      options: [
        'Verde, laranja e roxo.',
        'Vermelho, amarelo e azul.',
        'Branco, preto e cinza.',
        'Marrom, rosa e dourado.'
      ],
      correctIndex: 1,
      explanation: 'As cores primárias puras tradicionais são vermelho, amarelo e azul, pois não podem ser obtidas pela mistura de outras cores.'
    }
  },

  // -------------------------------------------------------------------------
  // EDUCAÇÃO FÍSICA
  // -------------------------------------------------------------------------
  {
    slug: 'physical_education-67-esportes-invasao',
    title: 'Esportes de Invasão, Táticas Coletivas e Fair Play',
    subjectCode: 'physical_education',
    gradeLevel: 67,
    skillCodes: ['EF67EF03', 'EF67EF04'],
    nodes: [
      {
        slug: 'node-esportes-invasao-tatica',
        type: 'concept',
        title: 'Lógica Interna dos Esportes de Invasão',
        shortDescription: 'Modalidades em que uma equipe deve ocupar o campo adversário para marcar pontos protegendo sua meta.',
        deepDescription: 'Exemplos como basquetebol, futsal e handebol, onde a dinâmica exige transição rápida entre ataque e defesa, comunicação coletiva e respeito às regras (fair play).',
        keyPoints: ['Ocupação de espaço e passe em progressão', 'Sistemas táticos defensivos e ofensivos', 'Fair play e respeito às diferenças de habilidade']
      }
    ],
    quiz: {
      question: 'Qual é o objetivo tático central comum a todas as modalidades de esportes de invasão?',
      options: [
        'Evitar que a bola toque no solo de seu próprio campo rebatendo-a sobre uma rede divisória.',
        'Avançar com a posse de bola sobre o campo adversário e introduzi-la na meta rival defendendo a própria meta.',
        'Derrubar o oponente sobre o tatame por meio de pegadas e alavancas corporais.',
        'Percorrer uma distância determinada no menor tempo individual possível sem interação de equipe.'
      ],
      correctIndex: 1,
      explanation: 'Esportes de invasão (como futebol, handebol, basquete) exigem invadir o território rival para atingir o alvo (gol, cesta).'
    }
  },

  // -------------------------------------------------------------------------
  // ENSINO RELIGIOSO (não confessional e facultativo)
  // -------------------------------------------------------------------------
  {
    slug: 'religious_education-6-tradicao-oral-escrita',
    title: 'Tradição Oral, Textos Sagrados e Diversidade Cultural',
    subjectCode: 'religious_education',
    gradeLevel: 6,
    skillCodes: ['EF06ER01', 'EF06ER02'],
    nodes: [
      {
        slug: 'node-tradicao-oral-sagrado',
        type: 'concept',
        title: 'A Oralidade e os Textos Sagrados nas Culturas',
        shortDescription: 'Memória ancestral, narrativas míticas e livros sagrados como patrimônio cultural imaterial da humanidade.',
        deepDescription: 'Sob perspectiva laica, pedagógica e não confessional, examina como povos indígenas, africanos e orientais preservaram saberes e valores comunitários por meio de cantos, contos e registros escritos.',
        keyPoints: ['Abordagem não confessional e laica', 'Tradição oral como veículo de sabedoria e ética', 'Respeito irrestrito à liberdade de crença e não crença']
      }
    ],
    quiz: {
      question: 'Segundo as diretrizes da BNCC para o Ensino Religioso nas escolas públicas, qual é o princípio que deve orientar as aulas?',
      options: [
        'A doutrinação dos alunos em uma fé religiosa específica escolhida pela direção da escola.',
        'O caráter não confessional, laico e de valorização da diversidade cultural e dos direitos humanos.',
        'A obrigação de todos os estudantes realizarem orações e ritos religiosos em sala.',
        'A proibição do estudo histórico de qualquer tradição espiritual do passado.'
      ],
      correctIndex: 1,
      explanation: 'A BNCC estabelece que o Ensino Religioso em escolas públicas é não confessional, focado no conhecimento histórico-cultural e no respeito à diversidade.'
    }
  },
  // -------------------------------------------------------------------------
  // INGLÊS — 8º E 9º ANOS
  // -------------------------------------------------------------------------
  {
    slug: 'english-8-future-plans-predictions',
    title: 'Future Plans, Intentions and Predictions: Will vs. Going to',
    subjectCode: 'english',
    gradeLevel: 8,
    skillCodes: ['EF08LI05', 'EF08LI12'],
    nodes: [
      {
        slug: 'node-eng-8-future-will',
        type: 'concept',
        title: 'Future Simple with Will (Predictions and Spontaneous Decisions)',
        shortDescription: 'Estrutura verbal utilizada para previsões futuras baseadas em opinião e decisões tomadas no momento da fala.',
        deepDescription: 'O auxiliar modal "will" é empregado para expressar previsões sobre o futuro ("I think it will rain tomorrow"), promessas ("I will help you") e decisões espontâneas imediatas, sem planejamento prévio.',
        keyPoints: [
          'Previsões baseadas em crença ou opinião pessoal',
          'Decisões espontâneas tomadas no instante do diálogo',
          'Forma negativa: will not ou contracted won\'t'
        ],
        example: 'Scientists believe artificial intelligence will transform healthcare in the next decade.'
      },
      {
        slug: 'node-eng-8-future-going-to',
        type: 'concept',
        title: 'Future with Going to (Prior Plans and Present Evidence)',
        shortDescription: 'Estrutura utilizada para planos já estabelecidos e previsões com evidência presente observável.',
        deepDescription: 'A estrutura "be going to + verbo base" indica planos premeditados e intenções firmadas antes do momento da conversa ("We are going to visit the museum next Friday"), além de previsões com indícios claros no presente ("Look at those dark clouds, it is going to rain").',
        keyPoints: [
          'Planos e intenções premeditados com antecedência',
          'Previsões fundamentadas em evidências visíveis no presente',
          'Conjugação obrigatória do verbo to be (am/is/are) + going to'
        ],
        example: 'Look at the schedule: our class is going to present the science project on Thursday.'
      },
      {
        slug: 'node-eng-8-time-markers',
        type: 'concept',
        title: 'Future Time Expressions and Lexical Markers',
        shortDescription: 'Expressões temporais que contextualizam e situam a ação futura no discurso.',
        deepDescription: 'Marcadores temporais como "next week", "tomorrow", "in the near future", "soon" e "by next year" organizam a progressão temática e fornecem referências temporais essenciais para a coesão discursiva.',
        keyPoints: [
          'Localização temporal precisa de planos e previsões',
          'Coesão e articulação em textos orais e escritos em língua inglesa',
          'Diferenciação temporal em relação ao Simple Past e Simple Present'
        ],
        example: 'In the near future, renewable energy sources will power most of our public transportation.'
      }
    ],
    relations: [
      { fromSlug: 'node-eng-8-future-going-to', type: 'contrasts_with', toSlug: 'node-eng-8-future-will' },
      { fromSlug: 'node-eng-8-time-markers', type: 'related_to', toSlug: 'node-eng-8-future-will' }
    ],
    resources: [
      {
        id: 'res-eng-8-future-chart',
        type: 'comparison_table',
        title: 'Comparative Chart: Will versus Be Going To',
        storagePath: '/storage/assets/charts/english-future-will-vs-going-to.svg',
        mimeType: 'image/svg+xml',
        metadata: { columns: ['Structure', 'Main Use', 'Key Example'], rows: 2 },
        linkToSlug: 'node-eng-8-future-will',
        role: 'comparison'
      }
    ],
    quiz: {
      question: 'Which sentence correctly demonstrates the use of "be going to" based on a prior plan or present evidence?',
      options: [
        'I think humans will live on Mars someday.',
        'We are going to travel to Salvador next month; the tickets are already bought.',
        'Wait! I will answer the phone for you right now.',
        'Perhaps the teacher will arrive late tomorrow morning.'
      ],
      correctIndex: 1,
      explanation: 'The sentence "We are going to travel to Salvador next month; the tickets are already bought" expresses a premeditated plan with concrete prior arrangement, requiring "be going to".'
    }
  },
  {
    slug: 'english-9-global-issues-conditionals',
    title: 'Global Challenges and Conditionals: If Clauses in Debate',
    subjectCode: 'english',
    gradeLevel: 9,
    skillCodes: ['EF09LI01', 'EF09LI14'],
    nodes: [
      {
        slug: 'node-eng-9-first-conditional',
        type: 'concept',
        title: 'First Conditional: Real Possibilities and Consequences',
        shortDescription: 'Estrutura condicional para causas prováveis e consequências reais no presente ou futuro.',
        deepDescription: 'Formada pela oração condicional com "if + simple present" e a oração principal com "will + verbo", expressa causas com alta probabilidade de ocorrência e seus desdobramentos lógicos ("If we reduce carbon emissions, we will protect coastal ecosystems").',
        keyPoints: [
          'If + Simple Present na oração condicional',
          'Will + Verbo base na oração principal consequente',
          'Uso para causas reais, avisos, acordos e metas ambientais'
        ],
        example: 'If cities invest in bicycle lanes, traffic pollution will decrease significantly.'
      },
      {
        slug: 'node-eng-9-second-conditional',
        type: 'concept',
        title: 'Second Conditional: Hypothetical Scenarios and Solutions',
        shortDescription: 'Estrutura condicional para hipóteses improváveis ou situações imaginárias no presente.',
        deepDescription: 'Formada por "if + simple past" e "would + verbo", permite formular hipóteses reflexivas, debates sobre utopias sociais e soluções alternativas para desafios globais ("If every community had clean water, preventable diseases would decline").',
        keyPoints: [
          'If + Simple Past para situações hipotéticas no presente',
          'Would + Verbo base para o resultado imaginado',
          'Emprego frequente em debates reflexivos e discursos éticos'
        ],
        example: 'If I were a community leader, I would prioritize affordable education and green public spaces.'
      },
      {
        slug: 'node-eng-9-connectors-argumentation',
        type: 'concept',
        title: 'Connectors of Condition, Contrast and Addition in Arguments',
        shortDescription: 'Conectivos textuais (unless, however, furthermore) que estruturam argumentos complexos em debates.',
        deepDescription: 'Conectivos lógicos estruturam o posicionamento crítico do estudante, permitindo refutar contra-argumentos e introduzir ressalvas condicionais com rigor semântico.',
        keyPoints: [
          'Unless com valor semântico de "a menos que / se não"',
          'Conectores de contraste e adição em debates internacionais',
          'Desenvolvimento da competência argumentativa em língua inglesa'
        ],
        example: 'Global temperatures will keep rising unless nations implement strict environmental policies.'
      }
    ],
    relations: [
      { fromSlug: 'node-eng-9-first-conditional', type: 'contrasts_with', toSlug: 'node-eng-9-second-conditional' },
      { fromSlug: 'node-eng-9-connectors-argumentation', type: 'related_to', toSlug: 'node-eng-9-first-conditional' }
    ],
    resources: [
      {
        id: 'res-eng-9-conditionals-map',
        type: 'diagram',
        title: 'Decision Flowchart: Conditionals in Debate (First vs. Second)',
        storagePath: '/storage/assets/diagrams/english-conditionals-flowchart.svg',
        mimeType: 'image/svg+xml',
        metadata: { branches: ['Real Possibility -> 1st', 'Hypothetical -> 2nd'] },
        linkToSlug: 'node-eng-9-first-conditional',
        role: 'illustration'
      }
    ],
    quiz: {
      question: 'Which of the following sentences correctly uses the First Conditional to express a real cause-and-effect relationship?',
      options: [
        'If governments protected biodiversity, forests would survive automatically.',
        'If we conserve potable water, our community will face fewer shortages in dry seasons.',
        'If I had more time yesterday, I will study climate change.',
        'Unless you did not recycle, nature will recover on its own.'
      ],
      correctIndex: 1,
      explanation: 'The sentence "If we conserve potable water, our community will face fewer shortages in dry seasons" follows the exact First Conditional structure (If + present, will + base verb) indicating a realistic consequence.'
    }
  },
  // -------------------------------------------------------------------------
  // EDUCAÇÃO FÍSICA — FAIXA 8º E 9º ANOS
  // -------------------------------------------------------------------------
  {
    slug: 'physical_education-89-lutas-mundo-aventura',
    title: 'Lutas do Mundo e Práticas Corporais de Aventura na Natureza',
    subjectCode: 'physical_education',
    gradeLevel: 89,
    skillCodes: ['EF89EF14', 'EF89EF16', 'EF89EF19'],
    nodes: [
      {
        slug: 'node-ef-89-lutas-filosofia',
        type: 'concept',
        title: 'Lutas do Mundo: Filosofia, Tradição e Ética Marcial',
        shortDescription: 'Estudo das lutas tradicionais (Judô, Capoeira, Taekwondo, Aikidô) diferenciando-as de brigas e violência.',
        deepDescription: 'As lutas do mundo caracterizam-se por sistemas codificados de movimentos, respeito rigoroso à integridade física do adversário e fundamentação filosófica em valores de autocontrole, cortesia e superação pessoal, repudiando qualquer apologia à agressão gratuita.',
        keyPoints: [
          'Diferença estrutural entre luta regulamentada e violência interpessoal',
          'Rituais de saudação, códigos de honra e respeito mútuo',
          'Origens culturais e matrizes históricas (oriental, afro-brasileira, indígena)'
        ],
        example: 'O cumprimento inicial no Judô (Rei) formaliza o compromisso ético de ambos os praticantes em preservar a segurança recíproca.'
      },
      {
        slug: 'node-ef-89-aventura-natureza',
        type: 'concept',
        title: 'Práticas Corporais de Aventura na Natureza: Orientação e Trekking',
        shortDescription: 'Atividades físicas realizadas em ambiente natural desafiador com superação de obstáculos geográficos.',
        deepDescription: 'As práticas de aventura na natureza envolvem caminhadas ecológicas orientadas (trekking), corrida de orientação com bússola e mapa topográfico, escalada esportiva e canoagem, exigindo coordenação motora, trabalho em equipe e tomada de decisões sob incerteza ambiental.',
        keyPoints: [
          'Interação respeitosa com relevo, vegetação e hidrografia',
          'Uso instrumental de bússola, mapas e leitura de trilhas',
          'Trabalho cooperativo e superação de limites psicofísicos'
        ],
        example: 'Em uma prova de orientação, a equipe calcula a rota mais eficiente pela vegetação usando azimute na bússola e curvas de nível na carta topográfica.'
      },
      {
        slug: 'node-ef-89-gestao-risco-meio-ambiente',
        type: 'concept',
        title: 'Gestão de Risco, Segurança e Sustentabilidade Ambiental',
        shortDescription: 'Protocolos de minimização de acidentes e conservação dos ecossistemas nas práticas corporais.',
        deepDescription: 'A segurança nas atividades de aventura depende do uso correto de Equipamentos de Proteção Individual (EPI), planejamento prévio das condições meteorológicas e adoção da conduta de mínimo impacto ambiental ("não tire nada além de fotos, não deixe nada além de pegadas").',
        keyPoints: [
          'Equipamentos obrigatórios de segurança e checagem preventiva',
          'Princípio de mínimo impacto ambiental e preservação de trilhas',
          'Responsabilidade compartilhada e prevenção de acidentes'
        ],
        example: 'Verificação em dupla dos nós e mosquetões antes de qualquer atividade de descida ou travessia vertical.'
      }
    ],
    relations: [
      { fromSlug: 'node-ef-89-gestao-risco-meio-ambiente', type: 'requires', toSlug: 'node-ef-89-aventura-natureza' },
      { fromSlug: 'node-ef-89-lutas-filosofia', type: 'related_to', toSlug: 'node-ef-89-gestao-risco-meio-ambiente' }
    ],
    resources: [
      {
        id: 'res-ef-89-orientacao-diagram',
        type: 'diagram',
        title: 'Esquema de Leitura de Bússola e Azimute em Trilha Natural',
        storagePath: '/storage/assets/diagrams/ef-bussola-azimute-orientacao.svg',
        mimeType: 'image/svg+xml',
        metadata: { elements: ['Agulha Magnética', 'Limbo Graduado', 'Linha de Fé', 'Curvas de Nível'] },
        linkToSlug: 'node-ef-89-aventura-natureza',
        role: 'illustration'
      }
    ],
    quiz: {
      question: 'Qual é a diferença fundamental entre as lutas regulamentadas estudadas na Educação Física e situações de briga ou violência urbana?',
      options: [
        'Nas lutas há o objetivo de ferir o adversário para demonstrar superioridade física incontestável.',
        'As lutas possuem regras acordadas, código ético, rituais de respeito mútuo e preservação da integridade física dos participantes.',
        'Não há diferença técnica, pois ambas envolvem confronto corporal sem qualquer restrição de golpes.',
        'As brigas de rua seguem árbitros neutros que supervisionam o respeito às regras esportivas.'
      ],
      correctIndex: 1,
      explanation: 'As lutas constituem manifestações culturais codificadas com regras explícitas, valores éticos de autocontrole e compromisso inegociável com a segurança e o respeito recíproco entre os praticantes.'
    }
  },
  // -------------------------------------------------------------------------
  // LÍNGUA PORTUGUESA — 6º, 7º, 8º, 9º ANOS E FAIXA 69
  // -------------------------------------------------------------------------
  {
    slug: 'portuguese-6-narrativa-ficcional-enredo',
    title: 'Narrativa Ficcional: Estrutura do Enredo, Personagens e Tempo',
    subjectCode: 'portuguese',
    gradeLevel: 6,
    skillCodes: ['EF06LP05', 'EF06LP06'],
    nodes: [
      {
        slug: 'node-pt-6-enredo-conflito',
        type: 'concept',
        title: 'Estrutura do Enredo: Situação Inicial, Conflito, Clímax e Desfecho',
        shortDescription: 'Organização sequencial dos acontecimentos que compõem a trama narrativa na ficção literária.',
        deepDescription: 'Toda narrativa ficcional articula uma situação de equilíbrio inicial rompida por um elemento complicador (conflito gerador). A sucessão de peripécias intensifica a tensão até o clímax (ponto máximo de tensão), que se resolve no desfecho.',
        keyPoints: [
          'Situação inicial e apresentação do cenário/personagens',
          'Conflito gerador como força motriz da transformação da história',
          'Clímax como ponto culminante e desfecho como resolução dramática'
        ],
        example: 'No conto de mistério, a descoberta da carta secreta rompe a rotina do vilarejo e desencadeia a busca pelo remetente.'
      },
      {
        slug: 'node-pt-6-caracterizacao-personagens',
        type: 'concept',
        title: 'Caracterização de Personagens e Marcadores de Tempo e Espaço',
        shortDescription: 'Recursos linguísticos e estilísticos que constroem a identidade das personagens e o cenário.',
        deepDescription: 'A caracterização direta (por adjetivos e descrições do narrador) e indireta (por meio das ações, falas e pensamentos das personagens) constrói a verossimilhança interna da obra, ancorada em marcadores temporais e espaciais.',
        keyPoints: [
          'Caracterização física, psicológica e social de protagonistas e antagonistas',
          'Tempo cronológico (relógio/calendário) versus tempo psicológico (memória/fluxo)',
          'Espaço narrativo como componente ativo do clima e do sentido da obra'
        ],
        example: 'A descrição da mansão decadente com portas emperradas antecipa o clima de isolamento e suspense do protagonista.'
      },
      {
        slug: 'node-pt-6-foco-narrativo',
        type: 'concept',
        title: 'Foco Narrativo: Narrador Personagem versus Narrador Observador',
        shortDescription: 'Perspectiva pela qual a história é relatada ao leitor, determinando o grau de subjetividade.',
        deepDescription: 'O narrador em 1ª pessoa (personagem) vivencia os fatos e oferece uma visão parcial e íntima; o narrador em 3ª pessoa (onisciente ou observador) situa-se fora da ação direta, dominando ampla visão dos eventos e pensamentos.',
        keyPoints: [
          '1ª pessoa: narrativa testemunhal ou protagonista, com subjetividade explícita',
          '3ª pessoa: distanciamento épico e amplitude panorâmica',
          'Efeitos de sentido gerados pela escolha do ponto de vista'
        ],
        example: 'Um diário de bordo narrado em 1ª pessoa transmite a angústia imediata do marinheiro diante da tempestade.'
      }
    ],
    relations: [
      { fromSlug: 'node-pt-6-caracterizacao-personagens', type: 'part_of', toSlug: 'node-pt-6-enredo-conflito' },
      { fromSlug: 'node-pt-6-foco-narrativo', type: 'related_to', toSlug: 'node-pt-6-enredo-conflito' }
    ],
    resources: [
      {
        id: 'res-pt-6-enredo-piramide',
        type: 'diagram',
        title: 'Pirâmide da Estrutura Narrativa (Freytag): Conflito, Clímax e Desfecho',
        storagePath: '/storage/assets/diagrams/portugues-estrutura-enredo-freytag.svg',
        mimeType: 'image/svg+xml',
        metadata: { stages: ['Exposição', 'Ação Ascendente', 'Clímax', 'Ação Descendente', 'Desfecho'] },
        linkToSlug: 'node-pt-6-enredo-conflito',
        role: 'illustration'
      }
    ],
    quiz: {
      question: 'Em uma narrativa ficcional, como se define o "clímax" do enredo?',
      options: [
        'É o primeiro parágrafo da história no qual se descreve a data e o clima do local.',
        'É o ponto de máxima tensão dramática, em que o conflito atinge seu ápice antes da resolução.',
        'É a lista de adjetivos utilizada para descrever as roupas do antagonista.',
        'É a moral da história explicada em versos após o término da aventura.'
      ],
      correctIndex: 1,
      explanation: 'O clímax é o ápice do arco narrativo, no qual a tensão provocada pelo conflito gerador atinge sua intensidade máxima, encaminhando a trama imediatamente para o desfecho.'
    }
  },
  {
    slug: 'portuguese-7-texto-dramatico-teatro',
    title: 'O Texto Dramático: Rubricas, Diálogos e Encenação Teatral',
    subjectCode: 'portuguese',
    gradeLevel: 7,
    skillCodes: ['EF07LP05', 'EF07LP12'],
    nodes: [
      {
        slug: 'node-pt-7-estrutura-texto-dramatico',
        type: 'concept',
        title: 'A Estrutura Textual do Drama: Diálogos e Rubricas Cênicas',
        shortDescription: 'Gênero literário concebido primordialmente para ser encenado no palco teatral.',
        deepDescription: 'Diferente da narrativa tradicional, o texto dramático não conta com a figura convencional do narrador; a história avança pelas falas das personagens e pelas rubricas (indicações cênicas em itálico/parênteses sobre gestos, iluminação, tom de voz e movimentação).',
        keyPoints: [
          'Ausência de narrador mediador clássico; predomínio da fala direta',
          'Função das rubricas cênicas na orientação de atores e diretores',
          'Divisão tradicional em atos (grandes blocos temporais) e cenas (entradas e saídas)'
        ],
        example: 'MÁRIO (em sussurro desesperado, olhando em direção à janela): "Eles já estão no portão!"'
      },
      {
        slug: 'node-pt-7-conflito-acao-dramatica',
        type: 'concept',
        title: 'Conflito Dramático e Diálogo como Força de Ação',
        shortDescription: 'A tensão entre vontades opostas que impulsiona o ritmo da peça teatral.',
        deepDescription: 'No teatro, falar é agir. O diálogo dramático não é mera conversa cotidiana, mas embate de objetivos, defesa de posições morais e confrontação de desejos conflitantes entre os protagonistas.',
        keyPoints: [
          'O diálogo dramático como propulsor de acontecimentos e escolhas',
          'Subtexto: o que está implícito nas entrelinhas das falas',
          'Comédia, tragédia e auto popular como manifestações do drama'
        ],
        example: 'No Auto da Compadecida de Ariano Suassuna, os diálogos de João Grilo articulam a esperteza popular contra os abusos dos poderosos.'
      },
      {
        slug: 'node-pt-7-teatro-sociedade',
        type: 'concept',
        title: 'O Teatro como Espelho Social e Instrumento Crítico',
        shortDescription: 'Relação entre a produção teatral e os debates éticos e sociopolíticos de seu tempo.',
        deepDescription: 'Desde as tragédias clássicas até as montagens contemporâneas brasileiras, o teatro funciona como arena pública de debate sobre cidadania, desigualdade e dilemas humanos fundamentais.',
        keyPoints: [
          'Reflexão crítica sobre costumes, hierarquias e injustiças sociais',
          'Catarse e empatia na experiência do público espectador',
          'Patrimônio do teatro brasileiro (Martins Pena, Nelson Rodrigues, Suassuna)'
        ],
        example: 'As comédias de costumes de Martins Pena satirizavam a burocracia e a falsidade moral da sociedade imperial no Rio de Janeiro.'
      }
    ],
    relations: [
      { fromSlug: 'node-pt-7-conflito-acao-dramatica', type: 'part_of', toSlug: 'node-pt-7-estrutura-texto-dramatico' },
      { fromSlug: 'node-pt-7-teatro-sociedade', type: 'related_to', toSlug: 'node-pt-7-estrutura-texto-dramatico' }
    ],
    resources: [
      {
        id: 'res-pt-7-rubrica-exemplo',
        type: 'comparison_table',
        title: 'Elementos do Texto Dramático: Fala da Personagem versus Rubrica Cênica',
        storagePath: '/storage/assets/tables/portugues-rubrica-dialogo-teatro.svg',
        mimeType: 'image/svg+xml',
        metadata: { elementA: 'Falas dos Atores', elementB: 'Rubricas de Direção' },
        linkToSlug: 'node-pt-7-estrutura-texto-dramatico',
        role: 'comparison'
      }
    ],
    quiz: {
      question: 'Qual é a função primordial das "rubricas" em um texto dramático teatral?',
      options: [
        'Apresentar ao final do livro a biografia completa do escritor e o preço da edição.',
        'Orientar os atores e a equipe técnica sobre movimentação, gestos, tom de voz e cenário.',
        'Substituir a fala dos personagens principais quando estes esquecem o texto.',
        'Impor rimas obrigatórias no final de todas as frases pronunciadas pelos figurantes.'
      ],
      correctIndex: 1,
      explanation: 'As rubricas (ou didascálias) contêm as instruções cênicas do dramaturgo destinadas à encenação, detalhando estados emocionais, deslocamentos no palco, entonação e indicações de luz e som.'
    }
  },
  {
    slug: 'portuguese-8-reportagem-investigativa-etica',
    title: 'Reportagem Investigativa: Apuração, Vozes Sociais e Ética Jornalística',
    subjectCode: 'portuguese',
    gradeLevel: 8,
    skillCodes: ['EF08LP01', 'EF08LP02'],
    nodes: [
      {
        slug: 'node-pt-8-reportagem-estrutura',
        type: 'concept',
        title: 'Gênero Reportagem: Aprofundamento, Contextualização e Multimodalidade',
        shortDescription: 'Gênero jornalístico amplo que vai além do fato imediato da notícia para investigar causas e impactos.',
        deepDescription: 'Diferente da notícia diária que foca no "o quê" imediato, a reportagem investiga o "porquê" e o "e agora?", combinando entrevistas em profundidade, pesquisa histórica, estatísticas oficiais e recursos infográficos multimodais.',
        keyPoints: [
          'Diferença entre notícia (factual breve) e reportagem (aprofundamento investigativo)',
          'Estrutura em blocos temáticos, depoimentos e infografia de apoio',
          'Voz autoral presente na tessitura analítica e no recorte interpretativo'
        ],
        example: 'Uma reportagem sobre a crise hídrica visita reservatórios, analisa dados meteorológicos históricos e entrevista ribeirinhos e engenheiros.'
      },
      {
        slug: 'node-pt-8-pluralidade-fontes',
        type: 'concept',
        title: 'Pluralidade de Fontes e Escuta dos Atores Sociais',
        shortDescription: 'Critério jornalístico de ouvir diferentes lados de uma questão para evitar parcialidade unilateral.',
        deepDescription: 'A reportagem de qualidade assegura equilíbrio ao consultar fontes oficiais (governo, especialistas), fontes comunitárias (população diretamente afetada) e contraditório, garantindo pluralidade democrática de perspectivas.',
        keyPoints: [
          'Confronto equilibrado entre discursos institucionais e realidade comunitária',
          'Identificação de interesses econômicos e políticos por trás das falas',
          'Direito de resposta e transparência quanto às fontes consultadas'
        ],
        example: 'Ao noticiar uma nova obra pública, a matéria consulta tanto o órgão responsável pelos prazos quanto moradores vizinhos ao traçado.'
      },
      {
        slug: 'node-pt-8-etica-checagem-dados',
        type: 'concept',
        title: 'Ética Jornalística, Verificação e Responsabilidade Social',
        shortDescription: 'Procedimentos de checagem cruzada de informações antes da publicação para evitar danos à verdade.',
        deepDescription: 'O código de ética profissional exige que informações divulgadas tenham sua autenticidade checada em documentos comprobatórios e bases de dados públicas confiáveis, combatendo rumores, sensacionalismo e difamação.',
        keyPoints: [
          'Checagem cruzada de documentos primários e dados abertos oficiais',
          'Repúdio ao sensacionalismo e respeito à dignidade humana',
          'Responsabilidade civil e ética pelo impacto público do conteúdo'
        ],
        example: 'A confirmação de números de desmatamento através da comparação entre imagens de satélite do INPE e relatórios de campo do Ibama.'
      }
    ],
    relations: [
      { fromSlug: 'node-pt-8-pluralidade-fontes', type: 'part_of', toSlug: 'node-pt-8-reportagem-estrutura' },
      { fromSlug: 'node-pt-8-etica-checagem-dados', type: 'requires', toSlug: 'node-pt-8-pluralidade-fontes' }
    ],
    resources: [
      {
        id: 'res-pt-8-infografico-estrutura',
        type: 'diagram',
        title: 'Estrutura Canônica de uma Grande Reportagem Multimodal',
        storagePath: '/storage/assets/diagrams/portugues-estrutura-reportagem-multimodal.svg',
        mimeType: 'image/svg+xml',
        metadata: { sections: ['Título e Gancho', 'Contextualização Histórica', 'Vozes Sociais', 'Infográfico de Dados', 'Desdobramentos Futuros'] },
        linkToSlug: 'node-pt-8-reportagem-estrutura',
        role: 'illustration'
      }
    ],
    quiz: {
      question: 'Qual é o critério ético essencial que diferencia a reportagem jornalística responsável de um boato sensacionalista de internet?',
      options: [
        'A reportagem usa adjetivos exagerados no título para atrair visualizações instantâneas a qualquer custo.',
        'A reportagem fundamenta-se na apuração criteriosa de dados primários, checagem cruzada e escuta plural de diferentes atores envolvidos.',
        'A reportagem publica exclusivamente opiniões anônimas colhidas em redes sociais sem conferência de identidade.',
        'A reportagem evita consultar documentos oficiais para não tornar a leitura formal.'
      ],
      correctIndex: 1,
      explanation: 'O jornalismo profissional baseia-se na metodologia da apuração rigorosa: verificação cruzada de evidências documentais e escuta equilibrada e plural das partes afetadas pelo fato investigado.'
    }
  },
  {
    slug: 'portuguese-9-cronica-argumentacao-estilo',
    title: 'A Crônica Literária e o Editorial: Argumentação, Ironia e Cotidiano',
    subjectCode: 'portuguese',
    gradeLevel: 9,
    skillCodes: ['EF09LP01', 'EF09LP03'],
    nodes: [
      {
        slug: 'node-pt-9-cronica-cotidiano',
        type: 'concept',
        title: 'A Crônica: Olhar Sensível sobre o Cotidiano e Hibridismo Literário',
        shortDescription: 'Gênero que transita entre o jornalismo e a literatura, transformando cenas rotineiras em reflexão poética.',
        deepDescription: 'A crônica brasileira (Rubem Braga, Clarice Lispector, Machado de Assis) nasce no espaço do jornal diário com linguagem leve e intimista, utilizando pequenos episódios da vida urbana para suscitar reflexões profundas sobre a condição humana.',
        keyPoints: [
          'Hibridismo entre efemeridade jornalística e permanência literária',
          'Linguagem coloquial refinada e proximidade afetiva com o leitor',
          'Crônica narrativa, dissertativa, humorística e lírica'
        ],
        example: 'Uma conversa casual ouvida no banco de uma praça pública torna-se o ponto de partida para refletir sobre a solidão nas grandes cidades.'
      },
      {
        slug: 'node-pt-9-ironia-figuras-estilo',
        type: 'concept',
        title: 'Ironia, Humor e Figuras de Linguagem na Construção de Sentido',
        shortDescription: 'Estratégias semânticas em que o autor diz o oposto do que pensa para provocar efeito crítico ou cômico.',
        deepDescription: 'A ironia exige maturidade de leitura: o leitor precisa apreender as pistas contextuais e o tom discursivo para decodificar o sentido não literal pretendido pelo autor, desmascarando hipocrisias sociais sem panfletarismo óbvio.',
        keyPoints: [
          'Decodificação de pistas contextuais e modulações de tom',
          'Diferença entre deboche agressivo e ironia reflexiva elegante',
          'Metáforas, hipérboles e antíteses como enriquecedores estilísticos'
        ],
        example: '"Ele era tão dedicado à pontualidade que chegou exatamente duas horas após o início da cerimônia."'
      },
      {
        slug: 'node-pt-9-editorial-posicionamento',
        type: 'concept',
        title: 'O Editorial Jornalístico: Tese Institucional e Argumentação Formal',
        shortDescription: 'Texto dissertativo-argumentativo que expressa a posição política e ética oficial de um veículo de comunicação.',
        deepDescription: 'Diferente dos artigos assinados por colunistas individuais, o editorial expressa a voz coletiva do jornal ou portal. Utiliza a norma-padrão rigorosa, encadeamento lógico de argumentos e dados empíricos para persuadir a opinião pública sobre temas de interesse nacional.',
        keyPoints: [
          'Voz institucional impessoal sem assinatura de um único jornalista',
          'Defesa explícita de uma tese central fundamentada em premissas lógicas',
          'Uso de operadores argumentativos de causa, concessão e conclusão'
        ],
        example: 'O editorial defende a urgência de aprovação de verbas emergenciais para a merenda escolar fundamentando-se em índices nutricionais do IBGE.'
      }
    ],
    relations: [
      { fromSlug: 'node-pt-9-ironia-figuras-estilo', type: 'part_of', toSlug: 'node-pt-9-cronica-cotidiano' },
      { fromSlug: 'node-pt-9-editorial-posicionamento', type: 'contrasts_with', toSlug: 'node-pt-9-cronica-cotidiano' }
    ],
    resources: [
      {
        id: 'res-pt-9-cronica-vs-editorial',
        type: 'comparison_table',
        title: 'Matriz Comparativa: A Subjetividade da Crônica versus a Institucionalidade do Editorial',
        storagePath: '/storage/assets/tables/portugues-cronica-vs-editorial-comparativo.svg',
        mimeType: 'image/svg+xml',
        metadata: { crônica: 'Autoral, poética, cena cotidiana', editorial: 'Institucional, formal, debate público' },
        linkToSlug: 'node-pt-9-cronica-cotidiano',
        role: 'comparison'
      }
    ],
    quiz: {
      question: 'O que diferencia fundamentalmente um Editorial jornalístico de uma Crônica literária de jornal?',
      options: [
        'O editorial é um poema rimado sobre animais, enquanto a crônica é um formulário fiscal oficial.',
        'O editorial expressa a posição institucional formal do jornal sobre um tema público, enquanto a crônica reflete sobre cenas cotidianas com sensibilidade literária e olhar autoral.',
        'A crônica não tem autor e expressa a opinião de toda a diretoria de um banco privado.',
        'Não há diferença alguma de estilo, objetivo ou linguagem entre os dois gêneros.'
      ],
      correctIndex: 1,
      explanation: 'O editorial assume a voz corporativa do jornal sobre fatos cívicos e políticos de relevância pública, enquanto a crônica explora cenas miúdas do cotidiano com liberdade artística e estilo pessoal.'
    }
  },
  {
    slug: 'portuguese-69-hipertexto-cultura-digital',
    title: 'Cultura Digital, Multissemiose e Curadoria Crítica de Conteúdo',
    subjectCode: 'portuguese',
    gradeLevel: 69,
    skillCodes: ['EF69LP06', 'EF69LP07'],
    nodes: [
      {
        slug: 'node-pt-69-multissemiose',
        type: 'concept',
        title: 'Textos Multissemióticos: Integração de Linguagem Verbal, Visual e Sonora',
        shortDescription: 'Composições textuais que articulam palavras escritas, imagens estáticas ou em movimento, ícones e áudio.',
        deepDescription: 'Na cultura contemporânea digital, os textos não são exclusivamente alfabéticos; memes, videominutos, podcasts e postagens de redes sociais combinam semioses complementares, exigindo competência leitora para decodificar como cada linguagem contribui para o sentido global.',
        keyPoints: [
          'Convergência entre linguagem verbal, visual (enquadramento/cor) e sonora',
          'Leitura sintética e integrada das diversas camadas expressivas',
          'Produção consciente de conteúdos multimodais em ambientes virtuais'
        ],
        example: 'Em um vídeo educativo curto, a legenda em texto reforça a palavra-chave enquanto o gráfico animado ilustra o processo biológico.'
      },
      {
        slug: 'node-pt-69-hipertexto-redes',
        type: 'concept',
        title: 'Hipertexto, Links e Navegação Não Linear na Web',
        shortDescription: 'Modo de organização textual em nós interconectados por hiperlinks que permitem múltiplos percursos de leitura.',
        deepDescription: 'Diferente da leitura linear sequencial do livro impresso tradicional, o hipertexto digital faculta ao leitor construir sua própria rota investigativa ao clicar em termos destacados, demandando foco cognitivo para não se perder em desvios desinformativos.',
        keyPoints: [
          'Leitura em rede aberta com hiperlinks que conectam verbetes e fontes',
          'Autonomia do leitor na seleção de percursos investigativos',
          'Risco de dispersão e importância de manter o objetivo de estudo'
        ],
        example: 'Ao ler um artigo sobre energia solar em uma enciclopédia online, o estudante clica no termo "fotovoltaica" para consultar o glossário físico.'
      },
      {
        slug: 'node-pt-69-curadoria-algoritmos',
        type: 'concept',
        title: 'Curadoria Digital Crítica e Consciência sobre Bolhas Algorítmicas',
        shortDescription: 'Desenvolvimento de critérios conscientes para selecionar fontes confiáveis e contornar filtros automáticos.',
        deepDescription: 'Os algoritmos das plataformas digitais tendem a priorizar conteúdos que confirmam crenças prévias (câmaras de eco). A curadoria crítica exige checar a autoria, a datação, o rigor metodológico e a reputação institucional das fontes antes de compartilhar.',
        keyPoints: [
          'Reconhecimento dos mecanismos de recomendação por engajamento algorítmico',
          'Critérios de autoridade: identificação de especialistas e instituições científicas',
          'Cidadania digital: combate ativo ao compartilhamento impulsivo de desinformação'
        ],
        example: 'Antes de compartilhar um gráfico alarmista, o estudante verifica se os dados foram publicados por agências oficiais ou por perfil anônimo sem credibilidade.'
      }
    ],
    relations: [
      { fromSlug: 'node-pt-69-hipertexto-redes', type: 'part_of', toSlug: 'node-pt-69-multissemiose' },
      { fromSlug: 'node-pt-69-curadoria-algoritmos', type: 'requires', toSlug: 'node-pt-69-hipertexto-redes' }
    ],
    resources: [
      {
        id: 'res-pt-69-curadoria-guia',
        type: 'diagram',
        title: 'Fluxograma de Checagem Crítica em Redes e Meios Digitais',
        storagePath: '/storage/assets/diagrams/portugues-checagem-fontes-digitais.svg',
        mimeType: 'image/svg+xml',
        metadata: { steps: ['Identificar Autor', 'Conferir Data', 'Buscar em Outras Fontes', 'Avaliar Viés'] },
        linkToSlug: 'node-pt-69-curadoria-algoritmos',
        role: 'illustration'
      }
    ],
    quiz: {
      question: 'O que caracteriza a leitura de um texto hipertextual na internet em comparação à leitura de um livro impresso linear tradicional?',
      options: [
        'No hipertexto as palavras são eliminadas e substituídas exclusivamente por emojis sem sentido.',
        'O hipertexto oferece múltiplos percursos de leitura por meio de links clicáveis que conectam nós de informação complementares.',
        'O hipertexto obriga o leitor a ler todas as páginas de trás para frente obrigatoriamente.',
        'No hipertexto não há autoria nem possibilidade de conferência de dados em enciclopédias.'
      ],
      correctIndex: 1,
      explanation: 'O hipertexto estrutura-se como rede não linear de informações interligadas por links, permitindo ao leitor definir ativamente sua trajetória de aprofundamento e consulta a fontes correlatas.'
    }
  },
  // -------------------------------------------------------------------------
  // ENSINO RELIGIOSO — 7º, 8º E 9º ANOS
  // -------------------------------------------------------------------------
  {
    slug: 'religious_education-7-liderancas-eticas-sociais',
    title: 'Lideranças Religiosas, Ética e Transformação Social no Mundo',
    subjectCode: 'religious_education',
    gradeLevel: 7,
    skillCodes: ['EF07ER01', 'EF07ER02'],
    nodes: [
      {
        slug: 'node-er-7-liderancas-historicas',
        type: 'concept',
        title: 'Lideranças Históricas e Tradições de Paz na Humanidade',
        shortDescription: 'Figuras históricas que mobilizaram valores espirituais e éticos na luta pelos direitos civis e pela dignidade.',
        deepDescription: 'Sob enfoque laico e histórico-cultural, analisa trajetórias de lideranças como Martin Luther King Jr., Mahatma Gandhi, Irmã Dulce e Desmond Tutu, que usaram a não violência ativa e o amor comunitário para combater segregações, racismo e preconceitos.',
        keyPoints: [
          'Enfoque histórico-social, laico e respeitoso à diversidade cultural',
          'Princípio da ação não violenta (Ahimsa / Satyagraha)',
          'Mobilização da espiritualidade em favor dos direitos universais da pessoa humana'
        ],
        example: 'A Marcha sobre Washington em 1963 mobilizou milhares de cidadãos de diferentes crenças em torno do fim da discriminação racial.'
      },
      {
        slug: 'node-er-7-valores-eticos-comunitarios',
        type: 'concept',
        title: 'Valores Éticos Compartilhados: Solidariedade, Justiça e Compaixão',
        shortDescription: 'Princípios morais comuns a diversas matrizes filosóficas e tradições religiosas mundiais.',
        deepDescription: 'A Regra de Ouro ("não faças ao outro o que não gostarias que fizessem a ti") expressa-se com variações em tradições indígenas, ocidentais, orientais e africanas, constituindo patrimônio ético coletivo da humanidade.',
        keyPoints: [
          'Convergência ética entre saberes ancestrais e filosofias humanistas',
          'Prática da solidariedade e proteção aos membros vulneráveis da sociedade',
          'Valorização da empatia como fundamento da convivência pacífica'
        ],
        example: 'O conceito africano de Ubuntu ("eu sou porque nós somos") enfatiza a interdependência humana e a generosidade comunitária.'
      },
      {
        slug: 'node-er-7-dialogo-inter-religioso',
        type: 'concept',
        title: 'O Diálogo Inter-religioso e a Superação da Intolerância',
        shortDescription: 'Iniciativas de cooperação entre diferentes tradições de fé e pessoas sem religião pela convivência democrática.',
        deepDescription: 'O diálogo inter-religioso promove encontros baseados no reconhecimento da alteridade e na rejeição ao fundamentalismo dogmático, trabalhando conjuntamente na mediação de conflitos e em ações humanitárias conjuntas.',
        keyPoints: [
          'Reconhecimento do direito de crer e do direito de não professar religião',
          'Superação ativa de preconceitos históricos e estigmas culturais',
          'Cooperação solidária em prol do bem comum e da pacificação social'
        ],
        example: 'Líderes de matrizes indígenas, afro-brasileiras, cristãs, judaicas e islâmicas reunindo-se em fóruns de defesa da paz comunitária.'
      }
    ],
    relations: [
      { fromSlug: 'node-er-7-valores-eticos-comunitarios', type: 'part_of', toSlug: 'node-er-7-liderancas-historicas' },
      { fromSlug: 'node-er-7-dialogo-inter-religioso', type: 'related_to', toSlug: 'node-er-7-valores-eticos-comunitarios' }
    ],
    resources: [
      {
        id: 'res-er-7-mapa-valores',
        type: 'diagram',
        title: 'Quadro Conceitual: Princípios Éticos Compartilhados nas Culturas Mundiais',
        storagePath: '/storage/assets/diagrams/ensino-religioso-valores-eticos.svg',
        mimeType: 'image/svg+xml',
        metadata: { coreValues: ['Solidariedade', 'Compaixão', 'Justiça Social', 'Não Violência', 'Alteridade'] },
        linkToSlug: 'node-er-7-valores-eticos-comunitarios',
        role: 'illustration'
      }
    ],
    quiz: {
      question: 'Qual é o principal objetivo do "diálogo inter-religioso" abordado pedagogicamente nas aulas de Ensino Religioso?',
      options: [
        'Convencer todos os alunos a adotarem uma única religião oficial estabelecida por lei.',
        'Promover o respeito à diversidade, a superação da intolerância e a cooperação pacífica entre pessoas de diferentes crenças e não crenças.',
        'Classificar qual denominação religiosa possui maior autoridade moral sobre as demais.',
        'Proibir debates éticos e censurar o estudo histórico das manifestações culturais.'
      ],
      correctIndex: 1,
      explanation: 'O diálogo inter-religioso visa ao mútuo reconhecimento, à fraternidade cívica e à construção de uma sociedade democrática e fraterna que repudia a intolerância e acolhe a diversidade.'
    }
  },
  {
    slug: 'religious_education-8-crencas-ritos-passagem',
    title: 'Crenças, Filosofias de Vida e Ritos de Passagem nas Culturas',
    subjectCode: 'religious_education',
    gradeLevel: 8,
    skillCodes: ['EF08ER01', 'EF08ER02'],
    nodes: [
      {
        slug: 'node-er-8-ritos-passagem',
        type: 'concept',
        title: 'Ritos de Passagem: Celebrações do Nascimento, Maturidade e Morte',
        shortDescription: 'Cerimônias comunitárias que marcam as grandes transições do ciclo vital da existência humana.',
        deepDescription: 'Nas mais diversas sociedades, os ritos de passagem (conceito do antropólogo Arnold van Gennep) estruturam-se em três fases: separação da condição anterior, liminaridade (aprendizado/transição) e incorporação ao novo papel perante a coletividade.',
        keyPoints: [
          'Fases rituais: separação, transição liminar e reintegração social',
          'Marcação simbólica de etapas: nascimento, infância, puberdade, casamento e luto',
          'Papel consolidador da identidade e dos vínculos de pertencimento comunitário'
        ],
        example: 'Os rituais de passagem da juventude em povos indígenas do Xingu, preparando os jovens com cantos e provas corporais para a vida adulta.'
      },
      {
        slug: 'node-er-8-matrizes-culturais-brasil',
        type: 'concept',
        title: 'Matrizes Indígenas, Afro-brasileiras e Ocidentais na Espiritualidade Nacional',
        shortDescription: 'Estudo do patrimônio imaterial plural que moldou as tradições culturais brasileiras.',
        deepDescription: 'O Brasil constitui-se pela interação de cosmologias indígenas originárias, tradições de matriz africana (Candomblé, Umbanda) e correntes cristãs e espíritas ocidentais, compondo um rico patrimônio imaterial cuja história deve ser ensinada com rigor e sem preconceitos.',
        keyPoints: [
          'Cosmovisão indígena: sacralidade da terra e comunhão com a natureza viva',
          'Tradições de matriz africana: valorização dos ancestrais e preservação da resistência cultural',
          'Combate ao racismo religioso e valorização do patrimônio nacional'
        ],
        example: 'O toque sagrado dos atabaques e a preservação de cantos em iorubá nos terreiros como resistência e memória histórica secular.'
      },
      {
        slug: 'node-er-8-filosofias-sentido',
        type: 'concept',
        title: 'Filosofias de Vida, Sentido da Existência e Liberdade de Pensamento',
        shortDescription: 'Reflexões humanas fundamentais sobre o propósito da vida, o sofrimento e a finitude.',
        deepDescription: 'A busca por sentido não se restringe a dogmas formais; tradições filosóficas laicas (existencialismo, estoicismo, humanismo secular) oferecem respostas éticas consistentes sobre como viver de modo digno, generoso e consciente da finitude.',
        keyPoints: [
          'A interrogação sobre o sentido da existência como característica universal da condição humana',
          'Concepções filosóficas laicas sobre ética, generosidade e bem comum',
          'Direito fundamental à liberdade de consciência e de autodeterminação reflexiva'
        ],
        example: 'A reflexão estoica sobre focar no que depende de nossas próprias escolhas éticas em vez de nos angustiarmos com o incontrolável.'
      }
    ],
    relations: [
      { fromSlug: 'node-er-8-matrizes-culturais-brasil', type: 'related_to', toSlug: 'node-er-8-ritos-passagem' },
      { fromSlug: 'node-er-8-filosofias-sentido', type: 'related_to', toSlug: 'node-er-8-ritos-passagem' }
    ],
    resources: [
      {
        id: 'res-er-8-ritos-ciclo',
        type: 'diagram',
        title: 'Esquema Antropológico: As Três Fases dos Ritos de Passagem (Van Gennep)',
        storagePath: '/storage/assets/diagrams/ensino-religioso-ritos-passagem-ciclo.svg',
        mimeType: 'image/svg+xml',
        metadata: { phases: ['1. Separação', '2. Liminaridade', '3. Agregação/Incorporação'] },
        linkToSlug: 'node-er-8-ritos-passagem',
        role: 'illustration'
      }
    ],
    quiz: {
      question: 'Segundo os estudos antropológicos abordados no Ensino Religioso, qual é o papel essencial dos "ritos de passagem" nas diferentes culturas?',
      options: [
        'Isolar os indivíduos para que nunca mais participem da vida em comunidade.',
        'Marcar simbolicamente a transição entre fases da vida, fortalecendo a identidade e os laços de pertencimento coletivo.',
        'Obrigar o cidadão a pagar tributos financeiros exclusivos a templos privados.',
        'Eliminar os costumes dos ancestrais em nome da padronização comercial moderna.'
      ],
      correctIndex: 1,
      explanation: 'Os ritos de passagem estruturam as mudanças de papel social e etapas do desenvolvimento (nascimento, puberdade, casamento, morte), reforçando a solidariedade e os vínculos comunitários.'
    }
  },
  {
    slug: 'religious_education-9-direitos-humanos-laicidade',
    title: 'Direitos Humanos, Princípios Éticos e Laicidade do Estado',
    subjectCode: 'religious_education',
    gradeLevel: 9,
    skillCodes: ['EF09ER01', 'EF09ER02'],
    nodes: [
      {
        slug: 'node-er-9-direitos-humanos',
        type: 'concept',
        title: 'A Declaração Universal dos Direitos Humanos e o Respeito às Diferenças',
        shortDescription: 'Marco histórico de 1948 que consagra a dignidade intrínseca e os direitos inalienáveis de toda pessoa.',
        deepDescription: 'Aprovada pela ONU após as atrocidades da Segunda Guerra Mundial, a DUDH estabelece em seu Artigo 18 que todo ser humano tem direito à liberdade de pensamento, de consciência e de religião, inclusive a liberdade de mudar de crença ou de não professar nenhuma.',
        keyPoints: [
          'Dignidade humana intrínseca como princípio fundante de todo ordenamento civil',
          'Liberdade de manifestar crença ou convicção religiosa sem coação estatal',
          'Repúdio a perseguições por motivos religiosos, étnicos ou de gênero'
        ],
        example: 'O Artigo 18 da Declaração Universal dos Direitos Humanos garante a proteção jurídica a todos os credos e a quem opta pelo ateísmo ou agnosticismo.'
      },
      {
        slug: 'node-er-9-estado-laico-constituicao',
        type: 'concept',
        title: 'O Estado Laico e a Constituição Federal de 1988',
        shortDescription: 'Princípio republicano que assegura a separação entre o poder público e as instituições religiosas.',
        deepDescription: 'A Constituição de 1988 estabelece que o Estado brasileiro é laico: não possui religião oficial, não patrocina cultos nem embaraça seu funcionamento. A laicidade não é oposição à religião, mas a garantia jurídica de que todas as fés e não crenças são tratadas com igualdade e imparcialidade pela lei.',
        keyPoints: [
          'Separação constitucional entre Igreja e Estado na República Federativa do Brasil',
          'Imparcialidade do Poder Público perante os múltiplos credos existentes no território',
          'A laicidade como escudo protetor contra o fanatismo e a discriminação religiosa'
        ],
        example: 'Em um Estado laico, as leis e políticas públicas educacionais são fundamentadas na ciência e nos direitos constitucionais, sem privilégios para dogmas particulares.'
      },
      {
        slug: 'node-er-9-cidadania-cultura-paz',
        type: 'concept',
        title: 'Cidadania Democrática, Liberdade de Consciência e Cultura de Paz',
        shortDescription: 'Construção coletiva de um ambiente escolar e social imune ao ódio e aberto ao diálogo.',
        deepDescription: 'A prática da cidadania ativa exige convivência plural: saber ouvir argumentos contrários, dialogar com empatia e defender o direito de outrem a manifestar suas convicções pacíficas, alicerçando uma cultura duradoura de paz e justiça social.',
        keyPoints: [
          'Exercício prático da alteridade e escuta atenta no ambiente escolar',
          'Desconstrução de estereótipos que associam certas tradições a preconceitos infundados',
          'Compromisso republicano com a cultura de paz e os direitos fundamentais'
        ],
        example: 'Projetos escolares multidisciplinares nos quais estudantes convidam representantes de diversas tradições para discutir sustentabilidade e combate à fome.'
      }
    ],
    relations: [
      { fromSlug: 'node-er-9-estado-laico-constituicao', type: 'requires', toSlug: 'node-er-9-direitos-humanos' },
      { fromSlug: 'node-er-9-cidadania-cultura-paz', type: 'related_to', toSlug: 'node-er-9-estado-laico-constituicao' }
    ],
    resources: [
      {
        id: 'res-er-9-laicidade-esquema',
        type: 'diagram',
        title: 'Diagrama Constitucional: A Laicidade do Estado como Garantia de Liberdade Plural',
        storagePath: '/storage/assets/diagrams/ensino-religioso-laicidade-estado.svg',
        mimeType: 'image/svg+xml',
        metadata: { core: 'Estado Laico', guarantees: ['Liberdade de Crer', 'Liberdade de Não Crer', 'Igualdade Perante a Lei', 'Imparcialidade'] },
        linkToSlug: 'node-er-9-estado-laico-constituicao',
        role: 'illustration'
      }
    ],
    quiz: {
      question: 'O que significa afirmar que o Brasil é constitucionalmente um "Estado laico"?',
      options: [
        'Significa que o governo é obrigado a proibir todas as religiões e punir quem frequentar templos.',
        'Significa que o Estado não adota uma religião oficial, garantindo a todas as pessoas liberdade de crença, de culto e de não crença com igualdade perante a lei.',
        'Significa que a chefia do poder executivo deve ser exercida exclusivamente por ministros de fé.',
        'Significa que somente religiões centenárias têm permissão para funcionar em espaço público.'
      ],
      correctIndex: 1,
      explanation: 'A laicidade estatal assegura que o poder público permaneça neutro e independente de confissões religiosas, resguardando juridicamente o direito de todos à liberdade de consciência e de expressão espiritual.'
    }
  }
];

export async function runCurriculumIngestion(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    console.log('=== INICIANDO CARGA DO ACERVO CURRICULAR BNCC COMPLETO (EF II) ===');
    await client.query('BEGIN');

    // 1. Inserir Fonte Oficial BNCC
    const src = OFFICIAL_BNCC_SOURCE;
    await client.query(
      `INSERT INTO sources (id, provider, title, url, author, language, source_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title, url = EXCLUDED.url, provider = EXCLUDED.provider;`,
      [src.id, src.provider, src.title, src.url, src.author, src.language, src.source_type, src.status]
    );

    // Fontes complementares
    const extraSources = [
      { id: 'src-ibge-geografia', provider: 'IBGE', title: 'Atlas Geográfico Escolar e Anuário Estatístico do Brasil', url: 'https://educa.ibge.gov.br/' },
      { id: 'src-mec-pnld', provider: 'MEC/FNDE', title: 'Guia do Livro Didático PNLD — Ensino Fundamental', url: 'https://www.fnde.gov.br/programas/programas-do-livro/' }
    ];
    for (const es of extraSources) {
      await client.query(
        `INSERT INTO sources (id, provider, title, url, author, language, source_type, status)
         VALUES ($1, $2, $3, $4, 'MEC/IBGE', 'pt-BR', 'official', 'verified')
         ON CONFLICT (id) DO NOTHING;`,
        [es.id, es.provider, es.title, es.url]
      );
    }

    // 2. Inserir Matriz Completa de Habilidades da BNCC Literal do MEC (730 habilidades EF II)
    const allSkills = getOfficialBnccSkills();
    console.log(`Carregando ${allSkills.length} habilidades curriculares oficiais da BNCC...`);

    // Remove qualquer registro sintético/fictício não existente na BNCC oficial
    await client.query("DELETE FROM curriculum_skills WHERE code = 'EF09MA24';");

    let skillsInserted = 0;
    for (const s of allSkills) {
      const id = `skill-${s.code.toLowerCase()}`;
      await client.query(
        `INSERT INTO curriculum_skills (id, code, thematic_unit, knowledge_object, description, grade_level, subject_code, source_id, status, version, locator, locator_pdf, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OFFICIAL_BNCC', '2018.3', $9, $10, CURRENT_TIMESTAMP)
         ON CONFLICT (code) DO UPDATE
         SET thematic_unit = EXCLUDED.thematic_unit,
             knowledge_object = EXCLUDED.knowledge_object,
             description = EXCLUDED.description,
             grade_level = EXCLUDED.grade_level,
             subject_code = EXCLUDED.subject_code,
             source_id = EXCLUDED.source_id,
             status = 'OFFICIAL_BNCC',
             version = '2018.3',
             locator = EXCLUDED.locator,
             locator_pdf = EXCLUDED.locator_pdf,
             verified_at = CURRENT_TIMESTAMP;`,
        [id, s.code, s.thematic_unit, s.knowledge_object, s.description, s.grade_level, s.subject_code, src.id, s.locator || null, s.locator_pdf || null]
      );
      skillsInserted++;
    }
    console.log(`✔ ${skillsInserted} habilidades inseridas/atualizadas com sucesso.`);

    // 3. Inserir Nós de Conhecimento e Content Packs
    const defaultLicenseId = 'lic-pemara-internal';
    let nodesInserted = 0;
    let packsPublished = 0;
    let linksInserted = 0;

    for (const topic of CURRICULAR_TOPICS) {
      // 3.1. Inserir nós de conhecimento do tema
      const createdNodeIds: string[] = [];
      for (const node of topic.nodes) {
        const nodeId = node.slug;
        await client.query(
          `INSERT INTO knowledge_nodes (id, slug, type, title, short_description, subject_code, grade_level, data_json, language, source_id, license_id, status, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pt-BR', $9, $10, 'PUBLISHED', 1)
           ON CONFLICT (slug) DO UPDATE
           SET title = EXCLUDED.title,
               short_description = EXCLUDED.short_description,
               data_json = EXCLUDED.data_json,
               status = 'PUBLISHED';`,
          [
            nodeId,
            node.slug,
            node.type,
            node.title,
            node.shortDescription,
            topic.subjectCode,
            topic.gradeLevel,
            JSON.stringify({
              deep_description: node.deepDescription,
              key_points: node.keyPoints,
              example: node.example || null,
              quizzes: [topic.quiz],
              pedagogical_guidance: `Abordagem contextualizada para Ensino Fundamental II (${topic.gradeLevel}º ano).`
            }),
            src.id,
            defaultLicenseId
          ]
        );
        createdNodeIds.push(nodeId);
        nodesInserted++;

        // 3.2. Vínculos Habilidade Curricular <-> Nó
        for (const skillCode of topic.skillCodes) {
          const linkHash = crypto.createHash('md5').update(`${skillCode}-${node.slug}`).digest('hex');
          const linkId = `link-${linkHash}`;
          const linkResult = await client.query(
            `INSERT INTO curriculum_knowledge_links (id, curriculum_skill_id, knowledge_node_id, priority, required)
             SELECT $1, cs.id, $2, 1, TRUE
             FROM curriculum_skills cs
             WHERE cs.code = $3
             ON CONFLICT (curriculum_skill_id, knowledge_node_id) DO NOTHING;`,
            [linkId, nodeId, skillCode]
          );
          linksInserted += linkResult.rowCount ?? 0;
        }
      }

      // 3.3. Relações entre nós do tema
      if (topic.relations) {
        for (const rel of topic.relations) {
          const relHash = crypto.createHash('md5').update(`${rel.fromSlug}-${rel.type}-${rel.toSlug}`).digest('hex');
          const relId = `rel-${relHash}`;
          await client.query(
            `INSERT INTO knowledge_relations (id, from_node_id, relation_type, to_node_id, status)
             VALUES ($1, $2, $3, $4, 'ACTIVE')
             ON CONFLICT (from_node_id, relation_type, to_node_id) DO NOTHING;`,
            [relId, rel.fromSlug, rel.type, rel.toSlug]
          );
        }
      }

      // 3.4. Recursos do tema
      if (topic.resources) {
        for (const res of topic.resources) {
          await client.query(
            `INSERT INTO resources (id, type, title, storage_path, mime_type, source_id, license_id, status, metadata_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8)
             ON CONFLICT (id) DO UPDATE
             SET title = EXCLUDED.title, metadata_json = EXCLUDED.metadata_json, status = 'ACTIVE';`,
            [res.id, res.type, res.title, res.storagePath, res.mimeType, src.id, defaultLicenseId, JSON.stringify(res.metadata)]
          );
          const rlinkHash = crypto.createHash('md5').update(`${res.id}-${res.linkToSlug}`).digest('hex');
          const rlinkId = `rl-${rlinkHash}`;
          await client.query(
            `INSERT INTO resource_links (id, resource_id, knowledge_node_id, role)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING;`,
            [rlinkId, res.id, res.linkToSlug, res.role]
          );
        }
      }

      // 3.5. Cadastrar Content Pack Canônico
      const rootNodeId = topic.nodes[0].slug;
      await client.query(
        `INSERT INTO content_packs (id, slug, subject_code, grade_level, topic_node_id, title, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
         ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             subject_code = EXCLUDED.subject_code,
             grade_level = EXCLUDED.grade_level,
             topic_node_id = EXCLUDED.topic_node_id;`,
        [topic.slug, topic.slug, topic.subjectCode, topic.gradeLevel, rootNodeId, topic.title]
      );

      // 3.6. Montar o payload_json completo e integro
      const primarySkill = topic.skillCodes[0] || 'BNCC-EF';
      const payload = {
        packId: topic.slug,
        slug: topic.slug,
        version: topic.slug === 'history-6-grecia-antiga' ? '2.0.0' : '1.0.0',
        title: topic.title,
        subjectCode: topic.subjectCode,
        gradeLevel: topic.gradeLevel,
        bnccSkill: primarySkill,
        createdBy: 'curator-system',
        nodes: topic.nodes.map(n => ({
          id: n.slug,
          slug: n.slug,
          type: n.type,
          name: n.title,
          title: n.title,
          short_definition: n.shortDescription,
          deep_description: n.deepDescription,
          key_points: n.keyPoints,
          version: 1,
          source_id: src.id,
          license_id: defaultLicenseId
        })),
        relations: (topic.relations || []).map(r => ({
          from: r.fromSlug,
          to: r.toSlug,
          relation: r.type
        })),
        resources: (topic.resources || []).map(r => ({
          id: r.id,
          nodeId: r.linkToSlug,
          role: r.role,
          title: r.title,
          type: r.type,
          storagePath: r.storagePath,
          mimeType: r.mimeType
        })),
        quizzes: [
          {
            id: `quiz-${topic.slug}-01`,
            question: topic.quiz.question,
            options: topic.quiz.options,
            correct_index: topic.quiz.correctIndex,
            explanation: topic.quiz.explanation
          }
        ],
        licenses: [
          { id: 'lic-pemara-internal', code: 'Internal', name: 'PEMARA Curated Educational License' }
        ],
        sources: [
          { id: src.id, provider: src.provider, title: src.title, url: src.url }
        ],
        assembledAt: new Date().toISOString()
      };

      const payloadString = JSON.stringify(payload);
      const contentHash = crypto.createHash('sha256').update(payloadString).digest('hex');
      const targetVersion = payload.version;

      const manifest = {
        version: targetVersion,
        slug: topic.slug,
        title: topic.title,
        contentHash,
        nodesCount: payload.nodes.length,
        relationsCount: payload.relations.length,
        resourcesCount: payload.resources.length,
        sourcesCount: 1,
        licensesCount: 1,
        createdBy: 'curator-system',
        publishedAt: new Date().toISOString()
      };

      // Se for a versão 1.0.0 antiga vazia de história, arquiva
      if (topic.slug === 'history-6-grecia-antiga') {
        await client.query(
          `UPDATE content_pack_versions
           SET status = 'ARCHIVED'
           WHERE pack_id = $1 AND version = '1.0.0';`,
          [topic.slug]
        );
      }

      // Inserir versão íntegra com payload_json real
      const versionId = `cpv-${topic.slug}-v${targetVersion}`.slice(0, 64);
      await client.query(
        `INSERT INTO content_pack_versions (id, pack_id, version, schema_version, content_hash, manifest_json, payload_json, status, published_at)
         VALUES ($1, $2, $3, '1.0', $4, $5::jsonb, $6::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP)
         ON CONFLICT (pack_id, version) DO UPDATE
         SET payload_json = EXCLUDED.payload_json,
             manifest_json = EXCLUDED.manifest_json,
             content_hash = EXCLUDED.content_hash,
             status = 'PUBLISHED';`,
        [versionId, topic.slug, targetVersion, contentHash, JSON.stringify(manifest), payloadString]
      );
      packsPublished++;
    }

    await client.query('COMMIT');
    console.log('=== CARGA CONCLUÍDA COM SUCESSO! ===');
    console.log(`- Habilidades BNCC: ${skillsInserted}`);
    console.log(`- Nós de Conhecimento: ${nodesInserted}`);
    console.log(`- Vínculos Habilidade <-> Nó: ${linksInserted}`);
    console.log(`- Content Packs Publicados (com payload íntegro): ${packsPublished}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na carga curricular:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Execução autônoma quando acionado diretamente por linha de comando
async function main() {
  const config = JSON.parse(fs.readFileSync('.local-demo/config.json', 'utf8'));
  const pool = new pg.Pool({
    host: '127.0.0.1',
    port: config.dbPort,
    user: 'postgres',
    password: config.password,
    database: 'pemara_demo_utf8'
  });

  try {
    await runCurriculumIngestion(pool);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.includes('carregar-acervo-curricular-completo')) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
