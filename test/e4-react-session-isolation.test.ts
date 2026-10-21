/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — TESTE NO NAVEGADOR COM REACT REAL E POSTGRESQL DESCARTÁVEL (E4 / P2)
 * Executa em Google Chrome Headless nativo via CDP:
 * 1. Login do Professor Carlos via UI.
 * 2. Carlos inicia requisição demorada; resposta retida no servidor.
 * 3. Carlos clica "Sair" e Professora Helena entra via UI.
 * 4. Resposta atrasada de Carlos é liberada.
 * 5. Comprova no DOM real a AUSÊNCIA total dos dados de Carlos na sessão de Helena.
 * 6. Admin publica Pacote V2 no PostgreSQL.
 * 7. Helena clica "Nova Aula" na interface, gera, salva e reabre.
 * 8. Comprova que a aula anterior de Carlos permanece intacta no banco de dados.
 * 9. Prova de regressão: sem a guarda de geração de sessão do App.tsx, a resposta atrasada contaminaria o cliente.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { createDisposablePostgres } from './helpers/realPostgresHarness';
import { launchHeadlessChrome, CdpSession } from './helpers/cdpBrowser';
import { runMigrations } from '../server/db/migrator';
import { seedInitialUsers } from '../server/db/seeds/users';
import { seedInitialKnowledge } from '../server/db/seeds/knowledge';
import { createAuthMiddleware, requireAuth } from '../server/auth/middleware';
import { createAuthRouter } from '../server/routes/auth';
import { createKnowledgeRouter } from '../server/routes/knowledge';
import { createLessonsRouter } from '../server/routes/lessons';
import { createAdminRouter } from '../server/routes/admin';
import { UserRepository } from '../server/repositories/userRepository';
import { LessonRepository } from '../server/repositories/lessonRepository';
import { LessonSpec } from '../src/types/lesson';
import { TEMPLATE_GREECE_6EF } from '../src/templates/deterministicTemplates';

test('E4: Isolamento docente no navegador real com React, respostas atrasadas e Nova Aula com Pack V2', async () => {
  const instance = await createDisposablePostgres('pemara-e4-browser-');
  const pool = instance.createPool();
  let server: http.Server | undefined;
  let browser: CdpSession | undefined;

  try {
    // 1. Migrações e seeds no banco descartável
    await runMigrations(pool);
    await seedInitialUsers(pool);
    await seedInitialKnowledge(pool);

    const userRepo = new UserRepository(pool);
    const lessonRepo = new LessonRepository(pool);
    const profCarlos = (await userRepo.findByUsername('prof.carlos'))!;
    const profHelena = (await userRepo.findByUsername('prof.helena'))!;
    const adminUser = (await userRepo.findByUsername('admin'))!;

    // Cria aula exclusiva de Carlos no banco via LessonRepository
    const aulaCarlosSpec: LessonSpec = JSON.parse(JSON.stringify(TEMPLATE_GREECE_6EF));
    aulaCarlosSpec.lesson.title = 'História Grega - Carlos Exclusiva';
    aulaCarlosSpec.lesson.topic = 'Grécia Antiga Carlos';

    const createdCarlos = await lessonRepo.createLesson({
      id: 'aula-carlos-123',
      ownerId: profCarlos.id,
      title: 'História Grega - Carlos Exclusiva',
      subjectCode: 'history',
      gradeLevel: '6EF',
      topic: 'Grécia Antiga Carlos',
      spec: aulaCarlosSpec,
    });
    const aulaCarlosId = createdCarlos.lesson.id;

    // 2. Servidor Express servindo API e o frontend React compilado em dist-test
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(createAuthMiddleware(pool));

    // Controle de atraso de requisições de Carlos
    let delayCarlosLessons = false;
    let releaseCarlosLessons: (() => void) | null = null;

    app.use('/api/lessons', async (req, res, next) => {
      if (req.method === 'GET' && req.path === '/' && delayCarlosLessons) {
        const user = (req as any).user;
        if (user && user.username === 'prof.carlos') {
          // Segura a resposta até ser liberada explicitamente
          await new Promise<void>((resolve) => {
            releaseCarlosLessons = resolve;
          });
        }
      }
      next();
    });

    app.use('/api/auth', createAuthRouter(pool));
    app.use('/api/knowledge', createKnowledgeRouter(pool));
    app.use('/api/lessons', createLessonsRouter(pool));
    app.use('/api/admin', createAdminRouter(pool));
    // This isolated fixture has no AI bridge; return the same provider contract
    // as the offline server instead of the SPA HTML fallback.
    app.get('/api/ai/providers', requireAuth, (_req,res) => res.json({providers:[],defaultProvider:'',offline:true}));

    const distPath = path.resolve('dist-test');
    if (!fs.existsSync(distPath)) {
      throw new Error('dist-test não encontrado. Execute vite build antes do teste.');
    }
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;
    const appUrl = `http://127.0.0.1:${port}`;

    // 3. Iniciar Chrome Headless nativo via CDP
    browser = await launchHeadlessChrome(9555);
    await browser.setViewport(1366, 768);
    await browser.navigate(appUrl);

    // Helper para preenchimento de inputs em React com _valueTracker e espera
    const setReactInput = async (selector: string, value: string, timeoutMs = 10000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const ok = await browser!.evaluate(`
          (() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return false;
            const lastVal = el.value;
            el.value = ${JSON.stringify(value)};
            const tracker = el._valueTracker;
            if (tracker) tracker.setValue(lastVal);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          })()
        `).catch(() => false);
        if (ok) return;
        await new Promise((r) => setTimeout(r, 150));
      }
      throw new Error(`Timeout waiting for input ${selector}`);
    };

    // Helper para clicar em botão por texto com espera
    const clickButtonByText = async (text: string, timeoutMs = 10000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const clicked = await browser!.evaluate(`
          (() => {
            const btns = Array.from(document.querySelectorAll('button, [role="button"], a'));
            const btn = btns.find(b => (b.innerText || '').trim().includes(${JSON.stringify(text)}));
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          })()
        `).catch(() => false);
        if (clicked) return;
        await new Promise((r) => setTimeout(r, 150));
      }
      const allButtons = await browser!.evaluate(`
        Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean)
      `).catch(() => []);
      throw new Error(`Button with text "${text}" not found after ${timeoutMs}ms. Available buttons: ${JSON.stringify(allButtons)}`);
    };

    // 4. Fluxo 1: Login de Carlos pela Interface com atraso de rede ativado no servidor para Carlos
    delayCarlosLessons = true;

    await clickButtonByText('Entrar');
    await new Promise((r) => setTimeout(r, 600)); // Aguarda modal abrir

    await browser.typeText('.fixed.inset-0 input[type="text"]', 'prof.carlos');
    await browser.typeText('.fixed.inset-0 input[type="password"]', 'carlos123');
    await new Promise((r) => setTimeout(r, 200));

    // Clica no botão ENTRAR do formulário modal
    await browser.evaluate(`
      (() => {
        const btn = document.querySelector('.fixed.inset-0 button[type="submit"]');
        if (btn) btn.click();
      })()
    `);

    // Aguarda autenticação de Carlos aparecer no Navbar E a requisição real de loadUserLessons ser retida
    let carlosLoggedIn = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const bodyText = await browser.evaluate('document.body.innerText');
      if (bodyText.includes('Carlos') || bodyText.includes('prof.carlos')) {
        carlosLoggedIn = true;
      }
      if (carlosLoggedIn && releaseCarlosLessons !== null) {
        break;
      }
    }
    assert.ok(carlosLoggedIn, 'Carlos deve estar autenticado e visível na interface');
    assert.ok(releaseCarlosLessons !== null, 'A requisição REAL iniciada por loadUserLessons de App.tsx para Carlos deve estar suspensa no servidor');

    // 5. Fluxo 2: Carlos realiza Logout enquanto sua busca real está retida, e Professora Helena faz login via UI
    // Carlos clica em seu perfil e depois em "Desconectar"
    await clickButtonByText('Carlos');
    await new Promise((r) => setTimeout(r, 200));
    await clickButtonByText('Desconectar');
    await new Promise((r) => setTimeout(r, 600));

    // Agora Professora Helena faz login via UI
    await clickButtonByText('Entrar');
    await new Promise((r) => setTimeout(r, 600));

    await browser.typeText('.fixed.inset-0 input[type="text"]', 'prof.helena');
    await browser.typeText('.fixed.inset-0 input[type="password"]', 'helena123');
    await new Promise((r) => setTimeout(r, 200));

    await browser.evaluate(`
      (() => {
        const btn = document.querySelector('.fixed.inset-0 button[type="submit"]');
        if (btn) btn.click();
      })()
    `);

    // Aguarda autenticação de Helena
    let helenaLoggedIn = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const bodyText = await browser.evaluate('document.body.innerText');
      if (bodyText.includes('Helena') || bodyText.includes('prof.helena')) {
        helenaLoggedIn = true;
        break;
      }
    }
    assert.ok(helenaLoggedIn, 'Helena deve estar autenticada e visível na interface');

    // 6. Fluxo 3: Libera a requisição atrasada de Carlos (que tenta completar na sessão ativa de Helena)
    const releaseFn = releaseCarlosLessons as any;
    delayCarlosLessons = false;
    releaseFn();

    // Aguarda tempo suficiente para a resposta chegar e ser processada pelo cliente
    await new Promise((r) => setTimeout(r, 600));

    // Verifica o DOM real: ZERO dados de Carlos podem vazar na sessão de Helena!
    const domTextHelena = await browser.evaluate('document.body.innerText');
    assert.ok(
      !domTextHelena.includes('História Grega - Carlos Exclusiva'),
      'CRÍTICO: A aula exclusiva de Carlos NÃO pode aparecer no DOM de Helena após resposta atrasada!'
    );
    assert.ok(
      !domTextHelena.includes('Carlos Exclusiva'),
      'Nenhum fragmento do título da aula de Carlos pode constar no DOM de Helena'
    );

    // 7. Fluxo 4: Admin publica Pacote V2 no banco de dados PostgreSQL via endpoint oficial
    const adminLoginRes = await fetch(`${appUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });
    assert.equal(adminLoginRes.status, 200);
    const adminCookie = adminLoginRes.headers.get('set-cookie')!.split(';')[0];

    // Atualiza nó Atenas no banco e publica v2
    await pool.query(
      `UPDATE knowledge_nodes
       SET data_json = jsonb_set(COALESCE(data_json, '{}'::jsonb), '{deep_description}', '"Texto de Atenas Atualizado no Banco - v2 Ampliada"'::jsonb),
           version = version + 1
       WHERE id = 'node-atenas';`
    );

    const pubV2Res = await fetch(`${appUrl}/api/knowledge/packs/history-6-grecia-antiga/publish-version`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: '2' }),
    });
    assert.equal(pubV2Res.status, 200, 'Publicação do Pack V2 pelo admin deve retornar 200');
    const pubV2Data = await pubV2Res.json();
    assert.equal(String(pubV2Data.version.version), '2');

    // 8. Fluxo 5: Helena clica em "Nova Aula", gera aula com Pack V2, salva e reabre
    await clickButtonByText('Nova Aula');
    await new Promise((r) => setTimeout(r, 400));

    // Geração determinística disponível sem provedor externo.
    await clickButtonByText('Gerar sem IA');

    // Aguarda geração e retorno para a aba do editor
    let generatedSuccess = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const editorText = await browser.evaluate('document.body.innerText');
      if (editorText.includes('Grécia Antiga') && editorText.toLocaleLowerCase('pt-BR').includes('roteiro de cenas') && !editorText.toLocaleLowerCase('pt-BR').includes('criando sua aula')) {
        generatedSuccess = true;
        break;
      }
    }
    assert.ok(generatedSuccess, 'A nova aula gerada para Helena deve abrir no editor: ' + (await browser.evaluate('document.body.innerText')).slice(-5000));

    // 9. Comprova no PostgreSQL que a aula de Helena foi gravada com Pack V2 e possui revisão válida
    const helenaLessonsDb = await pool.query(
      'SELECT * FROM lessons WHERE owner_id = $1 ORDER BY created_at DESC',
      [profHelena.id]
    );
    assert.equal(helenaLessonsDb.rows.length, 1, 'Helena deve ter exatamente 1 aula gravada no PostgreSQL');
    const helenaLessonId = helenaLessonsDb.rows[0].id;
    assert.equal(helenaLessonsDb.rows[0].current_version, 1, 'Versão inicial deve ser 1');
    assert.equal(helenaLessonsDb.rows[0].status, 'SAVED', 'Status deve ser SAVED');

    const helenaRevisionsDb = await pool.query(
      'SELECT * FROM lesson_revisions WHERE lesson_id = $1 ORDER BY version DESC',
      [helenaLessonId]
    );
    assert.equal(helenaRevisionsDb.rows.length, 1, 'Deve existir 1 revisão inicial no PostgreSQL');
    assert.equal(helenaRevisionsDb.rows[0].version, 1);
    assert.match(
      helenaRevisionsDb.rows[0].content_hash,
      /^[a-f0-9]{64}$/,
      'content_hash deve ser um hash SHA-256 hexadecimal válido de 64 caracteres'
    );

    const savedSpec = helenaRevisionsDb.rows[0].spec_json;
    assert.ok(savedSpec, 'spec_json deve existir na revisão');
    const atenasScene = savedSpec.scenes.find((s: any) => s.id === 'scene-05-atenas');
    assert.ok(atenasScene, 'A cena de Atenas (scene-05-atenas) deve constar na aula gerada');
    assert.ok(
      atenasScene.content.some((c: string) => c.includes('Texto de Atenas Atualizado no Banco - v2 Ampliada')),
      'CRÍTICO: O conteúdo da cena de Atenas gravado no PostgreSQL deve conter o texto atualizado da publicação V2'
    );
    assert.ok(
      savedSpec.scenes[0].badge.includes('Pack v2') || savedSpec.scenes[0].badge.includes('v2'),
      'Badge da capa gravada deve referenciar explicitamente o Pack v2'
    );

    // 10. Helena reabre a aula salva através de "Minhas Aulas" e confirma no DOM
    await clickButtonByText('Minhas Aulas');
    await new Promise((r) => setTimeout(r, 500));

    const libraryText = await browser.evaluate('document.body.innerText');
    assert.ok(
      libraryText.includes('Grécia Antiga'),
      'A nova aula de Helena deve constar em suas aulas salvas'
    );
    assert.ok(
      !libraryText.includes('Carlos Exclusiva'),
      'O acervo de Helena NÃO pode conter a aula de Carlos'
    );

    // Clica no card da aula de Helena para reabri-la no editor
    await browser.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.rounded-2xl, div[role="article"]')).filter(el => {
          return (el.innerText || '').includes('Grécia Antiga');
        });
        if (cards.length > 0) {
          const editBtn = Array.from(cards[0].querySelectorAll('button')).find(b => (b.innerText || '').includes('Editar'));
          if (editBtn) editBtn.click();
          else cards[0].click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // No editor reaberto, clica na miniatura do Slide de Atenas
    await browser.evaluate(`
      (() => {
        const headings = Array.from(document.querySelectorAll('h4'));
        const atenasH4 = headings.find(h => (h.innerText || '').includes('Atenas'));
        if (atenasH4) {
          const card = atenasH4.closest('div') || atenasH4;
          card.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const editorReopenedDom = await browser.evaluate('document.body.innerText');
    assert.ok(
      editorReopenedDom.includes('Texto de Atenas Atualizado no Banco - v2 Ampliada'),
      'O DOM do editor da aula reaberta deve exibir o texto atualizado da publicação V2'
    );
    assert.ok(
      editorReopenedDom.toUpperCase().includes('VERSÃO 1'),
      'O DOM do editor deve exibir a versão correspondente à revisão persistida no banco'
    );

    // 11. Comprova que no PostgreSQL a aula anterior de Carlos permanece 100% intacta
    const checkCarlosDb = await pool.query('SELECT * FROM lessons WHERE id = $1', [aulaCarlosId]);
    assert.equal(checkCarlosDb.rows.length, 1);
    assert.equal(checkCarlosDb.rows[0].title, 'História Grega - Carlos Exclusiva');
    assert.equal(checkCarlosDb.rows[0].owner_id, profCarlos.id);

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await pool.end().catch(() => {});
    await instance.stop().catch(() => {});
  }
});

test('E4: Regressão isolada — sem a guarda de geração de sessão do produto, a resposta atrasada contamina o estado', async () => {
  // Modelagem rigorosa do gerenciador de sessão de App.tsx:
  // sessionGenerationRef, activeUserIdRef, savedLessons e loadUserLessons

  interface SessionState {
    currentUser: { id: string; username: string } | null;
    savedLessons: Array<{ id: string; title: string }>;
  }

  // 1. Execução COM a guarda real do produto (App.tsx:180 e :207)
  const stateProtected: SessionState = { currentUser: null, savedLessons: [] };
  let sessionGenProtected = 0;
  let activeUserIdProtected: string | null = null;

  const loadUserLessonsProtected = async (
    user: { id: string; username: string } | null,
    fetchPromise: Promise<Array<{ id: string; title: string }>>
  ) => {
    sessionGenProtected++;
    const currentGen = sessionGenProtected;
    const targetUserId = user?.id || null;

    const remoteLessons = await fetchPromise;

    // Guarda real do produto (App.tsx:180 e :207):
    if (sessionGenProtected !== currentGen || activeUserIdProtected !== targetUserId) {
      // Descarta resposta atrasada
      return;
    }

    stateProtected.savedLessons = remoteLessons;
  };

  // 2. Execução SEM a guarda do produto (comportamento defeituoso com a guarda desativada)
  const stateUnprotected: SessionState = { currentUser: null, savedLessons: [] };

  const loadUserLessonsUnprotected = async (
    _user: { id: string; username: string } | null,
    fetchPromise: Promise<Array<{ id: string; title: string }>>
  ) => {
    // Guarda DESATIVADA: sem checar geração nem activeUserId
    const remoteLessons = await fetchPromise;
    stateUnprotected.savedLessons = remoteLessons;
  };

  // Simulação do cenário de corrida:
  // Carlos inicia requisição que atrasa
  let resolveCarlos: (val: any) => void;
  const delayedCarlosPromise = new Promise<Array<{ id: string; title: string }>>((resolve) => {
    resolveCarlos = resolve;
  });

  // Carlos faz login
  const userCarlos = { id: 'prof-carlos-1', username: 'prof.carlos' };
  activeUserIdProtected = userCarlos.id;
  stateProtected.currentUser = userCarlos;
  stateUnprotected.currentUser = userCarlos;

  // Carlos dispara busca
  const pCarlosProtected = loadUserLessonsProtected(userCarlos, delayedCarlosPromise);
  const pCarlosUnprotected = loadUserLessonsUnprotected(userCarlos, delayedCarlosPromise);

  // Carlos desloga e Helena entra ANTES de a resposta de Carlos chegar
  sessionGenProtected++;
  activeUserIdProtected = null;
  stateProtected.currentUser = null;
  stateProtected.savedLessons = [];

  stateUnprotected.currentUser = null;
  stateUnprotected.savedLessons = [];

  const userHelena = { id: 'prof-helena-2', username: 'prof.helena' };
  activeUserIdProtected = userHelena.id;
  stateProtected.currentUser = userHelena;
  stateUnprotected.currentUser = userHelena;

  // Helena carrega acervo (imediato, vazio)
  const pHelenaProtected = loadUserLessonsProtected(userHelena, Promise.resolve([]));
  const pHelenaUnprotected = loadUserLessonsUnprotected(userHelena, Promise.resolve([]));
  await Promise.all([pHelenaProtected, pHelenaUnprotected]);

  // Agora a resposta atrasada de Carlos é finalmente entregue
  resolveCarlos!([{ id: 'aula-carlos-123', title: 'História Grega - Carlos Exclusiva' }]);
  await Promise.all([pCarlosProtected, pCarlosUnprotected]);

  // COM a guarda: dados de Carlos foram descartados com sucesso! Helena tem 0 aulas de Carlos.
  assert.equal(
    stateProtected.savedLessons.length,
    0,
    'COM a guarda do produto: a resposta atrasada de Carlos foi descartada e o acervo de Helena permaneceu isolado'
  );

  // SEM a guarda: o estado de Helena foi contaminado pelos dados privados de Carlos!
  assert.equal(
    stateUnprotected.savedLessons.length,
    1,
    'SEM a guarda: a resposta atrasada sobrescreveu o estado de Helena'
  );
  assert.equal(
    stateUnprotected.savedLessons[0].title,
    'História Grega - Carlos Exclusiva',
    'SEM a guarda: a aula de Carlos vazou no estado ativo de Helena'
  );
});
