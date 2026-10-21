import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDisposablePostgres,getFreePort} from './helpers/realPostgresHarness';
import {launchHeadlessChrome,type CdpSession} from './helpers/cdpBrowser';
import {configureOpenCodeLessons,stopOpenCodeLessons} from '../server/ai/openCodeJobs';
import {freeHtmlFixture} from './fixtures/freeHtmlLesson';

test('Professores e revisores no navegador: seleção, geração controlada, pareceres e persistência real',{timeout:90000},async()=>{
  const db=await createDisposablePostgres('pemara-team-browser-');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-team-jobs-'));
  const port=await getFreePort(),url=`http://127.0.0.1:${port}`;
  Object.assign(process.env,{DATABASE_URL:db.connectionString,NODE_ENV:'production',TEST_MODE:'agents-browser',PEMARA_SINGLE_TEACHER:'true',PEMARA_OFFLINE:'true',SEED_DEMO_USERS:'false',HOST:'127.0.0.1',PORT:String(port)});
  const calls:string[]=[],sessions:string[]=[];
  const visual=(layout:string)=>({layout,caption:'Comparação esquemática das fontes.',nodes:[{id:'a',label:'Documento escrito',icon:'book',explanation:'A autoria e a data ajudam a contextualizar o documento.'},{id:'b',label:'Relato oral',icon:'people',explanation:'Relatos trazem perspectivas e precisam ser confrontados com outras fontes.'}]});
  const response=JSON.stringify({schema_version:'1.0',lesson_version:1,renderer_version:'0.3.0',lesson:{id:'candidate',subject:'history',grade:'6EF',topic:'Fontes históricas',title:'Fontes históricas em diálogo',duration_minutes:30,language:'pt-BR',generation_mode:'MODE_C_API'},objectives:['Comparar autoria e contexto de fontes.'],scenes:[{id:'s1',type:'title',title:'Fontes históricas'},...['flow','cards','comparison','flow','cards'].map((layout,i)=>({id:'s'+(i+2),type:'text',title:i===3?'Atividade: comparar documentos':'Contexto das fontes '+i,visual:visual(layout)})),{id:'q',type:'quiz',title:'Verifique',question:'O que ajuda a contextualizar uma fonte?',answers:['Autoria e data','Apenas o tamanho'],correct_index:0,explanation:'Autoria e data situam a produção da fonte.'},{id:'end',type:'summary',title:'Síntese',visual:visual('cards')}]});
  configureOpenCodeLessons({models:async()=>[{id:'test/free',name:'Modelo controlado de teste'}],model:async()=> 'test/free',create:async({id,jobId})=>{const session=id||'ses_'+jobId;sessions.push(session);return session;},generate:async({prompt})=>{calls.push(prompt);return {model:'test/free',text:prompt.includes('agente de revisão')?JSON.stringify(prompt.includes('Revisor de Fontes')?{verdict:'attention',findings:[{scene_id:'presentation',problem:'Identificar o documento usado no exemplo.',suggestion:'Acrescentar autoria e data da fonte escolhida.'}]}:{verdict:'no_issue_found',findings:[]}):freeHtmlFixture};}},directory);
  let server:import('node:http').Server|undefined,browser:CdpSession|undefined;
  try{
    const {startServer}=await import('../server');server=await startServer();
    if(!server.listening)await new Promise<void>(r=>server!.once('listening',r));
    browser=await launchHeadlessChrome(await getFreePort());await browser.setViewport(1366,1000);
    await browser.send('Network.enable');await browser.send('Network.setBlockedURLs',{urls:['https://*']});
    const wait=async(expression:string)=>{for(let i=0;i<100;i++){if(await browser!.evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Estado de interface ausente: '+expression+'\n'+await browser!.evaluate('document.body.innerText'));};
    await browser.navigate(url);await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Nova Aula')`);
    await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Nova Aula').click()`);
    await wait(`!!document.querySelector('[aria-label="Equipe pedagógica"]')`);
    assert.deepEqual(await browser.evaluate(`JSON.parse(localStorage.getItem('pemara_saved_lessons_v2')||'[]')`),[],'A sessão pessoal não deve receber aulas de demonstração durante a abertura');
    assert.equal(await browser.evaluate(`document.querySelector('[aria-label="Disciplina"]').options.length`),12);
    for(const [subject,name] of [['math','Professor de Matemática'],['history','Professor de História']]){
      await browser.evaluate(`(()=>{const s=document.querySelector('[aria-label="Disciplina"]');s.value=${JSON.stringify(subject)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await wait(`document.querySelector('[aria-label="Equipe pedagógica"]').textContent.includes(${JSON.stringify(name)})`);
    }
    await browser.typeText('[aria-label="Tema e orientações para a IA"]','Fontes históricas');
    await browser.typeText('[aria-label="Duração (minutos)"]','30');
    await browser.evaluate(`document.querySelector('[aria-label="Equipe pedagógica"] input[type="checkbox"]').click()`);
    fs.mkdirSync('evidencias/debug-20261019',{recursive:true});
    await browser.screenshot('evidencias/debug-20261019/professor-historia.png');
    await browser.evaluate(`document.querySelector('button[type="submit"]').click()`);
    await wait(`!!document.querySelector('[aria-label="Pareceres da equipe pedagógica"]')`);
    assert.equal(new Set(sessions).size,6);
    assert.equal(calls.filter(p=>p.includes('agente de revisão')).length,5);
    assert.ok(calls[0].includes('Professor de História'));
    assert.equal(await browser.evaluate(`document.querySelector('[aria-label="Pareceres da equipe pedagógica"]').querySelectorAll('details').length`),5);
    assert.ok(await browser.evaluate(`document.body.innerText.includes('Identificar o documento usado no exemplo.')`));
    await browser.screenshot('evidencias/debug-20261019/pareceres-agentes.png');
    const saved=await browser.evaluate(`(async()=>{const list=await fetch('/api/lessons').then(r=>r.json());return fetch('/api/lessons/'+list.lessons[0].id).then(r=>r.json());})()`);
    assert.equal(saved.currentSpec.lesson.pedagogical_team.reviews.length,5);
    assert.equal(saved.currentSpec.presentation.html,freeHtmlFixture);
    assert.deepEqual(saved.currentSpec.presentation.atlas_models,[]);
    await browser.navigate(url);
    await wait(`!!document.querySelector('iframe[title="Apresentação criada pela IA"]')`);
    await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Guardar versão'&&!b.disabled)`);
    await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Guardar versão').click()`);
    await browser.typeText('textarea[placeholder^="Ex: Atualizados"]','Conferência após reabrir a apresentação.');
    await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Publicar Versão v2')).click()`);
    await wait(`document.body.innerText.includes('Aula salva no acervo.')&&!document.body.innerText.includes('Publicar Nova Versão Oficial')`);
    const published=await browser.evaluate(`(async()=>{const list=await fetch('/api/lessons').then(r=>r.json());return fetch('/api/lessons/'+list.lessons[0].id).then(r=>r.json());})()`);
    assert.equal(published.currentVersion,2);
    assert.equal(published.currentSpec.presentation.html,freeHtmlFixture);
    assert.equal(saved.currentSpec.lesson.pedagogical_team.human_review_required,true);
  }finally{
    await browser?.close();await stopOpenCodeLessons();
    if(server)await new Promise<void>(r=>server!.close(()=>r()));
    const {getPool}=await import('../server/db/pool');await getPool().end();
    await db.cleanup();
    // Keep the isolated job receipts as local evidence; they contain synthetic data only.
  }
});
