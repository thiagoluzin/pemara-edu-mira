import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root = 'G:/PEMARA_EDU/build/openchamber/2.4.0-pemara.1'; const demo = (process.env.LOCALAPPDATA + '/Programs/PEMARA OpenChamber/resources/pemara').replaceAll('\\', '/');
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1280,height:900}});
await context.addInitScript(()=>{
  const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
  const pending=new Set();let calls=0,max=0;
  window.requestAnimationFrame=fn=>{let id=request(t=>{pending.delete(id);calls++;fn(t);});pending.add(id);max=Math.max(max,pending.size);return id;};
  window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id);};
  window.__rafAudit=()=>({pending:pending.size,calls,max});
});
const page=await context.newPage(),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',request=>{if(/^https?:/.test(request.url()))external.push(request.url());});
const report={startedAt:new Date().toISOString(),offline:true,checks:{},passed:false};
const canvas=()=>page.locator('#sim').evaluate(c=>c.toDataURL());
try {
  await page.goto(pathToFileURL(demo+'/exemplo/aula.html').href);
  assert.equal(await page.locator('.slide').count(),6);
  let total=0;
  for(let index=0;index<6;index++) {
    assert.equal(await page.locator('#contador').textContent(),`Etapa ${index+1} de 6`);
    const slide=page.locator('.slide.ativo');
    await slide.locator('.notas-btn').click();
    assert.equal(await slide.locator('.notas-btn').getAttribute('aria-expanded'),'true');
    assert.ok(await slide.locator('.notas').isVisible());
    total+=Number((await slide.locator('.notas').textContent()).match(/(\d+)\s*min/)?.[1]);
    await slide.locator('.notas-btn').click();
    assert.ok(!await slide.locator('.notas').isVisible());
    if(index<5)await page.locator('#next').click();
  }
  assert.equal(total,50);
  report.checks.sixSlidesAndAllTeacherNotes=true;report.lessonMinutes=total;
  assert.ok(await page.locator('#next').isDisabled());
  for(const question of await page.locator('.q').all()) {
    await question.locator('button:not([data-ok])').first().click();
    assert.ok(await question.locator('.fb.errado').isVisible());
    await question.locator('button[data-ok="1"]').click();
    assert.ok(await question.locator('.fb.certo').isVisible());
  }
  report.checks.quizFeedback=true;
  for(let i=0;i<5;i++)await page.locator('#prev').click();
  await page.locator('#next').click();
  assert.match(await page.locator('.slide.ativo h2').textContent(),/experiência/i);
  report.checks.experimentStartsEarly=true;
  await page.locator('#next').click();
  assert.ok(await page.locator('#sim').isVisible());
  const a=await canvas();await page.waitForTimeout(500);assert.notEqual(await canvas(),a);
  report.checks.actualMotion=true;
  await page.locator('#btnPausa').click();
  const paused=await canvas();await page.waitForTimeout(500);assert.equal(await canvas(),paused);
  report.checks.pauseStopsPixels=true;
  await page.locator('#btnReiniciar').click();
  assert.notEqual(await canvas(),paused);
  const reset=await canvas();await page.waitForTimeout(300);assert.equal(await canvas(),reset);
  report.checks.resetRespectsPause=true;
  await page.locator('#next').click();await page.locator('#prev').click();
  const returned=await canvas();await page.waitForTimeout(300);assert.equal(await canvas(),returned);
  report.checks.manualPauseSurvivesNavigation=true;
  await page.locator('#btnPausa').click();
  for(const id of ['tMor','vFor','tAmb','vFra']) {
    await page.locator('#'+id).click();assert.match(await page.locator('#'+id).getAttribute('class'),/\bon\b/);
  }
  report.checks.temperatureAndWindControls=true;
  for(let i=0;i<3;i++)await page.locator('#btnReiniciar').click();
  await page.waitForTimeout(300);
  assert.equal((await page.evaluate(()=>window.__rafAudit())).max,1);
  report.checks.singleAnimationLoop=true;
  await page.screenshot({path:root+'/evidencias/ia-aula-simulacao.png',fullPage:true});
  await page.locator('#next').click();
  const stopped=await page.evaluate(()=>window.__rafAudit());await page.waitForTimeout(400);
  assert.equal((await page.evaluate(()=>window.__rafAudit())).calls,stopped.calls);
  report.checks.hiddenSimulationStops=true;
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  report.checks.noScriptErrorsOrRemoteResources=true;
  await page.goto(pathToFileURL(demo+'/exemplo/atividade-aluno.html').href);
  assert.equal(await page.locator('.q').count(),5);
  assert.doesNotMatch(await page.locator('.orient').textContent(),/superfície/i);
  await page.pdf({path:root+'/evidencias/ia-atividade-impressao.pdf',format:'A4',printBackground:true});
  report.checks.fivePrintableQuestionsWithoutAnswerHint=true;
  report.passed=true;
} catch(error) {report.error=String(error);process.exitCode=1;}
finally {
  report.finishedAt=new Date().toISOString();report.errors=errors;report.externalRequests=external;
  await fs.writeFile(root+'/evidencias/ia-aula-testes.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));await browser.close();
}
