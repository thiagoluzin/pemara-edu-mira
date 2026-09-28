import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDisposablePostgres } from './helpers/realPostgresHarness';
import { runMigrations } from '../server/db/migrator';
import { UserRepository } from '../server/repositories/userRepository';
import { readCompleteCatalog, validateCompleteCatalog, publishCompleteCatalog } from '../server/curriculum/completeCatalog';
import { exportDatabase, importDatabase } from '../server/db/backup';
import { KnowledgeRepository } from '../server/repositories/knowledgeRepository';
import { createKnowledgeRouter } from '../server/routes/knowledge';
import express from 'express';

test('Acervo integral: cobertura, publicação idempotente, catálogo e restauração em banco isolado', async()=>{
 const packs=readCompleteCatalog();
 const checked=await validateCompleteCatalog(packs);
 assert.deepEqual(checked.errors,[]);
 assert.equal(checked.linkedSkills,checked.totalSkills);
 assert.equal(checked.totalSkills,730);
 const db=await createDisposablePostgres('pemara-full-content-');
 const bootstrap=db.createPool();
 await bootstrap.query("CREATE DATABASE curriculum_test WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'");
 const pool=db.createPool({connectionString:db.connectionString.replace(/\/postgres$/, '/curriculum_test')});
 let restored:Awaited<ReturnType<typeof createDisposablePostgres>>|undefined;
 let server:ReturnType<ReturnType<typeof express>['listen']>|undefined;
 try {
  await runMigrations(pool);
  const admin=await new UserRepository(pool).create({username:'test-admin',name:'Administrador de teste',email:'test-admin@school.local',password_hash:'test-only-no-login',role:'admin'});
  const first=await publishCompleteCatalog(pool,packs);
  assert.equal(first.published,packs.length);
  let saved=(await pool.query('SELECT id,content_hash,payload_json FROM content_pack_versions ORDER BY id')).rows;
  const second=await publishCompleteCatalog(pool,packs);
  assert.equal(second.published,0);assert.equal(second.unchanged,packs.length);
  assert.deepEqual((await pool.query('SELECT id,content_hash,payload_json FROM content_pack_versions ORDER BY id')).rows,saved);
  assert.equal((await pool.query('SELECT count(DISTINCT curriculum_skill_id)::int AS total FROM curriculum_knowledge_links')).rows[0].total,730);
  assert.equal((await pool.query("SELECT count(*)::int AS total FROM content_pack_versions WHERE status='PUBLISHED'")).rows[0].total,packs.length);
  const changed=structuredClone(packs);changed[0].title+=' — versão revisada';
  assert.equal((await publishCompleteCatalog(pool,changed)).published,1);
  assert.equal((await publishCompleteCatalog(pool,packs)).published,1,'Reversão A→B→A publica nova versão A');
  const visible=await new KnowledgeRepository(pool).listNodes({limit:10000});
  assert.equal(visible.total,packs.reduce((count,p)=>count+p.nodes.length,0),'Versões antigas não duplicam a listagem');
  const active=(await pool.query("SELECT pv.payload_json,pv.id FROM content_pack_versions pv JOIN content_packs cp ON cp.id=pv.pack_id WHERE cp.slug=$1 AND pv.status='PUBLISHED'",[packs[0].slug])).rows[0];
  assert.equal(active.payload_json.version,'3');
  const originalNodeId=active.payload_json.nodes[0].id;
  await pool.query("UPDATE knowledge_nodes SET short_description='Edição do professor preservada', version=version+1 WHERE id=$1",[originalNodeId]);
  assert.equal((await publishCompleteCatalog(pool,changed)).published,0,'Carga não substitui edição docente pendente');
  assert.equal((await pool.query('SELECT short_description FROM knowledge_nodes WHERE id=$1',[originalNodeId])).rows[0].short_description,'Edição do professor preservada');
  await pool.query("UPDATE content_packs SET status='ARCHIVED' WHERE slug=$1",[packs[1].slug]);
  const archivedChange=structuredClone(packs);archivedChange[1].title+=' — revisão';
  assert.equal((await publishCompleteCatalog(pool,archivedChange)).published,0,'Carga não reativa conjunto arquivado');
  assert.equal((await pool.query('SELECT status FROM content_packs WHERE slug=$1',[packs[1].slug])).rows[0].status,'ARCHIVED');
  await pool.query("UPDATE content_packs SET status='ACTIVE' WHERE slug=$1",[packs[1].slug]);
  saved=(await pool.query('SELECT id,content_hash,payload_json FROM content_pack_versions ORDER BY id')).rows;
  const app=express();app.use('/api/knowledge',createKnowledgeRouter(pool));server=app.listen(0,'127.0.0.1');
  await new Promise<void>(r=>server!.once('listening',r));
  const port=(server.address() as any).port;
  const response=await fetch(`http://127.0.0.1:${port}/api/knowledge/catalog`);assert.equal(response.status,200);
  const catalog=(await response.json()).catalog;
  assert.equal(catalog.length,packs.length);assert.ok(catalog.every((e:any)=>e.keywords.length && e.editorialStatus==='pending_teacher_review'));
  const backup=await exportDatabase(pool);
  restored=await createDisposablePostgres('pemara-full-restored-');const restoreBootstrap=restored.createPool();await restoreBootstrap.query("CREATE DATABASE curriculum_test WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'");const target=restored.createPool({connectionString:restored.connectionString.replace(/\/postgres$/, '/curriculum_test')});await runMigrations(target);
  await importDatabase(target,backup,{confirmDestructiveRestore:true});
  assert.deepEqual((await target.query('SELECT id,content_hash,payload_json FROM content_pack_versions ORDER BY id')).rows,saved);
  assert.equal((await target.query('SELECT id FROM users WHERE id=$1',[admin.id])).rowCount,1);
 } finally {
  if(server) await new Promise<void>(r=>server!.close(()=>r()));
  if(restored) await restored.cleanup();
  await db.cleanup();
 }
});

