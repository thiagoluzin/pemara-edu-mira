import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ATLAS_REVIEW} from '../src/animations/atlasReview';
import {ATLAS} from '../src/animations/atlas';
import {launchHeadlessChrome} from '../test/helpers/cdpBrowser';
const surface=process.argv[2];assert.ok(['programa','html'].includes(surface));
const root='docs/evidencias/atlas-movimento-integral-20261017',only=process.argv[3],out=only?root+'/reteste-'+only+'-'+surface:root,lessons=JSON.parse(fs.readFileSync(root+(only?'/aulas-finais.json':'/aulas.json'),'utf8')).filter((l:any)=>!only||l.subject===only);if(only)fs.mkdirSync(out);
const b=await launchHeadlessChrome(surface==='html'?9567:9568),rows:any[]=[],files:any[]=[],errors:string[]=[],requests:string[]=[];
const wait=(ms=150)=>new Promise(r=>setTimeout(r,ms));
const until=async(expr:string)=>{for(let i=0;i<100;i++){if(await b.evaluate(expr))return;await wait(100);}throw Error('Não carregou: '+expr);};
const click=async(selector:string)=>{await b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Controle ausente');e.click()})()`);await wait(40);};
const clickText=async(text:string)=>{await b.evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Botão ausente: '+${JSON.stringify(text)});e.click()})()`);await wait(40);};
const snapshot=(selector:string)=>b.evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map(e=>{const m=e.getCTM(),r=e.getBoundingClientRect();return [m.a,m.b,m.c,m.d,m.e,m.f,r.x,r.y,r.width,r.height]})`);
const play=()=>surface==='html'?click('#slide-content [data-action=play]'):b.evaluate(`[...document.querySelectorAll('button')].find(e=>/^(Pausar animação|Reproduzir animação)$/.test(e.textContent.trim())).click()`);
const go=async(index:number)=>{if(surface==='html')await b.evaluate(`window.goToSlide(${index})`);else await click(`button[title^="Página ${index+1}:"]`);await wait(60);};
b.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params));if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url))requests.push(m.params.request.url);});
try{
 await b.setViewport(1366,768);await b.send('Network.enable');await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 if(surface==='html')await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 for(const lesson of lessons){
  if(surface==='html'){const absolute=path.resolve(lesson.file);await b.navigate(pathToFileURL(absolute).href);files.push({file:lesson.file,sha256:createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')});await until(`!!document.querySelector('#btn-next')`);}
  else{await b.navigate('http://127.0.0.1:3001/library');await until(`[...document.querySelectorAll('h3')].some(e=>e.textContent===${JSON.stringify(lesson.title)})`);await b.evaluate(`[...document.querySelectorAll('h3')].find(e=>e.textContent===${JSON.stringify(lesson.title)}).parentElement.parentElement.querySelector('button[title="Apresentar Aula em Tela Cheia"]').click()`);await until(`!!document.querySelector('button[title^="Página 1:"]')`);}
  for(let page=0;page<=lesson.kinds.length;page++){
   await go(page);
   await click(surface==='html'?'#btn-notes-toggle':'button[title="Notas Pedagógicas (Atalho: N)"]');
   assert.ok((await b.evaluate(`document.querySelector(${JSON.stringify(surface==='html'?'#teacher-notes-text':'aside[aria-label="Notas do professor"]')}).textContent`)).length>45);
   await click('[aria-label="Fechar notas do professor"]');
   if(page===0)continue;
   const kind=lesson.kinds[page-1];await until(`document.querySelector('.learning-canvas')?.dataset.learningKind===${JSON.stringify(kind)}`);
   const count=await b.evaluate(`document.querySelectorAll('.learning-variants button').length`);assert.equal(count,ATLAS.find(p=>p.id===kind)!.variants.length);
   for(let variant=0;variant<count;variant++){
    await b.evaluate(`document.querySelectorAll('.learning-variants button')[${variant}].click()`);await wait(50);
    const role=(ATLAS_REVIEW as any)[kind]?.roles[variant],selector=role?`[data-motion-role="${role}"]`:'.phenomenon-motion';
    const initial=await snapshot(selector);assert.ok(initial.length,kind+' alvo de movimento');await wait(140);assert.deepEqual(await snapshot(selector),initial,kind+' aguarda reprodução em modo reduzido');
    await play();await wait(650);assert.notDeepEqual(await snapshot(selector),initial,kind+'/'+variant+' muda geometria');
    await play();await wait(40);const paused=await snapshot(selector);await wait(170);assert.deepEqual(await snapshot(selector),paused,kind+' pausa geometria');
    if(variant===0)await b.screenshot(`${out}/${surface}-${kind}.png`);
    await play();await wait(270);assert.notDeepEqual(await snapshot(selector),paused,kind+' retoma');
    if(surface==='html')await click('[data-action=reset]');else await clickText('Recomeçar exploração');
    assert.equal(await b.evaluate(`document.querySelector('.learning-canvas').dataset.running`),'false');
    rows.push({surface,lesson:lesson.id,kind,variant,role:role||'phenomenon-motion',geometry:true,pause:true,resume:true,reset:true,reducedMotion:true});
   }
  }
  await go(0);let steps=0;
  const next=surface==='html'?'#btn-next':null,prev=surface==='html'?'#btn-prev':null;
  const disabled=(direction:string)=>b.evaluate(surface==='html'?`document.querySelector(${JSON.stringify(direction==='next'?next:prev)}).disabled`:`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(direction==='next'?'Próximo':'Anterior')}).disabled`);
  while(!await disabled('next')){if(next)await click(next);else await clickText('Próximo');assert.ok(++steps<100);}
  for(let i=0;i<steps;i++){if(prev)await click(prev);else await clickText('Anterior');}assert.equal(await disabled('prev'),true);
  console.log(surface,lesson.subject,lesson.kinds.length,'modelos OK',steps,'avanços');
  fs.writeFileSync(`${out}/${surface}-aulas-reais-resultados.json`,JSON.stringify({surface,rows,files,errors,requests,finished:false},null,2));
 }
 const expectedModels=lessons.flatMap((l:any)=>l.kinds);assert.equal(rows.length,ATLAS.filter(p=>expectedModels.includes(p.id)).reduce((n,p)=>n+p.variants.length,0));assert.equal(new Set(rows.map(r=>r.kind)).size,expectedModels.length);assert.deepEqual(errors,[]);if(surface==='html')assert.deepEqual(requests,[]);
 fs.writeFileSync(`${out}/${surface}-aulas-reais-resultados.json`,JSON.stringify({surface,rows,files,errors,requests,finished:true},null,2));console.log(JSON.stringify({surface,variants:rows.length,models:expectedModels.length,lessons:lessons.length,errors,offline:surface==='html'}));
}finally{await b.close();}
