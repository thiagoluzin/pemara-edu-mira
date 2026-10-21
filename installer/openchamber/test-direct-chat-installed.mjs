import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {version} from './release.mjs';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron}=require('playwright');
const out=path.resolve('evidencias/revisao-chat-20261021');
const executablePath=path.join(process.env.LOCALAPPDATA,'Programs/PEMARA OpenChamber/PEMARA EDU.exe');
const report={passed:false,checks:{},generation:'No lessons or cloud prompts generated in owner profile.'};let app;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<240;n++){const v=await fn();if(v)return v;await pause(500);}throw Error(label);}
try {
  app=await _electron.launch({executablePath,timeout:90000});
  assert.equal(await app.evaluate(({app})=>app.getVersion()),version);
  const nav=await until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')),'Navigation unavailable');
  await nav.getByRole('button',{name:'Revisões do chat',exact:true}).waitFor();
  // Service must become ready before any education navigation is clicked.
  await until(async()=>/Revisão automática de aulas do chat ativa/.test(await nav.locator('#status').innerText()),'Automatic observer did not start from chat');
  report.checks.observerStartsWithoutCreateLesson=true;
  await nav.getByRole('button',{name:'Revisões do chat',exact:true}).click();
  const edu=await until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\//.test(p.url())),'Education unavailable');
  await edu.getByRole('heading',{name:'Revisões do chat',exact:true}).waitFor({timeout:60000});
  const status=await edu.evaluate(()=>fetch('/api/ai/opencode/chat-reviews').then(r=>r.json()));
  assert.equal(status.enabled,true);assert.equal(status.error,'');assert.equal(status.jobs.length,0);
  assert.equal(await edu.getByText('Aula sem inteligência artificial',{exact:true}).count(),0);
  report.checks.pastConversationsNotReviewed=true;report.checks.installedReviewScreen=true;
  await edu.screenshot({path:path.join(out,'installed-reviews.png')});
  const closed=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;app=null;
  const shutdown=JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA,'PEMARAOpenChamber/aulas/last-shutdown.json'),'utf8'));
  assert.equal(shutdown.backupSaved,true);report.checks.gracefulShutdownBackup=true;report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally {if(app)await app.close().catch(()=>{});report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'installed.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
