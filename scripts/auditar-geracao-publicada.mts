import fs from 'node:fs';
import pg from 'pg';
import { PemaraMaestro } from '../src/maestro/pemaraMaestro';
const config = JSON.parse(fs.readFileSync('.local-demo/config.json', 'utf8'));
const pool = new pg.Pool({ host: '127.0.0.1', port: config.dbPort, user: 'postgres', password: config.password, database: 'pemara_demo_utf8' });
try {
  const packs = (await pool.query(`SELECT DISTINCT ON(cp.id) cp.slug, cp.subject_code, cp.grade_level, cpv.payload_json FROM content_packs cp JOIN content_pack_versions cpv ON cpv.pack_id=cp.id WHERE cpv.status='PUBLISHED' AND cp.status IN ('ACTIVE','PUBLISHED') ORDER BY cp.id, cpv.published_at DESC NULLS LAST, cpv.created_at DESC`)).rows;
  const gaps = (await pool.query(`SELECT s.subject_code, s.grade_level, s.code, s.description FROM curriculum_skills s WHERE NOT EXISTS (SELECT 1 FROM curriculum_knowledge_links l JOIN knowledge_nodes n ON n.id=l.knowledge_node_id WHERE l.curriculum_skill_id=s.id AND n.status='PUBLISHED') ORDER BY s.subject_code, s.grade_level, s.code`)).rows;
  const csv = ['Disciplina;Ano ou faixa;Código;Habilidade', ...gaps.map(r => [r.subject_code, r.grade_level, r.code, r.description].map(v => '"' + String(v).replaceAll('"', '""') + '"').join(';'))].join('\r\n');
  fs.writeFileSync('docs/evidencias/habilidades-sem-conteudo.csv', '\uFEFF' + csv);
  const results = [];
  for (const row of packs) {
    const grade = String(row.grade_level).length === 2 ? String(row.grade_level)[0] : String(row.grade_level);
    try {
      const result = await PemaraMaestro.generateLesson({subject: row.subject_code, grade: `${grade}EF`, topic: row.payload_json.title, duration_minutes: 45, didactic_style: 'complete', generation_mode: 'MODE_A_NO_AI'}, row.payload_json);
      results.push({slug: row.slug, ok: true, scenes: result.lesson.scenes.length, visualStatus: result.lesson.lesson.visual_status});
    } catch (error) { results.push({slug: row.slug, ok: false, error: String(error)}); }
  }
  fs.writeFileSync('docs/evidencias/geracao-publicada-engenharia.json', JSON.stringify({checkedAt: new Date().toISOString(), results}, null, 2));
  console.log(JSON.stringify({total: results.length, passed: results.filter(r=>r.ok).length, failures: results.filter(r=>!r.ok)}, null, 2));
  if (results.some(r=>!r.ok)) process.exitCode=1;
} finally { await pool.end(); }
