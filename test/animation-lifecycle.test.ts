import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {animationCases} from './fixtures/animation-cases';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import {launchHeadlessChrome} from './helpers/cdpBrowser';
const wait=(ms=200)=>new Promise(r=>setTimeout(r,ms));
test('Exportação: preferência inicial, cliques rápidos, reinício e descarte dos motores ao trocar de página',async()=>{
 const spec=structuredClone(animationCases[0].spec);
 spec.scenes=['solar','projectile','biology-animal','function-sine','title'].map(id=>animationCases.find(c=>c.id===id)!.spec.scenes[0]);
 const html=generateStandaloneHtml(spec),server=http.createServer((_,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const browser=await launchHeadlessChrome(9592);
 try{
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await browser.navigate(`http://127.0.0.1:${(server.address() as any).port}`);
  assert.equal(await browser.evaluate(`document.querySelector('#btn-solar-pause').textContent`),'Retomar');
  await wait();assert.equal(await browser.evaluate('window.solarElapsedDays'),0);
  await browser.evaluate(`document.querySelector('#btn-solar-pause').click()`);await wait();assert.ok(await browser.evaluate('window.solarElapsedDays')>0);
  await browser.evaluate(`window.resetSolarTime()`);await wait();assert.equal(await browser.evaluate('window.solarElapsedDays'),0);
  await browser.evaluate(`document.querySelector('#btn-solar-pause').click();document.querySelector('#btn-next').click()`);
  const frozen=await browser.evaluate('window.solarElapsedDays');await wait();assert.equal(await browser.evaluate('window.solarElapsedDays'),frozen);
  await browser.evaluate(`for(let i=0;i<11;i++)document.querySelector('#proj-btn-play').click()`);
  await wait(300);const time=await browser.evaluate('window.projectileSim.t');assert.ok(time>.1&&time<.6,'Não duplica loops ao clicar rapidamente');
  await browser.evaluate(`window.resetProjectile()`);await wait();assert.equal(await browser.evaluate('window.projectileSim.t'),0);
  await browser.evaluate(`document.querySelector('#proj-btn-play').click();document.querySelector('#btn-next').click()`);
  const projectileTime=await browser.evaluate('window.projectileSim.t');await wait();assert.equal(await browser.evaluate('window.projectileSim.t'),projectileTime);
  assert.equal(await browser.evaluate(`document.querySelector('.bio-model').dataset.bioRunning`),'false');
  await browser.evaluate(`document.querySelector('[data-action=play]').click()`);
  const first=await browser.evaluate(`document.querySelector('.bio-body').getAnimations({subtree:true})[0].currentTime`);await wait();assert.ok(await browser.evaluate(`document.querySelector('.bio-body').getAnimations({subtree:true})[0].currentTime`)>first);
  // Exhaust the four biology reading steps before entering the next scene.
  await browser.evaluate(`for(let i=0;i<4;i++)document.querySelector('#btn-next').click()`);
  assert.ok(await browser.evaluate(`document.querySelector('[data-math-curve]')!==null`));
  await browser.evaluate(`document.querySelector('[data-math-play]').click()`);await wait();
  await browser.evaluate(`document.querySelector('#btn-next').click()`);
  assert.equal(await browser.evaluate(`document.getAnimations().filter(a=>a.playState==='running').length`),0);
 }finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
});
