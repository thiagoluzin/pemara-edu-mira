import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron}=require('playwright');
const out='build/openchamber/2.4.0-pemara.5/evidencias';
const app=await _electron.launch({executablePath:path.resolve('build/openchamber/2.4.0-pemara.5/dist/win-unpacked/PEMARA EDU.exe'),timeout:90000});
let nav,edu;
for(let i=0;i<120&&!nav;i++){nav=app.context().pages().find(p=>p.url().endsWith('/education-nav.html'));if(!nav)await new Promise(r=>setTimeout(r,500));}
await nav.getByRole('button',{name:'Criar aula',exact:true}).click();
for(let i=0;i<120&&!edu;i++){edu=app.context().pages().find(p=>/127.0.0.1:\d+\/create$/.test(p.url()));if(!edu)await new Promise(r=>setTimeout(r,500));}
const report={started:new Date().toISOString(),passed:false};
try{
await edu.getByRole('button',{name:'Criar aula com IA',exact:true}).waitFor({timeout:120000});
assert.equal(await edu.getByRole('button',{name:'Gerar sem IA',exact:true}).count(),0);
await edu.getByLabel('Tema e orientações para a IA',{exact:true}).fill('Evaporação e condensação: por que a roupa seca sem ferver? Use o Atlas de separação de misturas para explorar evaporação, com previsão, temperatura e vento, explicando os limites do modelo.');
await edu.getByLabel('Duração (minutos)',{exact:true}).fill('30');
await edu.getByRole('button',{name:'Criar aula com IA',exact:true}).click();
await edu.screenshot({path:out+'/ia-gerando.png'});
await edu.waitForFunction(()=>document.body.innerText.includes('EXPORTAR')||document.body.innerText.includes('Retomar'),{},{timeout:510000});
const jobs=await edu.evaluate(()=>fetch('/api/ai/opencode/jobs').then(r=>r.json()));report.job=jobs.jobs[0];
assert.equal(report.job.status,'completed',report.job.message);
const result=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),report.job.lessonId);report.lesson={id:result.lesson.id,title:result.currentSpec.lesson.title,scenes:result.currentSpec.scenes.length,provenance:result.currentSpec.lesson.ai_provenance,atlas:result.currentSpec.scenes.filter(s=>s.atlas_model).map(s=>s.atlas_model)};
assert.equal(report.lesson.provenance.provider,'opencode');assert.ok(report.lesson.atlas.length);
await edu.screenshot({path:out+'/ia-aula-pronta.png'});report.passed=true;
}catch(e){report.error=String(e);await edu?.screenshot({path:out+'/ia-falha.png'}).catch(()=>{});}
fs.writeFileSync(out+'/ia-geracao-real.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
const closed=app.waitForEvent('close',{timeout:120000});
await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
await closed;
process.exitCode=report.passed?0:1;
