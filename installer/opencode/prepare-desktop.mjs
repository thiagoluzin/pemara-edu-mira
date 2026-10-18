// Maintainer-only: official installers are retained byte-for-byte in cache.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as asar from '../../build/opencode/maintainer-tools/node_modules/@electron/asar/lib/asar.js';
const base=path.resolve('build/opencode'),source=path.resolve('installer/opencode');
const upstream=JSON.parse(await fs.readFile(path.join(source,'packages.json'),'utf8'));
const sha=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const manifest={...upstream,Bundle:'2026.10.18.4-desktop',Packages:upstream.Packages.filter(p=>p.Id!=='desktop')};
for(const arch of ['x64','arm64']) {
 const original=upstream.Packages.find(p=>p.Id==='desktop'&&p.Arch===arch);
 const input=path.join(base,'cache',original.File);
 if(await sha(input)!==original.Sha256)throw Error('Official desktop digest mismatch');
 const work=path.join(base,`desktop-build-${arch}-${Date.now()}`);await fs.mkdir(work,{recursive:true});
 const archive=path.join(work,'nsis'),app=path.join(work,'app');
 execFileSync('C:/Program Files/7-Zip/7z.exe',['x',input,`-o${archive}`,'-y'],{stdio:'pipe'});
 const packed=(await fs.readdir(path.join(archive,'$PLUGINSDIR'))).find(f=>/^app-.*\.7z$/.test(f));if(!packed)throw Error('Missing desktop payload');
 execFileSync('C:/Program Files/7-Zip/7z.exe',['x',path.join(archive,'$PLUGINSDIR',packed),`-o${app}`,'-y'],{stdio:'pipe'});
 const originalAsar=path.join(app,'resources','app.asar'),unpacked=path.join(work,'source');
 asar.extractAll(originalAsar,unpacked);
 const main=path.join(unpacked,'out','main','index.js');let code=await fs.readFile(main,'utf8');
 const replacements=[
 ['const UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev";', 'const UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev" && process.env.PEMARA_DISABLE_UPDATER !== "1";'],
 ['onboardingTestRoot ? join(onboardingTestRoot, "desktop") : join(app.getPath("appData"), appId)', 'process.env.PEMARA_DESKTOP_DATA || (onboardingTestRoot ? join(onboardingTestRoot, "desktop") : join(app.getPath("appData"), appId))'],
 ['if (onboardingTestRoot) app.setPath("sessionData", join(onboardingTestRoot, "session"));','if (process.env.PEMARA_DESKTOP_DATA) app.setPath("sessionData", join(process.env.PEMARA_DESKTOP_DATA, "session"));\n  if (onboardingTestRoot) app.setPath("sessionData", join(onboardingTestRoot, "session"));'],
 ['process.chdir(homedir());','process.chdir(process.env.PEMARA_AULAS_DIR || homedir());'],
 ['createDefaultProject ? join(app.getPath("documents"), DEFAULT_PROJECT_DIR) : null','createDefaultProject ? (process.env.PEMARA_AULAS_DIR || join(app.getPath("documents"), DEFAULT_PROJECT_DIR)) : null']
 ];
 for(const [before,after] of replacements){if(code.split(before).length!==2)throw Error('Upstream changed: '+before);code=code.replace(before,after);}
 await fs.writeFile(main,code);
 await fs.copyFile(originalAsar,path.join(work,'original-app.asar'));
 // Preserve Electron's native dependency layout. Every node_modules file stays unpacked.
 await asar.createPackageWithOptions(unpacked,originalAsar,{unpackDir:'node_modules'});
 const provenance={Upstream:original,ModifiedFiles:['out/main/index.js'],Purpose:'Separate teacher profile, disable desktop updates, start in teacher workspace',OriginalAsarSha256:await sha(path.join(work,'original-app.asar')),AdaptedAsarSha256:await sha(originalAsar)};
 await fs.writeFile(path.join(app,'PEMARA-adaptation.json'),JSON.stringify(provenance,null,2));
 const file=`opencode-desktop-pemara-1.19.3-r2-${arch}.zip`,output=path.join(base,'cache',file);
 try{await fs.access(output);throw Error('Derived artifact already exists; preserve it and use a new version name');}catch(e){if(e.code!=='ENOENT')throw e;}
 execFileSync('C:/Program Files/7-Zip/7z.exe',['a','-tzip','-mx=5',output,'.'],{cwd:app,stdio:'pipe'});
 manifest.Packages.push({Id:'desktop',Arch:arch,File:file,Version:'1.19.3-pemara.2',Sha256:await sha(output),Size:(await fs.stat(output)).size,Upstream:original});
 console.log(arch,output,manifest.Packages.at(-1).Size);
}
await fs.writeFile(path.join(source,'desktop-packages.json'),JSON.stringify(manifest,null,2)+'\n');
