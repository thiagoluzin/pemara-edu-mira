import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { launch, awaitOpen, evidence } from './test-installed.mjs';
const before = JSON.parse(await fs.readFile(path.join(evidence, 'installed-after.json'), 'utf8'));
const report = { startedAt: new Date().toISOString(), passed: false, checks: {} };
let current;
try {
  launch();
  current = await awaitOpen();
  report.checks.finalInstallerStartsWithSandbox = true;
  for (const [id, session] of Object.entries(before.sessions)) {
    const after = await current.client.session.export({ sessionID: id });
    assert.deepEqual(after.messages, session.messages);
  }
  for (const [file, hash] of Object.entries(before.files)) {
    assert.equal(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'), hash);
  }
  await current.page.getByRole('region', { name: 'Arquivos', exact: true }).getByText('teste-professor.html', { exact: true }).waitFor({ timeout: 20000 });
  await current.page.locator('.cm-content').filter({ hasText: 'Próxima aula: evaporação e condensação.' }).waitFor({ timeout: 15000 });
  await current.page.screenshot({ path: path.join(evidence, 'instalador-final-reaberto.png') });
  report.checks.messagesFilesAndDraftPreservedAfterReinstall = true;
  report.sessions = Object.keys(before.sessions).length;
  report.messages = Object.values(before.sessions).reduce((n,s) => n + s.messages.length, 0);
  report.files = Object.keys(before.files).length;
  report.passed = true;
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(evidence, 'instalador-final-testes.json'), JSON.stringify(report, null, 2));
  console.log(report);
  if (current) await current.browser.close().catch(() => {});
}
