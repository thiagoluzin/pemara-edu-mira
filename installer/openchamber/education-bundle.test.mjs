import fs from 'node:fs';
import promises from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {writeExportBundle} from './export-bundle-files.mjs';
const source=fs.readFileSync(new URL('./education-export.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const factory=new Function('fs','path','crypto','dialog','BrowserWindow','session','writeExportBundle',source+'\nreturn {saveEducationBundle};');
const requests=[{format:'html',filename:'aula.html',data:'<!DOCTYPE html><html></html>'},{format:'pdf',filename:'alunos.pdf',data:'<html><head></head><body>Aluno</body></html>'},{format:'docx',filename:'professor.docx',data:new Uint8Array([80,75,3,4])}];
test('canceling the single folder dialog creates no files and does not render a PDF',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-bundle-cancel-'));let calls=0;
 const api=factory(promises,path,crypto,{showOpenDialog:async()=>{calls++;return{canceled:true,filePaths:[]};}},class{constructor(){throw Error('Should not render');}},null,writeExportBundle);
 assert.deepEqual(await api.saveEducationBundle({},requests,root),{canceled:true});assert.equal(calls,1);assert.deepEqual(fs.readdirSync(root),[]);
 await assert.rejects(api.saveEducationBundle({},[requests[0],requests[0],requests[2]],root));
 await assert.rejects(api.saveEducationBundle({},[{...requests[0],filename:'../outside.html'},...requests.slice(1)],root));assert.equal(calls,1);
});
test('one folder selection produces all formats without opening individual Save As dialogs',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-bundle-dialog-'));let calls=0,printed=0;
 class View{constructor(){this.webContents={setWindowOpenHandler(){},on(){},printToPDF:async()=>{printed++;return Buffer.from('%PDF-test');}};}async loadURL(){}destroy(){}}
 const api=factory(promises,path,crypto,{showOpenDialog:async(_win,options)=>{calls++;assert.ok(options.properties.includes('openDirectory'));return{canceled:false,filePaths:[root]};},showSaveDialog:()=>{throw Error('Must not ask for three files');}},View,{fromPartition:()=>({webRequest:{onBeforeRequest(){}},setPermissionRequestHandler(){},async clearStorageData(){}})},writeExportBundle);
 const result=await api.saveEducationBundle({},requests,root);assert.equal(calls,1);assert.equal(printed,1);assert.equal(result.paths.length,3);
 assert.equal(fs.readFileSync(path.join(root,'alunos.pdf'),'utf8'),'%PDF-test');assert.equal(fs.readFileSync(path.join(root,'professor.docx'))[0],80);
});
