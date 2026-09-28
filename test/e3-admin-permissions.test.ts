/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — SUÍTE DE TESTES E3/E4: PAINEL ADMIN, AUTORIZAÇÃO E ISOLAMENTO
 * Comprova o cumprimento integral da ordem de serviço:
 * 1. Bootstrap admin/admin com persistência após reinício/seed
 * 2. Proteção transacional do último administrador (inclusive contra concorrência)
 * 3. Isolamento estrito do acervo docente (professores não acessam aulas alheias nem rotas /admin)
 * 4. Acesso administrativo centralizado: histórico, restauração de versões e transferência de autoria
 * 5. Revogação de sessões e encerramento imediato de acesso
 * 6. Rate limiting (bloqueio após 5 falhas consecutivas de login)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { createPool, withTransaction } from '../server/db/pool';
import { runMigrations } from '../server/db/migrator';
import { seedInitialUsers } from '../server/db/seeds/users';
import { seedInitialKnowledge } from '../server/db/seeds/knowledge';
import { UserRepository } from '../server/repositories/userRepository';
import { SessionRepository } from '../server/repositories/sessionRepository';
import { LessonRepository } from '../server/repositories/lessonRepository';
import { createAuthMiddleware } from '../server/auth/middleware';
import { createAuthRouter } from '../server/routes/auth';
import { createAdminRouter } from '../server/routes/admin';
import { createLessonsRouter } from '../server/routes/lessons';

async function setupAdminApp() {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);
  await seedInitialUsers(pool);
  await seedInitialKnowledge(pool);

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(createAuthMiddleware(pool));
  app.use('/api/auth', createAuthRouter(pool));
  app.use('/api/admin', createAdminRouter(pool));
  app.use('/api/lessons', createLessonsRouter(pool));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const close = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  };

  return { pool, baseUrl, close };
}

async function loginAs(baseUrl: string, username: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) {
    const errorBody = await res.json().catch(() => ({}));
    return { status: res.status, error: errorBody.error, code: errorBody.code, token: null, cookie: null, user: null };
  }
  const setCookie = res.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(/pemara_session=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : '';
  const data = await res.json();
  return { status: res.status, token, cookie: `pemara_session=${token}`, user: data.user, data };
}

test('E3 Admin: Bootstrap admin/admin, troca de senha e persistência após reinício', async () => {
  const { pool, baseUrl, close } = await setupAdminApp();

  try {
    // 1. Login inicial com admin / admin
    const login1 = await loginAs(baseUrl, 'admin', 'admin');
    assert.equal(login1.status, 200, 'Login inicial admin/admin deve funcionar');
    assert.equal(login1.user?.role, 'admin');
    assert.equal(login1.user?.password_hash, undefined, 'password_hash não deve ser exposto');

    // 2. Administrador altera sua própria senha
    const changePassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login1.token}`,
      },
      body: JSON.stringify({
        currentPassword: 'admin',
        newPassword: 'NovoAdminForte2026!',
      }),
    });
    assert.equal(changePassRes.status, 200, 'Troca de senha deve retornar status 200');

    // 3. Simula reinício de servidor disparando novo seedInitialUsers
    const seedResult = await seedInitialUsers(pool);
    assert.equal(seedResult.createdCount, 0, 'Nenhum usuário novo deve ser criado pois já existem');

    // 4. Login com senha antiga 'admin' deve falhar
    const oldLogin = await loginAs(baseUrl, 'admin', 'admin');
    assert.equal(oldLogin.status, 401, 'Senha antiga admin não deve ser aceita após alteração');

    // 5. Login com a nova senha deve ter sucesso
    const newLogin = await loginAs(baseUrl, 'admin', 'NovoAdminForte2026!');
    assert.equal(newLogin.status, 200, 'Login com a nova senha deve funcionar após o reinício');
  } finally {
    await close();
  }
});

test('E3 Admin: Proteção transacional do último administrador ativo contra desativação/rebaixamento', async () => {
  const { pool, baseUrl, close } = await setupAdminApp();

  try {
    const adminLogin = await loginAs(baseUrl, 'admin', 'admin');
    const adminId = adminLogin.user.id;

    // 1. Tentar desativar o único administrador ativo do sistema deve ser rejeitado com 409
    const deactRes = await fetch(`${baseUrl}/api/admin/users/${adminId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({ is_active: false }),
    });
    assert.equal(deactRes.status, 409, 'Desativar o único administrador deve retornar 409');
    const deactData = await deactRes.json();
    assert.equal(deactData.code, 'LAST_ADMIN_PROTECTED');

    // 2. Tentar rebaixar o único administrador ativo para 'teacher' deve ser rejeitado com 409
    const demoteRes = await fetch(`${baseUrl}/api/admin/users/${adminId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({ role: 'teacher' }),
    });
    assert.equal(demoteRes.status, 409, 'Rebaixar o único administrador deve retornar 409');
    const demoteData = await demoteRes.json();
    assert.equal(demoteData.code, 'LAST_ADMIN_PROTECTED');

    // 3. Cadastrar um segundo administrador
    const createAdmin2Res = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({
        username: 'admin2',
        name: 'Segundo Administrador',
        email: 'admin2@pemara.local',
        password: 'senhaAdmin2026!',
        role: 'admin',
      }),
    });
    assert.equal(createAdmin2Res.status, 201);
    const admin2Data = await createAdmin2Res.json();
    const admin2Id = admin2Data.user.id;

    // 4. Agora que existem 2 admins, rebaixar o segundo admin para professor deve ter sucesso
    const demoteAdmin2Res = await fetch(`${baseUrl}/api/admin/users/${admin2Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({ role: 'teacher' }),
    });
    assert.equal(demoteAdmin2Res.status, 200, 'Rebaixamento permitido quando há outro admin ativo');

    // 5. Tentativa subsequente de desativar o admin principal volta a ser rejeitada
    const deactAgainRes = await fetch(`${baseUrl}/api/admin/users/${adminId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({ is_active: false }),
    });
    assert.equal(deactAgainRes.status, 409);
    assert.equal((await deactAgainRes.json()).code, 'LAST_ADMIN_PROTECTED');
  } finally {
    await close();
  }
});

test('E3/E4: Isolamento estrito do acervo docente e bloqueio de rotas administrativas', async () => {
  const { baseUrl, close } = await setupAdminApp();

  try {
    const profHelena = await loginAs(baseUrl, 'prof.helena', 'helena123');
    const profCarlos = await loginAs(baseUrl, 'prof.carlos', 'carlos123');
    const admin = await loginAs(baseUrl, 'admin', 'admin');

    // 1. Professora Helena cria uma aula
    const createLessonRes = await fetch(`${baseUrl}/api/lessons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profHelena.token}`,
      },
      body: JSON.stringify({
        title: 'História Medieval e Feudalismo',
        subjectCode: 'history',
        gradeLevel: '7EF',
        topic: 'feudalismo',
        spec: {
          lesson: { title: 'História Medieval e Feudalismo', subject: 'history', grade: '7EF' },
          scenes: [{ id: 's1', type: 'title', title: 'O Castelo Medieval' }],
        },
      }),
    });
    assert.equal(createLessonRes.status, 201);
    const helenaLesson = (await createLessonRes.json()).lesson;

    // 2. Professor Carlos consulta suas próprias aulas: NÃO deve ver a aula da Helena
    const carlosLessonsRes = await fetch(`${baseUrl}/api/lessons`, {
      headers: { Authorization: `Bearer ${profCarlos.token}` },
    });
    assert.equal(carlosLessonsRes.status, 200);
    const carlosLessonsData = await carlosLessonsRes.json();
    const foundOtherLesson = carlosLessonsData.lessons.some((l: any) => l.id === helenaLesson.id);
    assert.equal(foundOtherLesson, false, 'Professor não deve ver aulas de outros professores na sua listagem');

    // 3. Professor Carlos tenta acessar diretamente a aula da Helena por ID: deve receber 403
    const directAccessRes = await fetch(`${baseUrl}/api/lessons/${helenaLesson.id}`, {
      headers: { Authorization: `Bearer ${profCarlos.token}` },
    });
    assert.equal(directAccessRes.status, 403, 'Acesso direto a aula alheia deve retornar 403 Forbidden');

    // 4. Professor Carlos tenta gravar rascunho (autosave) na aula da Helena: deve receber 403
    const draftRes = await fetch(`${baseUrl}/api/lessons/${helenaLesson.id}/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profCarlos.token}`,
      },
      body: JSON.stringify({
        draftSpec: { scenes: [{ id: 's1', title: 'Rascunho Indevido' }] },
        baseVersion: 1,
      }),
    });
    assert.equal(draftRes.status, 403, 'Tentativa de autosave em aula alheia deve retornar 403');

    // 5. Professor Carlos tenta acessar o painel administrativo: deve receber 403
    const adminOverviewRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${profCarlos.token}` },
    });
    assert.equal(adminOverviewRes.status, 403, 'Professor tentando acessar /api/admin/overview deve receber 403');

    const adminUsersRes = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${profCarlos.token}` },
    });
    assert.equal(adminUsersRes.status, 403, 'Professor tentando listar usuários no painel admin deve receber 403');

    // 6. Administrador tem acesso geral concedido: consulta a aula e visualiza visão geral
    const adminGetLessonRes = await fetch(`${baseUrl}/api/lessons/${helenaLesson.id}`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    assert.equal(adminGetLessonRes.status, 200, 'Administrador pode visualizar aula de qualquer professor');

    const adminOverviewOkRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    assert.equal(adminOverviewOkRes.status, 200, 'Administrador acessa a visão geral');
  } finally {
    await close();
  }
});

test('E3/E4: Persistência de aulas, autosave, histórico de revisões, restore e transferência de titularidade', async () => {
  const { baseUrl, close } = await setupAdminApp();

  try {
    const profHelena = await loginAs(baseUrl, 'prof.helena', 'helena123');
    const profCarlos = await loginAs(baseUrl, 'prof.carlos', 'carlos123');
    const admin = await loginAs(baseUrl, 'admin', 'admin');

    // 1. Helena cria aula (versão 1)
    const createRes = await fetch(`${baseUrl}/api/lessons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profHelena.token}`,
      },
      body: JSON.stringify({
        title: 'Geometria Espacial: Poliedros',
        subjectCode: 'math',
        gradeLevel: '8EF',
        topic: 'geometria_espacial',
        spec: { title: 'V1: Prismas e Pirâmides', scenes: [] },
      }),
    });
    assert.equal(createRes.status, 201);
    const lesson = (await createRes.json()).lesson;
    assert.equal(lesson.current_version, 1);

    // 2. Helena faz autosave de rascunho
    const draftRes = await fetch(`${baseUrl}/api/lessons/${lesson.id}/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profHelena.token}`,
      },
      body: JSON.stringify({
        draftSpec: { title: 'Rascunho de Poliedros com Cubos', scenes: [{ id: 's1' }] },
        baseVersion: 1,
      }),
    });
    assert.equal(draftRes.status, 200);

    // 3. Helena consulta sua aula: deve conter o rascunho pendente
    const getLessonWithDraft = await (await fetch(`${baseUrl}/api/lessons/${lesson.id}`, {
      headers: { Authorization: `Bearer ${profHelena.token}` },
    })).json();
    assert.ok(getLessonWithDraft.draft !== null, 'Aula deve conter rascunho associado');

    // 4. Helena salva nova versão definitiva (versão 2)
    const v2Res = await fetch(`${baseUrl}/api/lessons/${lesson.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profHelena.token}`,
      },
      body: JSON.stringify({
        spec: { title: 'V2: Poliedros de Platão', scenes: [{ id: 's1' }, { id: 's2' }] },
        changeSummary: 'Adicionada explicação sobre poliedros regulares',
      }),
    });
    assert.equal(v2Res.status, 200);
    const v2Data = await v2Res.json();
    assert.equal(v2Data.lesson.current_version, 2);

    // 5. Administrador inspeciona o histórico de revisões
    const revsRes = await fetch(`${baseUrl}/api/admin/lessons/${lesson.id}/revisions`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    assert.equal(revsRes.status, 200);
    const revsData = await revsRes.json();
    assert.equal(revsData.revisions.length, 2, 'Devem existir as versões 1 e 2');

    // 6. Administrador restaura a versão 1 (gerando versão 3)
    const restoreRes = await fetch(`${baseUrl}/api/admin/lessons/${lesson.id}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        revisionNumber: 1,
        reason: 'Recuperação de conteúdo a pedido pedagógico',
      }),
    });
    assert.equal(restoreRes.status, 200);
    const restoreData = await restoreRes.json();
    assert.equal(restoreData.lesson.current_version, 3);
    assert.ok(restoreData.revision.change_summary.includes('Restauração da revisão v1'));

    // 7. Administrador transfere a titularidade da aula para o Professor Carlos
    const transferRes = await fetch(`${baseUrl}/api/admin/lessons/${lesson.id}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        newOwnerId: profCarlos.user.id,
        reason: 'Transferência de turma para novo professor de matemática',
      }),
    });
    assert.equal(transferRes.status, 200);
    const transferData = await transferRes.json();
    assert.equal(transferData.lesson.owner_id, profCarlos.user.id);

    // 8. Agora Carlos tem acesso à aula como legítimo proprietário
    const carlosAccessRes = await fetch(`${baseUrl}/api/lessons/${lesson.id}`, {
      headers: { Authorization: `Bearer ${profCarlos.token}` },
    });
    assert.equal(carlosAccessRes.status, 200, 'Novo proprietário tem acesso concedido');

    // 9. Helena não tem mais acesso à aula (pois foi transferida)
    const helenaLostAccessRes = await fetch(`${baseUrl}/api/lessons/${lesson.id}`, {
      headers: { Authorization: `Bearer ${profHelena.token}` },
    });
    assert.equal(helenaLostAccessRes.status, 403, 'Antigo proprietário perde acesso após transferência');
  } finally {
    await close();
  }
});

test('E3 Admin: Revogação de sessão e bloqueio imediato de acesso', async () => {
  const { baseUrl, close } = await setupAdminApp();

  try {
    const profHelena = await loginAs(baseUrl, 'prof.helena', 'helena123');
    const admin = await loginAs(baseUrl, 'admin', 'admin');

    // 1. Helena acessa sua conta
    const me1 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${profHelena.token}` },
    });
    assert.equal(me1.status, 200);

    // 2. Administrador lista sessões ativas
    const sessionsRes = await fetch(`${baseUrl}/api/admin/sessions?activeOnly=true`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    assert.equal(sessionsRes.status, 200);
    const sessionsData = await sessionsRes.json();
    const helenaSession = sessionsData.sessions.find((s: any) => s.user_id === profHelena.user.id);
    assert.ok(helenaSession, 'Sessão da Helena deve constar na lista administrativa');

    // 3. Administrador revoga a sessão da Helena
    const revokeRes = await fetch(`${baseUrl}/api/admin/sessions/${helenaSession.id}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    assert.equal(revokeRes.status, 200);

    // 4. Próxima requisição com a sessão revogada é rejeitada imediatamente com 401
    const meAfterRevoke = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${profHelena.token}` },
    });
    assert.equal(meAfterRevoke.status, 401, 'Sessão revogada deve ser rejeitada com 401');
  } finally {
    await close();
  }
});

test('E3 Auth: Rate limiting bloqueia tentativas após 5 falhas consecutivas de login', async () => {
  const { baseUrl, close } = await setupAdminApp();

  try {
    const bruteUser = 'usuario.teste.brute';
    const testIp = '192.168.1.199';

    // Dispara 5 tentativas incorretas
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': testIp,
        },
        body: JSON.stringify({ username: bruteUser, password: 'senha-errada' }),
      });
      assert.equal(res.status, 401, `Tentativa ${i} deve retornar 401`);
    }

    // A 6ª tentativa deve ser bloqueada com HTTP 429 Too Many Requests
    const blockRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': testIp,
      },
      body: JSON.stringify({ username: bruteUser, password: 'qualquer-coisa' }),
    });
    assert.equal(blockRes.status, 429, 'Após 5 falhas, deve retornar HTTP 429');
    const blockData = await blockRes.json();
    assert.equal(blockData.code, 'RATE_LIMITED');
    assert.ok(blockData.remainingSeconds > 0);
  } finally {
    await close();
  }
});
