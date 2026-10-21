/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — SUÍTE DE TESTES E EVIDÊNCIAS DE INTEGRIDADE RELACIONAL (E2)
 * Valida migrações SQL, idempotência, atomicidade transacional,
 * controle de concorrência otimista (409), deduplicação, snapshots imutáveis,
 * proteção do acervo autoral e backup/restauração em emulador isolado.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { createPool, withTransaction } from '../server/db/pool';
import { runMigrations } from '../server/db/migrator';
import { UserRepository } from '../server/repositories/userRepository';
import { LessonRepository } from '../server/repositories/lessonRepository';
import { KnowledgeRepository } from '../server/repositories/knowledgeRepository';
import { PackRepository } from '../server/repositories/packRepository';
import { AuditRepository } from '../server/repositories/auditRepository';
import { exportDatabase, importDatabase } from '../server/db/backup';
import { OptimisticLockError } from '../server/db/types';

test('E2 (emulador pg-mem): Migrar banco vazio aplica todas as tabelas canônicas e registra schema_migrations', async () => {
  const { pool } = createPool({ forceMemory: true });

  const result = await runMigrations(pool);
  assert.ok(result.appliedCount >= 1, 'Ao menos uma migração canônica deve ter sido aplicada');
  assert.equal(result.alreadyAppliedCount, 0, 'Nenhuma migração deveria existir previamente no banco vazio');

  // Verifica tabela de controle de migração
  const migRes = await pool.query('SELECT * FROM schema_migrations ORDER BY version ASC;');
  assert.equal(migRes.rows.length, 8);
  assert.equal(migRes.rows[0].version, '001');
  assert.equal(migRes.rows[1].version, '002');
  assert.equal(migRes.rows[2].version, '003');
  assert.equal(migRes.rows[3].version, '004');
  assert.equal(migRes.rows[4].version, '005');
  assert.equal(migRes.rows[5].version, '006');
  assert.equal(migRes.rows[6].version, '007');
  assert.equal(migRes.rows[7].version, '008');

  // Verifica tabelas essenciais criadas
  const checkTables = [
    'users',
    'sessions',
    'lessons',
    'lesson_revisions',
    'lesson_drafts',
    'generation_attempts',
    'activity_history',
    'sources',
    'licenses',
    'curriculum_skills',
    'knowledge_nodes',
    'knowledge_relations',
    'staging_nodes',
    'entity_versions',
    'content_packs',
    'content_pack_versions',
  ];

  for (const tbl of checkTables) {
    const res = await pool.query(`SELECT 1 FROM ${tbl} LIMIT 1;`);
    assert.ok(res !== undefined, `Tabela ${tbl} deve existir e ser consultável`);
  }
});

test('E2 (emulador pg-mem): Reaplicar migrações é idempotente e não duplica tabelas nem altera dados existentes', async () => {
  const { pool } = createPool({ forceMemory: true });

  // Primeira execução
  const res1 = await runMigrations(pool);
  assert.equal(res1.appliedCount, 8);

  // Inserir um dado de teste
  const userRepo = new UserRepository(pool);
  const teacher = await userRepo.create({
    username: 'prof.carlos',
    name: 'Carlos Alberto',
    email: 'carlos@escola.local',
    password_hash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
    role: 'teacher',
  });

  // Segunda execução
  const res2 = await runMigrations(pool);
  assert.equal(res2.appliedCount, 0, 'Segunda execução não deve reaplicar migrações');
  assert.equal(res2.alreadyAppliedCount, 8, 'Deve identificar que as 8 migrações já foram aplicadas');

  // Dados anteriores permanecem intactos
  const fetched = await userRepo.findById(teacher.id);
  assert.equal(fetched?.username, 'prof.carlos');
});

test('E2 (emulador pg-mem): Atomicidade transacional: falha na operação causa rollback completo sem gravação parcial', async () => {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);

  const userRepo = new UserRepository(pool);
  const teacher = await userRepo.create({
    username: 'prof.mariana',
    name: 'Mariana Lima',
    email: 'mariana@escola.local',
    password_hash: 'hash123',
  });

  // Tentativa de transação que falha intencionalmente após gravar na primeira tabela
  let errorCaught = false;
  try {
    await withTransaction(async (client) => {
      // 1. Grava uma aula
      await client.query(
        `INSERT INTO lessons (id, owner_id, title, subject_code, grade_level, topic, current_version, status)
         VALUES ($1, $2, 'Aula Fantasma', 'history', '6EF', 'Grécia', 1, 'DRAFT');`,
        ['aula-fantasma-1', teacher.id]
      );

      // 2. Simula erro inesperado no meio do pipeline
      throw new Error('Falha simulada de integridade ou quota antes do commit');
    }, pool);
  } catch (err: any) {
    errorCaught = true;
    assert.equal(err.message, 'Falha simulada de integridade ou quota antes do commit');
  }

  assert.equal(errorCaught, true, 'O erro deve ter sido capturado');

  // Verifica que a aula NÃO existe no banco (rollback bem-sucedido)
  const lessonCheck = await pool.query('SELECT * FROM lessons WHERE id = $1;', ['aula-fantasma-1']);
  assert.equal(lessonCheck.rows.length, 0, 'A aula não pode ter sido gravada no banco após falha da transação');
});

test('E2 (emulador pg-mem): Concorrência otimista (optimistic locking): duas alterações com mesma versão geram 1 sucesso e 1 erro 409', async () => {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);

  const userRepo = new UserRepository(pool);
  const lessonRepo = new LessonRepository(pool);

  const teacher = await userRepo.create({
    username: 'prof.roberto',
    name: 'Roberto Souza',
    email: 'roberto@escola.local',
    password_hash: 'hash456',
  });

  // Criação inicial da aula (versão 1)
  const initial = await lessonRepo.createLesson({
    ownerId: teacher.id,
    title: 'Grécia Antiga: Pólis e Democracia',
    subjectCode: 'history',
    gradeLevel: '6EF',
    topic: 'grecia_antiga',
    spec: { title: 'Versão 1 da Aula', scenes: [{ id: 's1', type: 'title', title: 'Atenas' }] },
  });

  assert.equal(initial.lesson.current_version, 1);
  assert.equal(initial.revision.version, 1);

  // Cliente A e Cliente B leem a aula na versão 1 ao mesmo tempo
  const expectedVersion = 1;

  // Cliente A submete atualização com base na versão 1
  const updateA = await lessonRepo.updateLessonWithOptimisticLock({
    lessonId: initial.lesson.id,
    expectedVersion: expectedVersion,
    spec: { title: 'Versão 2 do Cliente A', scenes: [{ id: 's1', type: 'title', title: 'Atenas Democrática' }] },
    actorId: teacher.id,
    changeSummary: 'Edição do Cliente A',
    title: 'Grécia Antiga (Edição A)',
  });

  assert.equal(updateA.lesson.current_version, 2, 'Cliente A deve avançar versão para 2');
  assert.equal(updateA.revision.version, 2);

  // Cliente B tenta submeter atualização ainda com base na versão 1 (obsoleta)
  let conflictOccurred = false;
  try {
    await lessonRepo.updateLessonWithOptimisticLock({
      lessonId: initial.lesson.id,
      expectedVersion: expectedVersion, // Esperava 1, mas o banco já está em 2!
      spec: { title: 'Versão 2 conflitante do Cliente B', scenes: [{ id: 's1', type: 'title', title: 'Esparta Militar' }] },
      actorId: teacher.id,
      changeSummary: 'Edição conflitante do Cliente B',
      title: 'Grécia Antiga (Edição B)',
    });
  } catch (err: any) {
    conflictOccurred = true;
    assert.ok(err instanceof OptimisticLockError, 'Erro deve ser instância de OptimisticLockError');
    assert.equal(err.code, '409_CONFLICT');
    assert.equal(err.expectedVersion, 1);
    assert.equal(err.actualVersion, 2);
  }

  assert.equal(conflictOccurred, true, 'Cliente B deve receber conflito 409 e ter submissão bloqueada');

  // Verifica que o acervo preservou a edição do Cliente A sem corrupção
  const finalLesson = await lessonRepo.getLessonById(initial.lesson.id);
  assert.equal(finalLesson?.current_version, 2);
  assert.equal(finalLesson?.title, 'Grécia Antiga (Edição A)');

  // Verifica histórico de revisões: existem exatamente a v1 e v2
  const revisions = await lessonRepo.listLessonRevisions(initial.lesson.id);
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].version, 2);
  assert.equal(revisions[1].version, 1);
});

test('E2 (emulador pg-mem): Snapshots em lesson_revisions e entity_versions são imutáveis e contêm a versão final exata', async () => {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);

  const userRepo = new UserRepository(pool);
  const lessonRepo = new LessonRepository(pool);
  const teacher = await userRepo.create({
    username: 'prof.lucia',
    name: 'Lúcia Costa',
    email: 'lucia@escola.local',
    password_hash: 'hash789',
  });

  const specV1 = { title: 'Aula de Frações v1', scenes: [{ id: 's1', type: 'text', content: ['Fração é parte de um todo'] }] };
  const created = await lessonRepo.createLesson({
    ownerId: teacher.id,
    title: 'Frações e Números Racionais',
    subjectCode: 'math',
    gradeLevel: '6EF',
    topic: 'fracoes',
    spec: specV1,
  });

  const specV2 = { title: 'Aula de Frações v2', scenes: [{ id: 's1', type: 'text', content: ['Fração é divisão em partes iguais'] }] };
  await lessonRepo.updateLessonWithOptimisticLock({
    lessonId: created.lesson.id,
    expectedVersion: 1,
    spec: specV2,
    actorId: teacher.id,
    changeSummary: 'Refinamento do conceito',
  });

  // Acessa revisão 1 e 2
  const rev1 = await lessonRepo.getLessonRevision(created.lesson.id, 1);
  const rev2 = await lessonRepo.getLessonRevision(created.lesson.id, 2);

  assert.ok(rev1 !== null);
  assert.ok(rev2 !== null);

  // Snapshot da v1 preservou exatamente specV1
  assert.deepEqual(rev1.spec_json, {...specV1,lesson_version:1});
  // Snapshot da v2 preservou exatamente specV2
  assert.deepEqual(rev2.spec_json, {...specV2,lesson_version:2});
  assert.equal(Object.hasOwn(specV1,'lesson_version'),false,'A entrada do chamador não deve ser alterada');
  assert.equal(Object.hasOwn(specV2,'lesson_version'),false);
  assert.equal(rev1.content_hash,crypto.createHash('sha256').update(JSON.stringify(rev1.spec_json)).digest('hex'));
  assert.equal(rev2.content_hash,crypto.createHash('sha256').update(JSON.stringify(rev2.spec_json)).digest('hex'));
  assert.deepEqual((await lessonRepo.getLessonRevision(created.lesson.id,1))?.spec_json,rev1.spec_json);
  // Hashes de conteúdo são distintos
  assert.notEqual(rev1.content_hash, rev2.content_hash);
});

test('E2 (emulador pg-mem): Duas aprovações concorrentes de staging geram um único nó canônico no Knowledge Core', async () => {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);

  const userRepo = new UserRepository(pool);
  const curator = await userRepo.create({
    username: 'curador.ana',
    name: 'Ana Curadora',
    email: 'ana@escola.local',
    password_hash: 'hashAna',
    role: 'curator',
  });

  const knowledgeRepo = new KnowledgeRepository(pool);

  // Inserir item no staging
  const stagingId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO staging_nodes (id, source_provider, external_id, title, slug, type, short_description, data_json, validation_status)
     VALUES ($1, 'Wikidata', 'Q11768', 'Atenas', 'atenas', 'place', 'Capital da Grécia clássica', '{"region": "Ática"}'::jsonb, 'VALID');`,
    [stagingId]
  );

  // Duas promoções chamadas
  const p1 = await knowledgeRepo.promoteStagingNode(stagingId, curator.id);
  const p2 = await knowledgeRepo.promoteStagingNode(stagingId, curator.id);

  // Ambas as chamadas apontam para o mesmo nó canônico
  assert.equal(p1.node.id, p2.node.id);
  assert.equal(p1.node.slug, 'atenas');
  assert.equal(p2.duplicateHandled, true, 'A segunda aprovação deve identificar a existência e tratar como duplicata');

  // Verifica que existe rigorosamente UM nó em knowledge_nodes com slug 'atenas'
  const nodesRes = await pool.query('SELECT * FROM knowledge_nodes WHERE slug = $1;', ['atenas']);
  assert.equal(nodesRes.rows.length, 1, 'Exatamente um nó canônico deve ter sido criado');
});

test('E2 (emulador pg-mem): Content Pack Versions são estritamente imutáveis e rejeitam sobrescrita de mesma versão', async () => {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);

  const userRepo = new UserRepository(pool);
  const editor = await userRepo.create({
    username: 'editor.joao',
    name: 'João Editor',
    email: 'joao@escola.local',
    password_hash: 'hashJoao',
    role: 'editor',
  });

  const packRepo = new PackRepository(pool);
  const pack = await packRepo.createPack({
    slug: 'pack-grecia-6ef',
    subjectCode: 'history',
    gradeLevel: 6,
    title: 'Content Pack: Grécia Antiga 6º Ano',
  });

  const payloadV1 = { entities: ['atenas', 'esparta'], quizzes: [{ q: 'Onde nasceu a democracia?' }] };
  const manifestV1 = { sources: ['BNCC', 'Wikidata'], hash: 'abc' };

  // Publica versão 1.0.0
  const pub1 = await packRepo.publishPackVersion({
    packId: pack.id,
    version: '1.0.0',
    payload: payloadV1,
    manifest: manifestV1,
    actorId: editor.id,
  });

  assert.equal(pub1.version, '1.0.0');
  assert.equal(pub1.status, 'PUBLISHED');

  // Tentativa de republicar ou sobrescrever a versão 1.0.0
  let overwriteBlocked = false;
  try {
    await packRepo.publishPackVersion({
      packId: pack.id,
      version: '1.0.0',
      payload: { entities: ['apenas-atenas'] },
      manifest: { sources: ['Wikidata'] },
      actorId: editor.id,
    });
  } catch (err: any) {
    overwriteBlocked = true;
    assert.match(err.message, /já está publicada e é imutável/);
  }

  assert.equal(overwriteBlocked, true, 'A tentativa de sobrescrever versão publicada de pack deve ser bloqueada');
});

test('E2 (emulador pg-mem): Proteção do acervo do professor: desativação preserva aulas e tentativa de DELETE é bloqueada por ON DELETE RESTRICT', async () => {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);

  const userRepo = new UserRepository(pool);
  const lessonRepo = new LessonRepository(pool);

  const teacher = await userRepo.create({
    username: 'prof.fernando',
    name: 'Fernando Dias',
    email: 'fernando@escola.local',
    password_hash: 'hash999',
  });

  const created = await lessonRepo.createLesson({
    ownerId: teacher.id,
    title: 'Aula de Literatura',
    subjectCode: 'history',
    gradeLevel: '6EF',
    topic: 'literatura',
    spec: { title: 'Mitologia Grega', scenes: [] },
  });

  // 1. Desativação do usuário
  const deactivated = await userRepo.deactivate(teacher.id);
  assert.equal(deactivated.is_active, false);

  // A aula permanece íntegra e acessível
  const lessonAfterDeactivation = await lessonRepo.getLessonById(created.lesson.id);
  assert.ok(lessonAfterDeactivation !== null);
  assert.equal(lessonAfterDeactivation.owner_id, teacher.id);
  assert.equal(lessonAfterDeactivation.is_deleted, false);

  // 2. Tentativa de excluir conta do professor do banco diretamente
  let deleteBlocked = false;
  try {
    await userRepo.delete(teacher.id);
  } catch (err: any) {
    deleteBlocked = true;
    // O banco de dados deve lançar violação de chave estrangeira
    assert.match(err.message, /foreign key|restri/i);
  }

  assert.equal(deleteBlocked, true, 'ON DELETE RESTRICT deve impedir a exclusão física do professor enquanto existirem aulas vinculadas');
});

test('E2 (emulador pg-mem): Backup e Restauração em banco separado com integridade criptográfica SHA-256', async () => {
  // Banco de Origem (Instância A)
  const { pool: poolA } = createPool({ forceMemory: true });
  await runMigrations(poolA);

  const userRepoA = new UserRepository(poolA);
  const lessonRepoA = new LessonRepository(poolA);
  const auditRepoA = new AuditRepository(poolA);

  const teacherA = await userRepoA.create({
    username: 'prof.beatriz',
    name: 'Beatriz Ramos',
    email: 'beatriz@escola.local',
    password_hash: 'hashBeatriz',
  });

  const lessonA = await lessonRepoA.createLesson({
    ownerId: teacherA.id,
    title: 'Aula de Astronomia',
    subjectCode: 'science',
    gradeLevel: '6EF',
    topic: 'sistema_solar',
    spec: { title: 'Planetas', scenes: [{ id: 's1', type: 'title', title: 'Sol e Órbitas' }] },
  });

  await lessonRepoA.saveDraft(lessonA.lesson.id, teacherA.id, { draftNote: 'Revisando texto dos planetas' }, 1);
  await auditRepoA.recordGenerationAttempt({
    userId: teacherA.id,
    lessonId: lessonA.lesson.id,
    requestedMode: 'MODE_A_DETERMINISTIC',
    executedMode: 'MODE_A_DETERMINISTIC',
    status: 'SUCCESS',
  });

  // Exportar backup do Banco A
  const backupEnvelope = await exportDatabase(poolA);
  assert.equal(backupEnvelope.format_version, '1.0');
  assert.equal(backupEnvelope.schema_version, '1.0');
  assert.ok(backupEnvelope.content_hash.length === 64, 'Deve conter hash SHA-256 válido');
  assert.equal(backupEnvelope.table_counts.users, 1);
  assert.equal(backupEnvelope.table_counts.lessons, 1);
  assert.equal(backupEnvelope.table_counts.lesson_revisions, 1);
  assert.equal(backupEnvelope.table_counts.lesson_drafts, 1);
  assert.equal(backupEnvelope.table_counts.generation_attempts, 1);

  // Banco de Destino (Instância B - Separada e Limpa)
  const { pool: poolB } = createPool({ forceMemory: true });
  await runMigrations(poolB);

  // Restaura no Banco B com confirmação explícita
  const restoreResult = await importDatabase(poolB, backupEnvelope, { confirmDestructiveRestore: true });
  assert.equal(restoreResult.success, true);
  assert.equal(restoreResult.tablesRestored.users, 1);
  assert.equal(restoreResult.tablesRestored.lessons, 1);
  assert.equal(restoreResult.tablesRestored.lesson_revisions, 1);
  assert.equal(restoreResult.tablesRestored.lesson_drafts, 1);

  // Conferir integridade no Banco B
  const userRepoB = new UserRepository(poolB);
  const lessonRepoB = new LessonRepository(poolB);

  const restoredUser = await userRepoB.findById(teacherA.id);
  assert.ok(restoredUser !== null);
  assert.equal(restoredUser.username, 'prof.beatriz');

  const restoredLesson = await lessonRepoB.getLessonById(lessonA.lesson.id);
  assert.ok(restoredLesson !== null);
  assert.equal(restoredLesson.title, 'Aula de Astronomia');
  assert.equal(restoredLesson.owner_id, teacherA.id);

  const restoredRev = await lessonRepoB.getLessonRevision(lessonA.lesson.id, 1);
  assert.ok(restoredRev !== null);
  assert.equal(restoredRev.spec_json.title, 'Planetas');

  const restoredDraft = await lessonRepoB.getDraft(lessonA.lesson.id, teacherA.id);
  assert.ok(restoredDraft !== null);
  assert.equal(restoredDraft.draft_spec_json.draftNote, 'Revisando texto dos planetas');

  // Teste de rejeição de backup corrompido / adulterado
  const tamperedEnvelope = JSON.parse(JSON.stringify(backupEnvelope));
  tamperedEnvelope.data.users[0].name = 'Nome Adulterado'; // Adulteração sem re-calcular hash

  let tamperBlocked = false;
  try {
    await importDatabase(poolB, tamperedEnvelope, { confirmDestructiveRestore: true });
  } catch (err: any) {
    tamperBlocked = true;
    assert.match(err.message, /Falha crítica de integridade/);
  }
  assert.equal(tamperBlocked, true, 'Backup adulterado deve ser rejeitado com falha de integridade criptográfica');
});

test('E2: Falha explícita ao tentar criar pool em produção sem DATABASE_URL definida', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousUrl = process.env.DATABASE_URL;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;

    assert.throws(
      () => createPool(),
      /DATABASE_URL é obrigatória em ambiente de produção/
    );
  } finally {
    if (previousEnv !== undefined) process.env.NODE_ENV = previousEnv;
    else delete process.env.NODE_ENV;
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
  }
});

test('E2: Falha explícita no backup quando consultas a tabelas falham (sem mascaramento)', async () => {
  const fakePool = {
    connect: async () => ({
      query: async () => {
        throw new Error('Conexão simulada com banco de dados abortada.');
      },
      release: () => {},
    }),
  } as any;

  await assert.rejects(
    async () => exportDatabase(fakePool),
    /Falha crítica na exportação do backup/
  );
});

test('E2: Rejeição estrita de migração com checksum divergente do registrado', async () => {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);

  // Adultera o checksum gravado na tabela schema_migrations
  await pool.query('UPDATE schema_migrations SET checksum = $1 WHERE version = $2;', ['checksum-falso', '001']);

  // Tenta rodar migrações novamente: deve falhar e recusar continuar
  await assert.rejects(
    async () => runMigrations(pool),
    /Inconsistência de integridade na migração/
  );
});

test('E2: Restauração rejeita execução sem confirmação explícita, com tabelas ausentes, contagens divergentes ou colunas adulteradas preservando destino intacto', async () => {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);

  const userRepo = new UserRepository(pool);
  await userRepo.create({
    username: 'usuario.intacto',
    name: 'Usuario Intacto',
    email: 'intacto@escola.local',
    password_hash: 'hashIntacto',
  });

  const validBackup = await exportDatabase(pool);

  // 1. Rejeição por falta de confirmação destrutiva
  await assert.rejects(
    async () => importDatabase(pool, validBackup),
    /Operação de restauração abortada por segurança/
  );

  // 2. Rejeição por tabela canônica obrigatória ausente em data
  const missingTablePayload = JSON.parse(JSON.stringify(validBackup));
  delete missingTablePayload.data.sources;
  missingTablePayload.content_hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(missingTablePayload.data))
    .digest('hex');

  await assert.rejects(
    async () => importDatabase(pool, missingTablePayload, { confirmDestructiveRestore: true }),
    /Tabela canônica obrigatória ausente no backup: "sources"/
  );

  // 3. Rejeição por divergência entre table_counts e tamanho real do array (probe do revisor)
  const divergentCountPayload = JSON.parse(JSON.stringify(validBackup));
  divergentCountPayload.data.users = [];
  divergentCountPayload.content_hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(divergentCountPayload.data))
    .digest('hex');

  await assert.rejects(
    async () => importDatabase(pool, divergentCountPayload, { confirmDestructiveRestore: true }),
    /Inconsistência pré-restauração na tabela "users"/
  );

  // 4. Rejeição por coluna não constante na whitelist de segurança
  const payloadWithInjection = JSON.parse(JSON.stringify(validBackup));
  payloadWithInjection.data.users[0].malicious_column = 'DROP TABLE users;';
  payloadWithInjection.content_hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payloadWithInjection.data))
    .digest('hex');

  await assert.rejects(
    async () => importDatabase(pool, payloadWithInjection, { confirmDestructiveRestore: true }),
    /Coluna inválida ou não reconhecida "malicious_column"/
  );

  // 5. Garantir que o banco de destino permaneceu 100% intacto após todas as rejeições
  const checkUsers = await pool.query('SELECT COUNT(*) AS total FROM users WHERE username = $1;', ['usuario.intacto']);
  assert.equal(Number(checkUsers.rows[0].total), 1, 'O registro do usuário deve permanecer intacto no banco de destino');
});
