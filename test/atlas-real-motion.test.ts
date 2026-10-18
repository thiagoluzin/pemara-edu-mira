import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {ATLAS} from '../src/animations/atlas';import {ATLAS_REVIEW} from '../src/animations/atlasReview';
import {atlasSvg} from '../src/animations/atlasSvg';import {LEARNING_CSS} from '../src/engine/learningVisual';
import {launchHeadlessChrome} from './helpers/cdpBrowser';

test('Atlas integral: 86 opções mudam a geometria do objeto didático, não só opacidade',async()=>{
 const profiles=ATLAS.filter(p=>p.id in ATLAS_REVIEW);
 assert.equal(profiles.length,24);assert.equal(profiles.reduce((n,p)=>n+p.variants.length,0),86);
 const frames=profiles.flatMap(p=>p.variants.map((_,v)=>({id:p.id+'-'+v,role:ATLAS_REVIEW[p.id as keyof typeof ATLAS_REVIEW].roles[v],html:atlasSvg(p.id,v)})));
 for(const f of frames){assert.ok(f.role,f.id);assert.doesNotMatch(f.html,/atlas-cue/,f.id+' não pode depender de destaque piscando');}
 const html=`<meta charset="utf-8"><style>${LEARNING_CSS}.frame{width:620px;padding:0!important}</style>`+frames.map(f=>`<section id="${f.id}" class="frame learning-canvas" data-running="false">${f.html}</section>`).join('');
 const server=http.createServer((_,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(html)});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const b=await launchHeadlessChrome(9569);
 try{
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await b.navigate(`http://127.0.0.1:${(server.address() as any).port}`);
  const results=await b.evaluate(`(()=>{const cases=${JSON.stringify(frames.map(({id,role})=>({id,role})))};return cases.map(f=>{const root=document.getElementById(f.id),nodes=Array.from(root.querySelectorAll('[data-motion-role="'+f.role+'"]'));const samples=[0,1200,2400,3600,4790].map(t=>{root.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t});return nodes.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});});return {id:f.id,count:nodes.length,samples};});})()`);
  for(const r of results){assert.ok(r.count>0,r.id+' precisa do objeto didático previsto');assert.ok(r.samples.slice(1).some((s:number[][])=>s.some((box,i)=>box.some((n,k)=>Math.abs(n-r.samples[0][i][k])>3))),r.id+' deve deslocar ou transformar esse objeto');}
  // Preserve the total while equalizing the five bars, not a decorative chart effect.
  const mean=await b.evaluate(`(()=>{const root=document.getElementById('statistics-1');return [0,2400,4790].map(t=>{root.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t});return Array.from(root.querySelectorAll('[data-motion-role=redistribuir]')).map(e=>Number(e.querySelector('rect').getAttribute('height'))*new DOMMatrix(getComputedStyle(e).transform).d);});})()`);
  for(const heights of mean)assert.ok(Math.abs(heights.reduce((a:number,n:number)=>a+n,0)-500)<.1,'Soma das alturas deve conservar 25 unidades');
  assert.ok(Math.max(...mean[2])-Math.min(...mean[2])<1,'Cinco valores convergem para a média 5');
  const ordered=await b.evaluate(`(()=>{const root=document.getElementById('statistics-2');root.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=5990});return Array.from(root.querySelectorAll('[data-motion-role=ordenar-dados]')).map(e=>({x:e.getBoundingClientRect().x,value:Number(e.textContent)})).sort((a,b)=>a.x-b.x).map(e=>e.value);})()`);
  assert.deepEqual(ordered,[2,3,3,8,9]);
  const respiration=await b.evaluate(`[0,2].map(v=>{const root=document.getElementById('respiration-'+v);return [0,3990].map(t=>{root.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t});return {lung:root.querySelector('[data-motion-role=pulmoes]').getBoundingClientRect().width,diaphragm:root.querySelector('[data-motion-role=diafragma]').getBoundingClientRect().y};});})`);
  assert.ok(respiration[0][1].lung>respiration[0][0].lung&&respiration[0][1].diaphragm>respiration[0][0].diaphragm,'Inspiração expande pulmões e desce diafragma');
  assert.ok(respiration[1][1].lung<respiration[1][0].lung&&respiration[1][1].diaphragm<respiration[1][0].diaphragm,'Expiração contrai volume e sobe diafragma');
  const balance=await b.evaluate(`(()=>{const root=document.getElementById('equation_balance-1');return [0,2400].map(t=>{root.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t});return ['menos-tres-esquerda','menos-tres-direita'].map(role=>{const e=root.querySelector('[data-motion-role='+role+']');return {count:e.querySelectorAll('rect').length,y:e.getBoundingClientRect().y};});});})()`);
  assert.equal(balance[0][0].count,3);assert.equal(balance[0][1].count,3);assert.ok(Math.abs((balance[1][0].y-balance[0][0].y)-(balance[1][1].y-balance[0][1].y))<.01);
  const beats=await b.evaluate(`(()=>{const root=document.getElementById('rhythm-1'),marker=root.querySelector('[data-motion-role=marcador-ritmico]');return [0,1000,2000,3000].map(t=>{root.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t});const m=new DOMMatrix(getComputedStyle(marker).transform);return [m.e,m.f];});})()`);
  assert.deepEqual(beats,[[118,135],[246,135],[374,135],[502,135]],'Marcador deve chegar aos quatro tempos nos instantes corretos');
 }finally{await b.close();await new Promise<void>(r=>server.close(()=>r()));}
});
