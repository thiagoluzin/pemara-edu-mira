import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=path.resolve(process.argv[2]||'evidencias/native-exports-20261019');
const report=JSON.parse(fs.readFileSync(path.join(out,'installed-exports.json')));
assert.equal(report.passed,true);
const spec=JSON.parse(fs.readFileSync(path.join(out,'export-spec.json')));
const html=report.exports.find(e=>e.format==='html');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 const context=await browser.newContext({offline:true});const page=await context.newPage();
 await page.goto(pathToFileURL(html.path).href);await page.locator('#btn-next').waitFor();
 const ai=spec.scenes.findIndex(s=>s.atlas_model&&s.atlas_model!=='none');assert.ok(ai>=0);
 await page.evaluate(index=>window.goToSlide(index),ai);await page.locator('.atlas-lab').waitFor();
 const play=page.getByRole('button',{name:/^(Reproduzir animação|Pausar animação)$/});if((await play.innerText()).includes('Reproduzir'))await play.click();
 const sample=()=>page.locator('.atlas-lab').evaluate(e=>[...e.querySelectorAll('svg path,svg circle')].map(n=>[n.getAttribute('d'),n.getAttribute('cx'),n.getAttribute('cy'),n.getCTM()?.e,n.getCTM()?.f]));
 const moving=await sample();await delay(1000);assert.notDeepEqual(await sample(),moving);await play.click();await delay(200);const paused=await sample();await delay(400);assert.deepEqual(await sample(),paused);
 await page.screenshot({path:path.join(out,'html-offline.png')});
 const qi=spec.scenes.findIndex(s=>s.type==='quiz'),quiz=spec.scenes[qi];assert.ok(qi>=0);await page.evaluate(index=>window.goToSlide(index),qi);await page.locator('#quiz-opt-'+quiz.correct_index).click();await page.locator('#quiz-feedback').filter({hasText:/Corret|Parabéns/}).waitFor();
 const result={passed:true,offline:true,animationAndPause:true,quiz:true,path:html.path};fs.writeFileSync(path.join(out,'html-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
