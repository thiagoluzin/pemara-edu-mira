import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {version,stage} from './release.mjs';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron,chromium}=require('playwright');
const out=path.resolve('evidencias/export-v9-20261019'),destination=path.join(out,'Outra pasta com acentuação');fs.mkdirSync(destination,{recursive:true});
const dataRoot=path.join(process.env.LOCALAPPDATA,'PEMARAEduTesteLimpo');assert.ok(fs.existsSync(dataRoot+'.preservado-export-v9-20261019'));
const report={passed:false,version,checks:{},errors:[],exports:[],saveDialogs:[],fixture:'Real AI lesson generated in previous validation; no new generation requested for export change.'};
const spec=JSON.parse(fs.readFileSync('evidencias/real-e2e-20261019/aula-real.json'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,message){const limit=Date.now()+150000;while(Date.now()<limit){const result=await fn();if(result)return result;await delay(300);}throw Error(message);}
let app,browser;
async function close(){if(!app)return;const done=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('openchamber-ui:')).close());await done;app=null;}
try{
 const executablePath=process.argv.includes('--unpacked')?path.join(stage,'dist/win-unpacked/PEMARA EDU Teste Limpo.exe'):path.join(process.env.LOCALAPPDATA,'Programs/PEMARA EDU Teste Limpo/PEMARA EDU Teste Limpo.exe');report.executablePath=executablePath;
 app=await _electron.launch({executablePath,timeout:90000});assert.equal(await app.evaluate(({app})=>app.getVersion()),version);
 app.context().on('page',page=>page.on('pageerror',error=>report.errors.push(error.message)));
 await app.evaluate(({dialog},destination)=>{
  globalThis.exportDialogs=[];globalThis.exportChoice='save';globalThis.exportPath=null;
  dialog.showSaveDialog=async(_win,options)=>{
   globalThis.exportDialogs.push(options);
   if(globalThis.exportChoice==='cancel')return{canceled:true};
   const filename=options.defaultPath.split(/[\\/]/).at(-1);
   const filePath=globalThis.exportPath||(destination+'/'+filename);return{canceled:false,filePath};
  };
 },destination);
 const nav=await until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')),'Navigation unavailable');await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();
 const edu=await until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\//.test(p.url())),'Education unavailable');
 await edu.getByRole('heading',{name:'Nenhuma aula encontrada',exact:true}).waitFor({timeout:150000});
 const created=await edu.evaluate(async spec=>{const response=await fetch('/api/lessons',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:spec.lesson.title,subjectCode:spec.lesson.subject,gradeLevel:spec.lesson.grade,topic:spec.lesson.topic,spec})});return{status:response.status,body:await response.json()};},spec);
 assert.equal(created.status,201,JSON.stringify(created.body));const id=created.body.lesson.id;
 await edu.reload();await edu.getByRole('heading',{name:spec.lesson.title,exact:true}).first().locator('..').locator('..').getByTitle('Editar no Estúdio').click();
 await edu.getByRole('button',{name:/Exportar/i}).click();const modal=edu.getByRole('dialog',{name:'Exportar Aula PEMARA'});await modal.waitFor();
 assert.equal(await edu.evaluate(()=>typeof window.pemaraExports?.save),'function');
 const before=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),id);fs.writeFileSync(path.join(out,'export-spec.json'),JSON.stringify(before.currentSpec,null,2));
 // Cancellation leaves no output, then the same operation can be retried.
 await app.evaluate(()=>globalThis.exportChoice='cancel');const initialFiles=fs.readdirSync(destination);
 await modal.getByRole('button',{name:/HTML animado/}).click();await modal.getByRole('status').filter({hasText:'Exportação cancelada.'}).waitFor();assert.deepEqual(fs.readdirSync(destination),initialFiles);report.checks.cancelNoFile=true;
 await app.evaluate(()=>globalThis.exportChoice='save');
 for(const [label,extension] of [['HTML animado','html'],['PDF para os alunos','pdf'],['Word do professor','docx'],['Cópia da aula','json']]){
  await modal.getByRole('button',{name:new RegExp(label)}).click();await modal.getByRole('status').filter({hasText:'Salvo em'}).waitFor({timeout:150000});
  const saved=(await modal.getByRole('status').innerText()).replace('Salvo em ','');assert.equal(path.dirname(path.resolve(saved)),destination);assert.equal(path.extname(saved),'.'+extension);const bytes=fs.readFileSync(saved);assert.ok(bytes.length>100);
  if(extension==='pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-');if(extension==='docx')assert.equal(bytes.subarray(0,2).toString(),'PK');
  report.exports.push({format:extension,path:saved,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 report.checks.threeFormatsChosenFolder=true;assert.deepEqual(JSON.parse(fs.readFileSync(report.exports.find(e=>e.format==='json').path)),before.currentSpec);report.checks.jsonBackup=true;
 // An inaccessible destination must produce an error and leave existing exports intact.
 const html=report.exports.find(e=>e.format==='html');await app.evaluate((_electron,p)=>globalThis.exportPath=p,path.join(destination,'missing-directory','failure.html'));
 await modal.getByRole('button',{name:/HTML animado/}).click();await modal.getByRole('alert').waitFor();assert.ok(!fs.existsSync(path.join(destination,'missing-directory')));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(html.path)).digest('hex'),html.sha256);
 await app.evaluate((_electron,p)=>globalThis.exportPath=p,html.path);await modal.getByRole('button',{name:/HTML animado/}).click();await modal.getByRole('status').filter({hasText:'Salvo em'}).waitFor();assert.equal(crypto.createHash('sha256').update(fs.readFileSync(html.path)).digest('hex'),html.sha256);report.checks.errorRetryAndReplacement=true;
 assert.ok(!fs.readdirSync(destination).some(name=>name.endsWith('.tmp')));
 await edu.screenshot({path:path.join(out,'exportacao-instalada.png')});
 report.saveDialogs=await app.evaluate(()=>globalThis.exportDialogs);assert.ok(report.saveDialogs.every(d=>d.title.startsWith('Salvar como')&&d.properties.includes('showOverwriteConfirmation')));report.checks.nativeSaveDialogContract=true;
 const after=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),id);assert.deepEqual(after.currentSpec,before.currentSpec);assert.equal(after.currentVersion,before.currentVersion);report.checks.lessonUnchanged=true;
 await close();
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const context=await browser.newContext({offline:true});const page=await context.newPage();await page.goto(pathToFileURL(html.path).href);
 await page.locator('#btn-next').waitFor();assert.ok(await page.locator('body').innerText());
 const atlasIndex=spec.scenes.findIndex(s=>s.atlas_model&&s.atlas_model!=='none');assert.ok(atlasIndex>=0);await page.evaluate(index=>window.goToSlide(index),atlasIndex);await page.locator('.atlas-lab').waitFor();
 const play=page.getByRole('button',{name:/^(Reproduzir animação|Pausar animação)$/});if((await play.innerText()).includes('Reproduzir'))await play.click();
 const sample=()=>page.locator('.atlas-lab').evaluate(e=>[...e.querySelectorAll('svg path,svg circle')].map(n=>[n.getAttribute('d'),n.getAttribute('cx'),n.getAttribute('cy'),n.getCTM()?.e,n.getCTM()?.f]));const moving=await sample();await delay(1000);assert.notDeepEqual(await sample(),moving);await play.click();await delay(200);const frozen=await sample();await delay(400);assert.deepEqual(await sample(),frozen);
 await page.screenshot({path:path.join(out,'html-animado-offline.png')});report.checks.htmlAnimationOffline=true;
 const qi=spec.scenes.findIndex(s=>s.type==='quiz'),quiz=spec.scenes[qi];await page.evaluate(index=>window.goToSlide(index),qi);await page.locator('#quiz-opt-'+quiz.correct_index).click();await page.locator('#quiz-feedback').filter({hasText:/Corret|Parabéns/}).waitFor();report.checks.offlineQuiz=true;
 await browser.close();browser=null;assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.error=error.stack;console.error(error);if(app)for(const [i,page] of app.context().pages().entries())await page.screenshot({path:path.join(out,`failure-${i}.png`)}).catch(()=>{});}
finally{if(browser)await browser.close();await close().catch(error=>{report.closeError=String(error);report.passed=false;});report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'installed-exports.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(!report.passed)process.exitCode=1;
