import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startEducation} from './education-service.mjs';
import {stage} from './release.mjs';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=path.resolve('evidencias/revisao-chat-20261021/ui-'+Date.now());fs.mkdirSync(out,{recursive:true});
let turn,fail=true;const calls=[];
const bridge={chatTurns:async()=>turn?[turn]:[],chatNotice:async()=>{},models:async()=>[{id:'opencode/test-free',name:'Resposta controlada'}],model:async()=> 'opencode/test-free',create:async({jobId})=>jobId,
  generate:async({sessionID})=>{calls.push(sessionID);if(fail&&sessionID.endsWith('review-assessment'))throw Error('Falha simulada de conexão.');return {model:'opencode/test-free',text:JSON.stringify(sessionID.startsWith('chat-classify-')?{is_lesson:true,subject:'math',grade:'6EF',title:'Frações no chat'}:{verdict:'attention',findings:[{scene_id:'chat',problem:'Verifique a equivalência apresentada no exemplo.',suggestion:'Mostre as duas frações sobre o mesmo inteiro dividido em partes iguais.'}]})};}};
const service=await startEducation({root:path.join(stage,'education'),dataDir:path.join(out,'data'),openCodeBridge:bridge});
let browser;const report={passed:false,controlledResponses:true,checks:{}};
try {
  const now=Date.now();turn={sessionID:'ses_ui',promptID:'msg_user',replyID:'msg_answer',directory:out,created:now,completed:now,title:'Frações no chat',request:'Crie uma aula de frações para o 6º ano.',context:'',answer:'Aula: frações equivalentes.',files:[]};
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  await page.goto(service.url+'/chat-reviews');
  await page.getByRole('heading',{name:'Revisões do chat',exact:true}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'Retomar revisão',exact:true}).waitFor({timeout:60000});
  assert.equal(await page.getByText(/Revisor de .* — /).count(),2);report.checks.partialReportsAndRetryVisible=true;
  fail=false;await page.getByRole('button',{name:'Retomar revisão',exact:true}).click();
  await page.getByText('Os cinco pareceres foram concluídos.',{exact:false}).waitFor({timeout:60000});
  assert.equal(await page.getByText(/Revisor de .* — /).count(),5);
  assert.equal(calls.filter(id=>id.endsWith('review-didactics')).length,1);
  await page.screenshot({path:path.join(out,'cinco-pareceres.png'),fullPage:true});
  await page.reload();await page.getByText('Os cinco pareceres foram concluídos.',{exact:false}).waitFor({timeout:60000});
  report.checks.fiveReportsSurviveReload=true;report.checks.onlyPendingReviewersRetried=true;
  report.calls=calls.length;report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally {if(browser)await browser.close();await service.stop();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,...report},null,2));}
