import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {animationCases} from './fixtures/animation-cases';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import {launchHeadlessChrome} from './helpers/cdpBrowser';
const wait=(ms=80)=>new Promise(r=>setTimeout(r,ms));
test('Órbitas e lançamento: controles alteram a cena, exportação mantém os oito planetas e parâmetros novos reiniciam o experimento',async()=>{
 const solar=animationCases.find(c=>c.id==='solar')!,html=generateStandaloneHtml(solar.spec);
 const vite=await createServer({server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'offline-controls',configureServer(s){s.middlewares.use('/controls.html',(_,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});}}]});
 await vite.listen();const port=(vite.httpServer!.address() as any).port,browser=await launchHeadlessChrome(9597);
 const ready=async(selector:string)=>{for(let i=0;i<150;i++){if(await browser.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`))return;await wait(100);}throw Error('Cena não carregada: '+selector);};
 try{
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await browser.navigate(`http://127.0.0.1:${port}/test/fixtures/animation-audit.html?case=${animationCases.indexOf(solar)}`);await ready('[data-planet]');
  assert.equal(await browser.evaluate("document.querySelectorAll('[data-planet] text').length"),8);
  for(const [id,selector] of [['labels','[data-planet] text'],['orbits','.orbit-path']]){
   await browser.evaluate(`document.querySelector('#orbit-toggle-${id}').click()`);await wait();assert.equal(await browser.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`),0);
   await browser.evaluate(`document.querySelector('#orbit-toggle-${id}').click()`);await wait();assert.equal(await browser.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`),8);
  }
  const minimal={...solar.spec.scenes[0],params:{central_body:'Sun',focused_planet:'Mars',speed_multiplier:2}};
  await browser.evaluate(`window.dispatchEvent(new CustomEvent('audit:scene',{detail:${JSON.stringify(minimal)}}))`);await wait();
  assert.equal(await browser.evaluate("document.querySelectorAll('[data-planet] text').length"),8,'Rótulos também aparecem com opção omitida');
  assert.ok(await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='2x').className.includes('bg-amber-500')"),'Velocidade acompanha parâmetros recebidos');
  await browser.navigate(`http://127.0.0.1:${port}/controls.html`);await ready('#solar-svg');
  for(let i=0;i<8;i++){await browser.evaluate(`document.querySelector('#solar-pill-${i}').click()`);assert.equal(await browser.evaluate("document.querySelector('#solar-name').textContent"),Object.values((await import('../src/engine/astronomyEngine')).PLANETS_DATA)[i].name);}
  for(const [id,selector] of [['labels','[id^="solar-label-"]'],['orbits','#solar-svg .orbit-path'],['cards','#solar-card']]){
   await browser.evaluate(`document.querySelector('#solar-toggle-${id}').click()`);assert.equal(await browser.evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).filter(e=>getComputedStyle(e).display!=='none').length`),0);
   await browser.evaluate(`document.querySelector('#solar-toggle-${id}').click()`);assert.equal(await browser.evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).filter(e=>getComputedStyle(e).display!=='none').length`),id==='cards'?1:8);
  }
  for(const speed of [.5,1,2,5]){await browser.evaluate(`document.querySelector('[data-solar-speed="${speed}"]').click()`);assert.equal(await browser.evaluate('window.solarSpeedMultiplier'),speed);}
  const projectile=animationCases.findIndex(c=>c.id==='projectile');await browser.navigate(`http://127.0.0.1:${port}/test/fixtures/animation-audit.html?case=${projectile}`);await ready('[aria-label="Velocidade inicial"]');
  const setInput=async(label:string,value:string)=>{await browser.evaluate(`(()=>{const e=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait();};
  await setInput('Tempo do lançamento','1');assert.ok(Number(await browser.evaluate("document.querySelector('[aria-label=\"Tempo do lançamento\"]').value"))>.9);
  await setInput('Velocidade inicial','5');assert.equal(Number(await browser.evaluate("document.querySelector('[aria-label=\"Tempo do lançamento\"]').value")),0,'Novo parâmetro reinicia o experimento');
  assert.doesNotMatch(await browser.evaluate("document.querySelector('[data-audit-ready]').innerHTML"),/NaN|Infinity/);
 }finally{await browser.close();await vite.close();}
});
