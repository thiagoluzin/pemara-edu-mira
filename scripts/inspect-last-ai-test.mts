import fs from 'node:fs';import pg from 'pg';
const c=JSON.parse(fs.readFileSync('.local-demo/config.json','utf8'));
const db=new pg.Client({host:'127.0.0.1',port:c.dbPort,user:'postgres',password:c.password,database:'pemara_demo_utf8'});await db.connect();
const lessons=await db.query(`SELECT l.id,l.title,l.created_at,l.updated_at,l.current_version,r.spec_json->'lesson' AS metadata,jsonb_array_length(r.spec_json->'scenes') AS scenes FROM lessons l JOIN lesson_revisions r ON r.lesson_id=l.id AND r.version=l.current_version WHERE NOT l.is_deleted ORDER BY l.created_at DESC LIMIT 5`);
console.log(JSON.stringify(lessons.rows,null,2));
const tables=await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%generation%'`);console.log(tables.rows);
await db.end();
