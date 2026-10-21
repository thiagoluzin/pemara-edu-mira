import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {connectWindowsUserFolders} from './known-folder-links.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const stage = path.resolve(here, '../../build/openchamber/2.4.0-pemara.1');
const code = fs.readFileSync(path.join(here, 'bootstrap.mjs'), 'utf8').replace(/^import .*;\r?\n/gm, '');
const run = new Function('fs', 'path', 'app', 'process', 'connectWindowsUserFolders', code.replace(/^export /gm, ''));
const execute=(fs,path,app,process)=>run(fs,path,app,process,connectWindowsUserFolders);
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
  assert.equal(fs.existsSync(path.dirname(lesson)), false, 'Primeira abertura não cria aula de exemplo');
  assert.equal(JSON.parse(fs.readFileSync(settings, 'utf8')).projects.length, 1);
  assert.deepEqual(fs.readdirSync(proc.cwd), ['LEIA-ME.txt']);
  // Simulate pre-existing teacher data: an update must preserve it.
  fs.mkdirSync(path.dirname(lesson), {recursive:true});
  fs.writeFileSync(lesson, 'Aula editada pelo professor');
  fs.writeFileSync(settings, '{"locale":"pt-BR","lastSelectedModel":"escolha-do-professor"}');
  execute(fs, path, app, freshProcess());
  assert.equal(fs.readFileSync(lesson, 'utf8'), 'Aula editada pelo professor');
  assert.equal(JSON.parse(fs.readFileSync(settings, 'utf8')).lastSelectedModel, 'escolha-do-professor');
});

test('clean edition keeps all runtime and project paths separate from the existing profile', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-clean-bootstrap-'));
  const resources=path.join(root,'resources');
  fs.mkdirSync(path.join(resources,'pemara'),{recursive:true});
  fs.writeFileSync(path.join(resources,'pemara/distribution.json'),JSON.stringify({edition:'clean-test'}));
  for(const variant of ['dark','light'])fs.copyFileSync(path.join(here,`assets/pemara-${variant}.json`),path.join(resources,`pemara/pemara-${variant}.json`));
  const local=path.join(root,'Local'),documents=path.join(root,'Documents');
  const old=path.join(local,'PEMARAOpenChamber/perfil');
  fs.mkdirSync(old,{recursive:true});fs.writeFileSync(path.join(old,'sentinel.txt'),'preserve');
  fs.mkdirSync(documents,{recursive:true});
  const proc={platform:'win32',resourcesPath:resources,cwd:'',chdir(value){this.cwd=value;},env:{LOCALAPPDATA:local,USERPROFILE:root,SystemRoot:process.env.SystemRoot,PATH:'test'}};
  execute(fs,path,{getPath:()=>documents},proc);
  assert.equal(proc.cwd,path.join(documents,'PEMARA Aulas - Teste Limpo/Minhas aulas'));
  assert.equal(proc.env.HOME,path.join(local,'PEMARAEduTesteLimpo/perfil'));
  assert.equal(proc.env.USERPROFILE,proc.env.HOME,'AI profile remains isolated');
  assert.equal(fs.realpathSync(path.join(proc.env.HOME,'Desktop')),fs.realpathSync(documents));
  assert.equal(fs.realpathSync(path.join(proc.env.HOME,'Downloads')),fs.realpathSync(documents));
  assert.deepEqual(fs.readdirSync(old),['sentinel.txt']);
  assert.equal(fs.readFileSync(path.join(old,'sentinel.txt'),'utf8'),'preserve');
  assert.equal(fs.existsSync(path.join(documents,'PEMARA Aulas')),false);
});
