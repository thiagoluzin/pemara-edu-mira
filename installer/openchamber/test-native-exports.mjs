import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {version} from './release.mjs';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron}=require('playwright');
const out=path.resolve('evidencias/native-exports-20261019');
const destination=path.join(out,'Outra pasta com acentuação');fs.mkdirSync(destination,{recursive:true});
const profile=path.join(process.env.LOCALAPPDATA,'PEMARAEduTesteLimpo');
assert.ok(fs.existsSync(profile+'.preservado-native-exports-20261019'));
const checkpoint=path.join(out,'native-export-checkpoint.json');
const resumed=fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint)):[];
for(const entry of resumed)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(entry.path)).digest('hex'),entry.sha256);
const report={passed:false,version,exports:resumed,startedAt:new Date().toISOString(),nativeDialogs:true,dialogMock:false};
let app;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,message){const end=Date.now()+150000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(300);}throw Error(message);}
try{
 const executablePath=path.join(process.env.LOCALAPPDATA,'Programs/PEMARA EDU Teste Limpo/PEMARA EDU Teste Limpo.exe');report.executablePath=executablePath;
 app=await _electron.launch({executablePath,timeout:90000});assert.equal(await app.evaluate(({app})=>app.getVersion()),version);
 const nav=await until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')),'Navigation unavailable');await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();
 const edu=await until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\//.test(p.url())),'Education unavailable');
 await edu.getByRole('button',{name:'Criar Nova Aula',exact:true}).waitFor({timeout:150000});
 const spec=JSON.parse(fs.readFileSync('evidencias/real-e2e-20261019/aula-real.json'));
 const created=await edu.evaluate(async spec=>{const list=await fetch('/api/lessons').then(r=>r.json());const existing=list.lessons.find(l=>l.title===spec.lesson.title);if(existing)return{status:201,body:{lesson:existing}};const response=await fetch('/api/lessons',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:spec.lesson.title,subjectCode:spec.lesson.subject,gradeLevel:spec.lesson.grade,topic:spec.lesson.topic,spec})});return{status:response.status,body:await response.json()};},spec);assert.equal(created.status,201,JSON.stringify(created.body));
 await edu.reload();await edu.getByRole('heading',{name:spec.lesson.title,exact:true}).first().locator('..').locator('..').getByTitle('Editar no Estúdio').click();
 const before=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),created.body.lesson.id);fs.writeFileSync(path.join(out,'export-spec.json'),JSON.stringify(before.currentSpec,null,2));
 // Collapse review details through the UI to keep native accessibility observations concise.
 while(await edu.locator('section[aria-label="Pareceres da equipe pedagógica"] details[open] > summary').count())await edu.locator('section[aria-label="Pareceres da equipe pedagógica"] details[open] > summary').first().click();
 await edu.getByRole('button',{name:/Exportar/i}).click();const modal=edu.getByRole('dialog',{name:'Exportar Aula PEMARA'});await modal.waitFor();
 for(const [label,format] of [['HTML animado','html'],['PDF para os alunos','pdf'],['Word do professor','docx']]){
  if(report.exports.some(entry=>entry.format===format))continue;
  const expected=path.join(destination,'aula-exportada.'+format);assert.ok(!fs.existsSync(expected));
  await modal.getByRole('button',{name:new RegExp(label)}).click();
  console.log('REAL_SAVE_DIALOG '+format+' -> '+expected);
  await modal.getByRole('status').filter({hasText:'Salvo em'}).waitFor({timeout:600000});
  const actual=(await modal.getByRole('status').innerText()).replace('Salvo em ','');
  assert.ok(path.isAbsolute(actual));assert.equal(path.extname(actual).toLowerCase(),'.'+format);
  const standard=path.join(process.env.USERPROFILE,'Documents/PEMARA Aulas - Teste Limpo/Minhas aulas/Exportadas');
  assert.notEqual(path.dirname(path.resolve(actual)).toLowerCase(),standard.toLowerCase(),'Select a directory outside the default export folder');
  const bytes=fs.readFileSync(actual);assert.ok(bytes.length>100);
  if(format==='html')assert.ok(bytes.toString().includes('<!DOCTYPE html>'));
  if(format==='pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  if(format==='docx')assert.equal(bytes.subarray(0,2).toString(),'PK');
  report.exports.push({format,path:actual,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  fs.writeFileSync(checkpoint,JSON.stringify(report.exports,null,2));
  await edu.screenshot({path:path.join(out,'saved-'+format+'.png')});
  fs.writeFileSync(path.join(out,'installed-exports-progress.json'),JSON.stringify(report,null,2));
 }
 const after=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),created.body.lesson.id);assert.deepEqual(after.currentSpec,before.currentSpec);assert.equal(after.currentVersion,before.currentVersion);
 assert.ok(!fs.readdirSync(destination).some(n=>n.endsWith('.tmp')));report.lessonUnchanged=true;report.passed=true;
}catch(error){report.error=error.stack;console.error(error);}
finally{
 if(app){try{const closed=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('openchamber-ui:')).close());await closed;}catch(error){report.closeError=String(error);report.passed=false;}}
 report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'installed-exports.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
if(!report.passed)process.exitCode=1;
