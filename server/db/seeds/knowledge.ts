/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — SEMENTE INICIAL DO KNOWLEDGE CORE (E3)
 * Popula de forma idempotente o banco de dados relacional com o acervo canônico
 * do Marco 1 (Grécia Antiga para o 6º ano do Ensino Fundamental).
 */

import pg from 'pg';
import crypto from 'crypto';
import { CONTENT_PACK_GRECIA_ANTIGA } from '../../../src/knowledge/packs/history6Greece';

export async function seedInitialKnowledge(pool: pg.Pool, options: {includeDemoResearch?: boolean} = {}): Promise<{
  licensesCount: number;
  sourcesCount: number;
  curriculumCount: number;
  nodesCount: number;
  relationsCount: number;
  resourcesCount: number;
  packsCount: number;
  stagingCount: number;
}> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Licenças
    const licenses = [
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

    for (const lic of licenses) {
      await client.query(
        `INSERT INTO licenses (id, name, code, commercial_use, derivatives_allowed, attribution_required, redistribution_allowed, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING;`,
        [lic.id, lic.name, lic.code, lic.commercial_use, lic.derivatives_allowed, lic.attribution_required, lic.redistribution_allowed, lic.notes]
      );
    }

    // 2. Fontes
    const sources = [
      {
        id: 'src-bncc-mec-2018',
        provider: 'BNCC / Ministério da Educação',
        title: 'Base Nacional Comum Curricular (Ensino Fundamental)',
        url: 'http://basenacionalcomum.mec.gov.br/',
        author: 'MEC / CNE',
        language: 'pt-BR',
        source_type: 'official',
        status: 'verified'
      },
      {
        id: 'src-wikidata-greece',
        provider: 'Wikidata',
        title: 'Wikidata Corpus: Ancient Greece Entities (Q11772)',
        url: 'https://www.wikidata.org/wiki/Q11772',
        author: 'Wikidata Contributors',
        language: 'mul',
        source_type: 'open_data',
        status: 'verified'
      },
      {
        id: 'src-vernant-mito',
        provider: 'Jean-Pierre Vernant',
        title: 'As Origens do Pensamento Grego e Mito e Sociedade na Grécia Antiga',
        author: 'Jean-Pierre Vernant',
        language: 'pt-BR',
        source_type: 'institutional',
        status: 'curated'
      },
      {
        id: 'src-funari-grecia',
        provider: 'Pedro Paulo Funari',
        title: 'Grécia e Roma: Vida Pública e Vida Privada',
        author: 'Pedro Paulo Funari (Editora Contexto)',
        language: 'pt-BR',
        source_type: 'encyclopedia',
        status: 'verified'
      },
      {
        id: 'src-tucídides-peloponeso',
        provider: 'Tucídides (Tradução Acadêmica)',
        title: 'História da Guerra do Peloponeso - Oração Fúnebre de Péricles',
        author: 'Tucídides (Trad. Mário da Gama Kury)',
        language: 'pt-BR',
        source_type: 'open_content',
        status: 'verified'
      }
    ];

    for (const src of sources) {
      await client.query(
        `INSERT INTO sources (id, provider, title, url, author, language, source_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING;`,
        [src.id, src.provider, src.title, src.url, src.author, src.language, src.source_type, src.status]
      );
    }

    // 3. Currículo BNCC
    const curriculum = [
      {
        id: 'curr-ef06hi09',
        code: 'EF06HI09',
        thematic_unit: 'Antiguidade Clássica: Grécia e Roma',
        knowledge_object: 'O conceito de pólis, a democracia ateniense e a oligarquia espartana',
        description: 'Discutir o conceito de Antiguidade Clássica, seu alcance e limite na tradição ocidental, assim como os impactos sobre outras sociedades e culturas.',
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

    for (const curr of curriculum) {
      await client.query(
        `INSERT INTO curriculum_skills (id, code, thematic_unit, knowledge_object, description, grade_level, subject_code, source_id, status, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (code) DO NOTHING;`,
        [curr.id, curr.code, curr.thematic_unit, curr.knowledge_object, curr.description, curr.grade_level, curr.subject_code, curr.source_id, curr.status, curr.version]
      );
    }
    await client.query(`
      UPDATE curriculum_skills SET description=$1
      WHERE id='curr-ef06hi09' AND code='EF06HI09' AND source_id='src-bncc-mec-2018'
        AND version='2018.3' AND status='OFFICIAL_BNCC' AND verified_at IS NULL
        AND description=$2
    `,[curriculum[0].description,'Discutir o conceito de Antiguidade Clássica, seu alcance e limite na tradição ocidental, assim como os impactos sobre a noção de cidadania.']);

    // 4. Nós de Conhecimento (11 nós canônicos)
    const nodes = [
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
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
        status: 'PUBLISHED'
      }
    ];

    for (const node of nodes) {
      const insRes = await client.query(
        `INSERT INTO knowledge_nodes (id, slug, type, title, short_description, subject_code, grade_level, data_json, language, source_id, license_id, status, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1)
         ON CONFLICT (slug) DO NOTHING
         RETURNING *;`,
        [node.id, node.slug, node.type, node.title, node.short_description, node.subject_code, node.grade_level, node.data_json, node.language, node.source_id, node.license_id, node.status]
      );

      if (insRes.rows.length > 0) {
        const created = insRes.rows[0];
        // Registrar snapshot inicial em entity_versions
        await client.query(
          `INSERT INTO entity_versions (id, entity_type, entity_id, version, snapshot_json, changed_by, change_reason)
           VALUES ($1, 'knowledge_node', $2, 1, $3, 'system-seed', 'Carga inicial do acervo canônico')
           ON CONFLICT (entity_type, entity_id, version) DO NOTHING;`,
          [crypto.randomUUID(), created.id, created]
        );
      }
    }

    // 5. Relações Ontológicas
    const relations = [
      { id: 'rel-1', from_node_id: 'node-atenas', relation_type: 'part_of', to_node_id: 'node-grecia-antiga' },
      { id: 'rel-2', from_node_id: 'node-esparta', relation_type: 'part_of', to_node_id: 'node-grecia-antiga' },
      { id: 'rel-3', from_node_id: 'node-atenas', relation_type: 'example_of', to_node_id: 'node-polis' },
      { id: 'rel-4', from_node_id: 'node-esparta', relation_type: 'example_of', to_node_id: 'node-polis' },
      { id: 'rel-5', from_node_id: 'node-atenas', relation_type: 'contrasts_with', to_node_id: 'node-esparta' },
      { id: 'rel-6', from_node_id: 'node-democracia-direta', relation_type: 'located_in', to_node_id: 'node-atenas' },
      { id: 'rel-7', from_node_id: 'node-democracia-direta', relation_type: 'occurred_in', to_node_id: 'node-agora' },
      { id: 'rel-8', from_node_id: 'node-pericles', relation_type: 'influenced', to_node_id: 'node-democracia-direta' },
      { id: 'rel-9', from_node_id: 'node-acropole', relation_type: 'located_in', to_node_id: 'node-atenas' },
      { id: 'rel-10', from_node_id: 'node-hilotas', relation_type: 'part_of', to_node_id: 'node-esparta' },
      { id: 'rel-11', from_node_id: 'node-jogos-olimpicos', relation_type: 'part_of', to_node_id: 'node-grecia-antiga' },
      { id: 'rel-12', from_node_id: 'node-relevo-egeu', relation_type: 'caused_by', to_node_id: 'node-polis' }
    ];

    for (const rel of relations) {
      await client.query(
        `INSERT INTO knowledge_relations (id, from_node_id, relation_type, to_node_id, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (from_node_id, relation_type, to_node_id) DO NOTHING;`,
        [rel.id, rel.from_node_id, rel.relation_type, rel.to_node_id]
      );
    }

    // 6. Recursos Didáticos
    const resources = [
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
        }
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
        }
      }
    ];

    for (const res of resources) {
      await client.query(
        `INSERT INTO resources (id, type, title, storage_path, mime_type, source_id, license_id, status, metadata_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING;`,
        [res.id, res.type, res.title, res.storage_path, res.mime_type, res.source_id, res.license_id, res.status, res.metadata_json]
      );
    }

    // 7. Content Pack
    const packId = 'history-6-grecia-antiga';
    await client.query(
      `INSERT INTO content_packs (id, slug, subject_code, grade_level, topic_node_id, title, status)
       VALUES ($1, $2, 'history', 6, 'node-grecia-antiga', 'Grécia Antiga: Pólis, Democracia e Sociedade', 'ACTIVE')
       ON CONFLICT (slug) DO NOTHING;`,
      [packId, packId]
    );

    // Content Pack Version
    const packVersionHash = crypto.createHash('sha256').update('history-6-grecia-antiga-v1.0.0').digest('hex');
    await client.query(
      `INSERT INTO content_pack_versions (id, pack_id, version, schema_version, content_hash, manifest_json, payload_json, status, published_at)
       VALUES ($1, $2, '1.0.0', '1.0', $3, '{"title":"Grécia Antiga"}'::jsonb, '{}'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP)
       ON CONFLICT (pack_id, version) DO NOTHING;`,
      ['cpv-history-6-grecia-1.0.0', packId, packVersionHash]
    );

    // Repair only the exact empty bundled placeholder. Published teacher work,
    // archived packs and previous revision bytes remain untouched.
    const placeholder = (await client.query(`
      SELECT v.id FROM content_pack_versions v JOIN content_packs p ON p.id=v.pack_id
      WHERE v.id='cpv-history-6-grecia-1.0.0' AND v.content_hash=$1
        AND v.payload_json='{}'::jsonb AND v.manifest_json='{"title":"Grécia Antiga"}'::jsonb
        AND v.status='PUBLISHED' AND p.status='ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM content_pack_versions other WHERE other.pack_id=$3 AND other.id<>'cpv-history-6-grecia-1.0.0')
        AND NOT EXISTS (SELECT 1 FROM knowledge_nodes WHERE id=ANY($2::text[]) AND version<>1)
    `, [packVersionHash, nodes.map(node=>node.id), packId])).rows[0];
    if (placeholder) {
      const canonical=CONTENT_PACK_GRECIA_ANTIGA;
      const payload={
        packId,slug:packId,version:'1.0.1',title:canonical.title,subjectCode:'history',gradeLevel:6,
        bnccSkill:canonical.bncc_skill,editorialStatus:'pending_teacher_review',
        nodes:nodes.map(node=>({...node,short_definition:node.short_description,...node.data_json,version:1})),
        relations,resources:resources.map(resource=>({...resource,storagePath:resource.storage_path})),
        quizzes:canonical.quizzes.map(quiz=>({...quiz,options:quiz.answers})),sources,licenses,
      };
      const payloadString=JSON.stringify(payload);
      const contentHash=crypto.createHash('sha256').update(payloadString).digest('hex');
      await client.query("UPDATE content_pack_versions SET status='ARCHIVED' WHERE id=$1",[placeholder.id]);
      await client.query(`
        INSERT INTO content_pack_versions(id,pack_id,version,schema_version,content_hash,manifest_json,payload_json,status,published_at)
        VALUES('cpv-history-6-grecia-1.0.1',$1,'1.0.1','1.0',$2,$3::jsonb,$4::jsonb,'PUBLISHED',CURRENT_TIMESTAMP)
      `,[packId,contentHash,JSON.stringify({title:canonical.title,origin:'bundled_seed_repair',previousVersionId:placeholder.id,editorialStatus:'pending_teacher_review'}),payloadString]);
      for(const node of nodes) await client.query(`
        INSERT INTO content_pack_entity_links(id,pack_version_id,entity_type,entity_id,entity_version)
        VALUES($1,'cpv-history-6-grecia-1.0.1','knowledge_node',$2,1)
      `,[crypto.randomUUID(),node.id]);
    }

    // 8. Lote de Ingestão e Staging Inicial
    const includeDemoResearch = options.includeDemoResearch !== false;
    const batchId = 'batch-wd-001';
    if (includeDemoResearch) await client.query(
      `INSERT INTO import_batches (id, provider, started_at, finished_at, records_found, records_imported, records_rejected, records_duplicates, status)
       VALUES ($1, 'Wikidata (SPARQL endpoint)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 50, 3, 2, 1, 'COMPLETED')
       ON CONFLICT (id) DO NOTHING;`,
      [batchId]
    );

    const stagingNodes = [
      {
        id: 'stg-01',
        import_batch_id: batchId,
        source_provider: 'Wikidata',
        external_id: 'Q83494',
        title: 'Pólis',
        slug: 'polis-wikidata',
        type: 'concept',
        short_description: 'Entidade política e administrativa da Grécia Antiga.',
        data_json: { qid: 'Q83494', instance_of: 'city-state' },
        validation_status: 'DUPLICATE',
        duplicate_candidate_id: 'node-polis',
        review_notes: 'Candidato duplicado detectado pelo slug normalizado "polis".'
      },
      {
        id: 'stg-02',
        import_batch_id: batchId,
        source_provider: 'Wikidata',
        external_id: 'Q913',
        title: 'Sócrates',
        slug: 'socrates',
        type: 'person',
        short_description: 'Filósofo ateniense do período clássico (470-399 a.C.).',
        data_json: { qid: 'Q913', field: 'filosofia grega' },
        validation_status: 'NEW',
        duplicate_candidate_id: null,
        review_notes: 'Novo registro pronto para validação e promoção ao Core.'
      },
      {
        id: 'stg-03',
        import_batch_id: batchId,
        source_provider: 'Wikidata',
        external_id: 'Q131390',
        title: 'Guerra do Peloponeso',
        slug: 'guerra-do-peloponeso',
        type: 'event',
        short_description: 'Conflito armado entre a Liga de Delos liderada por Atenas e a Liga do Peloponeso liderada por Esparta.',
        data_json: { qid: 'Q131390', dates: '431 a.C. - 404 a.C.' },
        validation_status: 'NEW',
        duplicate_candidate_id: null,
        review_notes: 'Pronto para aprovação.'
      }
    ];

    for (const stg of includeDemoResearch ? stagingNodes : []) {
      await client.query(
        `INSERT INTO staging_nodes (id, import_batch_id, source_provider, external_id, title, slug, type, short_description, data_json, validation_status, duplicate_candidate_id, review_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (source_provider, external_id) DO NOTHING;`,
        [stg.id, stg.import_batch_id, stg.source_provider, stg.external_id, stg.title, stg.slug, stg.type, stg.short_description, stg.data_json, stg.validation_status, stg.duplicate_candidate_id, stg.review_notes]
      );
    }

    await client.query('COMMIT');

    return {
      licensesCount: licenses.length,
      sourcesCount: sources.length,
      curriculumCount: curriculum.length,
      nodesCount: nodes.length,
      relationsCount: relations.length,
      resourcesCount: resources.length,
      packsCount: 1,
      stagingCount: includeDemoResearch ? stagingNodes.length : 0
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
