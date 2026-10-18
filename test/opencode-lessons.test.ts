import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import express from 'express';
import {createDisposablePostgres} from './helpers/realPostgresHarness';
import {runMigrations} from '../server/db/migrator';
import {UserRepository} from '../server/repositories/userRepository';
import {configureOpenCodeLessons,createOpenCodeLessonsRouter,stopOpenCodeLessons} from '../server/ai/openCodeJobs';
import {TEMPLATE_GREECE_6EF} from '../src/templates/deterministicTemplates';
import type {AddressInfo} from 'node:net';

test('OpenCode jobs preserve requests, retry one conversation, save once, and isolate owners',async()=>{
 const db=await createDisposablePostgres('pemara-opencode-'),pool=db.createPool();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-jobs-'));let server:ReturnType<ReturnType<typeof express>['listen']>|undefined;
 const sessions:string[]=[],prompts:string[]=[];let fail=true,hang=false;
 const raw=structuredClone(TEMPLATE_GREECE_6EF);raw.lesson.subject='science';raw.lesson.generation_mode='MODE_C_API';
 const visual=(layout:string)=>({layout,caption:'Esquema didático.',nodes:[{id:'a',label:'Água',icon:'water',explanation:'A água pode mudar de estado.'},{id:'b',label:'Vapor',icon:'energy',explanation:'Vapor de água é água no estado gasoso.'}]});
 const scenes=[{id:'s1',type:'title',title:'Evaporação'},...['flow','cards','comparison','flow','cards'].map((layout,i)=>({id:'s'+(i+2),type:'text',title:i===3?'Atividade: observar a roupa':'Observar a água '+i,visual:visual(layout),...(i===0?{atlas_model:'separation'}:{})})),{id:'q',type:'quiz',title:'Verifique',question:'Qual mudança ocorre?',answers:['Líquido para gás','Gás para sólido'],correct_index:0,explanation:'Na evaporação, água líquida passa ao estado gasoso.'},{id:'end',type:'summary',title:'Síntese',visual:visual('cards')}];
 (scenes[1] as any).atlas_model={id:'separation'};
 const response=JSON.stringify({...raw,scenes});
 let currentModel='';
 configureOpenCodeLessons({models:async()=>[{id:'test/refused',name:'Indisponível'},{id:'test/model',name:'Gratuito'}],model:async()=>'test/refused',create:async({id,jobId,model})=>{const sessionID=id||'ses_'+jobId;sessions.push(sessionID);currentModel=model;return sessionID;},generate:async({prompt},signal)=>{prompts.push(prompt);signal.throwIfAborted();if(hang)await new Promise<void>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));if(fail||currentModel==='test/refused')throw new Error('Conexão interrompida. Pedido guardado.');return{text:response,model:'test/model'};}},dir);
 try {
  await runMigrations(pool);const users=new UserRepository(pool);
  const owner=await users.create({username:'owner',name:'Professor',email:'owner@example.invalid',password_hash:'test',role:'teacher'});
  const other=await users.create({username:'other',name:'Outro',email:'other@example.invalid',password_hash:'test',role:'teacher'});
  const app=express();app.use(express.json());app.use((req,_res,next)=>{const id=req.headers['x-test-user'];if(id===owner.id)req.user=users.toSafeUser(owner);if(id===other.id)req.user=users.toSafeUser(other);next();});app.use('/jobs',createOpenCodeLessonsRouter(pool));
  server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));const url='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/jobs';
  const headers={'content-type':'application/json','x-test-user':owner.id};const input={requestId:randomUUID(),subject:'science',grade:'6EF',topic:'Evaporação e condensação. '+ 'Orientação detalhada para o professor. '.repeat(12),duration_minutes:30,material_text:'Roupa seca sem ferver.'};
  const send=(suffix:string,body:object)=>fetch(url+suffix,{method:'POST',headers,body:JSON.stringify(body)});
  const poll=async(status:string)=>{for(let i=0;i<100;i++){const job=await (await fetch(url+'/'+input.requestId,{headers})).json();if(job.status===status)return job;await new Promise(r=>setTimeout(r,40));}throw new Error('Job did not reach '+status);};
  assert.equal((await fetch(url)).status,401);assert.equal((await send('',input)).status,202);await poll('failed');
  assert.equal((await fetch(url+'/'+input.requestId,{headers:{'x-test-user':other.id}})).status,404);
  assert.equal((await pool.query('SELECT count(*)::int n FROM lessons')).rows[0].n,0);
  assert.ok(prompts[0].includes('Roupa seca sem ferver.'));assert.ok(prompts[0].includes('atlas_model'));
  assert.equal((await send('',{...input,topic:'Outro tema'})).status,409);
  fail=false;await send('/'+input.requestId+'/resume',{});const finished=await poll('completed');assert.equal(new Set(sessions).size,1);
  assert.deepEqual(finished.attempts.slice(-2).map((a:{model:string;status:string})=>[a.model,a.status]),[['test/refused','failed'],['test/model','completed']]);
  await send('',input);await send('/'+input.requestId+'/resume',{});assert.equal((await pool.query('SELECT count(*)::int n FROM lessons')).rows[0].n,1);
  assert.equal(finished.lessonId,'opencode-'+input.requestId);
  assert.equal((await pool.query('SELECT topic FROM lessons WHERE id=$1',[finished.lessonId])).rows[0].topic,input.topic.trim());
  const stored=JSON.parse(fs.readFileSync(path.join(dir,input.requestId+'.json'),'utf8'));assert.equal(stored.input.material_text,input.material_text);
  // Closing the service during a request preserves the brief and can resume it.
  input.requestId=randomUUID();hang=true;await send('',input);
  await poll('running');await stopOpenCodeLessons();await poll('interrupted');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,input.requestId+'.json'),'utf8')).input.material_text,input.material_text);
  hang=false;await send('/'+input.requestId+'/resume',{});await poll('completed');
  assert.equal((await pool.query('SELECT count(*)::int n FROM lessons')).rows[0].n,2);
  // A valid AI answer survives a local save failure; resume must not regenerate.
  input.requestId=randomUUID();input.topic='Storage failure recovery';
  await pool.query("ALTER TABLE lessons ADD CONSTRAINT test_storage_failure CHECK (topic <> 'Storage failure recovery') NOT VALID");
  await send('',input);const blocked=await poll('failed');assert.match(blocked.message,/IA respondeu/);
  assert.ok(fs.existsSync(path.join(dir,input.requestId+'.pending.json')));const calls=prompts.length;
  await pool.query('ALTER TABLE lessons DROP CONSTRAINT test_storage_failure');
  await send('/'+input.requestId+'/resume',{});await poll('completed');assert.equal(prompts.length,calls);
  assert.equal((await pool.query('SELECT count(*)::int n FROM lessons')).rows[0].n,3);
 } finally {await stopOpenCodeLessons();if(server)await new Promise<void>(r=>server!.close(()=>r()));await db.cleanup();}
});
