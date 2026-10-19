import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { _electron } = require('playwright');
const out = path.resolve('build/openchamber/navigation-fix-20261019');
const report = { passed: false, runs: [] };
const delay = ms => new Promise(r => setTimeout(r, ms));
let app;
async function until(fn) { for (let i=0;i<240;i++) { const result=await fn(); if(result)return result; await delay(500); } throw Error('Janela indisponível'); }
try {
 for(let run=0;run<2;run++) {
  app = await _electron.launch({ executablePath: path.join(process.env.LOCALAPPDATA,'Programs/PEMARA OpenChamber/PEMARA EDU.exe'), timeout:90000 });
  await app.evaluate(({dialog})=>{globalThis.dialogs=[];dialog.showMessageBox=async(...args)=>{globalThis.dialogs.push(args.at(-1));return {response:0};};});
  const nav = await until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')));
  const results = await nav.evaluate(async()=>Promise.allSettled(['library','library','atlas','create','library'].map(area=>window.pemaraNavigation.open(area))));
  const edu = await until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\/library/.test(p.url())));
  await edu.getByRole('heading',{name:'Como a roupa molhada seca? Evaporação e condensação',exact:true}).first().waitFor({timeout:120000});
  const lessons = await edu.evaluate(()=>fetch('/api/lessons').then(r=>r.json()));
  if(!process.argv.includes('--before')) {
   await nav.getByRole('button',{name:'Atlas de animações',exact:true}).click();
   await edu.waitForURL('**/atlas');
   await nav.getByRole('button',{name:'Criar aula',exact:true}).click();
   await edu.getByRole('button',{name:'Criar aula com IA',exact:true}).waitFor();
   await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();
   await edu.getByRole('heading',{name:'Como a roupa molhada seca? Evaporação e condensação',exact:true}).first().waitFor();
  }
  const dialogs = await app.evaluate(()=>globalThis.dialogs);
  report.runs.push({results,dialogs,lessonIds:lessons.lessons.map(l=>l.id).sort()});
  await edu.screenshot({path:path.join(out,`library-${process.argv.includes('--before')?'before':'after'}-${run}.png`)});
  const closed=app.waitForEvent('close',{timeout:120000});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;app=null;
  if(process.argv.includes('--before')) {
   assert.ok(dialogs.some(d=>d.detail?.includes('ERR_ABORTED (-3)')));
   assert.ok(results.some(r=>r.status==='rejected'));
   break;
  }
  assert.equal(dialogs.length,0);assert.ok(results.every(r=>r.status==='fulfilled'));
 }
 if(!process.argv.includes('--before'))assert.deepEqual(report.runs[0].lessonIds,report.runs[1].lessonIds);
 report.passed=true;
}catch(error){report.error=String(error);process.exitCode=1;}
finally { if(app)await app.close();fs.writeFileSync(path.join(out,process.argv.includes('--before')?'before.json':'after.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report)); }
