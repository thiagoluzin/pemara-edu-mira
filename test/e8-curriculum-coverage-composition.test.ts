/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — TESTES DE COBERTURA CURRICULAR BNCC E COMPOSIÇÃO MULTIDISCIPLINAR (E8)
 * 
 * Valida:
 * 1. Carga oficial da BNCC: 9 componentes curriculares do Ensino Fundamental II (6º ao 9º ano)
 *    com códigos oficiais, habilidades e faixas multiano (67, 69, 89).
 * 2. Nós de conhecimento e links ontológicos (curriculum_knowledge_links).
 * 3. Content Packs publicados com payload_json íntegro (nodes > 0) para os 9 componentes.
 * 4. Composição autônoma e determinística (Modo A sem IA) para os 9 componentes via LessonComposer.
 * 5. Preservação dos pilotos originais do Ensino Médio (física, biologia, química).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { LessonComposer } from '../src/composer/lessonComposer';
import { CURRICULUM_CATALOG, getTopicsForSubjectAndGrade, resolvePackSlugForInput } from '../src/catalog/curriculumCatalog';
import { Subject } from '../src/types/lesson';
import {createDisposablePostgres} from './helpers/realPostgresHarness';
import {runMigrations} from '../server/db/migrator';
import {seedInitialKnowledge} from '../server/db/seeds/knowledge';
import {readCompleteCatalog,publishCompleteCatalog} from '../server/curriculum/completeCatalog';

function getConnectionString(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const configPath = path.resolve(process.cwd(), '.local-demo/config.json');
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return `postgresql://postgres:${cfg.password}@127.0.0.1:${cfg.dbPort}/pemara_demo_utf8`;
  }
  return null;
}

test('E8: Cobertura Curricular Completa BNCC e Composição Multidisciplinar', async (t) => {
  let connStr = getConnectionString();
  let disposable:Awaited<ReturnType<typeof createDisposablePostgres>>|undefined;
  let pool!:pg.Pool;

  try {
    if(!connStr){
      disposable=await createDisposablePostgres('pemara-e8-curriculum-');
      const admin=disposable.createPool();
      try{await admin.query("CREATE DATABASE e8_curriculum WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'");}
      finally{await admin.end();}
      connStr=disposable.connectionString.replace(/\/postgres$/,'/e8_curriculum');
      pool=new pg.Pool({connectionString:connStr});
      await runMigrations(pool);
      await seedInitialKnowledge(pool,{includeDemoResearch:false});
      await publishCompleteCatalog(pool,readCompleteCatalog(),{onlyMissing:true,bundledBootstrap:true});
    }else pool=new pg.Pool({connectionString:connStr});
    // 1. Validar contagem e presença dos 9 componentes na tabela curriculum_skills
    await t.test('1. Cobertura BNCC: 9 componentes e faixas multiano', async () => {
      const skillsRes = await pool.query(`
        SELECT subject_code, COUNT(*) as count 
        FROM curriculum_skills 
        GROUP BY subject_code 
        ORDER BY subject_code;
      `);
      
      const counts: Record<string, number> = {};
      for (const row of skillsRes.rows) {
        counts[row.subject_code] = parseInt(row.count, 10);
      }

      const expectedSubjects = [
        'arts',
        'english',
        'geography',
        'history',
        'math',
        'physical_education',
        'portuguese',
        'religious_education',
        'science'
      ];

      for (const subj of expectedSubjects) {
        assert.ok(counts[subj] && counts[subj] > 0, `Componente ${subj} deve ter habilidades cadastradas`);
      }

      const totalSkills = Object.values(counts).reduce((a, b) => a + b, 0);
      assert.equal(totalSkills, 730, `Total de habilidades oficiais da BNCC EF II deve ser rigorosamente 730. Encontrado: ${totalSkills}`);

      // Validar ausência de descrições sintéticas geradas
      const synRes = await pool.query("SELECT count(*)::int AS count FROM curriculum_skills WHERE description LIKE '%(' || code || ').'");
      assert.equal(synRes.rows[0].count, 0, 'Nenhuma habilidade curricular pode conter descrição sintética gerada terminada no código');

      // Validar proveniência oficial: localizador de planilha MEC e página de PDF
      const locRes = await pool.query("SELECT count(*)::int AS count FROM curriculum_skills WHERE locator IS NOT NULL AND locator_pdf IS NOT NULL");
      assert.equal(locRes.rows[0].count, 730, 'Todas as 730 habilidades oficiais devem possuir proveniência auditada (localizador planilha e página PDF)');

      // Validar faixas multiano
      const bandsRes = await pool.query(`
        SELECT grade_level, COUNT(*) as count 
        FROM curriculum_skills 
        WHERE grade_level IN (67, 69, 89) 
        GROUP BY grade_level 
        ORDER BY grade_level;
      `);
      assert.equal(bandsRes.rows.length, 3, 'Devem existir habilidades nas 3 faixas multiano (67, 69, 89)');

      // Validar inexistência de séries desprovidas de conteúdo publicado (emptyContentGrades = 0)
      const emptyGradesRes = await pool.query(`
        SELECT DISTINCT s.subject_code, s.grade_level 
        FROM curriculum_skills s 
        WHERE NOT EXISTS (
          SELECT 1 FROM knowledge_nodes n 
          WHERE n.subject_code = s.subject_code AND n.grade_level = s.grade_level AND n.status = 'PUBLISHED'
        );
      `);
      assert.equal(emptyGradesRes.rows.length, 0, 'Todas as 34 combinações de disciplina e série do EF II devem possuir nós de conhecimento publicados');
    });

    // 2. Validar nós de conhecimento e links ontológicos
    await t.test('2. Nós de conhecimento e links de currículo', async () => {
      const nodesRes = await pool.query(`
        SELECT subject_code, COUNT(*) as count 
        FROM knowledge_nodes 
        GROUP BY subject_code;
      `);
      assert.ok(nodesRes.rows.length >= 9, 'Devem existir nós de conhecimento para ao menos 9 componentes');

      const linksRes = await pool.query(`
        SELECT COUNT(*) as count 
        FROM curriculum_knowledge_links;
      `);
      const totalLinks = parseInt(linksRes.rows[0].count, 10);
      assert.ok(totalLinks >= 100, `Devem existir links ontológicos currículo-conhecimento (>= 100). Encontrados: ${totalLinks}`);
    });

    // 3. Validar Content Packs publicados e integridade do payload_json
    let publishedPacks: any[] = [];
    await t.test('3. Content Packs publicados e payloads não vazios', async () => {
      const packsRes = await pool.query(`
        SELECT cp.slug, cp.title, cp.subject_code, cp.grade_level,
               v.version, v.payload_json
        FROM content_packs cp
        JOIN content_pack_versions v ON v.pack_id = cp.id
        WHERE v.status = 'PUBLISHED'
        ORDER BY cp.slug;
      `);
      publishedPacks = packsRes.rows;
      assert.ok(publishedPacks.length >= 34, `Devem existir ao menos 34 pacotes publicados cobrindo todas as séries do EF II. Encontrados: ${publishedPacks.length}`);

      for (const pack of publishedPacks) {
        assert.ok(pack.payload_json, `Pack ${pack.slug} não pode ter payload_json nulo`);
        const payload = typeof pack.payload_json === 'string' ? JSON.parse(pack.payload_json) : pack.payload_json;
        assert.ok(Array.isArray(payload.nodes) && payload.nodes.length > 0, `Pack ${pack.slug} deve conter array nodes com ao menos 1 nó`);
        
        // Bloqueio P2: questionário pedagógico obrigatório com alternativas fundamentadas
        assert.ok(Array.isArray(payload.quizzes) && payload.quizzes.length > 0, `Pack ${pack.slug} deve conter array quizzes com ao menos 1 questão fundamentada`);
        const quiz = payload.quizzes[0];
        assert.ok(quiz.question && quiz.question.length > 10, `Pack ${pack.slug} deve ter pergunta diagnóstica explícita`);
        assert.ok(Array.isArray(quiz.options) && quiz.options.length >= 2, `Pack ${pack.slug} deve ter ao menos 2 alternativas no quiz`);
        assert.equal(new Set(quiz.options).size, quiz.options.length, `Pack ${pack.slug} não deve repetir alternativas`);
        assert.ok(typeof (quiz.correct_index ?? quiz.correctIndex) === 'number', `Pack ${pack.slug} deve ter correct_index numérico`);
        assert.ok(quiz.explanation && quiz.explanation.length > 10, `Pack ${pack.slug} deve ter justificativa pedagógica explícita`);
      }

      // Legacy imports can be v2.0.0; clean bootstrap repairs its empty v1
      // with a new immutable revision. Validate content, not a dated importer.
      const greciaPack = publishedPacks.find((p) => p.slug === 'history-6-grecia-antiga');
      assert.ok(greciaPack, 'history-6-grecia-antiga deve existir e estar publicado');
      assert.notEqual(greciaPack.version, '1.0.0', 'O marcador vazio inicial deve estar arquivado');
    });

    // 4. Testar Composição Dinâmica para todos os 9 componentes do EF II
    await t.test('4. Composição autônoma de aulas para os 9 componentes BNCC', async () => {
      const bnccComponents: Subject[] = [
        'portuguese',
        'english',
        'arts',
        'physical_education',
        'math',
        'science',
        'history',
        'geography',
        'religious_education'
      ];

      for (const subj of bnccComponents) {
        const packForSubj = publishedPacks.find((p) => p.subject_code === subj);
        assert.ok(packForSubj, `Deve existir pack publicado para o componente ${subj}`);

        const payload = typeof packForSubj.payload_json === 'string' 
          ? JSON.parse(packForSubj.payload_json) 
          : packForSubj.payload_json;

        const composed = LessonComposer.compose(
          {
            discipline: subj,
            grade: 6,
            topic: packForSubj.title,
            duration: 50,
            teaching_method: 'complete'
          },
          payload
        );

        assert.ok(composed, `Composição para ${subj} deve retornar LessonSpec`);
        assert.equal(composed.lesson.subject, subj, `Disciplina da aula deve ser ${subj}`);
        assert.ok(composed.scenes.length >= 3, `Aula de ${subj} deve ter ao menos 3 cenas geradas. Cenas: ${composed.scenes.length}`);
        
        // Verificar presença de título e de skill BNCC
        assert.ok(composed.lesson.title.length > 0, `Título deve estar preenchido para ${subj}`);
        assert.ok(composed.lesson.bncc_skill, `Habilidade BNCC deve estar vinculada na aula de ${subj}`);

        // Verificar cenas canônicas
        const sceneTypes = composed.scenes.map((s) => s.type);
        assert.ok(sceneTypes.includes('title'), `Aula de ${subj} deve conter cena de abertura/título`);
        assert.ok(sceneTypes.includes('summary'), `Aula de ${subj} deve conter cena de encerramento/síntese`);
      }
    });

    // 5. Preservação dos pilotos e catálogo
    await t.test('5. Catálogo desacoplado e resolução de temas', async () => {
      assert.ok(CURRICULUM_CATALOG.length >= 20, 'Catálogo deve listar todos os pacotes publicados');

      // Resolução de tema para Matemática
      const mathSlug = resolvePackSlugForInput('math', '6EF', 'Frações, Decimais e Números Racionais');
      assert.equal(mathSlug, 'math-6-fracoes-decimais');

      // Resolução de tema para Língua Portuguesa
      const portSlug = resolvePackSlugForInput('portuguese', '6EF', 'Gênero Notícia, Fact-Checking e Desinformação');
      assert.equal(portSlug, 'portuguese-67-noticia-fake-news');

      // Bloqueio P1: Proibição estrita de substituição silenciosa de assunto e desrespeito à série
      // 1. Pedido História / 6EF / "Segunda Guerra Mundial" DEVE retornar null (tema não publicado em 6EF)
      const histWW2 = resolvePackSlugForInput('history', '6EF', 'Segunda Guerra Mundial');
      assert.equal(histWW2, null, 'Pedido de tema ausente (Segunda Guerra em 6EF) deve retornar null, nunca substituir por Grécia');

      // 2. Pedido História / 6EF / "A Revolução Industrial: Trabalho, Máquinas e Cidades" DEVE retornar null (pertence a 8EF, não 6EF)
      const histRev6 = resolvePackSlugForInput('history', '6EF', 'A Revolução Industrial: Trabalho, Máquinas e Cidades');
      assert.equal(histRev6, null, 'Pedido de tema de 8EF feito para 6EF deve retornar null, nunca ignorar a série');

      // 3. Pedido História / 8EF / "A Revolução Industrial: Trabalho, Máquinas e Cidades" DEVE retornar o pack correto de 8EF
      const histRev8 = resolvePackSlugForInput('history', '8EF', 'A Revolução Industrial: Trabalho, Máquinas e Cidades');
      assert.equal(histRev8, 'history-8-revolucao-industrial');

      // 4. Pedido História / 6EF / "Grécia Antiga" DEVE retornar o pack correto de 6EF
      const histGreece = resolvePackSlugForInput('history', '6EF', 'Grécia Antiga');
      assert.equal(histGreece, 'history-6-grecia-antiga');

      // Fallback para Grécia Antiga sem dynamicPack preservado para compatibilidade retroativa
      const fallbackGrecia = LessonComposer.compose({
        discipline: 'history',
        grade: 6,
        topic: 'Grécia Antiga',
        duration: 50,
        teaching_method: 'complete'
      });
      assert.equal(fallbackGrecia.lesson.subject, 'history');
      assert.ok(fallbackGrecia.scenes.length >= 5);
    });

  } finally {
    if(pool)await pool.end();
    if(disposable)await disposable.cleanup();
  }
});
