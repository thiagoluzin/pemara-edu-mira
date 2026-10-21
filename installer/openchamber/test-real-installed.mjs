import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {register} from 'tsx/esm/api';
import {version} from './release.mjs';
register();
const {sceneStepCount}=await import('../../src/engine/presentationNavigation.ts');
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron,chromium}=require('playwright');
const out=path.resolve('evidencias/real-e2e-20261019');
const executablePath=path.join(process.env.LOCALAPPDATA,'Programs/PEMARA EDU Teste Limpo/PEMARA EDU Teste Limpo.exe');
const dataRoot=path.join(process.env.LOCALAPPDATA,'PEMARAEduTesteLimpo');
assert.ok(fs.existsSync(dataRoot+'.preservado-e2e-20261019'),'Original profile must be held safely');
const report={passed:false,executablePath,checks:{},startedAt:new Date().toISOString(),pageErrors:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message,ms=150000){const end=Date.now()+ms;while(Date.now()<end){const result=await fn();if(result)return result;await delay(400);}throw Error(message);}
let app;
async function open(){app=await _electron.launch({executablePath,timeout:90000});report.appVersion=await app.evaluate(({app})=>app.getVersion());assert.equal(report.appVersion,version);await app.evaluate(({dialog})=>{globalThis.testDialogs=[];dialog.showMessageBox=async(...args)=>{globalThis.testDialogs.push(args.at(-1));return{response:0,checkboxChecked:false};};});app.context().on('page',p=>p.on('pageerror',e=>report.pageErrors.push({url:p.url(),message:e.message})));return until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')),'Navigation unavailable');}
async function close(){if(!app)return;await app.context().setOffline(false);const done=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await done;app=null;}
async function eduPage(){return until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\//.test(p.url())),'Education unavailable');}
async function shot(page,name){await delay(700);await page.screenshot({path:path.join(out,name+'.png')});}
async function motion(page){await page.locator('.atlas-lab').waitFor();const play=page.getByRole('button',{name:/^(Reproduzir animação|Pausar animação)$/});if((await play.innerText()).includes('Reproduzir'))await play.click();const sample=()=>page.locator('.atlas-lab').evaluate(e=>[...e.querySelectorAll('svg [data-motion-role],svg .atlas-process,svg circle,svg path')].map(n=>{const m=n.getCTM();return[n.getAttribute('d'),n.getAttribute('cx'),n.getAttribute('cy'),m?.a,m?.d,m?.e,m?.f,getComputedStyle(n).offsetDistance];}));const before=await sample();await delay(900);assert.notDeepEqual(await sample(),before);await play.click();await delay(200);const frozen=await sample();await delay(350);assert.deepEqual(await sample(),frozen);}
async function getLesson(edu,id){return edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),id);}
try{
 let nav=await open();await nav.getByRole('button',{name:'Criar aula',exact:true}).click();let edu=await eduPage();await edu.getByRole('button',{name:'Criar aula com IA',exact:true}).waitFor({timeout:150000});
 let jobs=(await edu.evaluate(()=>fetch('/api/ai/opencode/jobs').then(r=>r.json()))).jobs;
 report.reusedCompletedRealGeneration=jobs.some(job=>job.status==='completed');
 assert.ok(jobs.length<=1,'Only this isolated test job may exist');
 if(!jobs.length){
  const initial=await edu.evaluate(async()=>({lessons:await fetch('/api/lessons').then(r=>r.json()),materials:await fetch('/api/materials').then(r=>r.json())}));
  assert.equal(initial.lessons.lessons.length,0);assert.equal(initial.materials.materials.length,0);report.checks.initialDataEmpty=true;
  await edu.getByLabel('Tema e orientações para a IA',{exact:true}).fill('Como a roupa molhada seca? Evaporação e condensação no 6º ano. Aula completa com previsão inicial, explicações, comparação, experiência segura, quiz com feedback e síntese. Inclua uma cena com atlas_model separation, indique nas notas como selecionar Evaporação no Atlas e usar os controles. Diferencie evaporação e ebulição; vapor de água é invisível.');
  await edu.getByLabel('Duração (minutos)',{exact:true}).fill('30');
  await edu.getByRole('checkbox',{name:/Solicitar revisão por agentes/}).check();
  await edu.getByText('Adicionar materiais e orientações (opcional)',{exact:true}).click();
  await edu.getByLabel('Adicionar materiais',{exact:true}).setInputFiles({name:'referencia-ciencias-teste.txt',mimeType:'text/plain',buffer:Buffer.from('Material de teste elaborado para esta validação, não é fonte bibliográfica externa. A evaporação é a passagem do líquido ao gás pela superfície e ocorre também à temperatura ambiente, sem fervura. Vapor de água é invisível. Condensação é a passagem do gás para o líquido; gotículas visíveis não são vapor. Aquecimento e renovação do ar podem acelerar a secagem, dependendo da umidade. Experiência segura: comparar dois panos igualmente molhados, um exposto à ventilação e outro em ar parado. Não usar fogo nem água fervente. O modelo do Atlas é esquemático: comparar tendências, sem prometer tempos exatos ou medições reais.')});
  await edu.getByText('Leitura concluída. Confira e selecione os trechos que entrarão na aula.',{exact:true}).waitFor();await edu.getByRole('button',{name:'Selecionar todos',exact:true}).click();await edu.getByText('Conferi os trechos que serão enviados à IA.',{exact:true}).locator('input').check();
  await shot(edu,'01-criacao-quatro-revisores');await edu.getByRole('button',{name:'Criar aula com IA',exact:true}).click();
 }else if(['failed','interrupted'].includes(jobs[0].status)&&process.argv.includes('--resume')){
  await edu.evaluate(id=>fetch('/api/ai/opencode/jobs/'+id+'/resume',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),jobs[0].id);
 }
 let job;for(let i=0;i<240;i++){const data=await edu.evaluate(()=>fetch('/api/ai/opencode/jobs').then(r=>r.json()));job=data.jobs[0];if(['completed','failed','interrupted'].includes(job?.status))break;if(i%6===0)console.log(JSON.stringify({status:job?.status,model:job?.model,message:job?.message}));await delay(5000);}
 report.job=job;fs.writeFileSync(path.join(out,'real-job.json'),JSON.stringify(job,null,2));assert.equal(job?.status,'completed',job?.message);
 let saved=await getLesson(edu,job.lessonId);const generated=saved.currentSpec;
 const originalFile=path.join(out,'lesson-before-edit-'+job.id+'.json');
 if(!fs.existsSync(originalFile))fs.writeFileSync(originalFile,JSON.stringify(saved,null,2));
 assert.equal(generated.lesson.pedagogical_team.reviews.length,4);assert.equal(new Set(generated.lesson.pedagogical_team.reviews.map(r=>r.agent_id)).size,4);
 assert.ok(generated.lesson.pedagogical_team.reviews.every(r=>r.model.startsWith('opencode/')));
 const privateJob=JSON.parse(fs.readFileSync(path.join(dataRoot,'aulas/ai-jobs',job.id+'.json')));
 const sessions=Object.values(privateJob.reviewProgress?.sessions||{});report.reviewSessionIds=sessions;
 assert.equal(sessions.length,4);assert.equal(new Set([job.sessionID,...sessions]).size,5);
 fs.writeFileSync(path.join(out,'real-job-checkpoints.json'),JSON.stringify(privateJob,null,2));
 report.checks.realGenerationAndFourReviews=true;
 console.log(JSON.stringify({phase:'generated',lessonId:job.lessonId,scenes:generated.scenes.length,reviews:generated.lesson.pedagogical_team.reviews.map(r=>({name:r.agent_name,findings:r.findings.length,model:r.model}))}));
 await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();await edu.getByRole('heading',{name:generated.lesson.title,exact:true}).first().waitFor();
 await edu.getByRole('heading',{name:generated.lesson.title,exact:true}).first().locator('..').locator('..').getByTitle('Editar no Estúdio').click();
 const panel=edu.getByRole('region',{name:'Pareceres da equipe pedagógica'});await panel.waitFor();assert.equal(await panel.locator('details').count(),4);await shot(edu,'02-pareceres-reais');
 const editedTitle='Evaporação e condensação — aula revisada no teste real';
 const editedNote='Teste de edição final: recolher as previsões da turma antes da explicação. Vapor de água é invisível; gotículas de neblina são água líquida.';
 if(saved.currentSpec.lesson.title!==editedTitle||saved.currentSpec.lesson_version!==saved.currentVersion||saved.currentSpec.scenes[0].teacher_notes!==editedNote){
  const previousVersion=saved.currentVersion;
  await edu.getByLabel('Título da aula',{exact:true}).fill(editedTitle);await edu.getByLabel('Título da aula',{exact:true}).press('Tab');
  await edu.getByPlaceholder('Digite orientações de mediação ou perguntas provocativas para a turma...').fill(editedNote);
  await edu.getByRole('button',{name:'Salvar Versão',exact:true}).click();
  await edu.getByPlaceholder('Ex: Atualizados pontos de foco no mapa de Atenas e adicionadas 2 novas perguntas no questionário...').fill('Teste real: título e nota do professor editados na interface; versão original e pareceres mantidos no histórico.');
  await edu.getByRole('button',{name:/^Publicar Versão v/}).click();
  saved=await until(async()=>{const value=await getLesson(edu,job.lessonId);return value.currentVersion>previousVersion&&value.currentSpec.lesson.title===editedTitle&&value.currentSpec.scenes[0].teacher_notes===editedNote?value:null;},'Edited version not persisted');
 }
 report.checks.storedVersionMatchesPublication=saved.currentSpec.lesson_version===saved.currentVersion;
 const spec={...saved.currentSpec,lesson_version:saved.currentVersion};assert.equal(spec.scenes[0].teacher_notes,editedNote);assert.equal(spec.lesson.pedagogical_team.reviews.length,4);
 report.checks.uiEditAndImmutableVersion=true;report.lesson={id:job.lessonId,title:spec.lesson.title,version:saved.currentVersion,scenes:spec.scenes.length};
 fs.writeFileSync(path.join(out,'lesson-edited.json'),JSON.stringify(saved,null,2));await shot(edu,'03-edicao-salva');
 const history=await edu.evaluate(id=>fetch('/api/lessons/'+id+'/revisions').then(r=>r.json()),job.lessonId);
 const originalSpec=JSON.parse(fs.readFileSync(originalFile)).currentSpec;
 assert.deepEqual(history.revisions.find(r=>r.version===1).spec_json,originalSpec);
 fs.writeFileSync(path.join(out,'revision-history.json'),JSON.stringify(history,null,2));report.checks.originalRevisionPreserved=true;
 await edu.getByRole('button',{name:/Exportar/i}).click();
 for(const [name,extension] of [['Apresentação para abrir sem internet','html'],['Cópia da aula para importar','json']]){
  await app.evaluate(()=>{globalThis.testDialogs=[];});await edu.getByRole('heading',{name,exact:true}).click();
  const exported=await until(()=>app.evaluate(()=>globalThis.testDialogs.findLast(d=>d.message==='Aula exportada.')?.detail),extension+' export failed');assert.ok(fs.existsSync(exported));
  fs.copyFileSync(exported,path.join(out,'aula-real.'+extension));report[extension+'Export']=exported;
 }
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'aula-real.json'))),spec);report.checks.htmlAndJsonExport=true;
 await app.evaluate(()=>{globalThis.testDialogs=[];});
 await app.evaluate(({webContents})=>{globalThis.testDownloads=[];const wc=webContents.getAllWebContents().find(w=>/^http:\/\/127\.0\.0\.1:/.test(w.getURL()));wc.session.prependListener('will-download',(_event,item)=>{globalThis.testDownloads.push({name:item.getFilename()});item.on('done',(_e,state)=>globalThis.testDownloads.push({name:item.getFilename(),state,path:item.getSavePath()}));});});
 await edu.getByLabel('Incluir notas pedagógicas do professor na impressão',{exact:true}).check();
 await edu.evaluate(()=>{window.__printTrace=[];const open=window.open;window.open=function(...args){const result=open.apply(this,args);window.__printTrace.push({event:'window.open',url:args[0],returnedWindow:!!result});fetch(args[0]).then(r=>r.text()).then(html=>window.__printTrace.push({event:'opened-content',title:html.match(/<title>(.*?)<\/title>/)?.[1]}));return result;};const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){window.__printTrace.push({event:'download-click',name:this.download,href:this.href});return click.call(this);};});
 await edu.getByRole('heading',{name:'Imprimir ou salvar em PDF',exact:true}).click();
 const printExport=await until(()=>app.evaluate(()=>globalThis.testDialogs.findLast(d=>d.message==='Aula exportada.')?.detail),'Print document export failed',30000);
 assert.ok(fs.existsSync(printExport));fs.copyFileSync(printExport,path.join(out,'aula-impressao.html'));report.printExport=printExport;
 report.printTrace=await edu.evaluate(()=>window.__printTrace);report.downloads=await app.evaluate(()=>globalThis.testDownloads);
 assert.match(fs.readFileSync(printExport,'utf8'),/<title>.*Documento de Impressão<\/title>/);
 await edu.getByRole('button',{name:'Fechar',exact:true}).click();await edu.getByTitle('Apresentar em tela cheia',{exact:true}).click();
 await app.context().setOffline(true);
 await edu.keyboard.press('n');await edu.getByLabel('Notas do professor',{exact:true}).getByText(editedNote,{exact:true}).waitFor();await shot(edu,'04-apresentacao-notas');await edu.keyboard.press('n');
 const atlasIndex=spec.scenes.findIndex(s=>s.atlas_model==='separation');assert.ok(atlasIndex>=0,'Requested Atlas model missing');
 const atlasSteps=spec.scenes.slice(0,atlasIndex).reduce((n,s)=>n+sceneStepCount(s,spec.lesson),0);
 for(let index=0;index<atlasIndex;index++){
  await shot(edu,'cena-'+(index+1));
  for(let i=0;i<sceneStepCount(spec.scenes[index],spec.lesson);i++){await edu.keyboard.press('ArrowRight');await delay(70);}
 }
 await edu.locator('.learning-variants').getByRole('button',{name:'Evaporação',exact:true}).click();await motion(edu);await shot(edu,'05-atlas-offline');
 const remaining=spec.scenes.slice(atlasIndex,-1).reduce((n,s)=>n+sceneStepCount(s,spec.lesson),0);
 for(let index=atlasIndex;index<spec.scenes.length-1;index++){
  const scene=spec.scenes[index];
  await shot(edu,'cena-'+(index+1));
  if(scene.type==='quiz'){
   await edu.getByRole('button').filter({hasText:scene.answers[(scene.correct_index+1)%scene.answers.length]}).click();await edu.getByText('Não foi dessa vez! Veja a explicação:',{exact:true}).waitFor();
   await edu.getByRole('button',{name:'Tentar Novamente',exact:true}).click();await edu.getByRole('button').filter({hasText:scene.answers[scene.correct_index]}).click();await edu.getByText('Resposta Correta! Parabéns!',{exact:true}).waitFor();await shot(edu,'quiz-apresentacao');report.checks.quizWrongRetryCorrect=true;
  }
  for(let i=0;i<sceneStepCount(scene,spec.lesson);i++){await edu.keyboard.press('ArrowRight');await delay(70);}
 }
 await edu.getByRole('heading',{name:spec.scenes.at(-1).title,exact:true,level:2}).waitFor();await shot(edu,'06-sintese-offline');report.checks.presentationAllScenesNotesAtlasOffline=true;
 await edu.keyboard.press('Escape');await close();
 nav=await open();await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();edu=await eduPage();await edu.getByRole('heading',{name:spec.lesson.title,exact:true}).first().waitFor({timeout:150000});
 const reopened=await getLesson(edu,job.lessonId);assert.deepEqual({...reopened.currentSpec,lesson_version:reopened.currentVersion},spec);report.checks.persistedAfterRestart=true;await shot(edu,'07-biblioteca-reaberta');await close();
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({offline:true,viewport:{width:1366,height:900}});let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.join(out,'aula-real.html')).href);
  for(let i=0;i<atlasSteps;i++)await page.locator('#btn-next').click();await page.locator('.learning-variants').getByRole('button',{name:'Evaporação',exact:true}).click();await motion(page);await shot(page,'08-html-offline');
  for(let index=atlasIndex;index<spec.scenes.length-1;index++){
   const scene=spec.scenes[index];if(scene.type==='quiz'){
    await page.locator('#quiz-opt-'+((scene.correct_index+1)%scene.answers.length)).click();assert.match(await page.locator('#quiz-feedback').innerText(),/Incorreto/);
    await page.locator('#btn-prev').click();await page.locator('#btn-next').click();await page.locator('#quiz-opt-'+scene.correct_index).click();assert.match(await page.locator('#quiz-feedback').innerText(),/Correto!/);report.checks.exportQuizWrongAndCorrect=true;
   }
   for(let i=0;i<sceneStepCount(scene,spec.lesson);i++)await page.locator('#btn-next').click();
  }
  await page.getByRole('heading',{name:spec.scenes.at(-1).title,exact:true}).waitFor();assert.deepEqual(errors,[]);
  await page.close();page=await context.newPage();await page.goto(pathToFileURL(path.join(out,'aula-real.html')).href);await page.locator('#btn-next').waitFor();report.checks.exportReopensAndAllScenesAnimateOffline=true;
  await page.goto(pathToFileURL(path.join(out,'aula-impressao.html')).href);
  const printText=await page.locator('body').innerText();for(const scene of spec.scenes)assert.ok(printText.includes(scene.title),'Print scene missing: '+scene.title);assert.ok(printText.includes(editedNote));
  await page.pdf({path:path.join(out,'aula-real.pdf'),format:'A4',printBackground:true});assert.ok(fs.statSync(path.join(out,'aula-real.pdf')).size>10000);report.checks.printAllScenesNotesAndPdf=true;
 }finally{await browser.close();}
 assert.equal(report.checks.storedVersionMatchesPublication,true,'Stored LessonSpec version differs from published version');
 assert.deepEqual(report.pageErrors,[],'Unhandled renderer errors');
 report.passed=true;
}catch(error){report.error=error.stack;if(app){report.dialogs=await app.evaluate(()=>globalThis.testDialogs).catch(()=>[]);report.downloads=await app.evaluate(()=>globalThis.testDownloads).catch(()=>[]);const edu=app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:/.test(p.url()));if(edu){report.printTrace=await edu.evaluate(()=>window.__printTrace).catch(()=>[]);await shot(edu,'failure').catch(()=>{});fs.writeFileSync(path.join(out,'failure-ui.txt'),await edu.locator('body').innerText().catch(()=>''));}}}
finally{await close().catch(e=>{report.closeError=String(e);report.passed=false;});report.finishedAt=new Date().toISOString();const name='run-'+Date.now()+'.json';fs.writeFileSync(path.join(out,name),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(!report.passed)process.exitCode=1;
