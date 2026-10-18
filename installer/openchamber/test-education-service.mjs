import { startEducation } from './education-service.mjs';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const stage = path.resolve('build/openchamber/2.4.0-pemara.4');
const service = await startEducation({ root: path.join(stage, 'education'), dataDir: path.join(stage, 'test-fresh-data') });
try {
  const ready = await (await fetch(service.url + '/ready')).json();
  assert.equal(ready.ready, true);
  assert.equal((await (await fetch(service.url + '/api/auth/me')).json()).user.local, true);
  assert.equal((await fetch(service.url + '/api/lessons', { headers: { Origin: 'https://outside.invalid' } })).status, 403);
  assert.equal((await (await fetch(service.url + '/api/ai/providers')).json()).offline, true);
  fs.writeFileSync(path.join(stage, 'evidencias/service-fresh.json'), JSON.stringify({ passed: true, ready }));
} finally { await service.stop(); }
console.log('Fresh database, local authentication, origin guard, offline mode, clean shutdown: passed');
