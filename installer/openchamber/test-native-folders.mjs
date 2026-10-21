import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {version,stage} from './release.mjs';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron}=require('playwright');
const out=path.resolve('evidencias/folders-v10-20261019');fs.mkdirSync(out,{recursive:true});
const report={passed:false,version,checks:{},startedAt:new Date().toISOString()};
const profile=path.join(process.env.LOCALAPPDATA,'PEMARAEduTesteLimpo');
assert.ok(fs.existsSync(profile+'.preservado-folders-v10-20261019'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,message){const end=Date.now()+240000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(400);}throw Error(message);}
let app,fixture;
try{
 const executablePath=process.argv.includes('--unpacked')?path.join(stage,'dist/win-unpacked/PEMARA EDU Teste Limpo.exe'):path.join(process.env.LOCALAPPDATA,'Programs/PEMARA EDU Teste Limpo/PEMARA EDU Teste Limpo.exe');report.executablePath=executablePath;
 app=await _electron.launch({executablePath,timeout:90000});
 report.identity=await app.evaluate(({app})=>({version:app.getVersion(),userData:app.getPath('userData'),profile:process.env.USERPROFILE}));assert.equal(report.identity.version,version);
 assert.equal(report.identity.profile,path.join(profile,'perfil'));
 const folders=JSON.parse(fs.readFileSync(path.join(profile,'perfil/windows-folders.json')));assert.ok(folders.filter(f=>fs.existsSync(f.target)).every(f=>f.status==='connected'));report.folders=folders;
 const desktop=folders.find(f=>f.folder==='desktop').target;
 fixture=path.join(desktop,'PEMARA-teste-seletor-v10.txt');assert.ok(!fs.existsSync(fixture));fs.writeFileSync(fixture,'Teste técnico PEMARA: evaporação é a passagem da água líquida para o estado gasoso. Arquivo sintético para validar a importação local.',{flag:'wx'});
 fs.writeFileSync(path.join(out,'fixture-location.txt'),fixture);
 const nav=await until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')),'Navigation unavailable');await nav.getByRole('button',{name:'Criar aula',exact:true}).click();
 const edu=await until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\//.test(p.url())),'Education unavailable');
 await edu.getByText('Adicionar materiais e orientações (opcional)',{exact:true}).click();
 await edu.getByLabel('Adicionar materiais',{exact:true}).click();
 console.log('NATIVE_OPEN_DIALOG_READY: use the real Desktop shortcut and select PEMARA-teste-seletor-v10.txt.');
 await edu.getByText('Leitura concluída. Confira e selecione os trechos que entrarão na aula.',{exact:true}).waitFor({timeout:240000});
 assert.ok((await edu.locator('body').innerText()).includes('Teste técnico PEMARA'));report.checks.realNativeOpenAndLocalRead=true;
 await edu.screenshot({path:path.join(out,'importacao-real.png')});
 const spec=JSON.parse(fs.readFileSync('evidencias/real-e2e-20261019/aula-real.json'));spec.lesson.title='Validação técnica do seletor de arquivos PEMARA 10';
 const created=await edu.evaluate(async spec=>{const response=await fetch('/api/lessons',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:spec.lesson.title,subjectCode:spec.lesson.subject,gradeLevel:spec.lesson.grade,topic:spec.lesson.topic,spec})});return{status:response.status,body:await response.json()};},spec);assert.equal(created.status,201,JSON.stringify(created.body));
 await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();await edu.reload();await edu.getByRole('heading',{name:spec.lesson.title,exact:true}).first().locator('..').locator('..').getByTitle('Editar no Estúdio').click();
 await edu.getByRole('button',{name:/Exportar/i}).click();await edu.getByRole('button',{name:/HTML animado/}).click();
 console.log('NATIVE_SAVE_DIALOG_READY: navigate Desktop/Downloads and save to '+path.join(out,'native-save.html'));
 await edu.getByRole('status').filter({hasText:'Salvo em'}).waitFor({timeout:240000});
 const saved=(await edu.getByRole('status').innerText()).replace('Salvo em ','');assert.equal(path.resolve(saved),path.join(out,'native-save.html'));assert.ok(fs.readFileSync(saved,'utf8').includes('<!DOCTYPE html>'));
 report.checks.realNativeSave=true;report.checks.privateRuntimePreserved=true;report.saved=saved;
 await edu.screenshot({path:path.join(out,'exportacao-real.png')});report.passed=true;
}catch(error){report.error=error.stack;console.error(error);}
finally{
 if(app){const done=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('openchamber-ui:')).close());await done;}
 if(fixture&&fs.existsSync(fixture)){const bytes=fs.readFileSync(fixture);fs.writeFileSync(path.join(out,'material-teste.txt'),bytes);if(bytes.toString().startsWith('Teste técnico PEMARA:'))fs.unlinkSync(fixture);}
 report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'native-dialogs.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
if(!report.passed)process.exitCode=1;
