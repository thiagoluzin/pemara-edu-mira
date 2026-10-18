import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { connect, evidence, project } from './test-installed.mjs';
const require = createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const report = { startedAt: new Date().toISOString(), checks: {}, passed: false };
let app, standalone;
async function controls(surface) {
  await surface.locator('#btn-notas').click();
  assert.ok(await surface.locator('#notas').isVisible());
  await surface.locator('#btn-notas').click();
  assert.ok(!await surface.locator('#notas').isVisible());
  for (let i = 0; i < 3; i++) {
    await surface.locator('#btn-reiniciar').click();
    const answer = surface.locator('.alternativa').nth(i);
    const correct = await answer.getAttribute('data-correta') === 'true';
    await answer.click();
    assert.match(await surface.locator('#feedback').getAttribute('class'), correct ? /\bok\b/ : /\bnao\b/);
  }
}
try {
  const file = path.join(project, 'teste-professor.html');
  const html = await fs.readFile(file, 'utf8');
  for (const concept of ['superfície', 'temperatura ambiente', 'ebulição']) assert.ok(html.includes(concept), concept);
  app = await connect();
  const session = await app.client.session.get({ sessionID: 'ses_eafd970e2ffeORHg6aY427Qef3' });
  const exported = await app.client.session.export({ sessionID: session.id });
  const tools = exported.messages.filter(m => m.type === 'assistant').flatMap(m => m.content || []).filter(c => c.type === 'tool').map(c => c.name);
  assert.ok(session.tokens.output > 0);
  assert.equal(session.cost, 0);
  assert.ok(!tools.some(name => /shell|bash|terminal/i.test(name)));
  report.ai = { sessionId: session.id, model: session.model, tokens: session.tokens, reportedCost: session.cost, tools: [...new Set(tools)] };
  await app.page.getByRole('region', { name: 'Arquivos', exact: true }).getByRole('button', { name: 'teste-professor.html', exact: true }).click();
  const frame = app.page.frameLocator('iframe');
  await frame.locator('#btn-notas').waitFor({ timeout: 15000 });
  await controls(frame);
  report.checks.installedPreviewControls = true;
  await app.page.screenshot({ path: path.join(evidence, 'html-revisado-no-programa.png') });
  await app.page.getByRole('button', { name: 'Fechar aba teste-professor.html', exact: true }).click();
  standalone = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await standalone.newContext({ offline: true, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const external = [], errors = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(file).href);
  await controls(page);
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  report.checks.standaloneOfflineControls = true;
  report.checks.noRemoteResourcesOrScriptErrors = true;
  await page.screenshot({ path: path.join(evidence, 'html-revisado-offline.png'), fullPage: true });
  report.passed = true;
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally {
  await standalone?.close().catch(() => {});
  await app?.browser.close().catch(() => {});
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(evidence, 'html-gerado-testes.json'), JSON.stringify(report, null, 2));
  console.log(report);
}
