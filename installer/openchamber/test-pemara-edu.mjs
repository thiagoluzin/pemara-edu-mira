import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron,chromium}=require('playwright');
const stage=path.resolve('build/openchamber/2.4.0-pemara.5');
const label=process.env.PEMARA_TEST_APP?'installed':'packaged';
const out=path.join(stage,'evidencias');
const executablePath=process.env.PEMARA_TEST_APP||path.join(stage,'dist/win-unpacked/PEMARA EDU.exe');
const report={passed:false,executablePath,checks:{},realGeneration:'Provider refused with 403; no new AI request in this test.'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){const x=await fn();if(x)return x;await wait(250);}throw Error(message);}
let app;
async function open(){
 app=await _electron.launch({executablePath,timeout:90000});
 assert.equal(await app.evaluate(({app})=>app.getVersion()),'2.4.0-pemara.5');
 assert.equal(await app.evaluate(({app})=>app.getName()),'PEMARA EDU');
 await app.evaluate(({dialog})=>{globalThis.testDialogs=[];dialog.showMessageBox=async(...args)=>{globalThis.testDialogs.push(args.at(-1));return{response:0,checkboxChecked:false};};});
 return until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')),'Navigation unavailable');
}
async function close(){if(!app)return;const closed=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;app=null;assert.equal(JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA,'PEMARAOpenChamber/aulas/last-shutdown.json'))).backupSaved,true);}
async function education(){return until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\//.test(p.url())),'Education view unavailable');}
async function blockInternet(page){await page.route('**/*',route=>{const u=new URL(route.request().url());return /^https?:$/.test(u.protocol)&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)?route.abort('internetdisconnected'):route.continue();});}
async function motion(page){
 await page.locator('.atlas-lab').waitFor();const button=page.getByRole('button',{name:/^(Reproduzir animação|Pausar animação)$/});
 if((await button.innerText()).includes('Reproduzir'))await button.click();
 const geometry=()=>page.locator('.atlas-lab').evaluate(e=>[...e.querySelectorAll('svg [data-motion-role],svg .atlas-process,svg circle,svg path')].map(n=>{const m=n.getCTM();return[n.getAttribute('d'),n.getAttribute('cx'),n.getAttribute('cy'),m?.a,m?.d,m?.e,m?.f,getComputedStyle(n).offsetDistance];}));
 const before=await geometry();await wait(800);assert.notDeepEqual(await geometry(),before);await button.click();await wait(150);const paused=await geometry();await wait(350);assert.deepEqual(await geometry(),paused);
}
try{
 let nav=await open();await nav.getByRole('button',{name:'Criar aula',exact:true}).click();let edu=await education();await blockInternet(edu);
 await edu.getByRole('button',{name:'Criar aula com IA',exact:true}).waitFor({timeout:120000});assert.equal(await edu.getByRole('button',{name:'Gerar sem IA',exact:true}).count(),0);
 await edu.getByRole('button',{name:'Retomar',exact:true}).waitFor();assert.match(await edu.getByRole('status').innerText(),/403/);
 const jobs=await edu.evaluate(()=>fetch('/api/ai/opencode/jobs').then(r=>r.json()));const job=jobs.jobs[0];assert.equal(job.status,'failed');
 const brief=await edu.getByLabel('Tema e orientações para a IA',{exact:true}).inputValue();assert.match(brief,/Evaporação/);
 report.checks.aiButtonAndExplicitFailure=true;
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(900,700));await wait(600);
 assert.equal(await edu.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await edu.screenshot({path:path.join(out,label+'-criacao-responsiva.png'),fullPage:true});report.checks.responsive900x700=true;
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1366,900));
 await nav.getByRole('button',{name:'Atlas de animações',exact:true}).click();await edu.getByRole('heading',{name:'Atlas de animações',exact:true}).waitFor();await motion(edu);report.checks.atlasMovesAndPauses=true;
 await edu.screenshot({path:path.join(out,label+'-atlas.png')});
 await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();
 const title='Aula de teste integrada — Respiração';await edu.getByRole('heading',{name:title,exact:true}).first().waitFor();
 const library=await edu.evaluate(()=>fetch('/api/lessons').then(r=>r.json()));const lesson=library.lessons.find(l=>l.title===title);assert.ok(lesson);
 const snapshot=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),lesson.id);
 await edu.getByRole('heading',{name:title,exact:true}).first().locator('..').locator('..').getByTitle('Editar no Estúdio').click();
 await edu.getByRole('button',{name:/Exportar/i}).click();await edu.getByRole('heading',{name:'Apresentação para abrir sem internet',exact:true}).click();
 const exported=await until(()=>app.evaluate(()=>globalThis.testDialogs.findLast(d=>d.message==='Aula exportada.')?.detail),'Export unavailable');assert.ok(fs.existsSync(exported));assert.match(fs.readFileSync(exported,'utf8'),/<title>[^<]*PEMARA EDU<\/title>/);report.exported=exported;
 await edu.getByRole('button',{name:'Fechar',exact:true}).click();await close();
 nav=await open();await nav.getByRole('button',{name:'Criar aula',exact:true}).click();edu=await education();await blockInternet(edu);
 await edu.getByRole('button',{name:'Retomar',exact:true}).waitFor({timeout:120000});
 const again=await edu.evaluate(()=>fetch('/api/ai/opencode/jobs').then(r=>r.json()));assert.deepEqual(again.jobs.find(j=>j.id===job.id),job);assert.equal(await edu.getByLabel('Tema e orientações para a IA',{exact:true}).inputValue(),brief);
 report.checks.failedRequestAndBriefSurviveRestart=true;
 const reopened=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),lesson.id);assert.deepEqual(reopened.currentSpec,snapshot.currentSpec);assert.deepEqual(reopened.draft,snapshot.draft);report.checks.lessonAndDraftSurviveRestart=true;
 await nav.getByRole('button',{name:'Conversas e projetos',exact:true}).click();const chat=app.context().pages().find(p=>p.url().startsWith('openchamber-ui:'));await chat.getByRole('button',{name:'Abrir menu do OpenChamber',exact:true}).waitFor();assert.equal(await chat.locator('.xterm').count(),0);report.checks.chatAvailableWithoutTerminal=true;
 await close();
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{const context=await browser.newContext({offline:true,viewport:{width:1366,height:900}});let page=await context.newPage();await page.goto(pathToFileURL(exported).href);await page.locator('#btn-next').click();await motion(page);await page.screenshot({path:path.join(out,label+'-html-offline.png')});await page.close();page=await context.newPage();await page.goto(pathToFileURL(exported).href);await page.locator('#btn-next').click();await motion(page);report.checks.exportOpensReopensAndAnimatesOffline=true;}finally{await browser.close();}
 report.passed=true;
}catch(error){report.error=error.stack;if(app){const edu=app.context().pages().find(p=>/^http:\/\/127.0.0.1/.test(p.url()));await edu?.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});}}finally{await close().catch(e=>{report.closeError=String(e);report.passed=false;});report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,label+'-ui.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(!report.passed)process.exitCode=1;
