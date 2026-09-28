import fs from 'node:fs';
import pg from 'pg';
import {readCompleteCatalog,makePayload} from '../server/curriculum/completeCatalog';
import {LessonComposer} from '../src/composer/lessonComposer';
import {generateStandaloneHtml} from '../src/components/ExportModal';

const config=JSON.parse(fs.readFileSync('.local-demo/config.json','utf8'));
const pool=new pg.Pool({host:'127.0.0.1',port:config.dbPort,user:'postgres',password:config.password,database:'pemara_demo_utf8'});
try {
  const rows=(await pool.query(`SELECT l.title,l.grade_level,l.current_version,
    r.spec_json->'lesson'->>'bncc_skill' AS skills,
    (SELECT jsonb_agg(s->>'type') FROM jsonb_array_elements(r.spec_json->'scenes') s) AS scene_types
    FROM lessons l JOIN lesson_revisions r ON r.lesson_id=l.id AND r.version=l.current_version
    WHERE l.subject_code='science' AND l.is_deleted=false ORDER BY l.updated_at DESC LIMIT 4`)).rows;
  console.log(JSON.stringify(rows,null,2));
  fs.mkdirSync('docs/evidencias',{recursive:true});
  fs.writeFileSync('docs/evidencias/biologia-aulas-anteriores.json',JSON.stringify(rows,null,2));
  const pack=readCompleteCatalog().find(p=>p.slug==='science-6-celulas-e-niveis-de-organizacao-dos-seres-vivos')!;
  const lesson=LessonComposer.compose({discipline:'science',grade:'6EF',topic:pack.title,duration:45,teaching_method:'visual'},makePayload(pack,'1.0.0'));
  fs.writeFileSync('docs/evidencias/biologia-animada.html',generateStandaloneHtml(lesson));
  fs.writeFileSync('docs/evidencias/biologia-animada.json',JSON.stringify(lesson,null,2));
} finally {await pool.end();}
