import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {version,stage} from './release.mjs';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron}=require('playwright');
const out=path.resolve('evidencias/bundle-v11-20261019');fs.mkdirSync(out,{recursive:true});
assert.ok(fs.existsSync(path.join(process.env.LOCALAPPDATA,'PEMARAEduTesteLimpo.preservado-bundle-v11-20261019')));
const report={passed:false,version,exports:[],nativeFolderDialog:true,dialogMock:false,startedAt:new Date().toISOString()};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message){const end=Date.now()+150000;while(Date.now()<end){const v=await fn();if(v)return v;await delay(300);}throw Error(message);}
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const previous=JSON.parse(fs.readFileSync('evidencias/native-exports-20261019/installed-exports.json')).exports.map(e=>({path:e.path,sha256:hash(e.path)}));
let app;
try{
 const executablePath=process.argv.includes('--unpacked')?path.join(stage,'dist/win-unpacked/PEMARA EDU Teste Limpo.exe'):path.join(process.env.LOCALAPPDATA,'Programs/PEMARA EDU Teste Limpo/PEMARA EDU Teste Limpo.exe');report.executablePath=executablePath;
 app=await _electron.launch({executablePath,timeout:90000});assert.equal(await app.evaluate(({app})=>app.getVersion()),version);
 // Observe the actual native dialog; always delegate to Electron's original API.
 await app.evaluate(async({dialog})=>{
  const fs=process.getBuiltinModule('node:fs');const path=process.getBuiltinModule('node:path');
  globalThis.bundleDialogs=[];globalThis.individualSaveDialogs=0;
  const folder=dialog.showOpenDialog.bind(dialog),save=dialog.showSaveDialog.bind(dialog);
  dialog.showOpenDialog=async(...args)=>{const choice=await folder(...args);globalThis.bundleDialogs.push({options:args[1],choice,before:choice.canceled?[]:fs.readdirSync(choice.filePaths[0]).map(name=>path.join(choice.filePaths[0],name))});return choice;};
  dialog.showSaveDialog=async(...args)=>{globalThis.individualSaveDialogs++;return save(...args);};
 });
 const nav=await until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')),'Navigation unavailable');await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();
 const edu=await until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\//.test(p.url())),'Education unavailable');
 await edu.getByRole('button',{name:'Criar Nova Aula',exact:true}).waitFor({timeout:150000});
 const spec=JSON.parse(fs.readFileSync('evidencias/real-e2e-20261019/aula-real.json'));
 const created=await edu.evaluate(async spec=>{const list=await fetch('/api/lessons').then(r=>r.json());const existing=list.lessons.find(l=>l.title===spec.lesson.title);if(existing)return{status:201,body:{lesson:existing}};const response=await fetch('/api/lessons',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:spec.lesson.title,subjectCode:spec.lesson.subject,gradeLevel:spec.lesson.grade,topic:spec.lesson.topic,spec})});return{status:response.status,body:await response.json()};},spec);assert.equal(created.status,201);
 await edu.reload();await edu.getByRole('heading',{name:spec.lesson.title,exact:true}).first().locator('..').locator('..').getByTitle('Editar no Estúdio').click();
 const before=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),created.body.lesson.id);fs.writeFileSync(path.join(out,'export-spec.json'),JSON.stringify(before.currentSpec,null,2));
 while(await edu.locator('section[aria-label="Pareceres da equipe pedagógica"] details[open] > summary').count())await edu.locator('section[aria-label="Pareceres da equipe pedagógica"] details[open] > summary').first().click();
 await edu.getByRole('button',{name:/Exportar/i}).click();const modal=edu.getByRole('dialog',{name:'Exportar Aula PEMARA'});
 await edu.screenshot({path:path.join(out,'bundle-button.png')});
 await modal.getByRole('button',{name:'Exportar HTML, PDF e Word juntos',exact:false}).click();
 console.log('REAL_FOLDER_DIALOG_READY: choose one folder, for example D:\\, then confirm once.');
 await modal.getByRole('status').filter({hasText:'3 arquivos salvos em '}).waitFor({timeout:600000});
 const observations=await app.evaluate(()=>({dialogs:globalThis.bundleDialogs,individualDialogs:globalThis.individualSaveDialogs}));
 assert.equal(observations.dialogs.length,1);assert.equal(observations.individualDialogs,0);assert.equal(observations.dialogs[0].choice.canceled,false);report.observations=observations;
 const chosen=observations.dialogs[0].choice.filePaths[0];const prior=new Set(observations.dialogs[0].before);
 const added=fs.readdirSync(chosen).map(name=>path.join(chosen,name)).filter(file=>!prior.has(file)&&/^pemara-(apresentacao|alunos|professor)-/.test(path.basename(file))&&/\.(html|pdf|docx)$/.test(file));
 assert.equal(added.length,3);assert.deepEqual(added.map(file=>path.extname(file)).sort(),['.docx','.html','.pdf']);
 for(const file of added){const data=fs.readFileSync(file);const format=path.extname(file).slice(1);assert.ok(data.length>100);if(format==='pdf')assert.equal(data.subarray(0,5).toString(),'%PDF-');if(format==='docx')assert.equal(data.subarray(0,2).toString(),'PK');if(format==='html')assert.ok(data.toString().includes('<!DOCTYPE html>'));report.exports.push({format,path:file,bytes:data.length,sha256:hash(file)});}
 for(const entry of previous)assert.equal(hash(entry.path),entry.sha256);report.previousExportsPreserved=true;
 const after=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),created.body.lesson.id);assert.deepEqual(after.currentSpec,before.currentSpec);assert.equal(after.currentVersion,before.currentVersion);report.lessonUnchanged=true;
 await edu.screenshot({path:path.join(out,'bundle-saved.png')});report.passed=true;
}catch(error){report.error=error.stack;console.error(error);}
finally{
 if(app){try{const closed=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('openchamber-ui:')).close());await closed;}catch(error){report.closeError=String(error);report.passed=false;}}
 report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'installed-exports.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
if(!report.passed)process.exitCode=1;
