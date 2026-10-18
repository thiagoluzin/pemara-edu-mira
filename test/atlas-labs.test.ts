import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createServer} from 'vite';
import {animationCases} from './fixtures/animation-cases';import {generateStandaloneHtml} from '../src/components/ExportModal';import {launchHeadlessChrome} from './helpers/cdpBrowser';
test('Laboratórios: mesmos controles, geometria e cálculos em React e HTML offline',async()=>{
 const out='docs/evidencias/atlas-laboratorios-20261018';const selected=['respiration','separation','statistics'].map(kind=>({kind,index:animationCases.findIndex(c=>c.id==='atlas-'+kind)}));
 const docs=selected.map(c=>generateStandaloneHtml(animationCases[c.index].spec));
 const v=await createServer({cacheDir:'node_modules/.vite-labs-'+process.pid,server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'labs-offline',configureServer(s){s.middlewares.use('/labs-html',(req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(docs[Number(req.url?.slice(1))]);});}}]});await v.listen();const b=await launchHeadlessChrome(9575),base='http://127.0.0.1:'+(v.httpServer!.address() as any).port,errors:any[]=[],results:any[]=[];
 b.ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.method==='Runtime.exceptionThrown')errors.push(m.params)});
 const wait=(ms=150)=>new Promise(r=>setTimeout(r,ms));const input=async(selector:string,value:number)=>{await b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${value};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait(40);};
 const click=async(selector:string)=>{await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await wait(40);};
 const pick=async(i:number)=>{await b.evaluate(`document.querySelectorAll('.learning-variants button')[${i}].click()`);await wait(70);};
 const play=()=>b.evaluate(`[...document.querySelectorAll('button')].find(e=>/^(Reproduzir animação|Pausar animação)$/.test(e.textContent.trim())).click()`);
 try{await b.setViewport(1366,1000);await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const surface of ['react','html'])for(const [j,c] of selected.entries()){
  await b.navigate(base+(surface==='react'?'/test/fixtures/animation-audit.html?presentation=1&case='+c.index:'/labs-html/'+j));
  for(let i=0;i<200&&!await b.evaluate(`!!document.querySelector('.learning-variants')`);i++)await wait(100);
  if(c.kind==='separation')await pick(3);
  assert.ok(await b.evaluate(`!!document.querySelector('.atlas-lab')`),surface+' '+c.kind);
  const variants=c.kind==='separation'?[3]:c.kind==='respiration'?[0,1,2]:[0,1,2,3];
  for(const variant of variants){await pick(variant);const before=await b.evaluate(`document.querySelector('.atlas-lab svg').innerHTML`);await wait();assert.equal(await b.evaluate(`document.querySelector('.atlas-lab svg').innerHTML`),before);await play();await wait(400);assert.notEqual(await b.evaluate(`document.querySelector('.atlas-lab svg').innerHTML`),before,c.kind+variant+' movimento');await play();await wait(40);const paused=await b.evaluate(`document.querySelector('.atlas-lab svg').innerHTML`);await wait();assert.equal(await b.evaluate(`document.querySelector('.atlas-lab svg').innerHTML`),paused);await click('[data-lab-step]');assert.notEqual(await b.evaluate(`document.querySelector('.atlas-lab svg').innerHTML`),paused);results.push({surface,kind:c.kind,variant,play:true,pause:true,step:true});}
  if(c.kind==='respiration'){
   await pick(0);await input('[data-param=breathingRate]',24);assert.equal(await b.evaluate(`document.querySelector('[data-output=breathingRate]').textContent`),'24');await input('input[data-time]',0);const start=await b.evaluate(`document.querySelector('[data-motion-role=pulmoes]').getBoundingClientRect().width`);await input('input[data-time]',50);assert.ok(await b.evaluate(`document.querySelector('[data-motion-role=pulmoes]').getBoundingClientRect().width`)>start);assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.expansion`),'1');
  }else if(c.kind==='separation'){
   await input('[data-param=energy]',1);await input('input[data-time]',75);const low=Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.remaining`));await input('[data-param=energy]',3);assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.time`),'0');await input('input[data-time]',75);assert.ok(Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.remaining`))<low);await click('[data-mode=boiling]');assert.ok(await b.evaluate(`document.querySelector('.atlas-lab-foot').textContent.includes('bolhas')`));
  }else{
   await pick(1);for(let i=0;i<5;i++)await input('[data-param="'+i+'"]',i===4?10:0);
   assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.mean`),'2');assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.median`),'0');
   for(const t of [0,50,100]){await input('input[data-time]',t);const sum=await b.evaluate(`Array.from(document.querySelectorAll('[data-motion-role=redistribuir] rect')).reduce((s,e)=>s+Number(e.getAttribute('height')),0)`);assert.ok(Math.abs(sum-230)<.5,'Conserva dez unidades');}
   await pick(2);await input('input[data-time]',100);const order=await b.evaluate(`Array.from(document.querySelectorAll('[data-motion-role=ordenar-dados]')).sort((a,b)=>a.getBoundingClientRect().x-b.getBoundingClientRect().x).map(e=>Number(e.textContent))`);assert.deepEqual(order,[0,0,0,0,10]);
   await pick(3);await input('input[data-time]',100);const target=await b.evaluate(`(()=>{const e=document.querySelector('[data-drag="4"]'),r=e.getBoundingClientRect(),s=e.ownerSVGElement.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,to:s.top+s.height*(325-4*23)/410};})()`);
   await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',clickCount:1});await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.to,button:'left',buttons:1});await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.to,button:'left',clickCount:1});await wait();assert.equal(await b.evaluate(`document.querySelector('[data-param="4"]').value`),'4','Arrastar altera valor');
  }
  await b.screenshot(path.join(out,surface+'-'+c.kind+'.png'));
  for(const width of [543,390]){await b.setViewport(width,844);assert.equal(await b.evaluate(`document.documentElement.scrollWidth>innerWidth+1`),false,'Sem overflow');}await b.setViewport(1366,1000);
  await click('[data-lab-reset]');assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.time`),'0');assert.equal(await b.evaluate(`document.querySelector('.learning-canvas').dataset.running`),'false');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/controles-resultados.json',JSON.stringify({results,errors},null,2));
 }finally{await b.close();await v.close();}
});
