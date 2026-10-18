import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {ATLAS} from '../src/animations/atlas';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import {TEMPLATE_SOLAR_SYSTEM} from '../src/templates/deterministicTemplates';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {launchHeadlessChrome,type CdpSession} from './helpers/cdpBrowser';

async function freePort(){const s=net.createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as net.AddressInfo).port;await new Promise<void>(r=>s.close(()=>r()));return p;}
const pause=()=>new Promise(r=>setTimeout(r,150));

test('Professor offline: primeiro acesso, importação revisada, Atlas, gravação, reinício e recuperação real', {timeout:180000},async()=>{
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'pemara-teacher-browser-'));
  const appPort=await freePort(),dbPort=await freePort(),url=`http://127.0.0.1:${appPort}`;
  await fs.writeFile(path.join(data,'config.json'),JSON.stringify({appPort,dbPort,password:randomBytes(24).toString('hex')}));
  let child:ChildProcess|undefined,browser:CdpSession|undefined,output='';
  const start=async(restore?:string)=>{
    output='';child=spawn(process.execPath,['--import','tsx','scripts/demo-local.ts','--teacher',...(restore?['--restore',restore,'--confirm']:[])],{env:{...process.env,PEMARA_TEACHER_DATA_DIR:data},windowsHide:true,stdio:['ignore','pipe','pipe']});
    child.stdout!.on('data',d=>output+=d);child.stderr!.on('data',d=>output+=d);
    const deadline=Date.now()+45000;
    while(Date.now()<deadline){if(child.exitCode!==null)throw new Error('Inicialização falhou: '+output);try{if((await fetch(url+'/ready')).ok)return;}catch{}await pause();}
    throw new Error('Inicialização não confirmou prontidão: '+output);
  };
  const stop=async()=>{
    if(!child||child.exitCode!==null)return;
    const stopped=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Encerramento demorou: '+output)),30000);child!.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(output));});});
    await fs.writeFile(path.join(data,'stop.request'),'stop');await stopped;
    assert.equal(JSON.parse(await fs.readFile(path.join(data,'last-shutdown.json'),'utf8')).backupSaved,true);
  };
  const wait=async(expression:string)=>{const end=Date.now()+15000;while(Date.now()<end){if(await browser!.evaluate(expression))return;await pause();}throw new Error('Interface não atingiu: '+expression+'\n'+await browser!.evaluate('document.body.innerText'));};
  const click=async(text:string)=>{await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.innerText.trim()===${JSON.stringify(text)})`);await browser!.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.trim()===${JSON.stringify(text)}).click()`);};
  try{
    await start();assert.deepEqual(await(await fetch(url+'/api/setup')).json(),{required:false,personal:true});
    const owner = (await(await fetch(url+'/api/auth/me')).json()).user;
    assert.equal(owner.local,true);
    assert.equal(owner.password_hash,undefined);
    for (const headers of [{Origin:'https://outside.invalid'},{Host:'outside.invalid'},{'Sec-Fetch-Site':'cross-site'}]) {
      const status = await new Promise<number|undefined>((resolve,reject) => {
        http.get(url+'/api/lessons',{headers},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);
      });
      assert.equal(status,403,JSON.stringify(headers));
    }
    assert.equal((await fetch(url+'/api/auth/login',{method:'POST'})).status,404);
    assert.equal((await fetch(url+'/api/admin/users')).status,404);
    browser=await launchHeadlessChrome(9560);await browser.setViewport(1366,768);
    // Browser-side external requests fail even when this development PC has internet.
    await browser.send('Network.enable');await browser.send('Network.setBlockedURLs',{urls:['https://*','http://*.com/*','http://*.org/*','http://*.net/*']});
    await browser.navigate(url);await wait(`document.body.innerText.includes('Neste computador')`);
    assert.equal(await browser.evaluate(`Array.from(document.querySelectorAll('button')).some(b=>/^(Entrar|Administração|Desconectar)$/.test(b.innerText.trim()))`),false);
    assert.equal(await browser.evaluate(`document.querySelector('input[type="password"]') !== null`),false);
    assert.equal((await fetch(url+'/api/setup',{method:'POST'})).status,404);
    await click('Nova Aula');await wait(`!!document.querySelector('input[type="file"]')`);
    const passage='Fontes históricas: documentos escritos, relatos orais e vestígios materiais. A turma compara a autoria e a data de cada fonte.';
    await browser.evaluate(`(()=>{const input=document.querySelector('input[type="file"]');const files=new DataTransfer();files.items.add(new File([${JSON.stringify(passage)}],'fontes-da-turma.txt',{type:'text/plain'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await wait(`document.body.innerText.includes('Leitura concluída')`);
    assert.ok(await browser.evaluate(`document.body.innerText.includes('0 trechos selecionados')`));
    await click('Selecionar todos');await click('Gerar sem IA');await wait(`document.body.innerText.includes('marque a revisão')`);
    await browser.evaluate(`Array.from(document.querySelectorAll('label')).find(l=>l.innerText.includes('Conferi a leitura')).querySelector('input').click()`);
    await click('Gerar sem IA');await wait(`document.body.innerText.toLowerCase().includes('roteiro de cenas')`);
    await browser.evaluate(`Array.from(document.querySelectorAll('h4')).find(h=>h.innerText.includes('Material •')).click()`);
    await wait(`!!document.querySelector('[data-learning-kind="sources"]')`);
    assert.ok(await browser.evaluate(`document.body.innerText.includes('Fonte: fontes-da-turma.txt · Parágrafo 1')`));
    await browser.evaluate(`(()=>{const s=document.querySelector('select[aria-label="Modelo visual"]');s.value='historical_change';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await wait(`!!document.querySelector('[data-learning-kind="historical_change"]')`);
    await wait(`document.body.innerText.includes('Rascunho salvo')||document.body.innerText.includes('Salvo')`);
    await click('Salvar Versão');await browser.typeText('textarea[placeholder^="Ex: Atualizados"]','Modelo do Atlas revisado pelo professor.');await click('Publicar Versão v2');
    await wait(`!document.body.innerText.includes('Publicar Nova Versão Oficial')`);
    await fs.mkdir('docs/evidencias/offline-atlas',{recursive:true});await browser.screenshot('docs/evidencias/offline-atlas/professor-atlas.png');
    const records=await browser.evaluate(`fetch('/api/lessons').then(r=>r.json())`);
    const list=records.lessons;assert.equal(list.length,1);const lessonId=list[0].id;
    const getLesson=()=>browser!.evaluate(`fetch('/api/lessons/${lessonId}').then(r=>r.json())`);
    const saved=await getLesson();assert.ok(JSON.stringify(saved).includes(passage));assert.equal(saved.currentVersion,2);
    const ai=await browser.evaluate(`fetch('/api/ai/providers').then(r=>r.json())`);assert.equal(ai.offline,true);
    assert.equal(await browser.evaluate(`fetch('/api/ai/generate-lesson',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status)`),409);
    await stop();await start();await browser.send('Network.clearBrowserCookies');await browser.navigate(url);await wait(`document.body.innerText.includes('Neste computador')`);
    assert.equal((await(await fetch(url+'/api/auth/me')).json()).user.id,owner.id);
    const reopened=await getLesson();assert.ok(JSON.stringify(reopened).includes(passage));assert.ok(JSON.stringify(reopened).includes('historical_change'));
    const material=await browser.evaluate(`fetch('/api/materials').then(r=>r.json())`);assert.equal(material.materials.length,1);
    assert.equal(await browser.evaluate(`fetch('/api/materials/${material.materials[0].id}/original').then(r=>r.text())`),passage);
    await stop();const backups=(await fs.readdir(path.join(data,'backups'))).filter(p=>p.startsWith('backup-')).sort();assert.ok(backups.length>=2);
    await start(path.join(data,'backups',backups.at(-1)!));
    await browser.send('Network.clearBrowserCookies');await browser.navigate(url);await wait(`document.body.innerText.includes('Neste computador')`);
    assert.equal((await(await fetch(url+'/api/auth/me')).json()).user.id,owner.id);
    assert.ok(JSON.stringify(await getLesson()).includes(passage));assert.ok((await fs.readdir(path.join(data,'backups'))).some(p=>p.startsWith('antes-restauracao-')));
  }finally{await browser?.close();await stop();await fs.rm(data,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('HTML exportado: 26 modelos e todas as variantes operam sem CDN e preservam fonte',async()=>{
  const documents=ATLAS.map(profile=>{
    const spec=structuredClone(TEMPLATE_SOLAR_SYSTEM);spec.lesson.subject=profile.subjects[0] as any;spec.lesson.title=profile.name;spec.lesson.topic=profile.name;
    spec.scenes=[{id:'atlas',type:'text',title:profile.name,content:[profile.keywords[0]],atlas_model:profile.id,source_citation:'Original do professor · Página 2'}];
    return generateStandaloneHtml(spec);
  });
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"connect-src 'none'; img-src data:; font-src 'none'; media-src 'none'");res.end(documents[Number(req.url?.slice(1))]||documents[0]);});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));let browser:CdpSession|undefined;
  try{
    browser=await launchHeadlessChrome(9560);await browser.setViewport(1366,768);
    for(const [index,profile] of ATLAS.entries()){
      await browser.navigate(`http://127.0.0.1:${(server.address() as net.AddressInfo).port}/${index}`);
      assert.equal(await browser.evaluate(`document.querySelector('.learning-canvas')?.dataset.learningKind`),profile.id);
      assert.ok(await browser.evaluate(`document.body.innerText.includes('Original do professor · Página 2')`));
      const first=await browser.evaluate(`document.querySelector('.learning-art').innerHTML`);
      for(let variant=0;variant<profile.variants.length;variant++){
        await browser.evaluate(`document.querySelectorAll('.learning-variants button')[${variant}].click()`);
        assert.equal(await browser.evaluate(`document.querySelectorAll('.learning-variants button')[${variant}].getAttribute('aria-pressed')`),'true');
        assert.ok(await browser.evaluate(`!!document.querySelector('.learning-art svg')&&!/NaN|undefined/.test(document.querySelector('.learning-art').innerHTML)`));
      }
      assert.notEqual(await browser.evaluate(`document.querySelector('.learning-art').innerHTML`),first,profile.id+' deve mudar o desenho');
      assert.equal(await browser.evaluate(`performance.getEntriesByType('resource').filter(r=>!r.name.startsWith(location.origin)).length`),0);
      if(['transformations','food_chain','sources','photosynthesis'].includes(profile.id))await browser.screenshot(`docs/evidencias/offline-atlas/export-${profile.id}.png`);
    }
  }finally{await browser?.close();await new Promise<void>(r=>server.close(()=>r()));}
});
