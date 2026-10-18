import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { OpenCode } from '../../pilotos/openchamber/source/node_modules/@opencode/client/dist/promise/index.js';
const here = path.dirname(fileURLToPath(import.meta.url));
export const evidence = path.resolve(here, '../../build/openchamber/2.4.0-pemara.1/evidencias');
export const installed = process.env.PEMARA_TEST_APP || path.join(process.env.LOCALAPPDATA, 'Programs/PEMARA OpenChamber/PEMARA OpenChamber.exe');
export const project = path.join(process.env.USERPROFILE, 'Documents/PEMARA Aulas/Minhas aulas');
const require = createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function connect() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9341', { timeout: 10000 });
  const page = browser.contexts()[0].pages().find(p => p.url().startsWith('openchamber-ui:')) || browser.contexts()[0].pages()[0];
  await page.getByRole('button', { name: 'Abrir menu do OpenChamber', exact: true }).waitFor({ timeout: 45000 });
  const connection = await page.evaluate(() => ({ baseUrl: window.__OPENCHAMBER_API_BASE_URL__, headers: window.__OPENCHAMBER_RUNTIME_HEADERS__ }));
  const client = OpenCode.make({ ...connection, headers: { ...connection.headers, 'x-opencode-directory': encodeURIComponent(project.replaceAll('\\','/')) } });
  return { browser, page, client };
}
export function launch() {
  const child = spawn(installed, ['--remote-debugging-port=9341'], { detached: true, windowsHide: true, stdio: 'ignore' });
  child.unref();
  return child.pid;
}
async function snapshot(client) {
  const list = await client.session.list({ limit: 100, order: 'desc' });
  const sessions = {};
  for (const session of list.data) sessions[session.id] = await client.session.export({ sessionID: session.id });
  const files = {};
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file);
      else files[file] = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
    }
  }
  await visit(path.dirname(project));
  return { sessions, files };
}
export async function close(current) {
  const origin = await current.page.evaluate(() => new URL(window.__OPENCHAMBER_API_BASE_URL__).origin);
  await current.page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  for (let i = 0; i < 120; i++) {
    const alive = await Promise.all([origin, 'http://127.0.0.1:9341'].map(async url => {
      try { await fetch(url + '/health', { signal: AbortSignal.timeout(400) }); return true; } catch { return false; }
    }));
    if (alive.every(x => !x)) { await current.browser.close().catch(() => {}); return; }
    await wait(500);
  }
  throw new Error('O aplicativo ou backend permaneceu aberto');
}
export async function awaitOpen() {
  for (let i = 0; i < 100; i++) {
    try { const response = await fetch('http://127.0.0.1:9341/json/version', { signal: AbortSignal.timeout(400) }); if (response.ok) return connect(); } catch {}
    await wait(500);
  }
  throw new Error('Aplicativo não abriu');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = { startedAt: new Date().toISOString(), checks: {}, passed: false };
  let current;
  try {
    current = await connect();
    const active = await current.client.session.active();
    assert.equal(Object.keys(active).length, 0, 'A geração deve terminar antes do teste de persistência');
    const before = await snapshot(current.client);
    const messages = Object.values(before.sessions).flatMap(s => s.messages);
    assert.ok(messages.some(m => m.type === 'assistant' && m.content?.length), 'Exigir resposta real da IA');
    assert.ok(before.files[path.join(project, 'teste-professor.html')], 'Exigir arquivo real criado pela IA');
    await fs.writeFile(path.join(evidence, 'installed-before.json'), JSON.stringify(before, null, 2));
    await current.page.locator('.cm-content').first().fill('Próxima aula: evaporação e condensação.');
    await wait(1000);
    await current.page.screenshot({ path: path.join(evidence, 'instalado-antes-fechar.png') });
    await close(current);
    report.checks.completeShutdown = true;
    launch();
    current = await awaitOpen();
    await current.page.locator('.cm-content').filter({ hasText: 'Próxima aula: evaporação e condensação.' }).waitFor({ timeout: 30000 });
    report.checks.draftRestored = true;
    const after = await snapshot(current.client);
    assert.deepEqual(after.files, before.files);
    for (const [id, session] of Object.entries(before.sessions)) assert.deepEqual(after.sessions[id].messages, session.messages);
    report.checks.messagesAndFilesIdentical = true;
    report.sessions = Object.keys(after.sessions).length;
    report.messages = Object.values(after.sessions).reduce((count, s) => count + s.messages.length, 0);
    report.files = Object.keys(after.files).length;
    await current.page.getByRole('region', { name: 'Arquivos', exact: true }).getByText('teste-professor.html', { exact: true }).waitFor({ timeout: 15000 });
    await current.page.keyboard.press('Control+j');
    assert.equal(await current.page.locator('.xterm').count(), 0);
    report.checks.fileVisibleAndNoTerminal = true;
    await current.page.screenshot({ path: path.join(evidence, 'instalado-depois-reabrir.png') });
    await fs.writeFile(path.join(evidence, 'installed-after.json'), JSON.stringify(after, null, 2));
    report.passed = true;
  } catch (error) { report.error = String(error); process.exitCode = 1; }
  finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(evidence, 'reabertura-instalado.json'), JSON.stringify(report, null, 2));
    console.log(report);
    if (current) await current.browser.close().catch(() => {});
  }
}
