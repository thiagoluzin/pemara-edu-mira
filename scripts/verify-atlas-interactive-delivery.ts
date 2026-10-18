import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {launchHeadlessChrome} from '../test/helpers/cdpBrowser';import {ATLAS} from '../src/animations/atlas';import {sceneStepCount} from '../src/engine/presentationNavigation';
const surface=process.argv[2];assert.ok(['programa','html'].includes(surface));
const out='docs/evidencias/atlas-interativo-completo-20261018',lessons=JSON.parse(fs.readFileSync(out+'/aulas.json','utf8'));
const selected=process.argv[3]?lessons.filter((l:any)=>l.subject===process.argv[3]):lessons;
const b=await launchHeadlessChrome(surface==='html'?9565:9566),rows:any[]=[],errors:any[]=[],external:string[]=[],files:any[]=[],navigation:any[]=[];
const wait=(ms=100)=>new Promise(r=>setTimeout(r,ms));
const until=async(expression:string)=>{for(let i=0;i<150;i++){if(await b.evaluate(expression))return;await wait();}throw Error('Ausente: '+expression);};
const click=async(selector:string)=>{await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await wait(25);};
const input=async(selector:string,value:number|string)=>{await b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait(25);};
const play=async()=>{await b.evaluate(`[...document.querySelectorAll('button')].find(e=>/^(Reproduzir animação|Pausar animação)$/.test(e.textContent.trim())).click()`);await wait(30);};
const pick=async(i:number)=>{await b.evaluate(`document.querySelectorAll('.learning-variants button')[${i}].click()`);await wait(35);};
const go=async(i:number)=>{if(surface==='html')await b.evaluate(`window.goToSlide(${i})`);else await click(`button[title^="Página ${i+1}:"]`);await wait(40);};
const geometry=()=>b.evaluate(`(()=>{const lab=document.querySelector('.atlas-lab');if(lab.dataset.controller!=='native')return lab.querySelector('svg').innerHTML;return [...lab.querySelector('.atlas-scene>svg').querySelectorAll('[data-motion-role],.phenomenon-motion,.atlas-travel,.learning-particle')].map(e=>{const m=e.getCTM(),s=getComputedStyle(e);return [m.a,m.b,m.c,m.d,m.e,m.f,s.offsetDistance,s.strokeDashoffset]});})()`);
b.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url)&&!/^http:\/\/127\.0\.0\.1:3001\//.test(m.params.request.url))external.push(m.params.request.url);if(m.method==='Fetch.requestPaused'){const u=m.params.request.url,local=/^http:\/\/127\.0\.0\.1:3001\//.test(u)||!/^https?:/.test(u);void b.send(local?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(local?{}:{errorReason:'InternetDisconnected'})});}});
try{
 await b.setViewport(1366,1000);await b.send('Network.enable');await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 if(surface==='html')await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});else await b.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 for(const l of selected){
  if(surface==='html'){await b.navigate(pathToFileURL(path.resolve(l.file)).href);files.push({file:l.file,sha256:createHash('sha256').update(fs.readFileSync(l.file)).digest('hex')});await until(`!!document.querySelector('#btn-next')`);}
  else{await b.navigate('http://127.0.0.1:3001/library');await until(`[...document.querySelectorAll('h3')].some(e=>e.textContent===${JSON.stringify(l.title)})`);await b.evaluate(`[...document.querySelectorAll('h3')].find(e=>e.textContent===${JSON.stringify(l.title)}).parentElement.parentElement.querySelector('button[title="Apresentar Aula em Tela Cheia"]').click()`);await until(`!!document.querySelector('button[title^="Página 1:"]')`);}
  for(let page=0;page<=l.kinds.length;page++){
   await go(page);await click(surface==='html'?'#btn-notes-toggle':'button[title="Notas Pedagógicas (Atalho: N)"]');assert.ok((await b.evaluate(`document.querySelector(${JSON.stringify(surface==='html'?'#teacher-notes-text':'aside[aria-label="Notas do professor"]')}).textContent`)).length>100);await click('[aria-label="Fechar notas do professor"]');if(page===0)continue;
   const kind=l.kinds[page-1];await until(`!!document.querySelector('.atlas-lab')`);const variants=kind==='movement'?3:ATLAS.find(p=>p.id===kind)!.variants.length;assert.equal(await b.evaluate(`document.querySelectorAll('.learning-variants button').length`),variants);
   for(let variant=0;variant<variants;variant++){
    await pick(variant);const context=surface+' '+kind+'/'+variant,native=await b.evaluate(`document.querySelector('.atlas-lab').dataset.controller==='native'`),time=native?'[data-ex-time]':'input[data-time]',reset=native?'[data-ex-reset]':'[data-lab-reset]',step=native?'[data-ex-step]':'[data-lab-step]';
    const start=await geometry();await wait();assert.deepEqual(await geometry(),start,context+' reduzido');await play();await wait(230);assert.notDeepEqual(await geometry(),start,context+' movimento');await play();const paused=await geometry();await wait();assert.deepEqual(await geometry(),paused,context+' pausa');await play();await wait(160);assert.notDeepEqual(await geometry(),paused,context+' retomada');await play();
    await input(time,25);const a=await geometry();await click(step);assert.notDeepEqual(await geometry(),a,context+' passo');await input(time,65);assert.notDeepEqual(await geometry(),a,context+' tempo');if(native){await click('[data-ex-compare]');assert.equal(await b.evaluate(`document.querySelectorAll('.atlas-ghost').length`),1);await click('[data-ex-compare]');}
    await input(time,45);assert.ok(!/NaN|undefined|Infinity/.test(await b.evaluate(`document.querySelector('.atlas-lab svg').outerHTML`)));await b.screenshot(`${out}/${surface}-${kind}-v${variant}.png`);
    await click(reset);assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.time`),'0');assert.deepEqual(await geometry(),start,context+' restaurar');
    rows.push({surface,kind,variant,movement:true,pause:true,resume:true,step:true,seek:true,reset:true,notes:true,compare:native?true:null});
    await b.evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Recomeçar exploração').click()`);await wait(40);
   }
   await pick(variants-1);
   // Subject-specific controls must change the represented data in the delivered artifact.
   if(kind==='optics'){await input('[data-ex-param=angle]',60);await input('[data-ex-param=index]',1.5);assert.ok(Math.abs(Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.refractedAngle`))-Math.asin(Math.sin(Math.PI/3)/1.5)*180/Math.PI)<1e-8);}
   if(kind==='coordinates'){await input('[data-ex-param=x]',4);await input('[data-ex-param=y]',2);assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.point`),'[4,-2]');}
   if(kind==='probability'){await input('[data-ex-param=event]','one');assert.equal(Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.probability`)),1/6);}
   if(kind==='sentence'){await input('[data-ex-param=subject]','Os estudantes');await input('[data-ex-param=predicate]','compararam as hipóteses.');assert.ok((await b.evaluate(`document.querySelector('.atlas-scene').textContent`)).includes('Os estudantes'));}
   for(const width of [543,390]){await b.setViewport(width,844);assert.equal(await b.evaluate(`document.documentElement.scrollWidth>innerWidth+1`),false,kind+' largura '+width);}await b.setViewport(1366,1000);
   console.log(contextLabel(surface,kind),'OK');
  }
  const saved=JSON.parse(fs.readFileSync(out+'/aula-'+l.subject+'.json','utf8')),spec=saved.currentSpec||saved.lesson?.spec||saved.spec;
  assert.ok(spec,'spec salvo');const transitions=spec.scenes.reduce((n:number,s:any)=>n+sceneStepCount(s,spec.lesson),0)-1;
  const nav=(next:boolean)=>surface==='html'?`document.querySelector('${next?'#btn-next':'#btn-prev'}')`:`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='${next?'Próximo':'Anterior'}')`;
  await go(0);for(let n=0;n<transitions;n++){assert.equal(await b.evaluate(nav(true)+'.disabled'),false);await b.evaluate(nav(true)+'.click()');await wait(15);}assert.equal(await b.evaluate(nav(true)+'.disabled'),true);
  for(let n=0;n<transitions;n++){await b.evaluate(nav(false)+'.click()');await wait(15);}assert.equal(await b.evaluate(nav(false)+'.disabled'),true);navigation.push({subject:l.subject,pages:l.kinds.length+1,transitions,passed:true});
 }
 assert.equal(rows.length,selected.reduce((n:number,l:any)=>n+l.kinds.reduce((s:number,k:string)=>s+(k==='movement'?3:ATLAS.find(p=>p.id===k)!.variants.length),0),0));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(`${out}/${surface}-entrega${process.argv[3]?'-'+process.argv[3]:''}.json`,JSON.stringify({rows,files,navigation,errors,external,network:surface==='html'?'arquivo local com Network offline total':'somente loopback permitido; internet bloqueada',passed:true},null,2));
}finally{await b.close();}
function contextLabel(surface:string,kind:string){return surface+' '+kind;}
