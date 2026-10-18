import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const appDir = path.join(repo, 'pilotos/openchamber/source/packages/electron');
const stage = path.join(repo, 'build/openchamber/2.4.0-pemara.1');
const require = createRequire(path.join(appDir, 'package.json'));
const { build, Platform, Arch } = require('electron-builder');
const { readAsarFiles, findPackagedAppContentProblems } = require(path.join(appDir, 'scripts/packaged-app-contents.cjs'));
const upstream = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
const config = {
  appId: 'br.com.pemara.openchamber', productName: 'PEMARA OpenChamber',
  directories: { app: appDir, output: path.join(stage, 'dist-final'), buildResources: path.join(appDir, 'resources/icons') },
  electronDist: path.dirname(require('electron')), electronVersion: require('electron/package.json').version,
  extraMetadata: { name: 'pemara-openchamber', version: '2.4.0-pemara.2', description: 'Assistente de aulas para professores', author: 'PEMARA; OpenChamber contributors' },
  files: [
    { from: path.join(stage, 'bundle'), to: 'dist-bundle', filter: ['*.mjs'] },
    'preload.mjs', 'package.json', ...upstream.build.files.filter(f => f.startsWith('!')),
  ],
  asarUnpack: upstream.build.asarUnpack,
  extraResources: [
    ...upstream.build.extraResources.filter(r => r.to !== 'ripgrep').map(r => ({ ...r, from: path.join(appDir, r.from) })),
    { from: path.join(stage, 'ripgrep'), to: 'ripgrep' },
    { from: path.join(stage, 'tools'), to: 'tools' },
    { from: path.join(stage, 'pemara'), to: 'pemara' },
    { from: path.join(stage, 'dependency-receipts.json'), to: 'pemara/dependency-receipts.json' },
  ],
  npmRebuild: false, publish: null,
  win: { icon: path.join(appDir, 'resources/icons/icon.ico'), executableName: 'PEMARA OpenChamber', target: ['nsis'], verifyUpdateCodeSignature: false, artifactName: 'PEMARA-OpenChamber-2.4.0-pemara.2-Windows-x64-Instalar.${ext}' },
  nsis: { oneClick: false, perMachine: false, allowElevation: false, allowToChangeInstallationDirectory: true, installerLanguages: ['pt_BR'], displayLanguageSelector: false, createDesktopShortcut: true, createStartMenuShortcut: true, runAfterFinish: true, deleteAppDataOnUninstall: false, shortcutName: 'PEMARA OpenChamber', include: path.join(here, 'installer.nsh') },
  afterPack: async context => {
    const resources = path.join(context.appOutDir, 'resources');
    const files = readAsarFiles(path.join(resources, 'app.asar'));
    if (!files.some(f => f.path === 'dist-bundle/pemara-bootstrap.mjs')) throw new Error('Bootstrap ausente');
    const problems = findPackagedAppContentProblems(files.filter(f => f.path !== 'dist-bundle/pemara-bootstrap.mjs'));
    for (const file of ['ripgrep/rg.exe','opencode-cli/opencode.exe','tools/node/node.exe','tools/python/python.exe','tools/git/cmd/git.exe','web-dist/index.html','pemara/exemplo/aula.html']) {
      if (!fs.existsSync(path.join(resources, file))) problems.push(`Recurso ausente: ${file}`);
    }
    if (problems.length) throw new Error(problems.join('\n'));
    fs.writeFileSync(path.join(stage, 'packaged-content-check.json'), JSON.stringify({ passed: true, files: files.length, timestamp: new Date().toISOString() }, null, 2));
  },
};
export default config;
