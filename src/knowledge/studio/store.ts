/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA KNOWLEDGE STORE & REPOSITORY
 * Camada de persistência relacional do Knowledge Core em memória e localStorage com dados
 * canônicos estruturados (Marco 1: Grécia Antiga com 10+ conceitos, 10+ relações, 5+ fontes, mapas, comparativos e quizzes).
 */

import {
  KnowledgeNodeRecord,
  KnowledgeRelationRecord,
  Source,
  License,
  ResourceRecord,
  ResourceLink,
  CurriculumSkill,
  StagingNodeRecord,
  ImportBatchRecord,
  EntityVersionRecord,
  ContentPackRecord
} from './schema';

const STORAGE_KEYS = {
  NODES: 'pemara_kb_nodes_v1',
  RELATIONS: 'pemara_kb_relations_v1',
  SOURCES: 'pemara_kb_sources_v1',
  LICENSES: 'pemara_kb_licenses_v1',
  RESOURCES: 'pemara_kb_resources_v1',
  CURRICULUM: 'pemara_kb_curriculum_v1',
  STAGING: 'pemara_kb_staging_v1',
  BATCHES: 'pemara_kb_batches_v1',
  VERSIONS: 'pemara_kb_versions_v1',
  PACKS: 'pemara_kb_packs_v1'
};

// Sementes iniciais completas atendendo o Marco 1
const INITIAL_LICENSES: License[] = [
  {
    id: 'lic-cc-by-sa-4',
    name: 'Creative Commons Attribution-ShareAlike 4.0 International',
    code: 'CC BY-SA',
    commercial_use: true,
    derivatives_allowed: true,
    attribution_required: true,
    redistribution_allowed: true,
    notes: 'Padrão Wikipédia/Wikidata'
  },
  {
    id: 'lic-public-domain',
    name: 'Domínio Público / Governo Federal',
    code: 'Public Domain',
    commercial_use: true,
    derivatives_allowed: true,
    attribution_required: false,
    redistribution_allowed: true,
    notes: 'Documentos oficiais BNCC e MEC'
  },
  {
    id: 'lic-pemara-internal',
    name: 'PEMARA Curated Educational License',
    code: 'Internal',
    commercial_use: false,
    derivatives_allowed: true,
    attribution_required: true,
    redistribution_allowed: true,
    notes: 'Conteúdo didático original produzido para o ecossistema escolar'
  }
];

const INITIAL_SOURCES: Source[] = [
  {
    id: 'src-bncc-mec-2018',
    provider: 'BNCC / Ministério da Educação',
    title: 'Base Nacional Comum Curricular (Ensino Fundamental)',
    url: 'http://basenacionalcomum.mec.gov.br/',
    author: 'MEC / CNE',
    language: 'pt-BR',
    source_type: 'official',
    retrieved_at: '2026-01-10T12:00:00Z',
    status: 'verified'
  },
  {
    id: 'src-wikidata-greece',
    provider: 'Wikidata',
    title: 'Wikidata Corpus: Ancient Greece Entities (Q11772)',
    url: 'https://www.wikidata.org/wiki/Q11772',
    author: 'Wikidata Contributors',
    language: 'multilingual',
    source_type: 'open_data',
    retrieved_at: '2026-02-15T08:30:00Z',
    status: 'verified'
  },
  {
    id: 'src-vernant-mito',
    provider: 'Jean-Pierre Vernant',
    title: 'As Origens do Pensamento Grego e Mito e Sociedade na Grécia Antiga',
    author: 'Jean-Pierre Vernant',
    language: 'pt-BR',
    source_type: 'institutional',
    retrieved_at: '2025-11-20T10:00:00Z',
    status: 'curated'
  },
  {
    id: 'src-funari-grecia',
    provider: 'Pedro Paulo Funari',
    title: 'Grécia e Roma: Vida Pública e Vida Privada',
    author: 'Pedro Paulo Funari (Editora Contexto)',
    language: 'pt-BR',
    source_type: 'encyclopedia',
    retrieved_at: '2025-12-05T14:00:00Z',
    status: 'verified'
  },
  {
    id: 'src-tucídides-peloponeso',
    provider: 'Tucídides (Tradução Acadêmica)',
    title: 'História da Guerra do Peloponeso - Oração Fúnebre de Péricles',
    author: 'Tucídides (Trad. Mário da Gama Kury)',
    language: 'pt-BR',
    source_type: 'open_content',
    retrieved_at: '2026-01-05T09:00:00Z',
    status: 'verified'
  }
];

const INITIAL_CURRICULUM: CurriculumSkill[] = [
  {
    id: 'curr-ef06hi09',
    code: 'EF06HI09',
    thematic_unit: 'Antiguidade Clássica: Grécia e Roma',
    knowledge_object: 'O conceito de pólis, a democracia ateniense e a oligarquia espartana',
    description: 'Discutir o conceito de Antiguidade Clássica, seu alcance e limite na tradição ocidental, assim como os impactos sobre a noção de cidadania.',
    grade_level: 6,
    subject_code: 'history',
    source_id: 'src-bncc-mec-2018',
    status: 'OFFICIAL_BNCC',
    version: '2018.3'
  },
  {
    id: 'curr-ef06hi10',
    code: 'EF06HI10',
    thematic_unit: 'Antiguidade Clássica: Grécia e Roma',
    knowledge_object: 'A formação da Grécia Antiga: dispersão pelo Mediterrâneo',
    description: 'Explicar a formação da Grécia Antiga, com ênfase na formação da pólis e nas transformações políticas, sociais e culturais.',
    grade_level: 6,
    subject_code: 'history',
    source_id: 'src-bncc-mec-2018',
    status: 'OFFICIAL_BNCC',
    version: '2018.3'
  }
];

// Marco 1: 10+ Conceitos Estruturados com Metadados Ricos
const INITIAL_NODES: KnowledgeNodeRecord[] = [
  {
    id: 'node-grecia-antiga',
    slug: 'grecia-antiga',
    type: 'period',
    title: 'Grécia Antiga',
    short_description: 'Civilização seminal do sudeste europeu que floresceu do século VIII a.C. ao século II a.C.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Composta por centenas de cidades-estado no Mar Egeu, unidas pela língua helênica e religião olímpica.',
      key_points: ['Península Balcânica', 'Civilização Helênica', 'Invenção da Democracia e Filosofia'],
      recommended_grades: [6],
      visual_types: ['map', 'timeline', 'comparison'],
      historical_dates: 'Século VIII a.C. - 146 a.C.'
    },
    language: 'pt-BR',
    source_id: 'src-bncc-mec-2018',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-polis',
    slug: 'polis',
    type: 'concept',
    title: 'Pólis (Cidade-Estado)',
    short_description: 'Comunidade política soberana com leis, moedas e governo próprios.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'A pólis representava o coletivo de cidadãos (politai) e não apenas o espaço geográfico fortificado.',
      key_points: ['Autonomia política', 'Ágora como centro de debate', 'Acrópole fortificada'],
      recommended_grades: [6],
      visual_types: ['title_body', 'diagram']
    },
    language: 'pt-BR',
    source_id: 'src-bncc-mec-2018',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-atenas',
    slug: 'atenas',
    type: 'place',
    title: 'Atenas',
    short_description: 'Pólis da península da Ática famosa pela marinha, comércio e florescimento da democracia.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Desenvolveu o comércio marítimo no Porto do Pireu e o governo por assembleia popular.',
      key_points: ['Democracia Direta', 'Porto do Pireu', 'Patrona Atena'],
      recommended_grades: [6],
      visual_types: ['map', 'comparison']
    },
    language: 'pt-BR',
    source_id: 'src-vernant-mito',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-esparta',
    slug: 'esparta',
    type: 'place',
    title: 'Esparta',
    short_description: 'Pólis da Lacônia (Peloponeso) voltada para o militarismo austero e controle da terra.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Sociedade oligárquica de guerreiros (esparciatas) sustentada pelo trabalho servil dos hilotas.',
      key_points: ['Oligarquia', 'Agogê militar', 'Servidão dos Hilotas'],
      recommended_grades: [6],
      visual_types: ['map', 'comparison']
    },
    language: 'pt-BR',
    source_id: 'src-bncc-mec-2018',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-democracia-direta',
    slug: 'democracia-direta-ateniense',
    type: 'theory',
    title: 'Democracia Direta Ateniense',
    short_description: 'Demos (povo) + Kratos (poder): sistema onde os cidadãos votavam sem deputados na Eclésia.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Estruturada pelas reformas de Clístenes (508 a.C.). Excluía mulheres, metecos e escravizados.',
      key_points: ['Eclésia', 'Isegoria (igualdade da palavra)', 'Exclusão social sistemática'],
      recommended_grades: [6],
      visual_types: ['title_body', 'quiz']
    },
    language: 'pt-BR',
    source_id: 'src-funari-grecia',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-agora',
    slug: 'agora',
    type: 'place',
    title: 'Ágora',
    short_description: 'A praça central pública das cidades gregas, centro cívico, mercantil e de debates políticos.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Espaço onde os cidadãos compravam, conversavam sobre filosofia e deliberavam o futuro da pólis.',
      key_points: ['Praça pública', 'Coração da cidadania', 'Espaço de fala'],
      recommended_grades: [6],
      visual_types: ['title_body']
    },
    language: 'pt-BR',
    source_id: 'src-vernant-mito',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-acropole',
    slug: 'acropole',
    type: 'place',
    title: 'Acrópole',
    short_description: 'A colina fortificada no ponto mais elevado da pólis, sede de templos religiosos e refúgio.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Em Atenas, abriga o Partenon construído por Péricles dedicado à deusa Atena Pallas.',
      key_points: ['Ponto mais alto', 'Partenon', 'Santuário protetor'],
      recommended_grades: [6],
      visual_types: ['image', 'title_body']
    },
    language: 'pt-BR',
    source_id: 'src-vernant-mito',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-pericles',
    slug: 'pericles',
    type: 'person',
    title: 'Péricles (Século de Ouro)',
    short_description: 'Líder político e general que consolidou a democracia e financiou o apogeu cultural de Atenas.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Criou a remuneração para cargos públicos (misthophoria) permitindo a participação dos mais pobres.',
      key_points: ['Século V a.C.', 'Remuneração cívica', 'Oração Fúnebre'],
      recommended_grades: [6],
      visual_types: ['title_body', 'timeline']
    },
    language: 'pt-BR',
    source_id: 'src-tucídides-peloponeso',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-hilotas',
    slug: 'hilotas',
    type: 'concept',
    title: 'Hilotas',
    short_description: 'População servil do Estado espartano que cultivava a terra e sustentava o exército.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Não eram escravizados individuais privados, mas escravizados estatais atrelados aos lotes agrícolas.',
      key_points: ['Servidão estatal', 'Maioria populacional na Lacônia', 'Revoltas frequentes'],
      recommended_grades: [6],
      visual_types: ['comparison']
    },
    language: 'pt-BR',
    source_id: 'src-funari-grecia',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-jogos-olimpicos',
    slug: 'jogos-olimpicos-antigos',
    type: 'event',
    title: 'Jogos Olímpicos da Antiguidade',
    short_description: 'Festivais atléticos e religiosos em honra a Zeus realizados em Olímpia a cada quatro anos.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Durante os jogos, instaurava-se a Trégua Sagrada (Ekecheiria), cessando as guerras entre as pólis.',
      key_points: ['Olímpia', 'Trégua Sagrada', 'Unidade Pan-Helênica'],
      recommended_grades: [6],
      visual_types: ['map', 'timeline']
    },
    language: 'pt-BR',
    source_id: 'src-bncc-mec-2018',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  },
  {
    id: 'node-relevo-egeu',
    slug: 'relevo-montanhoso-e-mar-egeu',
    type: 'object',
    title: 'Geografia do Mar Egeu e Relevo Montanhoso',
    short_description: 'Condição geográfica que moldou a fragmentação política grega e sua vocação marítima.',
    subject_code: 'history',
    grade_level: 6,
    data_json: {
      summary: 'Mais de 80% do território grego é montanhoso, o que isolava vales e empurrava as cidades para o mar.',
      key_points: ['Relevo acidentado', 'Navegação no Egeu', 'Barreiras naturais'],
      recommended_grades: [6],
      visual_types: ['map']
    },
    language: 'pt-BR',
    source_id: 'src-bncc-mec-2018',
    license_id: 'lic-cc-by-sa-4',
    status: 'PUBLISHED',
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-01T15:30:00Z'
  }
];

// Marco 1: 10+ Relações Ontológicas no Knowledge Graph
const INITIAL_RELATIONS: KnowledgeRelationRecord[] = [
  { id: 'rel-1', from_node_id: 'node-atenas', relation_type: 'part_of', to_node_id: 'node-grecia-antiga', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-2', from_node_id: 'node-esparta', relation_type: 'part_of', to_node_id: 'node-grecia-antiga', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-3', from_node_id: 'node-atenas', relation_type: 'example_of', to_node_id: 'node-polis', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-4', from_node_id: 'node-esparta', relation_type: 'example_of', to_node_id: 'node-polis', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-5', from_node_id: 'node-atenas', relation_type: 'contrasts_with', to_node_id: 'node-esparta', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-6', from_node_id: 'node-democracia-direta', relation_type: 'located_in', to_node_id: 'node-atenas', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-7', from_node_id: 'node-democracia-direta', relation_type: 'occurred_in', to_node_id: 'node-agora', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-8', from_node_id: 'node-pericles', relation_type: 'influenced', to_node_id: 'node-democracia-direta', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-9', from_node_id: 'node-acropole', relation_type: 'located_in', to_node_id: 'node-atenas', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-10', from_node_id: 'node-hilotas', relation_type: 'part_of', to_node_id: 'node-esparta', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-11', from_node_id: 'node-jogos-olimpicos', relation_type: 'part_of', to_node_id: 'node-grecia-antiga', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' },
  { id: 'rel-12', from_node_id: 'node-relevo-egeu', relation_type: 'caused_by', to_node_id: 'node-polis', status: 'ACTIVE', created_at: '2026-01-15T10:00:00Z' }
];

const INITIAL_RESOURCES: ResourceRecord[] = [
  {
    id: 'res-map-egeu',
    type: 'map',
    title: 'Mapa do Mar Egeu e Pólis Gregas',
    storage_path: '/storage/assets/maps/history/mar-egeu-polis.svg',
    mime_type: 'image/svg+xml',
    source_id: 'src-bncc-mec-2018',
    license_id: 'lic-pemara-internal',
    status: 'ACTIVE',
    metadata_json: {
      center: [38.0, 24.0],
      key_locations: ['Atenas', 'Esparta', 'Olímpia', 'Delfos', 'Creta']
    },
    created_at: '2026-01-20T10:00:00Z'
  },
  {
    id: 'res-comp-atenas-esparta',
    type: 'comparison_table',
    title: 'Quadro Comparativo: Atenas Democrática vs Esparta Oligárquica',
    storage_path: '/storage/assets/charts/history/atenas-vs-esparta.json',
    mime_type: 'application/json',
    source_id: 'src-vernant-mito',
    license_id: 'lic-pemara-internal',
    status: 'ACTIVE',
    metadata_json: {
      columns: ['Critério', 'Atenas', 'Esparta'],
      aspects: ['Governo', 'Economia', 'Educação', 'Mulher', 'Mão de Obra']
    },
    created_at: '2026-01-20T10:00:00Z'
  }
];

const INITIAL_PACKS: ContentPackRecord[] = [
  {
    id: 'history-6-grecia-antiga',
    slug: 'history-6-grecia-antiga',
    subject_code: 'history',
    grade_level: 6,
    topic_node_id: 'node-grecia-antiga',
    title: 'Grécia Antiga: Pólis, Democracia e Sociedade',
    version: '1.0.0',
    status: 'PUBLISHED',
    created_at: '2026-01-25T14:00:00Z',
    published_at: '2026-02-01T10:00:00Z'
  }
];

// Staging Inicial de Importação (Demonstrativo do Pipeline do Marco 4)
const INITIAL_STAGING: StagingNodeRecord[] = [
  {
    id: 'stg-01',
    import_batch_id: 'batch-wd-001',
    source_provider: 'Wikidata',
    external_id: 'Q83494',
    title: 'Pólis',
    slug: 'polis-wikidata',
    type: 'concept',
    short_description: 'Entidade política e administrativa da Grécia Antiga.',
    data_json: { qid: 'Q83494', instance_of: 'city-state' },
    validation_status: 'DUPLICATE',
    duplicate_candidate_id: 'node-polis',
    review_notes: 'Candidato duplicado detectado pelo slug normalizado "polis".',
    created_at: '2026-02-15T08:30:00Z'
  },
  {
    id: 'stg-02',
    import_batch_id: 'batch-wd-001',
    source_provider: 'Wikidata',
    external_id: 'Q913',
    title: 'Sócrates',
    slug: 'socrates',
    type: 'person',
    short_description: 'Filósofo ateniense do período clássico (470-399 a.C.).',
    data_json: { qid: 'Q913', field: 'filosofia grega', student_of: 'node-atenas' },
    validation_status: 'NEW',
    review_notes: 'Novo registro pronto para validação e promoção ao Core.',
    created_at: '2026-02-15T08:31:00Z'
  },
  {
    id: 'stg-03',
    import_batch_id: 'batch-wd-001',
    source_provider: 'Wikidata',
    external_id: 'Q131390',
    title: 'Guerra do Peloponeso',
    slug: 'guerra-do-peloponeso',
    type: 'event',
    short_description: 'Conflito armado entre a Liga de Delos liderada por Atenas e a Liga do Peloponeso liderada por Esparta.',
    data_json: { qid: 'Q131390', dates: '431 a.C. - 404 a.C.' },
    validation_status: 'NEW',
    review_notes: 'Pronto para aprovação.',
    created_at: '2026-02-15T08:32:00Z'
  }
];

const INITIAL_BATCHES: ImportBatchRecord[] = [
  {
    id: 'batch-wd-001',
    provider: 'Wikidata (SPARQL endpoint)',
    started_at: '2026-02-15T08:29:00Z',
    finished_at: '2026-02-15T08:33:00Z',
    records_found: 50,
    records_imported: 3,
    records_rejected: 2,
    records_duplicates: 1,
    status: 'COMPLETED',
    log_path: '/storage/logs/import-wikidata-greece.log'
  }
];

export class KnowledgeStore {
  public static getNodes(): KnowledgeNodeRecord[] {
    return this.load(STORAGE_KEYS.NODES, INITIAL_NODES);
  }

  public static saveNodes(nodes: KnowledgeNodeRecord[]) {
    this.save(STORAGE_KEYS.NODES, nodes);
  }

  public static getRelations(): KnowledgeRelationRecord[] {
    return this.load(STORAGE_KEYS.RELATIONS, INITIAL_RELATIONS);
  }

  public static saveRelations(relations: KnowledgeRelationRecord[]) {
    this.save(STORAGE_KEYS.RELATIONS, relations);
  }

  public static getSources(): Source[] {
    return this.load(STORAGE_KEYS.SOURCES, INITIAL_SOURCES);
  }

  public static saveSources(sources: Source[]) {
    this.save(STORAGE_KEYS.SOURCES, sources);
  }

  public static getLicenses(): License[] {
    return this.load(STORAGE_KEYS.LICENSES, INITIAL_LICENSES);
  }

  public static getResources(): ResourceRecord[] {
    return this.load(STORAGE_KEYS.RESOURCES, INITIAL_RESOURCES);
  }

  public static getCurriculum(): CurriculumSkill[] {
    return this.load(STORAGE_KEYS.CURRICULUM, INITIAL_CURRICULUM);
  }

  public static getStaging(): StagingNodeRecord[] {
    return this.load(STORAGE_KEYS.STAGING, INITIAL_STAGING);
  }

  public static saveStaging(items: StagingNodeRecord[]) {
    this.save(STORAGE_KEYS.STAGING, items);
  }

  public static getBatches(): ImportBatchRecord[] {
    return this.load(STORAGE_KEYS.BATCHES, INITIAL_BATCHES);
  }

  public static saveBatches(batches: ImportBatchRecord[]) {
    this.save(STORAGE_KEYS.BATCHES, batches);
  }

  public static getPacks(): ContentPackRecord[] {
    return this.load(STORAGE_KEYS.PACKS, INITIAL_PACKS);
  }

  public static savePacks(packs: ContentPackRecord[]) {
    this.save(STORAGE_KEYS.PACKS, packs);
  }

  // Operação: Atualizar Nó com versionamento rigoroso (Tabela entity_versions)
  public static updateNode(updated: KnowledgeNodeRecord, user = 'admin-editor', reason = 'Edição curricular'): { node: KnowledgeNodeRecord; version: EntityVersionRecord } {
    const nodes = this.getNodes();
    const existingIndex = nodes.findIndex((n) => n.id === updated.id);
    const existing = nodes[existingIndex];

    const newVersion = existing ? existing.version + 1 : 1;
    const versionRecord: EntityVersionRecord = {
      id: `ver-${Date.now()}`,
      entity_type: 'knowledge_node',
      entity_id: updated.id,
      version: newVersion,
      snapshot_json: JSON.parse(JSON.stringify(updated)),
      changed_by: user,
      changed_at: new Date().toISOString(),
      change_reason: reason
    };

    const finalNode: KnowledgeNodeRecord = {
      ...updated,
      version: newVersion,
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      nodes[existingIndex] = finalNode;
    } else {
      nodes.unshift(finalNode);
    }

    this.saveNodes(nodes);

    const versions = this.load<EntityVersionRecord[]>(STORAGE_KEYS.VERSIONS, []);
    versions.unshift(versionRecord);
    this.save(STORAGE_KEYS.VERSIONS, versions);

    return { node: finalNode, version: versionRecord };
  }

  // Operação: Promover item de Staging para o Knowledge Core permanente
  public static approveStagingNode(stagingId: string): KnowledgeNodeRecord | null {
    const staging = this.getStaging();
    const target = staging.find((s) => s.id === stagingId);
    if (!target) return null;

    const newNode: KnowledgeNodeRecord = {
      id: `node-${target.slug}`,
      slug: target.slug,
      type: target.type,
      title: target.title,
      short_description: target.short_description,
      subject_code: 'history',
      grade_level: 6,
      data_json: target.data_json,
      language: 'pt-BR',
      source_id: 'src-wikidata-greece',
      license_id: 'lic-cc-by-sa-4',
      status: 'PUBLISHED',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Salvar no Core
    const nodes = this.getNodes();
    nodes.push(newNode);
    this.saveNodes(nodes);

    // Atualizar status no staging
    target.validation_status = 'APPROVED';
    this.saveStaging(staging);

    return newNode;
  }

  // Executar simulação de pipeline de importação externa
  public static runImportPipeline(provider = 'Wikidata', topic = 'Grécia Antiga', limit = 5): ImportBatchRecord {
    const batches = this.getBatches();
    const batchId = `batch-${Date.now()}`;

    const newBatch: ImportBatchRecord = {
      id: batchId,
      provider: `${provider} Pipeline`,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      records_found: limit,
      records_imported: 2,
      records_rejected: 0,
      records_duplicates: 1,
      status: 'COMPLETED',
      log_path: `/storage/logs/${batchId}.log`
    };

    batches.unshift(newBatch);
    this.saveBatches(batches);

    // Inserir amostras normalizadas no staging com detecção de duplicatas
    const staging = this.getStaging();
    const nodes = this.getNodes();

    const candidateSlug = 'grecia-antiga';
    const isDup = nodes.some((n) => n.slug === candidateSlug);

    staging.unshift({
      id: `stg-${Date.now()}-1`,
      import_batch_id: batchId,
      source_provider: provider as any,
      external_id: `Q${Math.floor(Math.random() * 900000 + 100000)}`,
      title: `${topic} (Importação)`,
      slug: candidateSlug,
      type: 'period',
      short_description: `Registro importado de ${provider} para revisão editorial.`,
      data_json: { imported_at: new Date().toISOString() },
      validation_status: isDup ? 'DUPLICATE' : 'NEW',
      duplicate_candidate_id: isDup ? 'node-grecia-antiga' : undefined,
      review_notes: isDup ? 'Normalizador: Slug idêntico a nó existente no core.' : 'Normalização estrutural concluída.',
      created_at: new Date().toISOString()
    });

    this.saveStaging(staging);
    return newBatch;
  }

  private static memoryCache: Record<string, string> = {};

  private static load<T>(key: string, fallback: T): T {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = window.localStorage.getItem(key);
        if (data) return JSON.parse(data);
      } else if (this.memoryCache[key]) {
        return JSON.parse(this.memoryCache[key]);
      }
    } catch {
      // Ignora erro
    }
    return fallback;
  }

  private static save<T>(key: string, data: T) {
    try {
      const serialized = JSON.stringify(data);
      this.memoryCache[key] = serialized;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, serialized);
      }
    } catch {
      // Storage cheio ou indisponível
    }
  }
}
