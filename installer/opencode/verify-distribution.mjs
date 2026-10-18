// Read-only package verification: never executes the installer or extracted tools.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
const file='build/opencode/dist-desktop/PEMARA-OpenCode-Desktop-Offline-Windows-r4.exe';
const bytes=await fs.readFile(file),manifest=JSON.parse(await fs.readFile('installer/opencode/desktop-packages.json','utf8'));
const eocd=bytes.lastIndexOf(Buffer.from([0x50,0x4b,5,6]));
if(eocd<0)throw Error('No payload ZIP');
const directorySize=bytes.readUInt32LE(eocd+12),directoryOffset=bytes.readUInt32LE(eocd+16),start=eocd-directorySize-directoryOffset;
let at=start+directoryOffset;const entries=new Map();
for(let i=0;i<bytes.readUInt16LE(eocd+10);i++){
 if(bytes.readUInt32LE(at)!==0x02014b50)throw Error('Bad central directory');
 const method=bytes.readUInt16LE(at+10),size=bytes.readUInt32LE(at+20),nameLength=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),local=start+bytes.readUInt32LE(at+42);
 const name=bytes.subarray(at+46,at+46+nameLength).toString();
 const dataAt=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
 const packed=bytes.subarray(dataAt,dataAt+size),data=method===0?packed:method===8?inflateRawSync(packed):null;
 if(!data)throw Error('Unsupported compression');
 entries.set(name,{size:data.length,sha:createHash('sha256').update(data).digest('hex')});at+=46+nameLength+extra+comment;
}
const checked=[];
for(const p of manifest.Packages){const e=entries.get(p.File);if(!e||e.size!==p.Size||e.sha!==p.Sha256)throw Error('Embedded package mismatch: '+p.File);checked.push({file:p.File,arch:p.Arch,sha256:e.sha});}
for(const name of ['OpenCode-Aulas.exe','LEIA-ME.html','OpenCode-LICENSE.txt'])if(!entries.has(name))throw Error('Missing '+name);
const launcherSha=createHash('sha256').update(await fs.readFile('build/opencode/OpenCode-Aulas.exe')).digest('hex');
if(entries.get('OpenCode-Aulas.exe').sha!==launcherSha)throw Error('Embedded launcher does not match the current build');
const original='build/opencode/originais-antes-desktop-20261018/PEMARA-OpenCode-Offline-Windows.exe';
const originalHash=createHash('sha256').update(await fs.readFile(original)).digest('hex');
if(originalHash!=='353f2856347cbf68aa9e945033555d3377ab9fc2a4b5d6bbb01eed55b8323cdc')throw Error('Original changed');
const report={installer:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),embeddedPackages:checked,helpersPresent:true,originalInstallerPreserved:true,installationExecuted:false};
await fs.writeFile('build/opencode/dist-desktop/package-verification-r4.json',JSON.stringify(report,null,2));console.log(JSON.stringify({packages:checked.length,helpers:3,originalPreserved:true,bytes:bytes.length}));
