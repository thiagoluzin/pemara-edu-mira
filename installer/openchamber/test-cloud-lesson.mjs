import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {register} from 'tsx/esm/api';
register();
const {sceneStepCount}=await import('../../src/engine/presentationNavigation.ts');
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron,chromium}=require('playwright');
const stage=path.resolve('build/openchamber/2.4.0-pemara.6');const out=path.join(stage,'evidencias');
const executablePath=process.env.PEMARA_TEST_APP||path.join(stage,'dist/win-unpacked/PEMARA EDU.exe');
const label=process.env.PEMARA_TEST_APP?'installed':'packaged';
const report={passed:false,executablePath,checks:{},startedAt:new Date().toISOString()};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message,ms=120000){const end=Date.now()+ms;while(Date.now()<end){const result=await fn();if(result)return result;await delay(300);}throw Error(message);}
let app;
async function open(){app=await _electron.launch({executablePath,timeout:90000});assert.equal(await app.evaluate(({app})=>app.getVersion()),'2.4.0-pemara.6');await app.evaluate(({dialog})=>{globalThis.testDialogs=[];dialog.showMessageBox=async(...args)=>{globalThis.testDialogs.push(args.at(-1));return{response:0,checkboxChecked:false};};});return until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')),'Navigation unavailable');}
async function close(){if(!app)return;const done=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await done;app=null;}
async function eduPage(){return until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\//.test(p.url())),'Education unavailable');}
async function motion(page){await page.locator('.atlas-lab').waitFor();const play=page.getByRole('button',{name:/^(Reproduzir animação|Pausar animação)$/});if((await play.innerText()).includes('Reproduzir'))await play.click();const sample=()=>page.locator('.atlas-lab').evaluate(e=>[...e.querySelectorAll('svg [data-motion-role],svg .atlas-process,svg circle,svg path')].map(n=>{const m=n.getCTM();return[n.getAttribute('d'),n.getAttribute('cx'),n.getAttribute('cy'),m?.a,m?.d,m?.e,m?.f,getComputedStyle(n).offsetDistance];}));const before=await sample();await delay(900);assert.notDeepEqual(await sample(),before);await play.click();await delay(200);const frozen=await sample();await delay(350);assert.deepEqual(await sample(),frozen);}
try{
 let nav=await open();await nav.getByRole('button',{name:'Criar aula',exact:true}).click();let edu=await eduPage();await edu.getByRole('button',{name:'Criar aula com IA',exact:true}).waitFor({timeout:120000});
 const existing=await edu.evaluate(()=>fetch('/api/lessons').then(r=>r.json()));
 const previousJobs=(await edu.evaluate(()=>fetch('/api/ai/opencode/jobs').then(r=>r.json()))).jobs;
 const resumeOnly=process.env.PEMARA_TEST_RESUME;
 if(resumeOnly){await edu.evaluate(id=>fetch('/api/ai/opencode/jobs/'+id+'/resume',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),resumeOnly);}
 else{
 await edu.getByLabel('Tema e orientações para a IA',{exact:true}).fill('Como a roupa molhada seca? Evaporação e condensação no 6º ano. Aula completa com previsão inicial, explicações, comparação, experiência segura, quiz com feedback e síntese. Inclua uma cena com atlas_model separation, indique nas notas como selecionar Evaporação no Atlas e usar os controles. Diferencie evaporação e ebulição; vapor de água é invisível.');
 await edu.getByLabel('Duração (minutos)',{exact:true}).fill('30');
 await edu.getByText('Adicionar materiais e orientações (opcional)',{exact:true}).click();
 await edu.getByLabel('Adicionar materiais',{exact:true}).setInputFiles({name:'referencia-ciencias-professor.txt',mimeType:'text/plain',buffer:Buffer.from('Referência revisada para a aula: a evaporação é a passagem do líquido ao gás pela superfície e ocorre também à temperatura ambiente, sem fervura. Vapor de água é invisível. Condensação é a passagem do gás para o líquido; gotículas visíveis não são vapor. Aquecimento e renovação do ar podem acelerar a secagem, dependendo da umidade. Experiência segura: comparar dois panos igualmente molhados, um exposto à ventilação e outro em ar parado. Não usar fogo nem água fervente. O modelo do Atlas é esquemático: comparar tendências, sem prometer tempos exatos ou medições reais.')});
 await edu.getByText('Leitura concluída. Confira e selecione os trechos que entrarão na aula.',{exact:true}).waitFor();await edu.getByRole('button',{name:'Selecionar todos',exact:true}).click();await edu.getByText('Conferi os trechos que serão enviados à IA.',{exact:true}).locator('input').check();
 await edu.getByRole('button',{name:'Criar aula com IA',exact:true}).click();
 }
 let job;for(let i=0;i<150;i++){const data=await edu.evaluate(()=>fetch('/api/ai/opencode/jobs').then(r=>r.json()));job=resumeOnly?data.jobs.find(j=>j.id===resumeOnly):data.jobs.find(j=>!previousJobs.some(old=>old.id===j.id));if(job?.status==='completed'||job?.status==='failed'||job?.status==='interrupted')break;if(i%6===0)console.log(JSON.stringify({status:job?.status,model:job?.model,message:job?.message,attempts:job?.attempts?.length}));await delay(5000);}
 report.job=job;assert.equal(job?.status,'completed',job?.message);
 assert.match(job.model,/^opencode\//);assert.ok(job.attempts.some(a=>a.status==='completed'));report.checks.realFreeCloudGeneration=true;
 let saved=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),job.lessonId);
 if(process.env.PEMARA_TEST_REVIEW&&saved.currentVersion===1){
  fs.writeFileSync(path.join(out,label+'-aula-ia-gerada-v1.json'),JSON.stringify(saved,null,2));
  const reviewed=structuredClone(saved.currentSpec);let changes=0;
  for(const scene of reviewed.scenes){if(scene.type==='text')scene.content=scene.content.map(text=>{if(text.includes('com bolhas e vapor visível')){changes++;return 'Na ebulição, bolhas de vapor se formam no líquido. A névoa branca acima é de gotas condensadas.';}return text;});}
  assert.equal(changes,1,'Review must target the exact observed scientific error');
  const result=await edu.evaluate(async({id,spec})=>{const r=await fetch('/api/lessons/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({spec,expectedVersion:1,changeSummary:'Revisão pedagógica: vapor invisível; névoa formada por gotículas condensadas. Original da IA preservado na versão 1.'})});return{status:r.status,body:await r.json()};},{id:job.lessonId,spec:reviewed});assert.equal(result.status,200);
  saved=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),job.lessonId);assert.equal(saved.currentVersion,2);report.review={originalVersion:1,reviewedVersion:2,changes};
 }
 const spec=saved.currentSpec;
 fs.writeFileSync(path.join(out,label+'-aula-ia.json'),JSON.stringify(saved,null,2));
 report.lesson={id:job.lessonId,title:spec.lesson.title,scenes:spec.scenes.length,model:spec.lesson.ai_provenance.model,atlas:spec.scenes.filter(s=>s.atlas_model).map(s=>s.atlas_model)};
 assert.ok(spec.scenes.length>=7);assert.ok(report.lesson.atlas.includes('separation'));assert.equal(spec.lesson.ai_provenance.model,job.model);
 await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();await edu.getByRole('heading',{name:spec.lesson.title,exact:true}).first().waitFor();
 await edu.getByRole('heading',{name:spec.lesson.title,exact:true}).first().locator('..').locator('..').getByTitle('Editar no Estúdio').click();await edu.getByRole('button',{name:/Exportar/i}).waitFor();
 await edu.screenshot({path:path.join(out,label+'-aula-ia-editor.png')});
 await edu.getByRole('button',{name:/Exportar/i}).click();await edu.getByRole('heading',{name:'Apresentação para abrir sem internet',exact:true}).click();
 const exported=await until(()=>app.evaluate(()=>globalThis.testDialogs.findLast(d=>d.message==='Aula exportada.')?.detail),'HTML export failed');assert.ok(fs.existsSync(exported));report.exported=exported;
 await edu.getByRole('button',{name:'Fechar',exact:true}).click();
 await edu.getByTitle('Apresentar em tela cheia',{exact:true}).click();
 const atlasIndex=spec.scenes.findIndex(s=>s.atlas_model==='separation');const atlasSteps=spec.scenes.slice(0,atlasIndex).reduce((n,s)=>n+sceneStepCount(s,spec.lesson),0);
 await app.context().setOffline(true);
 for(let i=0;i<atlasSteps;i++)await edu.keyboard.press('ArrowRight');await edu.locator('.learning-variants').getByRole('button',{name:'Evaporação',exact:true}).click();await motion(edu);await edu.screenshot({path:path.join(out,label+'-aula-ia-atlas.png')});report.checks.realLessonAtlasMovesAndPausesOffline=true;
 await edu.keyboard.press('n');await edu.getByText(spec.scenes[atlasIndex].teacher_notes,{exact:true}).waitFor();await edu.keyboard.press('n');report.checks.teacherNotesOpen=true;
 const remaining=spec.scenes.slice(atlasIndex,-1).reduce((n,s)=>n+sceneStepCount(s,spec.lesson),0);for(let i=0;i<remaining;i++)await edu.keyboard.press('ArrowRight');await edu.getByRole('heading',{name:spec.scenes.at(-1).title,exact:true,level:2}).waitFor();report.checks.fullLessonSequence=true;await app.context().setOffline(false);
 await edu.keyboard.press('Escape');await close();
 nav=await open();await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();edu=await eduPage();await edu.getByRole('heading',{name:spec.lesson.title,exact:true}).first().waitFor({timeout:120000});
 const reopened=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),job.lessonId);assert.deepEqual(reopened.currentSpec,spec);const all=await edu.evaluate(()=>fetch('/api/lessons').then(r=>r.json()));for(const old of existing.lessons)assert.ok(all.lessons.some(l=>l.id===old.id));report.checks.realLessonAndOriginalsSurviveRestart=true;
 await close();
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{const context=await browser.newContext({offline:true,viewport:{width:1366,height:900}});let page=await context.newPage();await page.goto(pathToFileURL(exported).href);for(let i=0;i<atlasSteps;i++)await page.locator('#btn-next').click();await page.locator('.learning-variants').getByRole('button',{name:'Evaporação',exact:true}).click();await motion(page);await page.screenshot({path:path.join(out,label+'-aula-ia-html-offline.png')});await page.close();page=await context.newPage();await page.goto(pathToFileURL(exported).href);await page.locator('#btn-next').waitFor();report.checks.realAiHtmlReopensAndAnimatesOffline=true;}finally{await browser.close();}
 report.passed=true;
}catch(error){report.error=error.stack;if(app){const edu=app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:/.test(p.url()));await edu?.screenshot({path:path.join(out,label+'-aula-ia-falha.png')}).catch(()=>{});}}finally{await close().catch(e=>{report.closeError=String(e);report.passed=false;});report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,label+'-aula-real.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(!report.passed)process.exitCode=1;
