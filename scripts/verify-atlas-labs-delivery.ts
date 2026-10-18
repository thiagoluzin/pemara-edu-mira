import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launchHeadlessChrome} from '../test/helpers/cdpBrowser';
const surface=process.argv[2];assert.ok(['programa','html'].includes(surface));
const out='docs/evidencias/atlas-laboratorios-20261018',lessons=JSON.parse(fs.readFileSync(out+'/aulas.json','utf8'));
const b=await launchHeadlessChrome(surface==='html'?9567:9568),rows:any[]=[],errors:any[]=[],external:string[]=[],files:any[]=[];
const wait=(ms=150)=>new Promise(r=>setTimeout(r,ms));
const until=async(expression:string)=>{for(let i=0;i<150;i++){if(await b.evaluate(expression))return;await wait(100);}throw Error('Ausente: '+expression);};
const click=async(selector:string)=>{await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await wait(50);};
const text=async(label:string)=>{await b.evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).click()`);await wait(50);};
const input=async(selector:string,value:number)=>{await b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${value};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait(40);};
const read=()=>b.evaluate(`document.querySelector('.atlas-lab svg').innerHTML`);
const play=async()=>{await b.evaluate(`[...document.querySelectorAll('button')].find(e=>/^(Reproduzir animação|Pausar animação)$/.test(e.textContent.trim())).click()`);await wait(40);};
const pick=async(i:number)=>{await b.evaluate(`document.querySelectorAll('.learning-variants button')[${i}].click()`);await wait(60);};
const go=async(i:number)=>{if(surface==='html')await b.evaluate(`window.goToSlide(${i})`);else await click(`button[title^="Página ${i+1}:"]`);await wait(60);};
b.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.method==='Fetch.requestPaused'){const u=m.params.request.url;const local=/^http:\/\/127\.0\.0\.1:3001\//.test(u);if(!local&&/^https?:/.test(u))external.push(u);void b.send(local||!/^https?:/.test(u)?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(local||!/^https?:/.test(u)?{}:{errorReason:'InternetDisconnected'})});}});
try{
 await b.setViewport(1366,1000);await b.send('Network.enable');await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 if(surface==='html')await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 else await b.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 for(const l of lessons){
  if(surface==='html'){await b.navigate(pathToFileURL(path.resolve(l.file)).href);files.push({file:l.file,sha256:createHash('sha256').update(fs.readFileSync(l.file)).digest('hex')});await until(`!!document.querySelector('#btn-next')`);}
  else {await b.navigate('http://127.0.0.1:3001/library');await until(`[...document.querySelectorAll('h3')].some(e=>e.textContent===${JSON.stringify(l.title)})`);await b.evaluate(`[...document.querySelectorAll('h3')].find(e=>e.textContent===${JSON.stringify(l.title)}).parentElement.parentElement.querySelector('button[title="Apresentar Aula em Tela Cheia"]').click()`);await until(`!!document.querySelector('button[title^="Página 1:"]')`);}
  for(const page of [0,1]){await go(page);await click(surface==='html'?'#btn-notes-toggle':'button[title="Notas Pedagógicas (Atalho: N)"]');assert.ok((await b.evaluate(`document.querySelector(${JSON.stringify(surface==='html'?'#teacher-notes-text':'aside[aria-label="Notas do professor"]')}).textContent`)).length>100);await click('[aria-label="Fechar notas do professor"]');}
  await until(`!!document.querySelector('.atlas-lab')`);
  for(const v of l.kind==='separation'?[3]:l.kind==='respiration'?[0,1,2]:[0,1,2,3]){
   await pick(v);const start=await read();await wait();assert.equal(await read(),start);await play();await wait(450);assert.notEqual(await read(),start,'Há movimento geométrico');await play();await wait(40);const paused=await read();await wait();assert.equal(await read(),paused);await play();await wait(250);assert.notEqual(await read(),paused);await play();await click('[data-lab-step]');const stepped=await read();await input('input[data-time]',50);assert.notEqual(await read(),stepped);
   for(const phase of [0,50,100]){await input('input[data-time]',phase);assert.equal(await b.evaluate(`document.querySelector('.learning-canvas').dataset.running`),'false');assert.ok(!/NaN|undefined|Infinity/.test(await read()));if(v===(l.kind==='separation'?3:l.kind==='statistics'?1:0))await b.screenshot(`${out}/${surface}-${l.slug}-fase-${phase}.png`);}
   await click('[data-lab-reset]');assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.time`),'0');rows.push({kind:l.kind,variant:v,motion:true,pause:true,resume:true,step:true,timeline:true,reset:true});
  }
  if(l.kind==='statistics'){
   await pick(1);await input('[data-param="4"]',10);assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.mean`),'5.2');assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.median`),'3');await input('input[data-time]',100);
   const sum=await b.evaluate(`Array.from(document.querySelectorAll('[data-motion-role=redistribuir] rect')).reduce((s,e)=>s+Number(e.getAttribute('height'))/23,0)`);assert.ok(Math.abs(sum-26)<.01);
   await b.evaluate(`document.querySelector('[data-drag="0"]').focus()`);await b.pressKey('ArrowUp');assert.equal(await b.evaluate(`document.querySelector('[data-param="0"]').value`),'3');assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.variant`),'1');
  }else if(l.kind==='separation'){
   await input('[data-param=energy]',1);await input('input[data-time]',75);const low=Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.remaining`));await input('[data-param=energy]',3);assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.time`),'0');await input('input[data-time]',75);assert.ok(Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.remaining`))<low);await click('[data-mode=boiling]');await input('input[data-time]',50);assert.ok((await b.evaluate(`document.querySelector('.atlas-lab-foot').textContent`)).includes('bolhas'));
  }else {await pick(0);await input('input[data-time]',0);await input('[data-param=breathingRate]',6);await play();await wait(400);await play();const slow=Number(await b.evaluate(`document.querySelector('input[data-time]').value`));await click('[data-lab-reset]');await input('[data-param=breathingRate]',24);await play();await wait(400);await play();const fast=Number(await b.evaluate(`document.querySelector('input[data-time]').value`));console.log({slow,fast,state:await b.evaluate(`document.querySelector('.atlas-lab').outerHTML.slice(-1000)`)});assert.ok(fast>slow*2);}
  await click('[data-lab-reset]');if(l.kind==='statistics')await pick(1);await input('input[data-time]',45);await b.screenshot(`${out}/${surface}-${l.slug}-final.png`);
  for(const width of [543,390]){await b.setViewport(width,844);assert.equal(await b.evaluate(`document.documentElement.scrollWidth>innerWidth+1`),false);await b.screenshot(`${out}/${surface}-${l.slug}-${width}.png`);}await b.setViewport(1366,1000);
  await go(0);const next=surface==='html'?'#btn-next':null,prev=surface==='html'?'#btn-prev':null;
  for(let i=0;i<3;i++){if(next)await click(next);else await text('Próximo');}assert.equal(await b.evaluate(surface==='html'?`document.querySelector('#btn-next').disabled`:`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Próximo').disabled`),true);
  for(let i=0;i<3;i++){if(prev)await click(prev);else await text('Anterior');}assert.equal(await b.evaluate(surface==='html'?`document.querySelector('#btn-prev').disabled`:`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Anterior').disabled`),true);
  console.log(surface,l.slug,'OK');
 }
 assert.equal(rows.length,8);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(`${out}/${surface}-entrega-resultados.json`,JSON.stringify({surface,rows,files,errors,external,network:surface==='html'?'offline total, arquivo local':'somente loopback; internet bloqueada',notes:true,navigation:true,passed:true},null,2));
}finally{await b.close();}
