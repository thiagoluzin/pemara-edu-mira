import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const stage = path.resolve(here, '../../build/openchamber/2.4.0-pemara.1');
const code = fs.readFileSync(path.join(here, 'bootstrap.mjs'), 'utf8').replace(/^import .*;\r?\n/gm, '');
const execute = new Function('fs', 'path', 'app', 'process', code.replace(/^export /gm, ''));
test('first use and repeated startup preserve files, settings and Electron state without inheriting credentials', () => {
  const root = fs.mkdtempSync(path.join(stage, 'bootstrap-test-'));
  const app = { getPath: name => { assert.equal(name, 'documents'); return path.join(root, 'Documentos do Professor João'); } };
  const freshProcess = () => ({
    resourcesPath: stage, cwd: '', chdir(value) { this.cwd = value; },
    env: { LOCALAPPDATA: path.join(root, 'Local'), SystemRoot: process.env.SystemRoot,
      CHROME_CRASHPAD_PIPE_NAME: 'test-only-crash-handler', OPENAI_API_KEY: 'fake-key', GITHUB_TOKEN: 'fake-token',
      OPENCHAMBER_DATA_DIR: 'must-not-use', NODE_OPTIONS: '--inspect=9999', PATH: 'C:/host-tools' },
  });
  const proc = freshProcess();
  execute(fs, path, app, proc);
  const settings = path.join(root, 'Local/PEMARAOpenChamber/perfil/.config/openchamber/settings.json');
  assert.equal(JSON.parse(fs.readFileSync(settings, 'utf8')).lastSelectedModel, 'opencode/deepseek-v4.1-flash-free');
  assert.equal(proc.env.CHROME_CRASHPAD_PIPE_NAME, 'test-only-crash-handler');
  for (const key of ['OPENAI_API_KEY','GITHUB_TOKEN','NODE_OPTIONS']) assert.equal(proc.env[key], undefined);
  assert.ok(!proc.env.PATH.includes('C:/host-tools'));
  assert.ok(fs.existsSync(path.join(proc.cwd, 'LEIA-ME.txt')));
  const lesson = path.join(app.getPath('documents'), 'PEMARA Aulas/Aula de exemplo/aula.html');
  fs.writeFileSync(lesson, 'Aula editada pelo professor');
  fs.writeFileSync(settings, '{"locale":"pt-BR","lastSelectedModel":"escolha-do-professor"}');
  execute(fs, path, app, freshProcess());
  assert.equal(fs.readFileSync(lesson, 'utf8'), 'Aula editada pelo professor');
  assert.equal(JSON.parse(fs.readFileSync(settings, 'utf8')).lastSelectedModel, 'escolha-do-professor');
});
