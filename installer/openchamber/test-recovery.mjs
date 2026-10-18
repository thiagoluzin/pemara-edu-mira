import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { connect, close, launch, awaitOpen, project, installed } from './test-installed.mjs';
const evidence = path.resolve('build/openchamber/2.4.0-pemara.3/evidencias');
const stuckId = 'ses_eb028d2acffe3Hc5trTKmjxsGJ';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function snapshot(client) {
  const sessions = {};
  for (const session of (await client.session.list({ limit: 200 })).data) {
    const records = [];
    let cursor;
    do {
      const page = await client.message.list({ sessionID: session.id, limit: 200, ...(cursor ? { cursor } : { order: 'asc' }) });
      records.push(...page.data);
      cursor = page.next;
      if (page.data.length < 200) break;
    } while (cursor);
    sessions[session.id] = records;
  }
  const files = {};
  async function visit(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      if (item.name.startsWith('.')) continue;
      const file = path.join(dir, item.name);
      if (item.isDirectory()) await visit(file);
      else files[file] = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
    }
  }
  await visit(path.dirname(project));
  return { sessions, files };
}
async function settle(client, id, timeout = 120000) {
  const deadline = Date.now() + timeout;
  do {
    if (!(await client.session.active())[id]) return;
    await wait(1000);
  } while (Date.now() < deadline);
  throw new Error('Generation did not settle');
}
const report = { startedAt: new Date().toISOString(), executable: installed, passed: false, checks: {}, limits: ['Internet loss is emulated in Chromium. The AI engine keeps its own connection. A process-only outage proxy was blocked by automatic policy review.'] };
let current;
try {
  current = await connect();
  const before = await snapshot(current.client);
  await fs.writeFile(path.join(evidence, 'historico-antes.json'), JSON.stringify(before, null, 2));
  await current.page.getByText('Sessão sem título', { exact: true }).first().click();
  await current.page.getByText('Sua conversa e os arquivos salvos continuam aqui.', { exact: false }).waitFor({ timeout: 30000 });
  assert.equal(await current.page.getByRole('button', { name: 'Parar geração', exact: true }).count(), 0);
  const draft = await current.page.locator('.cm-content').first().innerText();
  await fs.writeFile(path.join(evidence, 'rascunho-original.txt'), draft);
  report.checks.oldInterruptedConversationReleased = true;
  await current.page.screenshot({ path: path.join(evidence, 'indicador-corrigido.png') });
  const disconnected = [];
  current.page.on('requestfailed', request => { if (request.failure()?.errorText.includes('INTERNET_DISCONNECTED')) disconnected.push(new URL(request.url()).pathname); });
  await current.page.locator('.cm-content').first().fill('RASCUNHO-RECUPERACAO: continuar a aula de evaporação.');
  await wait(1200);
  await current.page.context().setOffline(true);
  const failed = await current.page.evaluate(async () => {
    try { await fetch(new URL('/health', window.__OPENCHAMBER_API_BASE_URL__), { headers: window.__OPENCHAMBER_RUNTIME_HEADERS__ }); return false; } catch { return true; }
  });
  assert.equal(failed, true, 'Network cut must actually fail a request');
  await wait(2500);
  assert.match(await current.page.locator('.cm-content').first().innerText(), /RASCUNHO-RECUPERACAO/);
  await current.page.screenshot({ path: path.join(evidence, 'conexao-cortada.png') });
  await current.page.context().setOffline(false);
  await wait(5000);
  const restored = await snapshot(current.client);
  assert.deepEqual(restored, before);
  report.checks.offlineThenOnlinePreservesAllRecordsAndFiles = true;
  report.offlineFailedRequests = disconnected.length;
  assert.ok(disconnected.length > 0);
  await close(current);
  launch(); current = await awaitOpen();
  await current.page.locator('.cm-content').filter({ hasText: 'RASCUNHO-RECUPERACAO' }).waitFor({ timeout: 20000 });
  await current.page.getByText('Sua conversa e os arquivos salvos continuam aqui.', { exact: false }).waitFor({ timeout: 25000 });
  assert.deepEqual(await snapshot(current.client), before);
  report.checks.closeAndReopenPreservesDraftAndAllRecords = true;
  // Continue in the very session that was stuck, without altering lesson files.
  await current.page.locator('.cm-content').first().fill('Teste de retomada da mesma conversa: não crie nem altere arquivos e não execute ferramentas. Responda apenas em duas frases, em português, explicando por que a evaporação acontece também à temperatura ambiente. Termine com RETOMADA-CONFIRMADA.');
  await current.page.locator('.cm-content').first().press('Enter');
  await current.page.getByRole('button', { name: 'Parar geração', exact: true }).waitFor({ timeout: 20000 });
  const acceptedDeadline = Date.now() + 20000;
  while (!(await current.client.session.active())[stuckId]) {
    if (Date.now() > acceptedDeadline) throw new Error('Backend did not accept the new turn');
    await wait(100);
  }
  report.checks.newTurnReallyStartsInSameConversation = true;
  // Lose the renderer connection while the real provider request is running.
  await current.page.context().setOffline(true);
  await wait(3000);
  await current.page.context().setOffline(false);
  await settle(current.client, stuckId);
  await current.page.getByRole('button', { name: 'Parar geração', exact: true }).waitFor({ state: 'detached', timeout: 30000 });
  const after = await snapshot(current.client);
  const replies = after.sessions[stuckId].filter(message => message.type === 'assistant' && message.content?.some(part => part.type === 'text' && part.text.includes('RETOMADA-CONFIRMADA')));
  assert.ok(replies.length > 0, 'Require a real model response in the old conversation');
  for (const [id, records] of Object.entries(before.sessions)) {
    const currentRecords = new Map(after.sessions[id].map(message => [message.id, message]));
    for (const record of records) {
      const actual = structuredClone(currentRecords.get(record.id));
      // OpenCode closes an old unfinished assistant record when a new turn
      // starts. Its content and identity must remain exactly unchanged.
      if (record.type === 'assistant' && record.time.completed === undefined && actual?.time.completed) delete actual.time.completed;
      assert.deepEqual(actual, record, `Original message content changed: ${record.id}`);
    }
  }
  assert.deepEqual(after.files, before.files);
  report.checks.sameConversationAnsweredAfterReconnect = true;
  report.checks.previousMessageContentAndFilesUnchanged = true;
  await current.page.locator('.cm-content').first().fill(draft);
  await wait(1200);
  await close(current);
  launch(); current = await awaitOpen();
  const reopened = await snapshot(current.client);
  assert.deepEqual(reopened, after);
  await current.page.getByRole('button', { name: 'Parar geração', exact: true }).waitFor({ state: 'detached', timeout: 20000 });
  await current.page.screenshot({ path: path.join(evidence, 'conversa-retomada-reaberta.png') });
  report.checks.newReplySurvivesFullRestart = true;
  report.beforeMessages = Object.values(before.sessions).reduce((n,messages) => n + messages.length, 0);
  report.afterMessages = Object.values(after.sessions).reduce((n,messages) => n + messages.length, 0);
  await fs.writeFile(path.join(evidence, 'historico-depois.json'), JSON.stringify(reopened, null, 2));
  report.passed = true;
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally {
  if (current) { await current.page.context().setOffline(false).catch(() => {}); await current.browser.close().catch(() => {}); }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(evidence, 'recuperacao-testes.json'), JSON.stringify(report, null, 2));
  console.log(report);
}
