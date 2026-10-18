import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const out = path.resolve('build/openchamber/2.4.0-pemara.4/evidencias');
const source = JSON.parse(fs.readFileSync(path.join(out,'education-ui.json')));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = {passed:false,checks:{},files:source.exports};
try {
  const context = await browser.newContext({offline:true,viewport:{width:1366,height:900}});
  let page = await context.newPage();
  await page.goto(pathToFileURL(source.exports[1].file).href);
  await page.locator('#btn-next').click();await page.locator('.atlas-lab').waitFor();
  const play=page.getByRole('button',{name:/^(Reproduzir animação|Pausar animação)$/});
  if((await play.innerText()).includes('Reproduzir'))await play.click();
  const geometry=()=>page.locator('.atlas-lab').evaluate(el=>[...el.querySelectorAll('svg path,svg circle')].map(node=>{const m=node.getCTM();return [node.getAttribute('d'),node.getAttribute('cx'),node.getAttribute('cy'),m.a,m.d,m.e,m.f];}));
  const initial=await geometry();await page.waitForTimeout(800);assert.notDeepEqual(await geometry(),initial);
  await play.click();await page.waitForTimeout(100);const paused=await geometry();await page.waitForTimeout(350);assert.deepEqual(await geometry(),paused);
  await page.screenshot({path:path.join(out,'html-exportado-offline.png')});
  report.checks.motionAndPauseWithoutNetwork=true;
  await page.close();page=await context.newPage();
  for(const file of source.exports) {await page.goto(pathToFileURL(file.file).href);await page.locator('#btn-next').waitFor();}
  report.checks.bothExportsReopenWithoutNetwork=true;report.passed=true;
} catch(error) {report.error=error.stack;process.exitCode=1;} finally {await browser.close();fs.writeFileSync(path.join(out,'education-exports.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
