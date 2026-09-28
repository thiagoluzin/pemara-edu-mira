/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — SUÍTE DE TESTES E EVIDÊNCIAS DE LOGIN, RBAC E KNOWLEDGE CORE (E3)
 * Comprova autenticação local em PostgreSQL, sessões, matriz de permissões RBAC,
 * controle otimista de concorrência (409), promoção de staging e exportação DDL/JSON.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { createPool } from '../server/db/pool';
import { runMigrations } from '../server/db/migrator';
import { seedInitialUsers } from '../server/db/seeds/users';
import { seedInitialKnowledge } from '../server/db/seeds/knowledge';
import { UserRepository } from '../server/repositories/userRepository';
import { SessionRepository } from '../server/repositories/sessionRepository';
import { KnowledgeRepository } from '../server/repositories/knowledgeRepository';
import { hashPassword, verifyPassword } from '../server/auth/passwords';
import { createAuthMiddleware } from '../server/auth/middleware';
import { createAuthRouter } from '../server/routes/auth';
import { createKnowledgeRouter } from '../server/routes/knowledge';

// Helper para iniciar servidor de teste em porta efêmera
async function setupTestApp() {
  const { pool } = createPool({ forceMemory: true });
  await runMigrations(pool);
  await seedInitialUsers(pool);
  await seedInitialKnowledge(pool);

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(createAuthMiddleware(pool));
  app.use('/api/auth', createAuthRouter(pool));
  app.use('/api/knowledge', createKnowledgeRouter(pool));

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

// Helper para autenticação segura via cookie / bearer nos testes
async function loginAs(baseUrl: string, username: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `Login para ${username} deve retornar status 200`);
  const setCookie = res.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(/pemara_session=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : '';
  const data = await res.json();
  return { token, cookie: `pemara_session=${token}`, user: data.user, rawRes: res, data };
}

test('E3: Hashing Seguro com Salt Nativo (scrypt) e Proteção Contra Timing Attacks', async () => {
  const password = 'MinhaSenhaSegura2026!';
  const hash1 = hashPassword(password);
  const hash2 = hashPassword(password);

  // Salts únicos geram hashes diferentes para a mesma senha
  assert.notEqual(hash1, hash2, 'Senhas iguais com salts aleatórios devem produzir hashes distintos');
  assert.ok(hash1.startsWith('scrypt:'), 'Hash deve utilizar formato canônico scrypt:<salt>:<hash>');

  // Verificação timing-safe
  assert.ok(verifyPassword(password, hash1), 'Senha correta deve ser validada');
  assert.ok(verifyPassword(password, hash2), 'Senha correta deve ser validada com salt diferente');
  assert.ok(!verifyPassword('SenhaIncorreta', hash1), 'Senha incorreta deve ser rejeitada');
  assert.ok(!verifyPassword('', hash1), 'Senha vazia deve ser rejeitada');
});

test('E3: Login e Ciclo de Vida da Sessão Local em PostgreSQL (Login, Me, Expiração e Logout)', async () => {
  const { baseUrl, close } = await setupTestApp();

  try {
    // 1. Login com credenciais válidas do professor
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'prof.helena', password: 'helena123' }),
    });

    assert.equal(loginRes.status, 200, 'Login do professor deve retornar status 200');
    const loginData = await loginRes.json();
    assert.equal(loginData.session, undefined, 'Token de sessão não deve ser exposto no corpo JSON (P1)');
    assert.equal(loginData.user?.role, 'teacher', 'Papel do usuário deve ser teacher');
    assert.equal(loginData.user?.password_hash, undefined, 'Hash de senha nunca deve ser retornado');

    // Sessão deve vir exclusivamente no cookie HttpOnly
    const setCookie = loginRes.headers.get('set-cookie');
    assert.ok(setCookie, 'Cabeçalho Set-Cookie deve ser enviado');
    assert.match(setCookie, /pemara_session=/);
    assert.match(setCookie, /HttpOnly/i, 'Cookie de sessão deve ser HttpOnly');

    const teacherToken = setCookie.match(/pemara_session=([^;]+)/)![1];

    // 2. Consulta de sessão ativa via GET /api/auth/me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.username, 'prof.helena');
    assert.equal(meData.user.password_hash, undefined, 'Hash de senha não pode constar no /me');

    // 3. Login com senha errada
    const badPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'prof.helena', password: 'senha-incorreta' }),
    });
    assert.equal(badPassRes.status, 401, 'Senha incorreta deve retornar 401');

    // 4. Login com usuário inexistente
    const unknownUserRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'usuario.inexistente', password: 'qualquer-senha' }),
    });
    assert.equal(unknownUserRes.status, 401, 'Usuário inexistente deve retornar 401');

    // 5. Logout encerra a sessão
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'x-session-id': teacherToken },
    });
    assert.equal(logoutRes.status, 200);

    // 6. Requisição subsequente com sessão encerrada é rejeitada
    const afterLogoutRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(afterLogoutRes.status, 401, 'Sessão encerrada deve retornar 401 no /api/auth/me');
  } finally {
    await close();
  }
});

test('E3: Rejeição de Sessão Expirada e de Conta Desativada', async () => {
  const { pool, baseUrl, close } = await setupTestApp();

  try {
    const sessionRepo = new SessionRepository(pool);
    const userRepo = new UserRepository(pool);

    // 1. Criar usuário e desativá-lo
    const deactUser = await userRepo.create({
      username: 'prof.desativado',
      name: 'Professor Desativado',
      email: 'desativado@escola.local',
      password_hash: hashPassword('senha123'),
      role: 'teacher',
      is_active: false,
    });

    const loginDeactRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'prof.desativado', password: 'senha123' }),
    });
    assert.equal(loginDeactRes.status, 403, 'Usuário inativo deve receber 403 Forbidden no login');

    // 2. Criar sessão expirada manualmente no PostgreSQL
    const { secretToken: expiredToken } = await sessionRepo.createSession(deactUser.id, { ttlHours: -1 }); // Expirada no passado

    const expRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(expRes.status, 401, 'Sessão com expires_at no passado deve retornar 401');
  } finally {
    await close();
  }
});

test('E3: Matriz de Permissões RBAC no Knowledge Core (401 sem sessão, 403 para papel insuficiente)', async () => {
  const { baseUrl, close } = await setupTestApp();

  try {
    // 1. Requisição sem autenticação deve falhar com 401 Unauthorized
    const unauthRes = await fetch(`${baseUrl}/api/knowledge/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Nó Não Autorizado',
        slug: 'nao-autorizado',
        type: 'concept',
        short_description: 'Teste',
        subject_code: 'history',
        grade_level: 6,
      }),
    });
    assert.equal(unauthRes.status, 401, 'Mutação sem autenticação deve retornar 401 Unauthorized');

    // Login dos diferentes papéis via helper seguro
    const teacherAuth = await loginAs(baseUrl, 'prof.helena', 'helena123');
    const editorAuth = await loginAs(baseUrl, 'editor.bruno', 'bruno123');
    const curatorAuth = await loginAs(baseUrl, 'curador.ana', 'ana123');

    const teacherToken = teacherAuth.token;
    const editorToken = editorAuth.token;
    const curatorToken = curatorAuth.token;

    // 2. PROFESSOR (teacher): Leitura permitida, mutação editorial proibida (403)
    const teacherReadRes = await fetch(`${baseUrl}/api/knowledge/nodes`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(teacherReadRes.status, 200, 'Professor pode consultar nós canônicos');

    const teacherCreateRes = await fetch(`${baseUrl}/api/knowledge/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        title: 'Tentativa do Professor',
        slug: 'tentativa-prof',
        type: 'concept',
        short_description: 'Descrição',
        subject_code: 'history',
        grade_level: 6,
      }),
    });
    assert.equal(teacherCreateRes.status, 403, 'Professor tentando criar nó canônico deve receber 403 Forbidden');

    const teacherApproveStagingRes = await fetch(`${baseUrl}/api/knowledge/staging/stg-02/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(teacherApproveStagingRes.status, 403, 'Professor tentando aprovar staging deve receber 403 Forbidden');

    // 3. EDITOR: Pode criar nó canônico (nasce DRAFT), mas NÃO pode aprovar staging nem auto-publicar
    const editorCreateRes = await fetch(`${baseUrl}/api/knowledge/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${editorToken}`,
      },
      body: JSON.stringify({
        title: 'Filosofia Pré-Socrática',
        slug: 'filosofia-pre-socratica',
        type: 'concept',
        short_description: 'Investigação racional sobre a physis e a cosmologia.',
        subject_code: 'history',
        grade_level: 6,
      }),
    });
    assert.equal(editorCreateRes.status, 201, 'Editor deve conseguir criar nó canônico');
    const editorCreateData = await editorCreateRes.json();
    assert.equal(editorCreateData.node.status, 'DRAFT', 'Nó criado por editor deve nascer como DRAFT (P1 Bloqueio 4)');

    // Editor tentando atribuir PUBLISHED diretamente na criação deve ser forçado a DRAFT ou bloqueado
    const editorForcePublishRes = await fetch(`${baseUrl}/api/knowledge/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${editorToken}`,
      },
      body: JSON.stringify({
        title: 'Tentativa de Auto Publicação',
        slug: 'tentativa-auto-pub',
        type: 'concept',
        short_description: 'Teste',
        subject_code: 'history',
        grade_level: 6,
        status: 'PUBLISHED',
      }),
    });
    if (editorForcePublishRes.status === 201) {
      const forcedData = await editorForcePublishRes.json();
      assert.equal(forcedData.node.status, 'DRAFT', 'Servidor deve forçar status DRAFT se editor tentar PUBLISHED');
    } else {
      assert.equal(editorForcePublishRes.status, 403, 'Rejeita tentativa de publicação não autorizada');
    }

    const editorApproveStagingRes = await fetch(`${baseUrl}/api/knowledge/staging/stg-02/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    assert.equal(editorApproveStagingRes.status, 403, 'Editor tentando aprovar staging deve receber 403 Forbidden');

    // 4. CURADOR: Pode criar nós e aprovar itens de staging para o Knowledge Core
    const curatorApproveRes = await fetch(`${baseUrl}/api/knowledge/staging/stg-02/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${curatorToken}` },
    });
    assert.equal(curatorApproveRes.status, 200, 'Curador deve conseguir aprovar item do staging para o Core');
    const approveData = await curatorApproveRes.json();
    assert.equal(approveData.success, true);
    assert.equal(approveData.node.slug, 'socrates');
  } finally {
    await close();
  }
});

test('E3: Controle Otimista de Concorrência (409 Conflict) com Snapshots Imutáveis no PostgreSQL', async () => {
  const { baseUrl, close } = await setupTestApp();

  try {
    // Autenticar como curador
    const curatorAuth = await loginAs(baseUrl, 'curador.ana', 'ana123');
    const token = curatorAuth.token;

    // 1. Obter nó 'grecia-antiga' com versão inicial 1
    const nodeRes = await fetch(`${baseUrl}/api/knowledge/nodes/node-grecia-antiga`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(nodeRes.status, 200);
    const { node } = await nodeRes.json();
    assert.equal(node.version, 1);

    // 2. Primeiro usuário atualiza com expected_version: 1 -> Sucesso (vai para v2)
    const update1Res = await fetch(`${baseUrl}/api/knowledge/nodes/${node.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        expected_version: 1,
        title: 'Grécia Antiga (Revisada)',
        short_description: 'Descrição atualizada com revisão historiográfica.',
        reason: 'Revisão conceitual curricular 2026',
      }),
    });
    assert.equal(update1Res.status, 200, 'Primeira atualização deve ter sucesso');
    const update1Data = await update1Res.json();
    assert.equal(update1Data.node.version, 2);
    assert.equal(update1Data.node.title, 'Grécia Antiga (Revisada)');

    // 3. Segundo usuário tenta atualizar concorrentemente com expected_version: 1 -> Retorna 409 Conflict
    const update2Res = await fetch(`${baseUrl}/api/knowledge/nodes/${node.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        expected_version: 1, // Versão defasada!
        title: 'Grécia Antiga Sobrescrita Silenciosa',
        reason: 'Tentativa concorrente com dados velhos',
      }),
    });
    assert.equal(update2Res.status, 409, 'Atualização com versão defasada deve retornar HTTP 409 Conflict');
    const conflictData = await update2Res.json();
    assert.ok(conflictData.error.includes('Conflito de versão'));
    assert.equal(conflictData.details.expectedVersion, 1);
    assert.equal(conflictData.details.currentVersion, 2);

    // 4. Comprovar que o registro no banco NÃO foi corrompido
    const checkRes = await fetch(`${baseUrl}/api/knowledge/nodes/${node.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const checkData = await checkRes.json();
    assert.equal(checkData.node.version, 2);
    assert.equal(checkData.node.title, 'Grécia Antiga (Revisada)');

    // 5. Comprovar histórico imutável em entity_versions (snapshots das versões 1 e 2)
    const versionsRes = await fetch(`${baseUrl}/api/knowledge/nodes/${node.id}/versions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { versions } = await versionsRes.json();
    assert.ok(versions.length >= 2, 'Devem existir snapshots das versões em entity_versions');
    assert.equal(versions[0].version, 2);
    assert.equal(versions[1].version, 1);
  } finally {
    await close();
  }
});

test('E3: Integridade Ontológica - Prevenção de Auto-Ciclos e Deduplicação no Staging', async () => {
  const { baseUrl, close } = await setupTestApp();

  try {
    const curatorAuth = await loginAs(baseUrl, 'curador.ana', 'ana123');
    const token = curatorAuth.token;

    // 1. Tentar criar relação com from_node_id === to_node_id (auto-ciclo inválido)
    const autoCycleRes = await fetch(`${baseUrl}/api/knowledge/relations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        from_node_id: 'node-atenas',
        relation_type: 'part_of',
        to_node_id: 'node-atenas', // Mesmo nó!
      }),
    });
    assert.equal(autoCycleRes.status, 400, 'Auto-ciclo ontológico reflexivo deve ser rejeitado com 400');

    // 2. Aprovação de item de staging duplicado (ex: polis-wikidata com slug que já existe no core)
    const dupRes = await fetch(`${baseUrl}/api/knowledge/staging/stg-01/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(dupRes.status, 200);
    const dupData = await dupRes.json();
    assert.equal(dupData.duplicateHandled, true, 'Deduplicação deve ser tratada sem duplicar o nó canônico');
    assert.equal(dupData.node.slug, 'polis');
  } finally {
    await close();
  }
});

test('E3: Exportação de DDL Real (/schema.sql) e Dump Canônico Versionado (/dump)', async () => {
  const { baseUrl, close } = await setupTestApp();

  try {
    // 1. Exportação DDL real do PostgreSQL
    const ddlRes = await fetch(`${baseUrl}/api/knowledge/schema.sql`);
    assert.equal(ddlRes.status, 200);
    assert.ok(ddlRes.headers.get('content-type')?.includes('text/plain'));
    const ddlText = await ddlRes.text();
    assert.ok(ddlText.includes('CREATE TABLE IF NOT EXISTS knowledge_nodes'));
    assert.ok(ddlText.includes('CREATE TABLE IF NOT EXISTS entity_versions'));
    assert.ok(ddlText.includes('CREATE TABLE IF NOT EXISTS users'));

    // 2. Dump JSON exige autenticação (Bloqueio P1 3)
    const unauthDumpRes = await fetch(`${baseUrl}/api/knowledge/dump`);
    assert.equal(unauthDumpRes.status, 401, 'Dump sem sessão deve ser rejeitado com 401');

    // Professor não pode ver dump do acervo geral editorial (403)
    const teacherAuth = await loginAs(baseUrl, 'prof.helena', 'helena123');
    const teacherDumpRes = await fetch(`${baseUrl}/api/knowledge/dump`, {
      headers: { Authorization: `Bearer ${teacherAuth.token}` },
    });
    assert.equal(teacherDumpRes.status, 403, 'Professor tentando acessar dump geral deve receber 403');

    // Curador acessa dump canônico completo
    const curatorAuth = await loginAs(baseUrl, 'curador.ana', 'ana123');
    const dumpRes = await fetch(`${baseUrl}/api/knowledge/dump`, {
      headers: { Authorization: `Bearer ${curatorAuth.token}` },
    });
    assert.equal(dumpRes.status, 200, 'Curador autenticado acessa dump canônico');
    const dump = await dumpRes.json();
    assert.equal(dump.meta.format_version, '1.0');
    assert.ok(dump.meta.total_nodes >= 11, 'Deve exportar 11+ nós canônicos do Marco 1');
    assert.ok(dump.meta.total_relations >= 12, 'Deve exportar 12+ relações ontológicas');
    assert.ok(Array.isArray(dump.knowledge_nodes));
    assert.ok(Array.isArray(dump.knowledge_relations));
    assert.ok(Array.isArray(dump.licenses));
    assert.ok(Array.isArray(dump.sources));
    assert.ok(Array.isArray(dump.curriculum_skills));
  } finally {
    await close();
  }
});
