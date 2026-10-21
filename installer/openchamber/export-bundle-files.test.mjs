import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {writeExportBundle} from './export-bundle-files.mjs';
const files=['html','pdf','docx'].map(ext=>({filename:'aula.'+ext,bytes:Buffer.from('conteúdo '+ext)}));
test('three files are saved together; repeated exports preserve existing files and use a shared suffix',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pemara-bundle-'));
 const first=await writeExportBundle(root,files);assert.equal(first.length,3);
 await fs.writeFile(first[0],'edição do professor');
 const second=await writeExportBundle(root,files);assert.ok(second.every(p=>p.includes(' - 2.')));
 assert.equal(await fs.readFile(first[0],'utf8'),'edição do professor');
 for(let i=0;i<3;i++)assert.deepEqual(await fs.readFile(second[i]),files[i].bytes);
 assert.equal((await fs.readdir(root)).length,6);
});
test('a failure partway through a bundle rolls back its new files and retains prior exports',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pemara-bundle-failure-'));
 await fs.writeFile(path.join(root,'aula.pdf'),'original');let copies=0;
 await assert.rejects(writeExportBundle(root,files,{...fs,copyFile:async(...args)=>{if(++copies===2)throw Error('disk failure');return fs.copyFile(...args);}}),/disk failure/);
 assert.deepEqual(await fs.readdir(root),['aula.pdf']);assert.equal(await fs.readFile(path.join(root,'aula.pdf'),'utf8'),'original');
 const retry=await writeExportBundle(root,files);assert.equal(retry.length,3);
});
test('a destination created by another writer is not overwritten during export',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pemara-bundle-race-'));let first=true;
 await assert.rejects(writeExportBundle(root,files,{...fs,copyFile:async(source,dest,flags)=>{if(first){first=false;await fs.writeFile(dest,'arquivo concorrente');}return fs.copyFile(source,dest,flags);}}),{code:'EEXIST'});
 assert.deepEqual(await fs.readdir(root),['aula.html']);assert.equal(await fs.readFile(path.join(root,'aula.html'),'utf8'),'arquivo concorrente');
});
test('invalid names and duplicate paths cannot escape or partially write the selected folder',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pemara-bundle-invalid-'));
 await assert.rejects(writeExportBundle(root,[{...files[0],filename:'../outside.html'},...files.slice(1)]),/inválido/);
 await assert.rejects(writeExportBundle(root,[files[0],files[0],files[2]]),/inválido/);
 assert.deepEqual(await fs.readdir(root),[]);
});
