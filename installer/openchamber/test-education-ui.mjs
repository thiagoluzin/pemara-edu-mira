import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { _electron, chromium } = require('playwright');
const stage = path.resolve('build/openchamber/2.4.0-pemara.4');
const out = path.join(stage, 'evidencias');
const executablePath = process.env.PEMARA_TEST_APP || path.join(stage, 'dist/win-unpacked/PEMARA OpenChamber.exe');
const report = { passed: false, executablePath, checks: {}, startedAt: new Date().toISOString() };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message, timeout = 120000) { const end=Date.now()+timeout; while(Date.now()<end) { const result=await fn(); if(result)return result; await wait(250); } throw new Error(message); }
let app;
async function open() {
  app = await _electron.launch({ executablePath, timeout: 90000 });
  assert.equal(await app.evaluate(({app})=>app.getVersion()), '2.4.0-pemara.4');
  await app.evaluate(({ dialog }) => { globalThis.educationDialogs = []; dialog.showMessageBox = async (...args) => { const options = args.at(-1); globalThis.educationDialogs.push(options); return { response: 0, checkboxChecked: false }; }; });
  const nav = await until(async()=>app.context().pages().find(page=>page.url().endsWith('/education-nav.html')), 'Navegação não abriu');
  await nav.getByRole('button', { name: 'Criar aula', exact: true }).waitFor();
  return nav;
}
async function image(name) {
  const base64 = await app.evaluate(async ({BrowserWindow}) => (await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString('base64'));
  fs.writeFileSync(path.join(out,'frame-'+name),Buffer.from(base64,'base64'));
  const eduPage=app.context().pages().find(page=>/^http:\/\/127\.0\.0\.1:\d+\//.test(page.url()));
  if(eduPage)await eduPage.screenshot({path:path.join(out,name)});
  const navPage=app.context().pages().find(page=>page.url().endsWith('/education-nav.html'));
  if(navPage)await navPage.screenshot({path:path.join(out,'nav-'+name)});
}
async function close() {
  const closed = app.waitForEvent('close', { timeout: 120000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed;
  const shutdown = JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA,'PEMARAOpenChamber/aulas/last-shutdown.json')));
  assert.equal(shutdown.backupSaved,true); report.checks.databaseBackupAtShutdown=true;
}
async function offline(page) {
  await page.route('**/*', route => { const url = new URL(route.request().url()); return /^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1' ? route.abort('internetdisconnected') : route.continue(); });
}
async function exportLesson(page) {
  await page.getByRole('button', { name: /Exportar/i }).click();
  await page.getByRole('heading',{name:'Apresentação para abrir sem internet',exact:true}).click();
  const saved = await until(async()=>app.evaluate(()=>globalThis.educationDialogs.findLast(item=>item.message==='Aula exportada.')?.detail), 'Exportação não terminou');
  assert.ok(fs.existsSync(saved));
  await app.evaluate(()=>{globalThis.educationDialogs=[];});
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  return saved;
}
async function nameLesson(page, title) {
  await page.getByLabel('Título da aula',{exact:true}).fill(title);
  await page.getByLabel('Título da aula',{exact:true}).press('Tab');
  await page.waitForFunction(()=>document.documentElement.dataset.pemaraSaveState==='saved');
  await page.getByRole('button',{name:'Salvar Versão',exact:true}).click();
  await page.getByPlaceholder(/^Ex: Atualizados/).fill('Aula de teste da integração desktop: título definido pelo professor.');
  await page.getByRole('button',{name:'Publicar Versão v2',exact:true}).click();
  await page.getByRole('heading',{name:'Publicar Nova Versão Oficial',exact:true}).waitFor({state:'hidden'});
}
async function motion(page) {
  await page.locator('.atlas-lab').waitFor();
  const play = page.getByRole('button', { name: /^(Reproduzir animação|Pausar animação)$/ });
  if ((await play.innerText()).includes('Reproduzir')) await play.click();
  const geometry = ()=>page.locator('.atlas-lab').evaluate(element => [...element.querySelectorAll('svg [data-motion-role],svg .atlas-process,svg circle,svg path')].map(node=>{const m=node.getCTM();return [node.getAttribute('d'),node.getAttribute('cx'),node.getAttribute('cy'),m?.a,m?.d,m?.e,m?.f,getComputedStyle(node).offsetDistance];}));
  const before=await geometry(); await wait(800); assert.notDeepEqual(await geometry(),before,'Movimento observável');
  await play.click(); await wait(100); const paused=await geometry(); await wait(350); assert.deepEqual(await geometry(),paused,'Pausa estabiliza a geometria');
}
try {
  let nav=await open();
  await nav.getByRole('button',{name:'Criar aula',exact:true}).click();
  let edu=await until(async()=>app.context().pages().find(page=>/^http:\/\/127\.0\.0\.1:\d+\/create$/.test(page.url())), 'Gerador não abriu');
  await offline(edu);
  await edu.getByRole('button',{name:'Gerar sem IA',exact:true}).waitFor({timeout:120000});
  const before=await edu.evaluate(()=>fetch('/api/lessons').then(r=>r.json()));
  fs.writeFileSync(path.join(out,'library-before.json'),JSON.stringify(before,null,2));
  await edu.getByLabel('Adicionar materiais',{exact:true}).setInputFiles({name:'material-integracao-professor.txt',mimeType:'text/plain',buffer:Buffer.from('Fontes históricas: documentos escritos, relatos orais e vestígios materiais. A turma compara a autoria e a data de cada fonte.')});
  await edu.getByText('Leitura concluída. Confira e selecione os trechos que entrarão na aula.',{exact:true}).waitFor();
  await edu.getByRole('button',{name:'Selecionar todos',exact:true}).click();
  await edu.getByLabel('Conferi a leitura, as fontes e a pertinência dos trechos para esta aula.',{exact:true}).check();
  await edu.getByRole('button',{name:'Gerar sem IA',exact:true}).click();
  await edu.getByRole('button',{name:/Exportar/i}).waitFor({timeout:60000});
  await nameLesson(edu,'Aula de teste integrada — Fontes históricas');
  const after=await edu.evaluate(()=>fetch('/api/lessons').then(r=>r.json()));
  const generated=after.lessons.find(item=>!before.lessons.some(old=>old.id===item.id));
  assert.ok(generated); report.checks.generatorCreatesAndSavesOffline=true;
  const materialLesson=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),generated.id);
  assert.ok(JSON.stringify(materialLesson.currentSpec).includes('vestígios materiais'));
  report.checks.materialImportedAndIncludedOffline=true;
  const generatedHtml=await exportLesson(edu);
  await nav.getByRole('button',{name:'Atlas de animações',exact:true}).click();
  await edu.getByRole('heading',{name:'Atlas de animações',exact:true}).waitFor();
  await motion(edu); report.checks.atlasPreviewMovesAndPauses=true;
  await edu.getByRole('button',{name:'Criar aula com este modelo',exact:true}).click();
  await edu.getByRole('button',{name:/Exportar/i}).waitFor();
  await nameLesson(edu,'Aula de teste integrada — Respiração');
  const all=await edu.evaluate(()=>fetch('/api/lessons').then(r=>r.json()));
  const atlas=all.lessons.find(item=>!after.lessons.some(old=>old.id===item.id));
  assert.ok(atlas); const atlasHtml=await exportLesson(edu);
  const getLesson=id=>edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),id);
  const saved=await getLesson(atlas.id);
  fs.writeFileSync(path.join(out,'atlas-saved.json'),JSON.stringify(saved,null,2));
  await image('integracao-antes-fechar.png');
  report.created={generated,atlas};report.exports=[generatedHtml,atlasHtml].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  await edu.getByPlaceholder('Digite orientações de mediação ou perguntas provocativas para a turma...').fill('Nota de teste: fechamento imediato deve preservar este rascunho.');
  await close(); nav=await open();
  await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();
  edu=await until(async()=>app.context().pages().find(page=>/^http:\/\/127\.0\.0\.1:\d+\/library$/.test(page.url())), 'Biblioteca não abriu após reiniciar');
  await offline(edu);
  await edu.getByRole('heading',{name:atlas.title,exact:true}).first().waitFor({timeout:60000});
  const reopened=await getLesson(atlas.id);assert.deepEqual(reopened.currentSpec,saved.currentSpec);
  assert.equal(reopened.draft?.draft_spec_json.scenes[0].teacher_notes,'Nota de teste: fechamento imediato deve preservar este rascunho.');report.checks.immediateCloseWaitsForTeacherNoteSave=true;
  const latest=await edu.evaluate(()=>fetch('/api/lessons').then(r=>r.json()));
  for(const old of before.lessons)assert.ok(latest.lessons.some(item=>item.id===old.id));
  const card=edu.getByRole('heading',{name:atlas.title,exact:true}).first().locator('..').locator('..');
  await card.getByTitle('Editar no Estúdio').click();
  await edu.getByRole('button',{name:/Exportar/i}).waitFor();
  report.checks.lessonAndOriginalLibrarySurviveRestart=true;
  await image('integracao-reaberta.png');
  await nav.getByRole('button',{name:'Conversas e projetos',exact:true}).click();
  const chat=app.context().pages().find(page=>page.url().startsWith('openchamber-ui:'));
  await chat.getByRole('button',{name:'Abrir menu do OpenChamber',exact:true}).waitFor();
  await chat.getByText('A conversa foi retomada após fechar o programa.',{exact:true}).first().waitFor({timeout:90000});
  assert.equal(await chat.locator('.xterm').count(),0);report.checks.chatStillAvailableWithoutTerminal=true;
  await close();
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const context=await browser.newContext({offline:true,viewport:{width:1366,height:900}});
    const page=await context.newPage();
    await page.goto(pathToFileURL(atlasHtml).href);await page.locator('#btn-next').waitFor();
    await page.locator('#btn-next').click();await motion(page);
    await page.screenshot({path:path.join(out,'html-exportado-offline.png')});
    await page.close();const again=await context.newPage();await again.goto(pathToFileURL(atlasHtml).href);await again.locator('#btn-next').waitFor();
    await again.goto(pathToFileURL(generatedHtml).href);await again.locator('#btn-next').waitFor();
    report.checks.exportedHtmlOpensReopensAndAnimatesOffline=true;
  } finally {await browser.close();}
  for(const old of JSON.parse(fs.readFileSync(path.join(out,'arquivos-antes.json'))))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(old.path)).digest('hex'),old.sha256);
  report.checks.originalFilesUnchanged=true;report.passed=true;
} catch(error) {report.error=error.stack; if(app){await image('integracao-falha.png').catch(()=>{});console.log(await app.context().pages().map(p=>({url:p.url()})));}} finally {
  report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'education-ui.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
if(!report.passed)process.exitCode=1;
