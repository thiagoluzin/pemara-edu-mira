import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createDisposablePostgres} from './helpers/realPostgresHarness';
import {runMigrations} from '../server/db/migrator';
import {UserRepository} from '../server/repositories/userRepository';
import {LessonRepository} from '../server/repositories/lessonRepository';

test('Publicação real mantém identidade e versão do JSON consistentes sem alterar snapshots anteriores',async()=>{
 const instance=await createDisposablePostgres('pemara-published-version-');const pool=instance.createPool();
 try{
  await runMigrations(pool);
  const teacher=await new UserRepository(pool).create({username:'teste.versoes',name:'Teste',email:'versoes@example.invalid',password_hash:'unused-test',role:'teacher'});
  const repo=new LessonRepository(pool);
  const input={schema_version:'1.0',lesson_version:9,renderer_version:'1.0.0',lesson:{id:'imported-id',title:'Teste de versão'},scenes:[{id:'s1',type:'title',title:'Original'}]};
  const original=structuredClone(input);
  const v1=await repo.createLesson({id:'published-test',ownerId:teacher.id,title:'Teste de versão',subjectCode:'science',gradeLevel:'6EF',topic:'Teste',spec:input});
  assert.equal(v1.revision.spec_json.lesson_version,1);assert.equal(v1.revision.spec_json.lesson.id,'published-test');assert.deepEqual(input,original);
  const edited={...input,lesson_version:1,scenes:[{id:'s1',type:'title',title:'Editada'}]};
  const v2=await repo.saveNewVersion({lessonId:v1.lesson.id,actorId:teacher.id,expectedVersion:1,spec:edited,changeSummary:'Editada'});
  assert.equal(v2.revision.spec_json.lesson_version,2);assert.equal(v2.revision.version,2);assert.equal(edited.lesson_version,1);
  const expected={...edited,lesson_version:2,lesson:{...edited.lesson,id:v1.lesson.id}};
  assert.equal(v2.revision.content_hash,crypto.createHash('sha256').update(JSON.stringify(expected)).digest('hex'));
  const v3=await repo.restoreRevision({lessonId:v1.lesson.id,revisionId:v1.revision.id,actorId:teacher.id});
  assert.equal(v3.revision.spec_json.lesson_version,3);assert.equal(v3.revision.spec_json.scenes[0].title,'Original');
  const duplicate=await repo.duplicateLesson(v1.lesson.id,teacher.id);
  assert.equal(duplicate.revision.spec_json.lesson_version,1);assert.equal(duplicate.revision.spec_json.lesson.id,duplicate.lesson.id);
  const history=await repo.listLessonRevisions(v1.lesson.id);
  assert.deepEqual(history.find(r=>r.version===1),v1.revision);assert.deepEqual(history.find(r=>r.version===2),v2.revision);
 }finally{await pool.end();await instance.cleanup();}
});
