import fs from 'node:fs';
import path from 'node:path';
import previous from './builder.education.config.mjs';
import {stage, version} from './release.mjs';
import {checkCleanPackage} from './check-clean-package.mjs';

const target = stage + '-principal';
export default {
  ...previous,
  appId: 'br.com.pemara.openchamber',
  productName: 'PEMARA EDU',
  directories: {...previous.directories, output: path.join(target, 'dist')},
  extraMetadata: {...previous.extraMetadata, name: 'pemara-openchamber', version},
  files: previous.files.map(file => typeof file === 'object' && file.to === 'dist-bundle'
    ? {...file, from: path.join(target, 'bundle')} : file),
  nsis: {...previous.nsis, shortcutName: 'PEMARA EDU', uninstallDisplayName: 'PEMARA EDU',
    include: path.resolve('installer/openchamber/installer.nsh')},
  win: {...previous.win, executableName: 'PEMARA EDU',
    artifactName: `PEMARA-EDU-${version}-Windows-x64-Instalar.\${ext}`},
  afterPack: async context => {
    const resources = path.join(context.appOutDir, 'resources');
    fs.copyFileSync(path.join(target, 'distribution/distribution.json'), path.join(resources, 'pemara/distribution.json'));
    fs.cpSync(path.join(stage, 'education/node_modules'), path.join(resources, 'education/node_modules'), {recursive:true,dereference:true});
    for (const file of ['app.asar', 'web-dist/index.html', 'education/dist/index.html', 'education/server.ts',
      'education/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe', 'opencode-cli/opencode.exe', 'tools/node/node.exe']) {
      if (!fs.existsSync(path.join(resources, file))) throw Error('Missing packaged resource: ' + file);
    }
    fs.writeFileSync(path.join(target, 'evidencias/packaged-content.json'),
      JSON.stringify(checkCleanPackage(resources, 'existing-profile'), null, 2));
  },
};
