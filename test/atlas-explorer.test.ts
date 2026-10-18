import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createServer} from 'vite';
import {animationCases} from './fixtures/animation-cases';import {generateStandaloneHtml} from '../src/components/ExportModal';import {launchHeadlessChrome} from './helpers/cdpBrowser';
test('Atlas completo: 88 variantes adicionais com geometria, tempo, comparação e parâmetros nos dois formatos',{timeout:300000},async()=>{
 const out='docs/evidencias/atlas-interativo-completo-20261018';fs.mkdirSync(out,{recursive:true});
 const selected=animationCases.map((c,i)=>({...c,index:i})).filter(c=>(c.family==='atlas'&&!['atlas-respiration','atlas-statistics'].includes(c.id))||c.id==='base-movement');
 const docs=selected.map(c=>generateStandaloneHtml(c.spec));
 const v=await createServer({cacheDir:'node_modules/.vite-explorer-'+process.pid,server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'export-test',configureServer(s){s.middlewares.use('/explorer-html',(req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"connect-src 'none'; img-src data:; font-src 'none'");res.end(docs[Number(req.url?.slice(1))]);});}}]});await v.listen();
 const b=await launchHeadlessChrome(9576),base='http://127.0.0.1:'+(v.httpServer!.address() as any).port,rows:any[]=[],errors:any[]=[];
 const wait=(ms=80)=>new Promise(r=>setTimeout(r,ms));
 const input=async(selector:string,value:string|number)=>{await b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait(25);};
 const click=async(selector:string)=>{await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await wait(25);};
 const geometry=()=>b.evaluate(`Array.from(document.querySelector('.atlas-scene>svg').querySelectorAll('[data-motion-role],.phenomenon-motion,.atlas-travel,.learning-particle')).map(e=>{const m=e.getCTM(),s=getComputedStyle(e);return [e.tagName,m.a,m.b,m.c,m.d,m.e,m.f,s.offsetDistance,s.strokeDashoffset]})`);
 const play=async()=>{await b.evaluate(`[...document.querySelectorAll('button')].find(e=>/^(Reproduzir animação|Pausar animação)$/.test(e.textContent.trim())).click()`);await wait(25);};
 b.ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.method==='Runtime.exceptionThrown')errors.push(m.params);});
 try{await b.setViewport(1366,1000);await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const surface of ['react','html'])for(const [j,c] of selected.entries()){
  await b.navigate(base+(surface==='react'?'/test/fixtures/animation-audit.html?presentation=1&case='+c.index:'/explorer-html/'+j));
  for(let i=0;i<150&&!await b.evaluate(`!!document.querySelector('.atlas-explorer')`);i++)await wait(100);
  assert.ok(await b.evaluate(`!!document.querySelector('.atlas-explorer')`),c.id+' carregou');
  const count=await b.evaluate(`document.querySelectorAll('.learning-variants button').length`);
  for(let variant=0;variant<count;variant++){
   if(c.id==='atlas-separation'&&variant===3)continue;
   await b.evaluate(`document.querySelectorAll('.learning-variants button')[${variant}].click()`);await wait(45);
   const context=surface+' '+c.id+'/'+variant,start=await geometry();assert.ok(start.length,context+' geometria');assert.ok(Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.animationCount`))>0,context+' efeitos');
   await wait();assert.deepEqual(await geometry(),start,context+' reduzido');await play();await wait(200);assert.notDeepEqual(await geometry(),start,context+' movimento');await play();const paused=await geometry();await wait();assert.deepEqual(await geometry(),paused,context+' pausa');await play();await wait(140);assert.notDeepEqual(await geometry(),paused,context+' retomada');await play();
   await input('[data-ex-time]',25);const p25=await geometry();await input('[data-ex-time]',70);assert.notDeepEqual(await geometry(),p25,context+' linha do tempo');
   await click('[data-ex-compare]');assert.equal(await b.evaluate(`document.querySelectorAll('.atlas-ghost').length`),1);await input('[data-ex-time]',25);const before=await geometry();await click('[data-ex-step]');assert.notDeepEqual(await geometry(),before,context+' passo');
   await click('[data-ex-reset]');assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.time`),'0');assert.equal(await b.evaluate(`document.querySelectorAll('.atlas-ghost').length`),0);assert.deepEqual(await geometry(),start,context+' reset');
   rows.push({surface,id:c.id,variant,movement:true,pause:true,resume:true,seek:true,compare:true,step:true,reset:true});
   // Exercise a direct jump from the initial variant, including identical SVGs.
   await b.evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Recomeçar exploração').click()`);await wait(40);
  }
  await b.evaluate(`document.querySelectorAll('.learning-variants button')[${c.id==='atlas-separation'?2:count-1}].click()`);await wait(40);
  if(c.id==='atlas-optics'){await input('[data-ex-param=angle]',60);await input('[data-ex-param=index]',1.5);const a=Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.refractedAngle`));assert.ok(Math.abs(a-Math.asin(Math.sin(Math.PI/3)/1.5)*180/Math.PI)<1e-8);}
  if(c.id==='atlas-coordinates'){await input('[data-ex-param=x]',4);await input('[data-ex-param=y]',2);assert.equal(await b.evaluate(`document.querySelector('.atlas-lab').dataset.point`),'[4,-2]');}
  if(c.id==='atlas-probability'){await input('[data-ex-param=event]','one');assert.equal(Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.probability`)),1/6);}
  if(c.id==='atlas-sentence'){await input('[data-ex-param=subject]','<img src=x onerror=alert(1)>');assert.equal(await b.evaluate(`document.querySelector('.atlas-scene img')`),null);assert.ok((await b.evaluate(`document.querySelector('.atlas-scene').textContent`)).includes('<img'));}
  await click('[data-ex-reset]');const rate=c.id==='atlas-rhythm'?'tempo':'speed';
  await input('[data-ex-param='+rate+']',rate==='tempo'?40:.25);await play();await wait(240);await play();const slow=Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.time`));
  await input('[data-ex-time]',0);await input('[data-ex-param='+rate+']',rate==='tempo'?160:2);await play();await wait(240);await play();const fast=Number(await b.evaluate(`document.querySelector('.atlas-lab').dataset.time`));assert.ok(fast>slow*2,c.id+' controle de velocidade');
  await click('[data-ex-repeat]');await input('[data-ex-time]',98);await play();for(let i=0;i<50&&await b.evaluate(`document.querySelector('.learning-canvas').dataset.running==='true'`);i++)await wait(100);
  assert.equal(await b.evaluate(`document.querySelector('.learning-canvas').dataset.running`),'false',c.id+' termina um ciclo');assert.equal(await b.evaluate(`document.querySelector('[data-ex-time]').value`),'100');
  await play();await wait(120);assert.ok(Number(await b.evaluate(`document.querySelector('[data-ex-time]').value`))<98,c.id+' reproduz novamente depois do fim');await play();
  await click('[data-ex-reset]');await input('[data-ex-time]',50);await b.screenshot(out+'/'+surface+'-'+c.id+'.png');
  for(const width of [543,390]){await b.setViewport(width,844);assert.equal(await b.evaluate(`document.documentElement.scrollWidth>innerWidth+1`),false,c.id+' largura '+width);}await b.setViewport(1366,1000);
  console.log(surface,c.id,'OK');
 }
 assert.equal(rows.length,176);assert.deepEqual(errors,[]);fs.writeFileSync(out+'/exploradores-resultados.json',JSON.stringify({rows,errors,passed:true},null,2));
 }finally{await b.close();await v.close();}
});
