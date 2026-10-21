import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import previous from './builder.recovery.config.mjs';
import {stage, version} from './release.mjs';
import {checkCleanPackage} from './check-clean-package.mjs';
export default {
  ...previous,
  appId: 'br.com.pemara.edu.clean',
  productName: 'PEMARA EDU Teste Limpo',
  directories: { ...previous.directories, output: path.join(stage, 'dist') },
  extraMetadata: { ...previous.extraMetadata, name: 'pemara-edu-clean', version },
  files: previous.files.map(file => typeof file === 'object' && file.to === 'dist-bundle' ? { from: path.join(stage, 'bundle'), to: 'dist-bundle', filter: ['*.mjs','*.cjs','*.js','*.html'] } : file),
  extraResources: [...previous.extraResources.map(resource => resource.to === 'pemara' ? {...resource, filter: ['**/*', '!exemplo{,/**}']} : resource), { from: path.join(stage, 'education'), to: 'education' }, { from: path.resolve('installer/openchamber/brand'), to: 'pemara/brand' }, { from: path.resolve('installer/openchamber/AULAS-PROFESSORES.txt'), to: 'pemara/LEIA-ME-PROFESSORES.txt' }, { from: path.resolve('THIRD_PARTY_NOTICES.md'), to: 'pemara/REFERENCIAS.md' }],
  nsis: { ...previous.nsis, shortcutName: 'PEMARA EDU Teste Limpo', uninstallDisplayName: 'PEMARA EDU Teste Limpo', include: path.resolve('installer/openchamber/installer-clean.nsh') },
  win: { ...previous.win, executableName: 'PEMARA EDU Teste Limpo', icon: path.resolve('installer/openchamber/brand/pemara-edu.ico'), artifactName: `PEMARA-EDU-${version}-Limpo-Windows-x64-Instalar.\${ext}` },
  afterPack: async context => {
    const resources = path.join(context.appOutDir, 'resources');
    fs.copyFileSync(path.join(stage, 'distribution/distribution.json'), path.join(resources, 'pemara/distribution.json'));
    if (fs.existsSync(path.join(resources, 'pemara/exemplo'))) throw new Error('O instalador limpo não pode incluir aulas de exemplo.');
    // electron-builder excludes node_modules from extraResources. Stage the exact
    // installed runtime closure explicitly; never fetch dependencies on the teacher PC.
    fs.cpSync(path.join(stage, 'education/node_modules'), path.join(resources, 'education/node_modules'), { recursive: true, dereference: true });
    for (const file of ['app.asar', 'web-dist/index.html', 'education/dist/index.html', 'education/server.ts', 'education/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe', 'opencode-cli/opencode.exe', 'tools/node/node.exe']) {
      if (!fs.existsSync(path.join(resources, file))) throw new Error(`Missing packaged resource: ${file}`);
    }
    fs.writeFileSync(path.join(stage, 'evidencias/packaged-content.json'), JSON.stringify(checkCleanPackage(resources),null,2));
  },
};
