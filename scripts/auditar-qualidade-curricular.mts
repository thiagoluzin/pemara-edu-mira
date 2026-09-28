import fs from 'node:fs';
import pg from 'pg';
const c=JSON.parse(fs.readFileSync('.local-demo/config.json','utf8'));
const pool=new pg.Pool({host:'127.0.0.1',port:c.dbPort,user:'postgres',password:c.password,database:'pemara_demo_utf8'});
try {
 const result={checkedAt:new Date().toISOString(),coverage:(await pool.query(`SELECT s.subject_code,count(*)::int AS skills,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM curriculum_knowledge_links l WHERE l.curriculum_skill_id=s.id))::int AS linked_skills FROM curriculum_skills s GROUP BY s.subject_code ORDER BY s.subject_code`)).rows,
 generatedDescriptions:(await pool.query(`SELECT count(*)::int AS total FROM curriculum_skills WHERE description LIKE '%(' || code || ').'`)).rows[0].total,
 examples:(await pool.query(`SELECT code,description,status FROM curriculum_skills WHERE code IN ('EF06CI01','EF06CI02','EF06CI03','EF06CI14') ORDER BY code`)).rows,
 emptyContentGrades:(await pool.query(`SELECT DISTINCT s.subject_code,s.grade_level FROM curriculum_skills s WHERE NOT EXISTS(SELECT 1 FROM knowledge_nodes n WHERE n.subject_code=s.subject_code AND n.grade_level=s.grade_level AND n.status='PUBLISHED') ORDER BY s.subject_code,s.grade_level`)).rows};
 fs.writeFileSync('docs/evidencias/qualidade-curricular-2026-09-27.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await pool.end();}
