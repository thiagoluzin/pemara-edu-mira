import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron}=require('playwright');
const out=path.resolve('build/openchamber/catalog-fix-20261019');
const report={passed:false,runs:[]};let app,brief;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<240;i++){const result=await fn();if(result)return result;await delay(250);}throw Error('Janela indisponível');}
try {
 for(let run=0;run<2;run++){
  app=await _electron.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Programs/PEMARA OpenChamber/PEMARA EDU.exe'),timeout:90000});
  const nav=await until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')));
  await nav.getByRole('button',{name:'Criar aula',exact:true}).click();
  const edu=await until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\/create/.test(p.url())));
  const button=edu.getByRole('button',{name:'Criar aula com IA',exact:true});await button.waitFor({timeout:60000});await until(()=>button.isEnabled());
  const saved=await edu.evaluate(()=>localStorage.getItem('pemara-opencode-brief'));
  if(!run){brief=saved;fs.writeFileSync(path.join(out,'brief-preserved.json'),saved||'null');}else assert.equal(saved,brief);
  const response=await edu.evaluate(()=>fetch('/api/ai/providers').then(r=>r.json()));assert.ok(response.model.startsWith('opencode/'));
  if(process.argv.includes('--generate') && run===0){
   const created=await edu.evaluate(async()=>{const r=await fetch('/api/ai/opencode/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),topic:'Teste de recuperação do catálogo: evaporação no 6º ano. Crie uma aula de 20 minutos com explicação de vapor invisível, atividade segura, quiz com feedback, síntese e uma cena atlas_model separation na variante Evaporação. Não afirmar que evaporação exige fervura.',subject:'science',grade:'6EF',duration_minutes:20,material_text:'',materials:[]})});return {status:r.status,body:await r.json()};});
   assert.ok(created.status<300,JSON.stringify(created.body));let job;
   for(let i=0;i<150;i++){job=await edu.evaluate(id=>fetch('/api/ai/opencode/jobs/'+id).then(r=>r.json()),created.body.id);if(job.status!=='running')break;if(i%12===0)console.log(JSON.stringify({status:job.status,model:job.model}));await delay(5000);}
   report.generation={id:job.id,status:job.status,model:job.model,lessonId:job.lessonId};assert.equal(job.status,'completed',job.message);
   const saved=await edu.evaluate(id=>fetch('/api/lessons/'+id).then(r=>r.json()),job.lessonId);assert.ok(saved.currentSpec.scenes.some(s=>s.atlas_model==='separation'));
   report.generation.scenes=saved.currentSpec.scenes.length;fs.writeFileSync(path.join(out,'generated-test-lesson.json'),JSON.stringify(saved,null,2));
   assert.equal(await edu.evaluate(()=>localStorage.getItem('pemara-opencode-brief')),brief);
  }
  assert.equal(await edu.getByRole('button',{name:'Verificar novamente',exact:true}).count(),0);
  await edu.screenshot({path:path.join(out,'catalog-restored-'+run+'.png')});report.runs.push({model:response.model,createButtonEnabled:true,briefPreserved:true});
  const closed=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;app=null;
 }
 const db=new DatabaseSync(path.join(process.env.LOCALAPPDATA,'PEMARAOpenChamber/perfil/.local/share/opencode/opencode.db'),{readOnly:true});
 assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(r=>r.integrity_check),['ok']);
 for(const table of ['session_v2','session_message']){const original=JSON.parse(fs.readFileSync(path.join(out,table+'-before.json'),'utf8'));for(const row of original)assert.equal(JSON.stringify(db.prepare('SELECT * FROM '+table+' WHERE id=?').get(row.id)),JSON.stringify(row));}
 db.close();report.databaseIntegrity=true;report.conversationsUnchanged=true;report.passed=true;
}catch(error){report.error=String(error);process.exitCode=1;}
finally{if(app)await app.close();fs.writeFileSync(path.join(out,'recovery-test.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
