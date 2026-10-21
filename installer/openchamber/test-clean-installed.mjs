import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {stage,version} from './release.mjs';
import {OpenCode} from '../../pilotos/openchamber/source/node_modules/@opencode/client/dist/promise/index.js';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron}=require('playwright');
const out=path.join(stage,'evidencias');
const executablePath=path.join(process.env.LOCALAPPDATA,'Programs/PEMARA EDU Teste Limpo/PEMARA EDU Teste Limpo.exe');
const dataRoot=path.join(process.env.LOCALAPPDATA,'PEMARAEduTesteLimpo');
const documents=path.join(process.env.PEMARA_OWNER_DOCUMENTS||path.join(process.env.USERPROFILE,'Documents'),'PEMARA Aulas - Teste Limpo');
const report={passed:false,executablePath,checks:{},cycles:[],startedAt:new Date().toISOString(),generation:'Not requested; first-launch and empty-state validation only.'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,message){const end=Date.now()+150000;while(Date.now()<end){const result=await fn();if(result)return result;await delay(300);}throw Error(message);}
let app,educationOpened=false;
async function close(){if(!app)return;const closed=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;app=null;if(educationOpened)assert.equal(JSON.parse(fs.readFileSync(path.join(dataRoot,'aulas/last-shutdown.json'))).backupSaved,true);educationOpened=false;}
try{
 assert.ok(!fs.existsSync(dataRoot),'First-launch profile must not exist');
 assert.ok(!fs.existsSync(documents),'First-launch documents must not exist');
 for(let cycle=1;cycle<=2;cycle++){
  app=await _electron.launch({executablePath,timeout:90000});
  const identity=await app.evaluate(({app})=>({version:app.getVersion(),name:app.getName(),userData:app.getPath('userData')}));
  assert.equal(identity.version,version);assert.equal(identity.name,'PEMARA EDU Teste Limpo');
  assert.ok(identity.userData.startsWith(dataRoot),'Chromium must use clean profile');
  const nav=await until(()=>app.context().pages().find(p=>p.url().endsWith('/education-nav.html')),'Navigation unavailable');
  const chat=await until(()=>app.context().pages().find(p=>p.url().startsWith('openchamber-ui:')),'Chat unavailable');
  await chat.getByRole('button',{name:'Abrir menu do OpenChamber',exact:true}).waitFor({timeout:120000});
  const connection=await chat.evaluate(()=>({baseUrl:window.__OPENCHAMBER_API_BASE_URL__,headers:window.__OPENCHAMBER_RUNTIME_HEADERS__}));
  const client=OpenCode.make({...connection,headers:{...connection.headers,'x-opencode-directory':encodeURIComponent(path.join(documents,'Minhas aulas').replaceAll('\\','/'))}});
  assert.equal((await client.session.list({limit:100,order:'desc'})).data.length,0,'Chat list must be empty');
  const chatInputs=await chat.locator('.cm-content').evaluateAll(elements=>elements.map(element=>{const copy=element.cloneNode(true);copy.querySelectorAll('.cm-placeholder').forEach(node=>node.remove());return copy.textContent||'';}));
  assert.ok(chatInputs.every(text=>!text.trim()),'Chat drafts must be empty');
  await chat.waitForTimeout(1000); // Let first-paint transitions settle before evidence capture.
  await chat.screenshot({path:path.join(out,`installed-clean-${cycle}-chat.png`)});
  await nav.getByRole('button',{name:'Minhas aulas',exact:true}).click();
  const edu=await until(()=>app.context().pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\//.test(p.url())),'Education unavailable');
  await edu.getByRole('heading',{name:'Nenhuma aula encontrada',exact:true}).waitFor({timeout:150000});
  educationOpened=true;
  const state=await edu.evaluate(async()=>{
   async function get(url){const response=await fetch(url);if(!response.ok)throw Error(url+': '+response.status);return response.json();}
   return{lessons:await get('/api/lessons'),materials:await get('/api/materials'),jobs:await get('/api/ai/opencode/jobs')};
  });
  assert.equal(state.lessons.lessons.length,0);assert.equal(state.materials.materials.length,0);assert.equal(state.jobs.jobs.length,0);
  const localLessons=await edu.evaluate(()=>JSON.parse(localStorage.getItem('pemara_saved_lessons_v2')||'[]'));
  assert.deepEqual(localLessons,[],'Do not seed browser lessons while authentication is opening');
  await edu.waitForTimeout(1000);
  await edu.screenshot({path:path.join(out,`installed-clean-${cycle}-library.png`)});
  await nav.getByRole('button',{name:'Criar aula',exact:true}).click();
  await edu.getByLabel('Tema e orientações para a IA',{exact:true}).waitFor({timeout:60000});
  assert.equal(await edu.getByLabel('Tema e orientações para a IA',{exact:true}).inputValue(),'');
  assert.equal(await edu.getByLabel('Texto complementar',{exact:true}).inputValue(),'');
  await edu.getByText('Autor: Professor de Ciências',{exact:true}).waitFor();
  assert.equal(await edu.getByRole('checkbox',{name:/Solicitar revisão por agentes/}).isChecked(),false);
  await edu.waitForTimeout(1000);
  await edu.screenshot({path:path.join(out,`installed-clean-${cycle}-teachers.png`)});
  report.cycles.push({cycle,identity,lessons:0,materials:0,jobs:0,chats:0,briefEmpty:true,reviewersAvailable:true});
  await close();
  const backups=fs.readdirSync(path.join(dataRoot,'aulas/backups')).sort();
  const snapshot=JSON.parse(fs.readFileSync(path.join(dataRoot,'aulas/backups',backups.at(-1))));
  for(const table of ['lessons','lesson_revisions','lesson_drafts','teacher_materials','generation_attempts','import_batches','staging_nodes'])assert.equal(snapshot.table_counts[table],0,table+' must be empty');
  report.cycles.at(-1).databaseCounts=Object.fromEntries(['lessons','lesson_revisions','lesson_drafts','teacher_materials','generation_attempts','import_batches','staging_nodes'].map(key=>[key,snapshot.table_counts[key]]));
 }
 const database=path.join(dataRoot,'perfil/.local/share/opencode/opencode.db');
 const sqlite=new DatabaseSync(database,{readOnly:true});
 try{report.chatTables={};for(const table of ['session_v2','session_message','session_pending','session_inbox']){const row=sqlite.prepare(`SELECT count(*) AS count FROM "${table}"`).get();assert.equal(row.count,0,table+' must be empty');report.chatTables[table]=row.count;}}finally{sqlite.close();}
 assert.deepEqual(fs.readdirSync(path.join(documents,'Minhas aulas')),['LEIA-ME.txt']);
 report.checks={freshInstall:true,firstLaunchEmpty:true,reopenEmpty:true,teacherProfilesPresent:true,cleanShutdown:true,separateOwnerProfile:true};
 report.passed=true;
}catch(error){report.error=error.stack;if(app){for(const [index,page] of app.context().pages().entries())await page.screenshot({path:path.join(out,`clean-failure-${index}.png`)}).catch(()=>{});}}
finally{await close().catch(error=>{report.closeError=String(error);report.passed=false;});report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'installed-clean.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(!report.passed)process.exitCode=1;
