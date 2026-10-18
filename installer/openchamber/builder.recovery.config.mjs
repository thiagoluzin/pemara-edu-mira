import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import previous from './builder.config.mjs';
const stage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../build/openchamber/2.4.0-pemara.3');
export default {
  ...previous,
  directories: { ...previous.directories, output: path.join(stage, 'dist') },
  extraMetadata: { ...previous.extraMetadata, version: '2.4.0-pemara.3' },
  extraResources: previous.extraResources.map(resource => resource.to === 'web-dist' ? { ...resource, from: path.join(stage, 'web-dist') } : resource),
  win: { ...previous.win, artifactName: 'PEMARA-OpenChamber-2.4.0-pemara.3-Windows-x64-Instalar.${ext}' },
  afterPack: async context => {
    const resources = path.join(context.appOutDir, 'resources');
    for (const file of ['app.asar','web-dist/index.html','opencode-cli/opencode.exe','tools/node/node.exe','tools/python/python.exe','tools/git/cmd/git.exe','pemara/exemplo/aula.html']) {
      if (!fs.existsSync(path.join(resources, file))) throw new Error(`Missing resource: ${file}`);
    }
    const actual = fs.readFileSync(path.join(resources, 'web-dist/index.html'));
    if (!actual.equals(fs.readFileSync(path.join(stage, 'web-dist/index.html')))) throw new Error('UI differs from recovery build');
    fs.writeFileSync(path.join(stage, 'evidencias/packaged-content.json'), JSON.stringify({ passed: true, timestamp: new Date().toISOString() }));
  },
};
