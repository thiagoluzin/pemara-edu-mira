// Maintainer operation, never executed on a teacher's machine. Versions are reviewed and pinned.
import fs from 'node:fs/promises';
const root=new URL('./',import.meta.url),headers={'User-Agent':'Pemara-OpenCode-Installer'};
const json=async url=>{const r=await fetch(url,{headers});if(!r.ok)throw Error(url+': '+r.status);return r.json();};
const [oc,git,python,nodeSums]=await Promise.all([
 json('https://api.github.com/repos/anomalyco/opencode/releases/tags/v1.19.3'),
 json('https://api.github.com/repos/git-for-windows/git/releases/tags/v2.56.0.windows.2'),
 json('https://www.python.org/ftp/python/3.13.16/windows-3.13.16.json'),
 fetch('https://nodejs.org/dist/v24.22.0/SHASUMS256.txt').then(r=>r.text())
]);
const packages=[];
const add=async(id,arch,name,url,sha256,version,size)=>{if(!/^[a-f0-9]{64}$/.test(sha256))throw Error('Missing official digest: '+id);if(!size){const r=await fetch(url,{method:'HEAD'});if(!r.ok)throw Error(url+': '+r.status);size=Number(r.headers.get('content-length'));}packages.push({Id:id,Arch:arch,File:name,Url:url,Sha256:sha256,Version:version,Size:size});};
for(const arch of ['x64','arm64']){
 const name=`node-v24.22.0-win-${arch}.zip`,sum=nodeSums.split('\n').find(l=>l.endsWith('  '+name))?.split(' ')[0];
 await add('node',arch,name,'https://nodejs.org/dist/v24.22.0/'+name,sum,'24.22.0');
 const p=python.versions.find(p=>p.id==='pythoncore-3.13-'+(arch==='x64'?'64':'arm64'));
 await add('python',arch,p.url.split('/').pop(),p.url,p.hash.sha256,'3.13.16');
 for(const [id,release,name] of [['opencode',oc,arch==='x64'?'opencode-windows-x64-baseline.zip':'opencode-windows-arm64.zip'],['desktop',oc,`opencode-desktop-win-${arch}.exe`],['git',git,`MinGit-2.56.0.2-${arch==='x64'?'64-bit':'arm64'}.zip`]]){
  const a=release.assets.find(a=>a.name===name);if(!a)throw Error('Missing release asset '+name);
  await add(id,arch,name,a.browser_download_url,a.digest?.replace('sha256:',''),id==='git'?'2.56.0.windows.2':'1.19.3',a.size);
 }
}
const manifest={Bundle:'2026.10.18.1',Created:new Date().toISOString(),Packages:packages,Sources:['https://github.com/anomalyco/opencode/releases/tag/v1.19.3','https://nodejs.org/dist/v24.22.0/SHASUMS256.txt','https://www.python.org/ftp/python/3.13.16/windows-3.13.16.json','https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.2']};
await fs.writeFile(new URL('packages.json',root),JSON.stringify(manifest,null,2)+'\n');console.log(packages.map(p=>`${p.Id} ${p.Arch}: ${p.Version} (${Math.round(p.Size/1048576)} MB)`).join('\n'));
