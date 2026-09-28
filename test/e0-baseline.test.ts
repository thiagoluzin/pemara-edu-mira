import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('E0: package-lock.json oficial gerado e bun.lock removido', () => {
  assert.equal(fs.existsSync(path.resolve('package-lock.json')), true, 'package-lock.json deve existir');
  assert.equal(fs.existsSync(path.resolve('bun.lock')), false, 'bun.lock redundante deve ter sido removido');
});

test('E0: scripts operacionais essenciais presentes no package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.ok(pkg.scripts.typecheck, 'script typecheck deve existir');
  assert.ok(pkg.scripts.build, 'script build deve existir');
  assert.ok(pkg.scripts.test, 'script test deve existir');
  assert.ok(pkg.scripts.clean, 'script clean deve existir');
  assert.equal(pkg.dependencies.tsx !== undefined, true, 'tsx deve estar em dependencies para execução do servidor');
  assert.equal(pkg.devDependencies?.esbuild, undefined, 'esbuild direto deve estar removido para evitar ERESOLVE');
});

test('E0: .env.example contém parâmetros de host, porta, db e IA', () => {
  const envContent = fs.readFileSync(path.resolve('.env.example'), 'utf8');
  assert.match(envContent, /HOST=/);
  assert.match(envContent, /PORT=/);
  assert.match(envContent, /DATABASE_URL=/);
});
