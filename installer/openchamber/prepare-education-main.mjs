import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stage } from './release.mjs';

const target = stage + '-principal';
const bundle = path.join(target, 'bundle');
assert.ok(!fs.existsSync(bundle), 'Preserve an existing prepared bundle; use a fresh version.');
fs.mkdirSync(path.join(target, 'evidencias'), {recursive: true});
fs.mkdirSync(path.join(target, 'distribution'), {recursive: true});
fs.cpSync(path.join(stage, 'bundle'), bundle, {recursive: true});
for (const file of ['entry.mjs', 'main.mjs', 'early-startup.mjs']) {
  const name = path.join(bundle, file);
  const original = fs.readFileSync(name, 'utf8');
  assert.ok(original.includes('pemara-edu-clean') || original.includes('br.com.pemara.edu.clean'), 'Identity anchor missing: ' + file);
  fs.writeFileSync(name, original
    .replaceAll('br.com.pemara.edu.clean', 'br.com.pemara.openchamber')
    .replaceAll('pemara-edu-clean', 'pemara-openchamber')
    .replaceAll('setName("PEMARA EDU Teste Limpo")', 'setName("PEMARA EDU")'));
}
fs.writeFileSync(path.join(target, 'distribution/distribution.json'), JSON.stringify({
  edition: 'existing-profile', profileDirectory: 'PEMARAOpenChamber', documentsDirectory: 'PEMARA Aulas',
}));
console.log(JSON.stringify({target, profile: 'PEMARAOpenChamber', documents: 'PEMARA Aulas'}));
