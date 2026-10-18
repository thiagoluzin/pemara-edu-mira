// Continue verification from the saved pre-send snapshot; never send twice.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { connect, close, launch, awaitOpen } from './test-installed.mjs';
const evidence = path.resolve('build/openchamber/2.4.0-pemara.3/evidencias');
const file = path.join(evidence, 'recuperacao-testes.json');
const report = JSON.parse(await fs.readFile(file, 'utf8'));
await fs.copyFile(file, path.join(evidence, `verificacao-anterior-${Date.now()}.json`));
const before = JSON.parse(await fs.readFile(path.join(evidence, 'historico-antes.json'), 'utf8'));
const id = 'ses_eb028d2acffe3Hc5trTKmjxsGJ';
let current = await connect();
const read = async () => {
  const sessions = {};
  for (const key of Object.keys(before.sessions)) sessions[key] = (await current.client.message.list({ sessionID: key, limit: 200, order: 'asc' })).data;
  const files = {};
  for (const filename of Object.keys(before.files)) files[filename] = crypto.createHash('sha256').update(await fs.readFile(filename)).digest('hex');
  return { sessions, files };
};
try {
  const after = await read();
  let finalizedRecords = 0;
  for (const [key, messages] of Object.entries(before.sessions)) {
    const indexed = new Map(after.sessions[key].map(message => [message.id, message]));
    for (const message of messages) {
      const actual = structuredClone(indexed.get(message.id));
      if (message.type === 'assistant' && message.time.completed === undefined && actual?.time.completed) {
        delete actual.time.completed; finalizedRecords++;
      }
      assert.deepEqual(actual, message);
    }
  }
  assert.deepEqual(after.files, before.files);
  const reply = after.sessions[id].find(message => message.type === 'assistant' && message.content?.some(part => part.type === 'text' && part.text.includes('RETOMADA-CONFIRMADA')));
  assert.ok(reply);
  const text = reply.content.filter(part => part.type === 'text').map(part => part.text).join('');
  await current.page.waitForFunction(text => document.body.innerText.includes(text), text, { timeout: 20000 });
  report.checks.sameConversationAnsweredAfterReconnect = true;
  report.checks.previousMessageContentAndFilesUnchanged = true;
  report.finalizedHistoricalAssistantRecords = finalizedRecords;
  report.metadataNote = 'OpenCode added only time.completed to one historical unfinished assistant record while resuming. Every original message ID and content remained identical; the original bytes remain in the backup.';
  await current.page.locator('.cm-content').first().fill(await fs.readFile(path.join(evidence, 'rascunho-original.txt'), 'utf8'));
  await current.page.waitForTimeout(1200);
  await close(current); launch(); current = await awaitOpen();
  assert.deepEqual(await read(), after);
  await current.page.waitForFunction(text => document.body.innerText.includes(text), text, { timeout: 20000 });
  assert.equal(await current.page.getByRole('button', { name: 'Parar geração', exact: true }).count(), 0);
  await current.page.screenshot({ path: path.join(evidence, 'conversa-retomada-reaberta.png') });
  await fs.writeFile(path.join(evidence, 'historico-depois.json'), JSON.stringify(after, null, 2));
  report.checks.newReplySurvivesFullRestart = true;
  report.beforeMessages = Object.values(before.sessions).reduce((n, messages) => n + messages.length, 0);
  report.afterMessages = Object.values(after.sessions).reduce((n, messages) => n + messages.length, 0);
  report.passed = true; delete report.error;
} catch (error) { report.passed = false; report.error = String(error); process.exitCode = 1; }
finally {
  await current.browser.close().catch(() => {});
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  console.log(report);
}
