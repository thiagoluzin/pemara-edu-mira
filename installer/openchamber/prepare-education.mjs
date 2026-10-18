import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const stage = path.join(repo, 'build/openchamber/2.4.0-pemara.6');
const target = path.join(stage, 'education');
if (!process.argv.includes('--bundle-only')) {
fs.mkdirSync(target, { recursive: true });
for (const dir of ['src', 'server']) fs.cpSync(path.join(repo, dir), path.join(target, dir), { recursive: true });
fs.copyFileSync(path.join(repo, 'server.ts'), path.join(target, 'server.ts'));
fs.copyFileSync(path.join(repo, 'tsconfig.json'), path.join(target, 'tsconfig.json'));
fs.mkdirSync(path.join(target, 'scripts'), { recursive: true });
fs.copyFileSync(path.join(repo, 'scripts/compilar-acervo-bncc.ts'), path.join(target, 'scripts/compilar-acervo-bncc.ts'));
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'pemara-education-runtime', private: true, type: 'module' }));
fs.copyFileSync(path.join(repo, 'LICENSE'), path.join(target, 'LICENSE'));
const copied = new Map();
function resolvePackage(name, from) {
  let directory = from;
  while (true) {
    const candidate = path.join(directory, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(directory); if (parent === directory) return;
    directory = parent;
  }
}
function copyPackage(name, from, optional = false) {
  const source = resolvePackage(name, from);
  if (!source) { if (optional) return; throw new Error(`Missing installed dependency: ${name}`); }
  if (copied.has(source)) return;
  const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
  if (pkg.os && !pkg.os.includes('win32') && !pkg.os.includes('!darwin')) return;
  if (pkg.cpu && !pkg.cpu.includes('x64')) return;
  const relative = path.relative(repo, source);
  if (relative.startsWith('..') || !relative.startsWith('node_modules')) throw new Error(`Dependency outside snapshot: ${name}`);
  copied.set(source, { name: pkg.name, version: pkg.version });
  fs.cpSync(source, path.join(target, relative), { recursive: true, dereference: true });
  for (const dependency of Object.keys(pkg.dependencies || {})) copyPackage(dependency, source, !!pkg.optionalDependencies?.[dependency]);
  for (const dependency of Object.keys(pkg.optionalDependencies || {})) copyPackage(dependency, source, true);
  for (const dependency of Object.keys(pkg.peerDependencies || {})) copyPackage(dependency, source, true);
}
const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
for (const name of [...Object.keys(pkg.dependencies), '@embedded-postgres/windows-x64']) copyPackage(name, repo);
fs.writeFileSync(path.join(stage, 'evidencias/education-dependencies.json'), JSON.stringify([...copied.values()], null, 2));
console.log(JSON.stringify({ dependencies: copied.size, target }));
}
const bundle = path.join(stage, 'bundle');
fs.cpSync(path.join(repo, 'build/openchamber/2.4.0-pemara.1/bundle'), bundle, { recursive: true });
fs.copyFileSync(path.join(here, 'bootstrap.mjs'), path.join(bundle, 'pemara-bootstrap.mjs'));
for (const file of ['education-service.mjs','education-shell.mjs','education-nav.html','education-nav.js','education-preload.cjs']) fs.copyFileSync(path.join(here, file), path.join(bundle, file));
const entry = path.join(bundle, 'entry.mjs');
fs.writeFileSync(entry, fs.readFileSync(entry, 'utf8').replace("import './pemara-bootstrap.mjs';", "import './pemara-bootstrap.mjs';\nimport './education-shell.mjs';"));
for (const main of [entry, path.join(bundle, 'main.mjs')]) {
let mainText = fs.readFileSync(main, 'utf8');
mainText = mainText.replaceAll('setName("PEMARA OpenChamber")', 'setName("PEMARA EDU")');
const anchor = 'await prepareForQuit();';
if (!mainText.includes(anchor)) throw new Error('Desktop shutdown anchor changed');
const quitAnchor = '  state.quitInProgress = true;\n  try {';
if (!mainText.includes(quitAnchor)) throw new Error('Desktop quit gate changed');
mainText = mainText.replace(quitAnchor, '  state.quitInProgress = true;\n  if (!await confirmEducationQuit()) { state.quitInProgress = false; return; }\n  try {');
mainText = "import { stopEducation, confirmEducationQuit } from './education-shell.mjs';\n" + mainText.replaceAll(anchor, "await stopEducation().catch(() => console.error('O acervo local não concluiu o encerramento. Dados preservados.'));\n    await prepareForQuit();");
fs.writeFileSync(main, mainText);
}
const manifest = [];
function visit(directory) { for (const file of fs.readdirSync(directory, { withFileTypes: true })) { const name = path.join(directory, file.name); if (file.isDirectory()) visit(name); else manifest.push({ path: path.relative(stage, name), sha256: crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex') }); } }
visit(path.join(stage, 'originais'));
fs.writeFileSync(path.join(stage, 'evidencias/original-source-hashes.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ originalFiles: manifest.length, target }));
