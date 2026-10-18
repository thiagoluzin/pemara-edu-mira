import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {animationCases} from './fixtures/animation-cases';
import {createLearningPlan,learningDiagram,isLearningScene,LEARNING_CSS} from '../src/engine/learningVisual';
import {BIOLOGY_CSS,biologySvg,BIOLOGY_STEPS} from '../src/engine/biologyModel';
import {launchHeadlessChrome} from './helpers/cdpBrowser';

test('Todos os desenhos: SVG válido, textos sem colisões e invariantes visuais científicos',async()=>{
 const frames:{id:string;svg:string}[]=[];
 for(const c of animationCases){const s=c.spec.scenes[0];
  if(isLearningScene(s)){const p=createLearningPlan(s,c.spec.lesson);for(let v=0;v<Math.max(1,p.variants.length);v++)frames.push({id:c.id+'-'+v,svg:learningDiagram(p,0,v)});}
  else if(s.type==='biology_model')for(let v=0;v<BIOLOGY_STEPS[s.params.model].length;v++)frames.push({id:c.id+'-'+v,svg:biologySvg(s.params.model,v,s.params.cell_type==='plant')});
 }
 const html=`<!doctype html><meta charset="utf-8"><style>${LEARNING_CSS}${BIOLOGY_CSS}.frame{width:620px;padding:0!important}.frame>svg{display:block;width:620px;height:auto}</style>`+frames.map(f=>`<section id="${f.id}" class="frame learning-canvas" data-running="false">${f.svg}</section>`).join('');
 const server=http.createServer((_,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const browser=await launchHeadlessChrome(9596);const errors:string[]=[];
 browser.ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry.text);});
 try{
  await browser.send('Log.enable');await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await browser.navigate(`http://127.0.0.1:${(server.address() as any).port}`);
  const issues=await browser.evaluate(`Array.from(document.querySelectorAll('.frame')).flatMap(f=>{const svg=f.querySelector('svg'),v=svg.getBoundingClientRect(),texts=Array.from(svg.querySelectorAll('text'));const out=[];for(let i=0;i<texts.length;i++){const a=texts[i].getBoundingClientRect();if(a.left<v.left-1||a.right>v.right+1||a.top<v.top-1||a.bottom>v.bottom+1)out.push({id:f.id,type:'corte',text:texts[i].textContent});for(let j=i+1;j<texts.length;j++){const b=texts[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)out.push({id:f.id,type:'textos sobrepostos',text:[texts[i].textContent,texts[j].textContent]});}}for(const p of svg.querySelectorAll('path')){const b=p.getBBox(),vb=svg.viewBox.baseVal;if(b.width>vb.width*2||b.height>vb.height*2)out.push({id:f.id,type:'caminho fora de escala',d:p.getAttribute('d')});}return out;})`);
  assert.deepEqual(errors,[],'O navegador não pode rejeitar caminhos SVG');
  assert.deepEqual(issues,[],'Textos precisam caber sem sobreposição');
  const ages=await browser.evaluate(`Array.from(document.querySelectorAll('#atlas-population_pyramid-0 [data-age-band]')).map(g=>({age:Number(g.dataset.ageBand),y:Number(g.querySelector('rect').getAttribute('y'))}))`);
  for(let i=1;i<ages.length;i++)assert.ok(ages[i].age>ages[i-1].age&&ages[i].y<ages[i-1].y,'Idades crescem da base para o topo');
  const riverGap=await browser.evaluate(`(()=>{const paths=Array.from(document.querySelectorAll('#atlas-watershed-0 path.learning-trace'));const main=paths[0],branch=paths[1],end=branch.getPointAtLength(branch.getTotalLength());let min=Infinity;for(let l=0;l<main.getTotalLength();l+=.5){const p=main.getPointAtLength(l);min=Math.min(min,Math.hypot(p.x-end.x,p.y-end.y));}return min;})()`);
  assert.ok(riverGap<2,'O afluente deve tocar o rio principal');
  const white=await browser.evaluate(`(async()=>{const svg=document.querySelector('#base-colors-3 svg').outerHTML;const img=new Image();const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail;img.src=url});const canvas=document.createElement('canvas');canvas.width=620;canvas.height=380;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,620,380);return Array.from(ctx.getImageData(310,180,1,1).data);}finally{URL.revokeObjectURL(url)}})()`);
  assert.deepEqual(white,[255,255,255,255],'Sobreposição RGB deve produzir branco, não uma cor aproximada');
  const beats=await browser.evaluate(`(()=>{const root=document.querySelector('#atlas-rhythm-3');const nodes=Array.from(root.querySelectorAll('.atlas-subbeat'));return Array.from({length:8},(_,i)=>{for(const el of nodes)for(const a of el.getAnimations()){a.pause();a.currentTime=i*500+100;}return nodes.map((e,j)=>getComputedStyle(e).fill==='rgb(251, 191, 36)'?j:-1).filter(j=>j>=0);});})()`);
  assert.deepEqual(beats,Array.from({length:8},(_,i)=>[i]),'Subdivisões acendem uma por vez, na ordem do compasso');
 }finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
});
