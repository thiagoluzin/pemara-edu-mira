import fs from 'node:fs';import pg from 'pg';import {createLearningPlan} from '../src/engine/learningVisual';
const c=JSON.parse(fs.readFileSync('.local-demo/config.json','utf8'));const db=new pg.Client({host:'127.0.0.1',port:c.dbPort,user:'postgres',password:c.password,database:'pemara_demo_utf8'});await db.connect();
const attempts=await db.query(`SELECT * FROM generation_attempts ORDER BY created_at DESC LIMIT 3`);console.log('ATTEMPTS',JSON.stringify(attempts.rows,null,2));
const row=(await db.query(`SELECT r.spec_json FROM lesson_revisions r JOIN lessons l ON l.id=r.lesson_id WHERE NOT l.is_deleted ORDER BY l.created_at DESC,r.version DESC LIMIT 1`)).rows[0];
console.log('LATEST_SPEC',JSON.stringify(row.spec_json,null,2));
for(const s of row.spec_json.scenes)if(['text','summary'].includes(s.type))console.log('VISUAL',s.id,createLearningPlan(s,row.spec_json.lesson).kind);
fs.mkdirSync('docs/evidencias/teste-ia-generico',{recursive:true});fs.writeFileSync('docs/evidencias/teste-ia-generico/aula-original.json',JSON.stringify(row.spec_json,null,2));await db.end();
