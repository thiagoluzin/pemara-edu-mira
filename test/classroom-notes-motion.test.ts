import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createServer} from 'vite';
import type {LessonSpec,TextScene} from '../src/types/lesson';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import {createLearningPlan} from '../src/engine/learningVisual';
import {launchHeadlessChrome} from './helpers/cdpBrowser';

const spec=JSON.parse(fs.readFileSync(new URL('./fixtures/mixtures-classroom.json',import.meta.url),'utf8')) as LessonSpec;
const wait=()=>new Promise(r=>setTimeout(r,280));
test('Desafio importado reconhece as misturas sem depender de seleção manual',()=>{
 const scene={...spec.scenes[1],atlas_model:undefined} as TextScene;
 assert.equal(createLearningPlan(scene,spec.lesson).kind,'separation');
});

// Includes a cold Vite build; the viewport assertions below are unchanged.
test('Apresentação no programa: janela estreita não corta desenho, notas ou controles', {timeout:180000},async()=>{
 const vite=await createServer({cacheDir:`node_modules/.vite-classroom-${process.pid}`,server:{host:'127.0.0.1',port:0,hmr:false}});await vite.listen();
 const browser=await launchHeadlessChrome(9594);
 try{
  await browser.navigate(`http://127.0.0.1:${(vite.httpServer!.address() as any).port}/test/fixtures/classroom-presentation.html`);
  const until=Date.now()+30000;while(Date.now()<until&&!await browser.evaluate(`!!document.querySelector('.learning-art')`))await wait();
  assert.equal(await browser.evaluate(`!!document.querySelector('.learning-art')`),true,'A apresentação deve estar carregada antes dos cliques');
  for(const [width,height] of [[1366,768],[543,704],[390,844]]){
   await browser.setViewport(width,height);
   await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.title==='Notas Pedagógicas (Atalho: N)').click()`);await wait();
   assert.equal(await browser.evaluate(`document.querySelectorAll('.learning-art [data-mixture]').length`),3);
   const boxes=await browser.evaluate(`[document.querySelector('header'),document.querySelector('main'),document.querySelector('aside')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth};})`);
   for(const b of boxes)assert.ok(b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=height&&b.scrollWidth<=b.clientWidth+1,`${width}x${height}: ${JSON.stringify(b)}`);
   await browser.evaluate(`document.querySelector('[aria-label="Fechar notas do professor"]').click()`);
   await browser.evaluate(`(()=>{const b=document.querySelector('.learning-playback button');if(b.textContent==='Reproduzir animação')b.click();document.querySelector('main').scrollTop=0;})()`);await wait();
   const visible=await browser.evaluate(`(()=>{const panel=document.querySelector('main').getBoundingClientRect();return ['.learning-playback button','.learning-art svg'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,panelTop:panel.top,panelBottom:panel.bottom};});})()`);
   for(const box of visible)assert.ok(box.top>=box.panelTop&&box.bottom<=box.panelBottom&&box.left>=0&&box.right<=width,`Reprodução e desenho visíveis juntos em ${width}: ${JSON.stringify(box)}`);
  }
 }finally{await browser.close();await vite.close();}
});
test('Aula real exportada: notas visíveis, três misturas em movimento e sequência completa', {timeout:60000},async()=>{
 const html=process.env.PEMARA_EXPORTED_HTML?fs.readFileSync(process.env.PEMARA_EXPORTED_HTML,'utf8'):generateStandaloneHtml(spec);
 const server=http.createServer((_,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"connect-src 'none'; img-src data:; font-src 'none'; media-src 'none'");res.end(html);});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const browser=await launchHeadlessChrome(9593);
 const errors:string[]=[];browser.ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params));});
 try{
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await browser.navigate(`http://127.0.0.1:${(server.address() as any).port}`);
  assert.equal(await browser.evaluate(`!!document.querySelector('#btn-next')`),true,'A apresentação deve estar carregada antes dos cliques');
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   await browser.setViewport(width,height);
   await browser.evaluate(`window.goToSlide(1);window.scrollTo(0,0);if(document.querySelector('#btn-notes-toggle').getAttribute('aria-expanded')!=='true')document.querySelector('#btn-notes-toggle').click()`);
   const box=await browser.evaluate(`(()=>{const p=document.querySelector('#teacher-notes-container'),r=p.getBoundingClientRect();return {visible:getComputedStyle(p).display!=='none',top:r.top,bottom:r.bottom,left:r.left,right:r.right};})()`);
   assert.ok(box.visible&&box.top>=0&&box.bottom<=height&&box.left>=0&&box.right<=width,`Notas dentro da tela ${width}x${height}: ${JSON.stringify(box)}`);
   await browser.evaluate(`document.querySelector('[aria-label="Fechar notas do professor"]').click()`);
   assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('#teacher-notes-container')).display`),'none');
  }
  await browser.setViewport(1024,768);
  const frames=()=>browser.evaluate(`Array.from(document.querySelectorAll('#slide-content [data-mixture]')).map(g=>Array.from(g.querySelectorAll('.atlas-travel,.learning-particle')).map(e=>{const s=getComputedStyle(e);return [s.transform,s.offsetDistance]}))`);
  assert.equal(await browser.evaluate(`document.querySelectorAll('#slide-content [data-mixture]').length`),3,'Três desenhos, não cartões de texto');
  await browser.evaluate(`document.querySelector('[data-action=play]').click()`);
  const before=await frames();await wait();const after=await frames();
  for(let i=0;i<3;i++)assert.notDeepEqual(after[i],before[i],`Movimento perceptível da mistura ${i}`);
  await browser.evaluate(`document.querySelector('[data-action=play]').click()`);await wait();const paused=await frames();await wait();assert.deepEqual(await frames(),paused);
  await browser.evaluate(`document.querySelector('[data-action=play]').click()`);await wait();assert.notDeepEqual(await frames(),paused);
  for(let i=0;i<spec.scenes.length;i++){
   await browser.evaluate(`window.goToSlide(${i});if(document.querySelector('#btn-notes-toggle').getAttribute('aria-expanded')!=='true')document.querySelector('#btn-notes-toggle').click()`);
   assert.equal(await browser.evaluate(`document.querySelector('#teacher-notes-text').textContent`),spec.scenes[i].teacher_notes,`Notas da página ${i+1}`);
  }
  await browser.pressKey('Home');
  for(let i=0;i<16;i++)await browser.evaluate(`document.querySelector('#btn-next').click()`);
  assert.equal(await browser.evaluate(`document.querySelector('#slide-num').textContent`),'Página 6 de 6 · Etapa 3/3');
  assert.equal(await browser.evaluate(`document.querySelector('#btn-next').disabled`),true);
  for(let i=0;i<16;i++)await browser.evaluate(`document.querySelector('#btn-prev').click()`);
  assert.equal(await browser.evaluate(`document.querySelector('#slide-num').textContent`),'Página 1 de 6');
  assert.equal(await browser.evaluate(`document.querySelector('#btn-prev').disabled`),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
});
