import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {animationCases} from './fixtures/animation-cases';
import {createLearningPlan,learningDiagram,LEARNING_CSS} from '../src/engine/learningVisual';
import {launchHeadlessChrome} from './helpers/cdpBrowser';

test('Movimento real: área iluminada, deslocamento das placas e articulações',async()=>{
 const ids=['atlas-moon_phases','atlas-tectonics','base-movement'];
 const frames=ids.flatMap(id=>{const c=animationCases.find(c=>c.id===id)!;const p=createLearningPlan(c.spec.scenes[0] as any,c.spec.lesson);return p.variants.map((_,v)=>`<section id="${id}-${v}" class="learning-canvas" data-running="false">${learningDiagram(p,0,v)}</section>`);});
 const server=http.createServer((_,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(`<meta charset="utf-8"><style>${LEARNING_CSS}.learning-canvas{width:620px}</style>${frames.join('')}`);});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const b=await launchHeadlessChrome(9598);
 try{
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await b.navigate(`http://127.0.0.1:${(server.address() as any).port}`);
  const moon=await b.evaluate(`(async()=>{
   const result=[];
   for(let v=0;v<4;v++){const root=document.querySelector('#atlas-moon_phases-'+v);const samples=[];
    for(const time of [0,3000,6000,9000,12000,18000,24000]){
     root.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=time});
     const svg=root.querySelector('svg'),clone=svg.cloneNode(true),src=[svg,...svg.querySelectorAll('*')],dst=[clone,...clone.querySelectorAll('*')];
     src.forEach((el,i)=>{const c=getComputedStyle(el);dst[i].setAttribute('style','animation:none;transform:'+c.transform+';transform-origin:'+c.transformOrigin+';transform-box:'+c.transformBox+';opacity:'+c.opacity)});
     clone.setAttribute('width','620');clone.setAttribute('height','380');const img=new Image();const url=URL.createObjectURL(new Blob([clone.outerHTML],{type:'image/svg+xml'}));
     await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail;img.src=url});const canvas=document.createElement('canvas');canvas.width=620;canvas.height=380;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);URL.revokeObjectURL(url);
     const data=ctx.getImageData(200,74,220,220).data;let lit=0,total=0;for(let y=0;y<220;y++)for(let x=0;x<220;x++){if(Math.hypot(x-110,y-110)>108)continue;total++;const k=(y*220+x)*4;if(data[k]>230&&data[k+1]>220&&data[k+2]>150)lit++;}samples.push(lit/total);
    }result.push(samples);
   }return result;
  })()`);
  for(let v=0;v<4;v++){
   assert.ok(Math.abs(moon[v][0]-[0,.5,1,.5][v])<.03,`Fase inicial ${v}: ${moon[v]}`);
   assert.ok(Math.abs(moon[v][0]-moon[v][1])>.1,'O terminador deve alterar a área iluminada entre quartos');
   assert.ok(Math.abs(moon[v][0]-moon[v][6])<.01,'O ciclo deve fechar sem salto de iluminação');
  }
  assert.ok(moon[0][0]<moon[0][1]&&moon[0][1]<moon[0][2]&&moon[0][2]<moon[0][3]&&moon[0][3]<moon[0][4],'Lua cresce continuamente da nova à cheia');
  const plates=await b.evaluate(`[0,1,2].map(v=>{const root=document.querySelector('#atlas-tectonics-'+v);return [0,7200].map(t=>{root.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t});return Array.from(root.querySelectorAll('[data-plate]')).map(e=>{const m=e.getCTM();return [m.e,m.f]});});})`);
  assert.ok(plates[0][1][0][0]>plates[0][0][0][0]&&plates[0][1][0][1]>plates[0][0][0][1],'Placa oceânica avança e mergulha');
  assert.ok(plates[0][1][1][0]<plates[0][0][1][0],'Outra placa converge');
  assert.ok(plates[1][1][0][0]<plates[1][0][0][0]&&plates[1][1][1][0]>plates[1][0][1][0],'Divergência afasta os corpos das placas');
  assert.ok(plates[2][1][0][1]<plates[2][0][0][1]&&plates[2][1][1][1]>plates[2][0][1][1],'Transformante desloca corpos em sentidos opostos');
  const body=await b.evaluate(`[0,1,2].map(v=>{const root=document.querySelector('#base-movement-'+v);return [0,v===1?1200:2500].map(t=>{root.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t});return Array.from(root.querySelectorAll('[data-joint]')).map(e=>{const m=e.getCTM();return {joint:e.dataset.joint,a:m.a,b:m.b,x:m.e,y:m.f};});});})`);
  const joint=(v:number,t:number,name:string)=>body[v][t].find((p:any)=>p.joint===name);
  assert.ok(joint(0,1,'shoulder--1').b>0&&joint(0,1,'shoulder-1').b<0,'Braços elevam para fora do tronco');
  for(const t of [0,1])for(const side of [-1,1])assert.ok(joint(1,t,'shoulder-'+side).b*joint(1,t,'hip-'+side).b<0,'Na caminhada, braço e perna do mesmo lado se opõem');
  for(let v=0;v<3;v++){
   const changed=body[v][0].filter((p:any,i:number)=>Math.abs(p.a-body[v][1][i].a)+Math.abs(p.b-body[v][1][i].b)>.1);
   assert.ok(changed.length>=4,`Variante corporal ${v}: várias articulações devem girar`);
   const elbow=body[v][0].findIndex((p:any)=>p.joint==='elbow-1');assert.ok(Math.hypot(body[v][0][elbow].x-body[v][1][elbow].x,body[v][0][elbow].y-body[v][1][elbow].y)>10,'O cotovelo acompanha geometricamente o ombro');
  }
 }finally{await b.close();await new Promise<void>(r=>server.close(()=>r()));}
});
