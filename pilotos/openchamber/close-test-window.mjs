import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { connect } from './probe.mjs';
import { root } from './launch.mjs';

const { browser, page } = await connect();
const origin = await page.evaluate(() => new URL(window.__OPENCHAMBER_API_BASE_URL__).origin);
await page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
let stopped = false;
for (let attempt = 0; attempt < 80; attempt++) {
  const alive = await Promise.all([origin, 'http://127.0.0.1:9337'].map(async url => {
    try { await fetch(url + '/health', { signal: AbortSignal.timeout(500) }); return true; }
    catch { return false; }
  }));
  if (alive.every(value => !value)) { stopped = true; break; }
  await new Promise(resolve => setTimeout(resolve, 500));
}
assert.ok(stopped, 'Desktop and local server must stop before opening the shortcut');
await fs.writeFile(root + '/evidencias/abertura-atalho-preparo.json', JSON.stringify({ origin, stopped, checkedAt: new Date().toISOString() }, null, 2));
await browser.close().catch(() => {});
console.log('Janela de teste e servidor local encerrados.');
