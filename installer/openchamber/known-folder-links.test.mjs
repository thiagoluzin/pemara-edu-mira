import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {connectWindowsUserFolders} from './known-folder-links.mjs';

test('native folder aliases reach actual files, preserve isolated identity and survive repeated startup',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-folders-'));
 const profile=path.join(root,'private'),actual=path.join(root,'OneDrive - Escola','Área de Trabalho');fs.mkdirSync(actual,{recursive:true});
 const source=path.join(actual,'aula com acentuação.txt');fs.writeFileSync(source,'original');
 const result=connectWindowsUserFolders(profile,()=>actual);
 assert.equal(result.length,6);assert.ok(result.every(r=>r.status==='connected'));
 assert.equal(fs.readFileSync(path.join(profile,'Desktop','aula com acentuação.txt'),'utf8'),'original');
 assert.ok(connectWindowsUserFolders(profile,()=>actual).every(r=>r.status==='connected'));
 assert.equal(fs.readFileSync(source,'utf8'),'original');
 assert.ok(!fs.existsSync(path.join(profile,'AppData')));
});
test('existing user folders are never replaced; unavailable locations are not invented',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-folders-preserve-'));
 const profile=path.join(root,'private'),actual=path.join(root,'real');fs.mkdirSync(path.join(profile,'Desktop'),{recursive:true});fs.mkdirSync(actual);
 fs.writeFileSync(path.join(profile,'Desktop','preserve.txt'),'keep');
 const result=connectWindowsUserFolders(profile,key=>key==='downloads'?path.join(root,'offline-drive'):actual);
 assert.equal(result.find(r=>r.folder==='desktop').status,'existing-preserved');assert.equal(result.find(r=>r.folder==='downloads').status,'target-unavailable');
 assert.equal(fs.readFileSync(path.join(profile,'Desktop','preserve.txt'),'utf8'),'keep');
 assert.throws(()=>connectWindowsUserFolders(profile,()=>profile),/perfil isolado/);
});
