import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDisposablePostgres} from './helpers/realPostgresHarness';
import {runMigrations} from '../server/db/migrator';
import {UserRepository} from '../server/repositories/userRepository';
import {LessonRepository} from '../server/repositories/lessonRepository';
import {lessonsApi} from '../src/services/lessonsApi';
import {TEMPLATE_GREECE_6EF} from '../src/templates/deterministicTemplates';
import {saveLessonsToStorage,LOCAL_STORAGE_KEY,BACKUP_RAW_STORAGE_KEY} from '../src/storage/lessonStorage';
import {readCompleteCatalog,validateCompleteCatalog} from '../server/curriculum/completeCatalog';

test('Validação do acervo relata estruturas inválidas sem cair antes do diagnóstico',async()=>{
 const pack=structuredClone(readCompleteCatalog()[0]);
 (pack.quiz[0] as any).options=null;
 const result=await validateCompleteCatalog([null,pack] as any,false);
 assert.ok(result.errors.some(e=>e.includes('objeto ausente')));
 assert.ok(result.errors.some(e=>e.includes('Questão inválida')));
});

test('Dois autosaves simultâneos no PostgreSQL: somente um vence e a versão perdedora recebe conflito',async()=>{
 const db=await createDisposablePostgres('pemara-draft-race-');const pool=db.createPool();
 try{
  await runMigrations(pool);
  const user=await new UserRepository(pool).create({username:'draft-race',name:'Teste isolado',email:'test@example.invalid',password_hash:'isolated-test-not-a-login',role:'teacher'});
  const repo=new LessonRepository(pool);
  const made=await repo.createLesson({ownerId:user.id,title:'Concorrência',subjectCode:'history',gradeLevel:'6EF',topic:'teste',spec:TEMPLATE_GREECE_6EF});
  const id=made.lesson.id;
  const seed=await repo.saveDraft(id,user.id,{note:'inicial'},1);
  const results=await Promise.allSettled(['A','B'].map(note=>repo.saveDraft(id,user.id,{note},1,{expectedDraftUpdatedAt:new Date(seed.updated_at).toISOString()})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;assert.equal(rejected.reason.name,'OptimisticLockError');
  const winner=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;
  assert.ok(new Date(winner.updated_at).getTime()>new Date(seed.updated_at).getTime());
  await assert.rejects(repo.saveDraft(id,user.id,{note:'sem token'},1),{name:'OptimisticLockError'});
  assert.deepEqual((await repo.getDraft(id,user.id))!.draft_spec_json,winner.draft_spec_json);
 }finally{await db.cleanup();}
});

test('Cliente serializa autosave da mesma aula e usa o token da resposta anterior',async()=>{
 const oldFetch=globalThis.fetch;lessonsApi.clearSessionCache();let active=0,max=0;const bodies:any[]=[];
 globalThis.fetch=async(_url,init)=>{active++;max=Math.max(max,active);bodies.push(JSON.parse(init!.body as string));await new Promise(r=>setTimeout(r,15));active--;return new Response(JSON.stringify({savedAt:`2026-09-27T22:00:00.00${bodies.length}Z`,baseVersion:1}),{status:200});};
 try{await Promise.all([lessonsApi.saveDraft('one',TEMPLATE_GREECE_6EF,1),lessonsApi.saveDraft('one',TEMPLATE_GREECE_6EF,1)]);assert.equal(max,1);assert.equal(bodies[1].expectedDraftUpdatedAt,'2026-09-27T22:00:00.001Z');}
 finally{globalThis.fetch=oldFetch;lessonsApi.clearSessionCache();}
});

test('Falha de backup local impede sobrescrita do único original',()=>{
 const values=new Map([[LOCAL_STORAGE_KEY,'original-do-professor']]);
 const storage:Storage={get length(){return values.size;},clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(k===BACKUP_RAW_STORAGE_KEY)throw Error('QuotaExceededError');values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 assert.equal(saveLessonsToStorage(storage,[],[]).success,false);assert.equal(values.get(LOCAL_STORAGE_KEY),'original-do-professor');
});
