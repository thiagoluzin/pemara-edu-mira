import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launchHeadlessChrome} from '../test/helpers/cdpBrowser';

const files=process.argv.slice(2);assert.equal(files.length,2,'Informe os dois HTMLs baixados pela interface');
const out='docs/evidencias/movimento-real-20261017';
const b=await launchHeadlessChrome(9599),results:any[]=[],errors:string[]=[],requests:string[]=[];
const wait=(ms=350)=>new Promise(r=>setTimeout(r,ms));
b.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params));if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url))requests.push(m.params.request.url);});
try{
 await b.send('Network.enable');await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await b.setViewport(1366,768);
 for(const [fileIndex,file] of files.entries()){
  const absolute=path.resolve(file),html=fs.readFileSync(absolute,'utf8');assert.ok(html.includes('phenomenon-motion'));
  await b.navigate(pathToFileURL(absolute).href);
  const until=Date.now()+5000;while(!await b.evaluate(`!!document.querySelector('#btn-next')`)&&Date.now()<until)await wait();
  const kinds=fileIndex===0?['moon_phases','tectonics']:['movement'];
  for(const [index,kind] of kinds.entries()){
   await b.evaluate(`window.goToSlide(${index+1})`);
   assert.equal(await b.evaluate(`document.querySelector('#slide-content .learning-canvas').dataset.learningKind`),kind);
   const count=await b.evaluate(`document.querySelectorAll('#slide-content .learning-variants button').length`);
   for(let variant=0;variant<count;variant++){
    await b.evaluate(`document.querySelectorAll('#slide-content .learning-variants button')[${variant}].click()`);
    const snapshot=()=>b.evaluate(`Array.from(document.querySelectorAll('#slide-content .phenomenon-motion')).map(e=>{const s=getComputedStyle(e),m=e.getCTM();return [s.opacity,s.transform,m.a,m.b,m.e,m.f];})`);
    const initial=await snapshot();await wait();assert.deepEqual(await snapshot(),initial,'Movimento reduzido deve aguardar Reproduzir');
    await b.evaluate(`document.querySelector('#slide-content [data-action=play]').click()`);await wait(1250);
    const moving=await snapshot();assert.notDeepEqual(moving,initial,`${kind}/${variant}: o desenho deve mudar`);
    await b.evaluate(`document.querySelector('#slide-content [data-action=play]').click()`);await wait();const paused=await snapshot();await wait();assert.deepEqual(await snapshot(),paused,'Pausar deve congelar geometria');
    await b.screenshot(path.join(out,`html-${kind}-${variant}.png`));
    await b.evaluate(`document.querySelector('#slide-content [data-action=play]').click()`);await wait();assert.notDeepEqual(await snapshot(),paused,'Retomar deve mover');
    await b.evaluate(`document.querySelector('#slide-content [data-action=reset]').click()`);
    assert.equal(await b.evaluate(`document.querySelector('#slide-content .learning-canvas').dataset.running`),'false');
    results.push({file:path.basename(file),kind,variant,reduced:true,play:true,pause:true,resume:true,reset:true});
   }
  }
  const pages=fileIndex===0?3:2;
  for(let page=0;page<pages;page++){
   await b.evaluate(`window.goToSlide(${page});if(document.querySelector('#btn-notes-toggle').getAttribute('aria-expanded')!=='true')document.querySelector('#btn-notes-toggle').click()`);
   assert.ok((await b.evaluate(`document.querySelector('#teacher-notes-text').textContent`)).length>30,'Notas da página presentes');
   assert.equal(await b.evaluate(`getComputedStyle(document.querySelector('#teacher-notes-container')).display!=='none'`),true);
  }
  await b.evaluate(`document.querySelector('[aria-label="Fechar notas do professor"]').click();window.goToSlide(0)`);
  let steps=0;while(!await b.evaluate(`document.querySelector('#btn-next').disabled`)){await b.evaluate(`document.querySelector('#btn-next').click()`);assert.ok(++steps<40);}
  assert.ok((await b.evaluate(`document.querySelector('#slide-num').textContent`)).includes(`Página ${pages} de ${pages}`));
  for(let i=0;i<steps;i++)await b.evaluate(`document.querySelector('#btn-prev').click()`);
  assert.equal(await b.evaluate(`document.querySelector('#btn-prev').disabled`),true);
  results.push({file:path.basename(file),sha256:createHash('sha256').update(html).digest('hex'),pages,forwardAndBack:steps,notes:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'HTML deve funcionar sem pedidos HTTP');
 fs.writeFileSync(path.join(out,'htmls-reais-resultados.json'),JSON.stringify({offline:true,results,errors,requests},null,2));console.log(JSON.stringify({variants:results.filter(r=>r.kind).length,files:files.length,offline:true,errors,requests}));
}finally{await b.close();}
