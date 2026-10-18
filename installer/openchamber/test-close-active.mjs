import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { connect, close, launch, awaitOpen } from './test-installed.mjs';
const evidence = path.resolve('build/openchamber/2.4.0-pemara.3/evidencias');
const id = 'ses_eb028d2acffe3Hc5trTKmjxsGJ';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { startedAt: new Date().toISOString(), passed: false, checks: {} };
let current;
try {
  current = await connect();
  const originalDraft = await current.page.locator('.cm-content').first().innerText();
  const before = (await current.client.message.list({ sessionID: id, limit: 200 })).data;
  await current.page.locator('.cm-content').first().fill('TESTE-FECHAR-EM-GERACAO: não use ferramentas, não crie nem altere arquivos. Escreva uma explicação didática de 800 palavras sobre evaporação para o professor.');
  await current.page.locator('.cm-content').first().press('Enter');
  await current.page.getByRole('button', { name: 'Parar geração', exact: true }).waitFor({ timeout: 20000 });
  const acceptedDeadline = Date.now() + 20000;
  while (!(await current.client.session.active())[id]) {
    if (Date.now() > acceptedDeadline) throw new Error('Backend did not accept the new turn');
    await wait(100);
  }
  assert.ok((await current.client.session.active())[id], 'Require a running backend turn before closing');
  report.checks.backendWasRunningAtClose = true;
  const during = (await current.client.message.list({ sessionID: id, limit: 200 })).data;
  assert.ok(during.some(message => message.type === 'user' && message.text.includes('TESTE-FECHAR-EM-GERACAO')));
  await fs.writeFile(path.join(evidence, 'mensagens-antes-fechar-ativo.json'), JSON.stringify(during, null, 2));
  await close(current);
  report.checks.windowAndBackendClosed = true;
  launch(); current = await awaitOpen();
  await current.page.getByRole('button', { name: 'Parar geração', exact: true }).waitFor({ state: 'detached', timeout: 30000 });
  const reopened = (await current.client.message.list({ sessionID: id, limit: 200 })).data;
  const indexed = new Map(reopened.map(message => [message.id, message]));
  for (const message of before) assert.deepEqual(indexed.get(message.id), message);
  for (const message of during.filter(message => message.type === 'user')) assert.deepEqual(indexed.get(message.id), message);
  report.checks.previousHistoryAndNewPromptSurviveClose = true;
  report.checks.noStuckIndicatorAfterReopen = true;
  await current.page.screenshot({ path: path.join(evidence, 'reaberto-apos-geracao-interrompida.png') });
  await current.page.locator('.cm-content').first().fill('Retome nesta mesma conversa. Não use ferramentas nem altere arquivos. Responda somente: A conversa foi retomada após fechar o programa.');
  await current.page.locator('.cm-content').first().press('Enter');
  await current.page.getByRole('button', { name: 'Parar geração', exact: true }).waitFor({ timeout: 20000 });
  const resumeAcceptedDeadline = Date.now() + 20000;
  while (!(await current.client.session.active())[id]) {
    if (Date.now() > resumeAcceptedDeadline) throw new Error('Backend did not accept the resume');
    await wait(100);
  }
  const deadline = Date.now() + 120000;
  while ((await current.client.session.active())[id]) {
    if (Date.now() > deadline) throw new Error('Resume timed out');
    await wait(1000);
  }
  const final = (await current.client.message.list({ sessionID: id, limit: 200 })).data;
  assert.ok(final.some(message => message.type === 'assistant' && message.content?.some(part => part.type === 'text' && part.text.includes('A conversa foi retomada após fechar o programa'))));
  await current.page.getByRole('button', { name: 'Parar geração', exact: true }).waitFor({ state: 'detached', timeout: 20000 });
  await current.page.locator('.cm-content').first().fill(originalDraft);
  await wait(1200);
  await current.page.screenshot({ path: path.join(evidence, 'retomada-apos-fechar.png') });
  await fs.writeFile(path.join(evidence, 'mensagens-finais.json'), JSON.stringify(final, null, 2));
  report.checks.realReplyAfterRestartInSameConversation = true;
  report.passed = true;
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally {
  if (current) await current.browser.close().catch(() => {});
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(evidence, 'fechar-durante-geracao.json'), JSON.stringify(report, null, 2));
  console.log(report);
}
