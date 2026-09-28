/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — ENSAIOS EM POSTGRESQL REAL (E2)
 * Executa contra instâncias reais descartáveis do PostgreSQL (MSVC x64 nativo).
 * Comprova migrações, idempotência, persistência em disco após encerramento do processo,
 * rollback atômico real, controle de concorrência com conexões simultâneas independentes
 * e exportação/restauração em uma segunda instância PostgreSQL separada.
 * Utiliza o harness isolado de teste em os.tmpdir() com teardown garantido (Bloco 0 item 4).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import crypto from 'crypto';
import { runMigrations } from '../server/db/migrator';
import { UserRepository } from '../server/repositories/userRepository';
import { LessonRepository } from '../server/repositories/lessonRepository';
import { KnowledgeRepository } from '../server/repositories/knowledgeRepository';
import { withTransaction } from '../server/db/pool';
import { exportDatabase, importDatabase } from '../server/db/backup';
import { OptimisticLockError } from '../server/db/types';
import { createDisposablePostgres } from './helpers/realPostgresHarness';

test('E2 (PostgreSQL REAL): Ciclo completo em instâncias reais — migrations, restart, rollback, concorrência e backup entre bancos separados', async (t) => {
  const instanceA = await createDisposablePostgres('pemara-e2-a-');
  const poolA = instanceA.createPool();
  let poolAReopened: pg.Pool | null = null;

  try {
    // 1. Verificação da versão oficial do binário PostgreSQL executando
    const verRes = await poolA.query('SELECT version();');
    console.log('[PostgreSQL Real] Provedor verificado:', verRes.rows[0].version);
    assert.match(verRes.rows[0].version, /PostgreSQL 18/i, 'Deve estar executando binário nativo do PostgreSQL');

    // 2. Migração em banco vazio (5 migrações canônicas: 001, 002, 003, 004 e 005)
    const migResult = await runMigrations(poolA);
    assert.equal(migResult.appliedCount, 6);
    assert.equal(migResult.alreadyAppliedCount, 0);

    // 3. Reaplicação de migrações (Idempotência e Checksum no banco real)
    const migReapply = await runMigrations(poolA);
    assert.equal(migReapply.appliedCount, 0);
    assert.equal(migReapply.alreadyAppliedCount, 6);

    // 4. Teste de Rollback Atômico Real no PostgreSQL
    const userRepoA = new UserRepository(poolA);
    const teacher = await userRepoA.create({
      username: 'prof.helena',
      name: 'Helena Nogueira',
      email: 'helena@escola.local',
      password_hash: 'hashHelena123',
      role: 'teacher',
    });

    let rollbackTriggered = false;
    try {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO lessons (id, owner_id, title, subject_code, grade_level, topic, current_version, status)
           VALUES ($1, $2, 'Aula Cancelada', 'history', '6EF', 'Roma', 1, 'DRAFT');`,
          ['aula-rollback-real', teacher.id]
        );
        throw new Error('Falha proposital para testar rollback nativo do PostgreSQL');
      }, poolA);
    } catch (err: any) {
      rollbackTriggered = true;
      assert.match(err.message, /rollback nativo do PostgreSQL/);
    }

    assert.equal(rollbackTriggered, true);
    const checkRollback = await poolA.query('SELECT * FROM lessons WHERE id = $1;', ['aula-rollback-real']);
    assert.equal(checkRollback.rows.length, 0, 'Rollback nativo do PostgreSQL não permitiu gravação parcial');

    // 5. Gravação de dados duráveis para teste de persistência ao reinício
    const lessonRepoA = new LessonRepository(poolA);
    const createdLesson = await lessonRepoA.createLesson({
      id: 'aula-persiste-reboot',
      ownerId: teacher.id,
      title: 'Grécia Antiga — Prova de Persistência',
      subjectCode: 'history',
      gradeLevel: '6EF',
      topic: 'grecia_antiga',
      spec: {
        schema_version: '1.0',
        lesson_version: 1,
        renderer_version: '1.0.0',
        lesson: {
          id: 'aula-persiste-reboot',
          title: 'Grécia Antiga — Prova de Persistência',
          subject: 'history',
          grade: '6EF',
          topic: 'grecia_antiga',
        },
        title: 'Grécia Antiga',
        scenes: [{ id: 's1', type: 'title', title: 'Pólis de Atenas' }],
      },
    });

    assert.equal(createdLesson.lesson.current_version, 1);

    // 6. Teste de Sobrevivência ao Reinício Real do Processo PostgreSQL
    console.log('[PostgreSQL Real] Encerrando processo do servidor PostgreSQL A (simulando shutdown)...');
    await poolA.end(); // fecha conexões
    await instanceA.stop(); // encerra postgres.exe

    // Aguarda o kernel do Windows desalocar os handles de shared memory do processo encerrado
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('[PostgreSQL Real] Reiniciando processo do servidor PostgreSQL A a partir dos arquivos de disco...');
    await instanceA.start(); // reinicia postgres.exe
    poolAReopened = instanceA.createPool();

    // Verifica que os dados persistiram no disco e estão 100% disponíveis
    const userRepoAReopened = new UserRepository(poolAReopened);
    const lessonRepoAReopened = new LessonRepository(poolAReopened);

    const reloadedTeacher = await userRepoAReopened.findById(teacher.id);
    assert.ok(reloadedTeacher !== null, 'Professor deve persistir após reboot do PostgreSQL');
    assert.equal(reloadedTeacher.username, 'prof.helena');

    const reloadedLesson = await lessonRepoAReopened.getLessonById('aula-persiste-reboot');
    assert.ok(reloadedLesson !== null, 'Aula deve persistir após reboot do PostgreSQL');
    assert.equal(reloadedLesson.current_version, 1);

    // 7. Teste de Concorrência Real com Conexões Simultâneas Independentes
    console.log('[PostgreSQL Real] Testando concorrência real: conexões simultâneas independentes disputando a mesma aula com barreira de sincronização...');
    const poolClient1 = instanceA.createPool();
    const poolClient2 = instanceA.createPool();
    const repo1 = new LessonRepository(poolClient1);
    const repo2 = new LessonRepository(poolClient2);

    let releaseBarrier: () => void;
    const barrierPromise = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    const promise1 = repo1.updateLessonOptimistic({
      lessonId: 'aula-persiste-reboot',
      expectedVersion: 1,
      actorId: teacher.id,
      title: 'Grécia Atualizada por Cliente 1',
      spec: {
        schema_version: '1.0',
        lesson_version: 2,
        renderer_version: '1.0.0',
        lesson: { id: 'aula-persiste-reboot', title: 'Grécia Atualizada por Cliente 1' },
        scenes: [{ id: 's1', type: 'title', title: 'Atenas V2' }],
      },
      beforeCommitHook: async () => {
        // Pausa intencional da conexão 1 enquanto segura o lock da linha
        await new Promise((resolve) => setTimeout(resolve, 100));
        releaseBarrier();
      },
    });

    const promise2 = (async () => {
      await barrierPromise;
      return repo2.updateLessonOptimistic({
        lessonId: 'aula-persiste-reboot',
        expectedVersion: 1,
        actorId: teacher.id,
        title: 'Grécia Atualizada por Cliente 2',
        spec: {
          schema_version: '1.0',
          lesson_version: 2,
          renderer_version: '1.0.0',
          lesson: { id: 'aula-persiste-reboot', title: 'Grécia Atualizada por Cliente 2' },
          scenes: [{ id: 's1', type: 'title', title: 'Esparta V2' }],
        },
      });
    })();

    const [res1, res2] = await Promise.allSettled([promise1, promise2]);
    await poolClient1.end();
    await poolClient2.end();

    assert.equal(res1.status, 'fulfilled', 'Conexão 1 deve comitar a versão 2 com sucesso');
    assert.equal(res2.status, 'rejected', 'Conexão 2 deve falhar com conflito de concorrência');

    const err2 = (res2 as PromiseRejectedResult).reason;
    assert.ok(err2 instanceof OptimisticLockError, 'Erro deve ser do tipo OptimisticLockError');
    assert.equal(err2.expectedVersion, 1, 'Esperava versão 1');
    assert.equal(err2.actualVersion, 2, 'Versão real no banco já avançou para 2');

    // 8. Teste de Deduplicação Transacional Simultânea no PostgreSQL Real
    console.log('[PostgreSQL Real] Testando promoção concorrente de staging por conexões independentes simultâneas...');
    const knowledgeRepoA = new KnowledgeRepository(poolAReopened);
    const batch = await knowledgeRepoA.createImportBatch('wikidata');

    const stagingA = await knowledgeRepoA.insertStagingNode({
      importBatchId: batch.id,
      sourceProvider: 'wikidata',
      externalId: 'Q-ATENAS-REAL',
      title: 'Atenas Antiga Real',
      slug: 'atenas-antiga-real',
      type: 'concept',
      shortDescription: 'Pólis grega pioneira na democracia.',
      dataJson: { period: 'Clássico' },
      validationStatus: 'VALID',
    });

    const stagingB = await knowledgeRepoA.insertStagingNode({
      importBatchId: batch.id,
      sourceProvider: 'wikidata',
      externalId: 'Q-ATENAS-REAL-DUP',
      title: 'Atenas Antiga Real Duplicada',
      slug: 'atenas-antiga-real', // Mesmo slug
      type: 'concept',
      shortDescription: 'Duplicata intencional.',
      dataJson: { period: 'Clássico' },
      validationStatus: 'VALID',
    });

    const poolDedup1 = instanceA.createPool();
    const poolDedup2 = instanceA.createPool();
    const repoDedup1 = new KnowledgeRepository(poolDedup1);
    const repoDedup2 = new KnowledgeRepository(poolDedup2);

    let resolveBarrier1: () => void = () => {};
    const barrier1 = new Promise<void>((r) => { resolveBarrier1 = r; });
    let resolveBarrier2: () => void = () => {};
    const barrier2 = new Promise<void>((r) => { resolveBarrier2 = r; });

    const [promo1, promo2] = await Promise.allSettled([
      repoDedup1.approveStagingNode(stagingA.id, teacher.id, {
        subjectCode: 'history',
        gradeLevel: 6,
        beforeCommitHook: async () => {
          resolveBarrier1();
          await barrier2;
        },
      }),
      repoDedup2.approveStagingNode(stagingB.id, teacher.id, {
        subjectCode: 'history',
        gradeLevel: 6,
        beforeCommitHook: async () => {
          await barrier1;
          resolveBarrier2();
        },
      }),
    ]);

    await poolDedup1.end();
    await poolDedup2.end();

    assert.equal(promo1.status, 'fulfilled', 'Promoção 1 deve ser concluída');
    assert.equal(promo2.status, 'fulfilled', 'Promoção 2 deve ser concluída');

    const promoRes1 = (promo1 as PromiseFulfilledResult<any>).value;
    const promoRes2 = (promo2 as PromiseFulfilledResult<any>).value;

    // Um foi criação primária e o outro foi deduplicação
    const handledFlags = [promoRes1.duplicateHandled, promoRes2.duplicateHandled];
    assert.ok(handledFlags.includes(false), 'Exatamente uma chamada deve realizar a criação inicial');
    assert.ok(handledFlags.includes(true), 'A chamada concorrente deve realizar a deduplicação idempotente');

    // Ambas retornam o exato mesmo nó canônico
    assert.equal(promoRes1.node.id, promoRes2.node.id, 'Ambas as chamadas devem retornar o mesmo ID canônico');
    assert.equal(promoRes1.node.slug, 'atenas-antiga-real', 'Slug canônico deve ser atenas-antiga-real');

    const checkUniqueSlug = await poolAReopened.query('SELECT COUNT(*)::int AS count FROM knowledge_nodes WHERE slug = $1;', ['atenas-antiga-real']);
    assert.equal(checkUniqueSlug.rows[0].count, 1, 'Exatamente 1 nó com slug único foi gravado');

    // Confere coerência do staging: um APPROVED e um DUPLICATE apontando para o nó canônico
    const stagingCheck = await poolAReopened.query(
      'SELECT id, validation_status, duplicate_candidate_id FROM staging_nodes WHERE id IN ($1, $2);',
      [stagingA.id, stagingB.id]
    );
    const stagingStatuses = stagingCheck.rows.map((r: any) => r.validation_status).sort();
    assert.deepEqual(stagingStatuses, ['APPROVED', 'DUPLICATE'], 'Um item de staging deve ser APPROVED e o outro DUPLICATE');
    const duplicateRow = stagingCheck.rows.find((r: any) => r.validation_status === 'DUPLICATE');
    assert.equal(duplicateRow.duplicate_candidate_id, promoRes1.node.id, 'Item duplicado deve apontar para o nó canônico');

    // 9. Exportar Backup Consistente da Instância A
    console.log('[PostgreSQL Real] Exportando backup consistente do PostgreSQL A...');
    const backupEnvelope = await exportDatabase(poolAReopened);
    assert.ok(backupEnvelope.content_hash.length === 64);
    assert.equal(backupEnvelope.table_counts.users >= 1, true);
    assert.equal(backupEnvelope.table_counts.lessons >= 1, true);
    assert.equal(backupEnvelope.table_counts.lesson_revisions >= 2, true);

    // Encerra completamente Banco A antes de subir Banco B (isolamento total entre instâncias)
    console.log('[PostgreSQL Real] Encerrando completamente Banco A antes de inicializar Banco B...');
    await poolAReopened.end();
    poolAReopened = null;
    await instanceA.cleanup();

    // 10. Inicializar uma SEGUNDA Instância de PostgreSQL Real (Banco B)
    console.log('[PostgreSQL Real] Inicializando SEGUNDA instância de PostgreSQL (Banco B)...');
    const instanceB = await createDisposablePostgres('pemara-e2-b-');
    const poolB = instanceB.createPool();

    try {
      // Aplica migrações na instância B com inicialização concorrente simultânea em banco vazio
      console.log('[PostgreSQL Real] Testando inicialização concorrente de migrações no Banco B (banco vazio)...');
      const poolB_Mig1 = instanceB.createPool();
      const poolB_Mig2 = instanceB.createPool();
      const [bMig1, bMig2] = await Promise.allSettled([
        runMigrations(poolB_Mig1),
        runMigrations(poolB_Mig2),
      ]);
      await poolB_Mig1.end();
      await poolB_Mig2.end();

      assert.equal(bMig1.status, 'fulfilled', 'Migração concorrente 1 em banco limpo deve cumprir');
      assert.equal(bMig2.status, 'fulfilled', 'Migração concorrente 2 em banco limpo deve cumprir');
      const bRes1 = (bMig1 as PromiseFulfilledResult<any>).value;
      const bRes2 = (bMig2 as PromiseFulfilledResult<any>).value;
      assert.equal(bRes1.appliedCount + bRes2.appliedCount, 6, 'Exatamente as 6 migrações são aplicadas');
      assert.equal(bRes1.alreadyAppliedCount + bRes2.alreadyAppliedCount, 6, 'A outra detecta já aplicada');

      // Restaura o backup da instância A na instância B
      console.log('[PostgreSQL Real] Restaurando envelope do Banco A no Banco B...');
      const restoreRes = await importDatabase(poolB, backupEnvelope, { confirmDestructiveRestore: true });
      assert.equal(restoreRes.success, true);
      assert.equal(restoreRes.tablesRestored.users, backupEnvelope.table_counts.users);
      assert.equal(restoreRes.tablesRestored.lessons, backupEnvelope.table_counts.lessons);

      // Conferir dados no Banco B
      const userRepoB = new UserRepository(poolB);
      const lessonRepoB = new LessonRepository(poolB);

      const bTeacher = await userRepoB.findById(teacher.id);
      assert.ok(bTeacher !== null);
      assert.equal(bTeacher.username, 'prof.helena');

      const bLesson = await lessonRepoB.getLessonById('aula-persiste-reboot');
      assert.ok(bLesson !== null);
      assert.equal(bLesson.title, 'Grécia Atualizada por Cliente 1');
      assert.equal(bLesson.current_version, 2);

      const bRevs = await lessonRepoB.listLessonRevisions('aula-persiste-reboot');
      assert.equal(bRevs.length, 2, 'Banco B deve conter exatamente as duas revisões restauradas');
      assert.equal(bRevs[0].version, 2);
      assert.equal(bRevs[1].version, 1);

      console.log('[PostgreSQL Real] Todos os testes no PostgreSQL real foram aprovados com sucesso!');
    } finally {
      await instanceB.cleanup();
    }
  } finally {
    if (poolAReopened) {
      try {
        await poolAReopened.end();
      } catch (_) {}
    }
    await instanceA.cleanup();
  }
});
