import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {launchHeadlessChrome} from '../test/helpers/cdpBrowser';import {ATLAS} from '../src/animations/atlas';
const out='docs/evidencias/atlas-interativo-completo-20261018',lessons=JSON.parse(fs.readFileSync(out+'/aulas.json','utf8')),b=await launchHeadlessChrome(9564),rows:any[]=[];
const wait=(ms=30)=>new Promise(r=>setTimeout(r,ms));
const seek=async(n:number)=>{await b.evaluate(`(()=>{const e=document.querySelector('[data-ex-time]');e.value=${n};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait();};
const pose=(ghost=false)=>b.evaluate(`Array.from(document.querySelector('.atlas-scene>${ghost?'svg.atlas-ghost':'svg'}').querySelectorAll('g,path,circle,ellipse,rect')).map(e=>{const m=e.getCTM();return [m.a,m.b,m.c,m.d,m.e,m.f].map(n=>Math.round(n*1000)/1000);})`);
try{await b.setViewport(1366,1000);await b.send('Network.enable');await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const l of lessons){await b.navigate(pathToFileURL(path.resolve(l.file)).href);
  for(const [i,kind] of l.kinds.entries()){if(['respiration','statistics'].includes(kind))continue;await b.evaluate(`goToSlide(${i+1})`);await wait();const count=kind==='movement'?3:ATLAS.find(p=>p.id===kind)!.variants.length;
   for(let v=0;v<count;v++){if(kind==='separation'&&v===3)continue;await b.evaluate(`document.querySelectorAll('.learning-variants button')[${v}].click()`);await wait();await seek(0);const start=await pose();await seek(60);await b.evaluate(`document.querySelector('[data-ex-compare]').click()`);await wait();const ghost=await pose(true);assert.equal(ghost.length,start.length);assert.ok(ghost.every((r:number[],i:number)=>r.every((n:number,j:number)=>Math.abs(n-start[i][j])<.02)),kind+'/'+v+' sobrepõe a posição inicial (tolerância de 0,02 px para serialização CSS)');await seek(30);assert.deepEqual(await pose(true),ghost,kind+'/'+v+' comparação permanece fixa');rows.push({kind,variant:v,initialMatches:true,staysFixed:true});}
  }
 }
 assert.equal(rows.length,88);fs.writeFileSync(out+'/comparacao-posicao-inicial.json',JSON.stringify({rows,passed:true},null,2));console.log('88 comparações conferidas nos HTMLs finais, sem rede.');
}finally{await b.close();}
