/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — TESTES DE PUBLICAÇÃO HTTP E COMPOSIÇÃO DE AULA (B4 / E3)
 * Integrado à suíte oficial npm test.
 * Valida com servidor Express e banco isolado:
 * 1. Publicação de Content Pack via rota HTTP com autor da sessão.
 * 2. Registro em activity_history com UUID do ator real (sem 'system').
 * 3. Publicações sucessivas v1 e v2 com arquivamento da anterior e hashes distintos.
 * 4. Composição conectada ao pack ativo do banco de dados.
 * 5. Rejeição explícita com 404 (PACK_NOT_FOUND) quando o pacote não existe.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { createDisposablePostgres } from './helpers/realPostgresHarness';
import { runMigrations } from '../server/db/migrator';
import { seedInitialUsers } from '../server/db/seeds/users';
import { seedInitialKnowledge } from '../server/db/seeds/knowledge';
import { createAuthMiddleware } from '../server/auth/middleware';
import { createAuthRouter } from '../server/routes/auth';
import { createKnowledgeRouter } from '../server/routes/knowledge';
import { createLessonsRouter } from '../server/routes/lessons';

test('E3: Publicação de Content Pack via rota HTTP, autoria na auditoria e composição de aula', async () => {
  const instance = await createDisposablePostgres('pemara-test-pub-');
  const pool = instance.createPool();
  let server: http.Server | undefined;

  try {
    await runMigrations(pool);
    await seedInitialUsers(pool);
    await seedInitialKnowledge(pool);

    const app = express();
    app.use(express.json());
    app.use(createAuthMiddleware(pool));
    app.use('/api/auth', createAuthRouter(pool));
    app.use('/api/knowledge', createKnowledgeRouter(pool));
    app.use('/api/lessons', createLessonsRouter(pool));

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;
    const base = `http://127.0.0.1:${port}`;

    // 1. Login como admin
    const adminLoginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });
    assert.equal(adminLoginRes.status, 200);
    const adminCookie = adminLoginRes.headers.get('set-cookie')!.split(';')[0];
    const adminData = await adminLoginRes.json();
    const adminId = adminData.user.id;

    // 2. Login como professor
    const teacherLoginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'prof.helena', password: 'helena123' }),
    });
    assert.equal(teacherLoginRes.status, 200);
    const teacherCookie = teacherLoginRes.headers.get('set-cookie')!.split(';')[0];

    // 3. Publicar v1 via rota HTTP como admin
    const pubV1Res = await fetch(`${base}/api/knowledge/packs/history-6-grecia-antiga/publish-version`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: '1' }),
    });
    assert.equal(pubV1Res.status, 200, 'Publicação HTTP v1 deve retornar 200');
    const pubV1Data = await pubV1Res.json();
    assert.equal(String(pubV1Data.version.version), '1');
    const hashV1 = pubV1Data.version.content_hash;
    assert.ok(hashV1 && hashV1.length === 64, 'Hash v1 deve ser SHA-256');

    // 4. Conferir auditoria: ator deve ser o UUID do admin
    const auditRes = await pool.query(
      `SELECT * FROM activity_history WHERE entity_type = 'pack' AND action = 'PACK_VERSION_PUBLISHED' ORDER BY created_at DESC LIMIT 1;`
    );
    assert.equal(auditRes.rows.length, 1);
    assert.equal(auditRes.rows[0].actor_id, adminId, 'Auditoria deve registrar o ID real do administrador');

    // 5. Professor compõe aula com o pack v1 publicado
    const compose1Res = await fetch(`${base}/api/knowledge/compose-lesson`, {
      method: 'POST',
      headers: { Cookie: teacherCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packSlug: 'history-6-grecia-antiga',
        composerInput: {
          discipline: 'history',
          grade: 6,
          topic: 'grecia_antiga',
          duration: 45,
          teaching_method: 'complete',
        },
      }),
    });
    assert.equal(compose1Res.status, 200);
    const compose1Data = await compose1Res.json();
    assert.equal(String(compose1Data.packVersion), '1');
    assert.equal(compose1Data.contentHash, hashV1);

    // Grava aula 1
    const save1Res = await fetch(`${base}/api/lessons`, {
      method: 'POST',
      headers: { Cookie: teacherCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: compose1Data.lesson.lesson.title,
        subjectCode: compose1Data.lesson.lesson.subject,
        gradeLevel: compose1Data.lesson.lesson.grade,
        topic: compose1Data.lesson.lesson.topic,
        spec: compose1Data.lesson,
      }),
    });
    assert.equal(save1Res.status, 201);
    const savedLesson1 = await save1Res.json();
    const lesson1Id = savedLesson1.lesson.id;

    // 6. Atualizar nó Atenas no banco e publicar v2 via HTTP
    await pool.query(
      `UPDATE knowledge_nodes
       SET data_json = jsonb_set(COALESCE(data_json, '{}'::jsonb), '{deep_description}', '"Texto de Atenas Atualizado no Banco"'::jsonb),
           version = version + 1
       WHERE id = 'node-atenas';`
    );

    const pubV2Res = await fetch(`${base}/api/knowledge/packs/history-6-grecia-antiga/publish-version`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: '2' }),
    });
    assert.equal(pubV2Res.status, 200);
    const pubV2Data = await pubV2Res.json();
    assert.equal(String(pubV2Data.version.version), '2');
    const hashV2 = pubV2Data.version.content_hash;
    assert.notEqual(hashV2, hashV1, 'Hash do pack v2 deve ser diferente de v1');

    // Versão 1 deve estar arquivada e versão 2 publicada
    const versCheck = await pool.query(
      `SELECT version, status FROM content_pack_versions WHERE pack_id = $1 ORDER BY created_at ASC;`,
      [pubV2Data.version.pack_id]
    );
    const v1Row = versCheck.rows.find((r) => r.version === '1');
    const v2Row = versCheck.rows.find((r) => r.version === '2');
    assert.equal(v1Row?.status, 'ARCHIVED');
    assert.equal(v2Row?.status, 'PUBLISHED');

    // 7. Compor aula 2 com pack v2
    const compose2Res = await fetch(`${base}/api/knowledge/compose-lesson`, {
      method: 'POST',
      headers: { Cookie: teacherCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packSlug: 'history-6-grecia-antiga',
        composerInput: {
          discipline: 'history',
          grade: 6,
          topic: 'grecia_antiga',
          duration: 45,
          teaching_method: 'complete',
        },
      }),
    });
    assert.equal(compose2Res.status, 200);
    const compose2Data = await compose2Res.json();
    assert.equal(String(compose2Data.packVersion), '2');
    assert.equal(compose2Data.contentHash, hashV2);
    const atenasSceneV2 = compose2Data.lesson.scenes.find((s: any) => s.id === 'scene-05-atenas');
    assert.ok(atenasSceneV2.content[0].includes('Texto de Atenas Atualizado no Banco'));

    // 8. Verificar que a aula 1 permaneceu 100% inalterada
    const getLesson1Res = await fetch(`${base}/api/lessons/${lesson1Id}`, {
      headers: { Cookie: teacherCookie },
    });
    assert.equal(getLesson1Res.status, 200);
    const lesson1Data = await getLesson1Res.json();
    const atenasSceneV1 = lesson1Data.currentSpec.scenes.find((s: any) => s.id === 'scene-05-atenas');
    assert.ok(!atenasSceneV1.content[0].includes('Texto de Atenas Atualizado no Banco'), 'Aula 1 não deve sofrer mutação retrógrada');

    // 9. Ausência de pacote retorna HTTP 404 explícito (sem fixture silenciosa)
    const missingRes = await fetch(`${base}/api/knowledge/compose-lesson`, {
      method: 'POST',
      headers: { Cookie: teacherCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packSlug: 'pack-inexistente',
        composerInput: {
          discipline: 'history',
          grade: 6,
          topic: 'grecia_antiga',
          duration: 45,
          teaching_method: 'complete',
        },
      }),
    });
    assert.equal(missingRes.status, 404);
    const missingBody = await missingRes.json();
    assert.equal(missingBody.code, 'PACK_NOT_FOUND');
  } finally {
    if (server) await new Promise<void>((r) => server!.close(() => r()));
    await pool.end();
    await instance.cleanup();
  }
});
