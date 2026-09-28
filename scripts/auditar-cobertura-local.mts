import fs from 'node:fs';
import pg from 'pg';
const config=JSON.parse(fs.readFileSync('.local-demo/config.json','utf8'));
const pool=new pg.Pool({host:'127.0.0.1',port:config.dbPort,user:'postgres',password:config.password,database:'pemara_demo_utf8'});
try {
 const result={checkedAt:new Date().toISOString(),
  knowledge:(await pool.query('SELECT subject_code,grade_level,status,count(*)::int AS total FROM knowledge_nodes GROUP BY subject_code,grade_level,status ORDER BY subject_code,grade_level,status')).rows,
  curriculum:(await pool.query('SELECT subject_code,grade_level,count(*)::int AS total FROM curriculum_skills GROUP BY subject_code,grade_level ORDER BY subject_code,grade_level')).rows,
  published:(await pool.query("SELECT cp.slug,cp.subject_code,cp.grade_level,v.version,jsonb_array_length(COALESCE(v.payload_json->'nodes','[]'::jsonb)) AS nodes FROM content_packs cp JOIN content_pack_versions v ON v.pack_id=cp.id WHERE v.status='PUBLISHED' ORDER BY cp.slug")).rows,
  links:(await pool.query('SELECT count(*)::int AS total FROM curriculum_knowledge_links')).rows[0].total,
  lessonCount:(await pool.query('SELECT count(*)::int AS total FROM lessons')).rows[0].total};
 fs.writeFileSync('docs/evidencias/cobertura-curricular-real-2026-09-27.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await pool.end();}
