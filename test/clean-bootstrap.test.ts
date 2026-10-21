import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDisposablePostgres} from './helpers/realPostgresHarness';
import {runMigrations} from '../server/db/migrator';
import {seedInitialKnowledge} from '../server/db/seeds/knowledge';
import {publishCompleteCatalog,readCompleteCatalog} from '../server/curriculum/completeCatalog';

test('Carga limpa mantém o acervo sem semear pesquisa; não apaga registros existentes',async()=>{
 const instance=await createDisposablePostgres('pemara-clean-seed-');
 const admin=instance.createPool();
 await admin.query("CREATE DATABASE clean_seed_test WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'");
 const pool=instance.createPool({connectionString:instance.connectionString.replace(/\/postgres$/,'/clean_seed_test')});
 try{
  await runMigrations(pool);
  const clean=await seedInitialKnowledge(pool,{includeDemoResearch:false});
  assert.equal(clean.stagingCount,0);assert.ok(clean.nodesCount>0);
  const versions=(await pool.query("SELECT version,status,payload_json FROM content_pack_versions WHERE pack_id='history-6-grecia-antiga' ORDER BY version")).rows;
  assert.deepEqual(versions[0],{version:'1.0.0',status:'ARCHIVED',payload_json:{}});
  assert.equal(versions[1].status,'PUBLISHED');assert.ok(versions[1].payload_json.nodes.length>0);assert.ok(versions[1].payload_json.quizzes.length>0);
  await publishCompleteCatalog(pool,readCompleteCatalog(),{onlyMissing:true,bundledBootstrap:true});
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM curriculum_skills WHERE locator IS NOT NULL AND locator_pdf IS NOT NULL')).rows[0].count,730);
  await pool.query("UPDATE curriculum_skills SET description='Texto alterado pelo professor',locator=NULL,locator_pdf=NULL WHERE code='EF06HI10'");
  await publishCompleteCatalog(pool,readCompleteCatalog(),{onlyMissing:true,bundledBootstrap:true});
  assert.deepEqual((await pool.query("SELECT description,locator,locator_pdf FROM curriculum_skills WHERE code='EF06HI10'")).rows[0],{description:'Texto alterado pelo professor',locator:null,locator_pdf:null});
  assert.deepEqual((await pool.query("SELECT version,status,payload_json FROM content_pack_versions WHERE pack_id='history-6-grecia-antiga' ORDER BY version")).rows,versions);
  for(const table of ['import_batches','staging_nodes','lessons','lesson_drafts','teacher_materials'])assert.equal((await pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count,0,table);
  await seedInitialKnowledge(pool);
  const before=(await pool.query('SELECT * FROM staging_nodes ORDER BY id')).rows;
  assert.equal(before.length,3);
  await seedInitialKnowledge(pool,{includeDemoResearch:false});
  assert.deepEqual((await pool.query('SELECT * FROM staging_nodes ORDER BY id')).rows,before,'Clean boot must not delete existing research');
  assert.deepEqual((await pool.query("SELECT version,status,payload_json FROM content_pack_versions WHERE pack_id='history-6-grecia-antiga' ORDER BY version")).rows,versions);
 }finally{await pool.end();await admin.end();await instance.cleanup();}
});
