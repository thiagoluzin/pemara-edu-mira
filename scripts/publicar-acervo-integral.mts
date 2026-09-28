import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { readCompleteCatalog, validateCompleteCatalog, publishCompleteCatalog } from '../server/curriculum/completeCatalog';
import { runMigrations } from '../server/db/migrator';
import { exportDatabase } from '../server/db/backup';
const packs=readCompleteCatalog();
const report=await validateCompleteCatalog(packs);
fs.mkdirSync('docs/evidencias',{recursive:true});
fs.writeFileSync('docs/evidencias/acervo-integral-validacao.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.errors.length) process.exit(1);
if(process.argv.includes('--apply')) {
  const config=JSON.parse(fs.readFileSync('.local-demo/config.json','utf8'));
  const pool=new pg.Pool({host:'127.0.0.1',port:config.dbPort,user:'postgres',password:config.password,database:'pemara_demo_utf8'});
  try {
    const backup=await exportDatabase(pool);
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const filename=path.resolve('.local-demo/backups',`pre-acervo-integral-${stamp}.json`);
    fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,JSON.stringify(backup));
    await runMigrations(pool);
    const protectedTables=['users','lessons','lesson_revisions','lesson_drafts','knowledge_nodes','resources'];
    const originalIds:Record<string,string[]>={};
    async function state(existingOnly=false) {
      const hashes:Record<string,string>={};
      for(const table of protectedTables) {
        const key=table==='lesson_drafts' ? 'lesson_id' : 'id';
        const rows=existingOnly ? (await pool.query(`SELECT * FROM ${table} WHERE ${key}=ANY($1::varchar[]) ORDER BY ${key}`,[originalIds[table]])).rows : (await pool.query(`SELECT * FROM ${table} ORDER BY ${key}`)).rows;
        if(!existingOnly) originalIds[table]=rows.map(r=>r[key]);
        hashes[table]=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
      }
      return hashes;
    }
    const before=await state();
    const first=await publishCompleteCatalog(pool,packs);
    const second=await publishCompleteCatalog(pool,packs);
    const after=await state(true);
    if(JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Contas ou aulas foram alteradas durante a carga. Consulte o backup.');
    if(second.published!==0 || second.unchanged!==packs.length) throw new Error('Falha de idempotência da carga.');
    const result={checkedAt:new Date().toISOString(),backup:filename,first,second,protectedDataPreserved:true,protectedTables};
    fs.writeFileSync('docs/evidencias/acervo-integral-publicacao.json',JSON.stringify(result,null,2));
    fs.writeFileSync('server/curriculum/complete/manifest.json',JSON.stringify({topics:packs.length,skills:report.totalSkills,editorialStatus:'pending_teacher_review',publishedAt:result.checkedAt},null,2));
    console.log(JSON.stringify({published:first.published,unchanged:second.unchanged,protectedDataPreserved:true}));
  } finally {await pool.end();}
}
