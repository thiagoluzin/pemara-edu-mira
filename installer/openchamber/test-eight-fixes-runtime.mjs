import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {stage} from './release.mjs';
import {startEducation} from './education-service.mjs';
const evidence=path.resolve(process.env.PEMARA_RUNTIME_EVIDENCE_DIR || 'evidencias/correcoes-oito-falhas-20261019');
fs.mkdirSync(evidence,{recursive:true});
const root=path.join(stage,'dist/win-unpacked/resources/education');
const dataDir=path.join(evidence,'runtime-profile');
const stateFile=path.join(evidence,'runtime-first.json');
const reopen=process.argv.includes('--reopen');
if(!reopen)assert.ok(!fs.existsSync(dataDir),'Use a new isolated test profile.');
else assert.ok(fs.existsSync(stateFile),'First cycle must have succeeded.');
const service=await startEducation({root,dataDir});
const hash=object=>crypto.createHash('sha256').update(JSON.stringify(object)).digest('hex');
async function request(route,method='GET',body,status=200){
 const res=await fetch(service.url+route,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 assert.equal(res.status,status,route);return res.json();
}
try{
 assert.equal((await fetch(service.url)).status,200);
 assert.equal((await request('/ready')).database.provider,'postgresql');
 if(!reopen){
  assert.equal((await request('/api/lessons')).lessons.length,0);
  assert.equal((await request('/api/materials')).materials.length,0);
  const {TEMPLATE_SOLAR_SYSTEM}=await import(pathToFileURL(path.join(root,'src/templates/deterministicTemplates.ts')).href);
  const spec=structuredClone(TEMPLATE_SOLAR_SYSTEM);delete spec.objectives;
  spec.lesson.title='Fixture isolada — preservação de aula legada';
  const created=await request('/api/lessons','POST',{title:spec.lesson.title,subjectCode:'science',gradeLevel:'6EF',topic:'Teste isolado',spec},201);
  const id=created.lesson.id;
  const initial=await request('/api/lessons/'+id);
  assert.equal(initial.currentSpec.objectives,undefined);
  const edited=structuredClone(initial.currentSpec);edited.scenes[0].title='Título revisado somente no teste';
  const published=await request('/api/lessons/'+id,'PUT',{spec:edited,expectedVersion:1,changeSummary:'Regressão isolada'});
  assert.equal(published.revision.version,2);
  const conflict=await request('/api/lessons/'+id+'/draft','POST',{draftSpec:initial.currentSpec,baseVersion:1},409);
  assert.equal(conflict.currentVersion,2);assert.equal(conflict.expectedVersion,1);
  const after=await request('/api/lessons/'+id);assert.equal(after.draft,null);
  const state={passed:true,id,firstRevision:created.revision,firstHash:hash(created.revision.spec_json),currentHash:hash(after.currentSpec),currentVersion:2,emptyFirstLaunch:true,conflict:{currentVersion:2,expectedVersion:1},root};
  fs.writeFileSync(stateFile,JSON.stringify(state,null,2),{flag:'wx'});
 }else{
  const state=JSON.parse(fs.readFileSync(stateFile));
  const after=await request('/api/lessons/'+state.id);
  assert.equal(after.currentVersion,2);assert.equal(hash(after.currentSpec),state.currentHash);assert.equal(after.currentSpec.objectives,undefined);
  fs.writeFileSync(path.join(evidence,'runtime-reopen.json'),JSON.stringify({passed:true,currentVersion:2,contentHashPreserved:true,legacyObjectivesPreserved:true,root},null,2));
 }
}finally{await service.stop();}
const backups=fs.readdirSync(path.join(dataDir,'backups')).sort();
const backup=JSON.parse(fs.readFileSync(path.join(dataDir,'backups',backups.at(-1))));
assert.equal(backup.table_counts.lessons,1);assert.equal(backup.table_counts.lesson_revisions,2);assert.equal(backup.table_counts.lesson_drafts,0);
const state=JSON.parse(fs.readFileSync(stateFile));
const firstRevision=backup.data.lesson_revisions.find(r=>r.lesson_id===state.id&&r.version===1);
assert.equal(hash(firstRevision.spec_json),state.firstHash,'Original revision changed');
assert.equal(firstRevision.content_hash,state.firstRevision.content_hash);
assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir,'last-shutdown.json'))).backupSaved,true);
console.log(JSON.stringify({passed:true,cycle:reopen?'reopen':'first',lessons:1,revisions:2,drafts:0,cleanShutdown:true}));
