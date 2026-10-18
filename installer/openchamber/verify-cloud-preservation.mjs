import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const stage=path.resolve('build/openchamber/2.4.0-pemara.6');
const data=path.join(process.env.LOCALAPPDATA,'PEMARAOpenChamber');
const original=JSON.parse(fs.readFileSync(path.join(stage,'originais/acervo-anterior.json')));
const backups=fs.readdirSync(path.join(data,'aulas/backups')).filter(f=>/^backup-\d+\.json$/.test(f)).sort();
const after=JSON.parse(fs.readFileSync(path.join(data,'aulas/backups',backups.at(-1))));
const counts={};
for(const table of ['lessons','lesson_revisions','lesson_drafts','teacher_materials']){const key=table==='lesson_drafts'?'lesson_id':'id';for(const row of original.data[table])assert.deepEqual(after.data[table].find(r=>r[key]===row[key]),row,table+'/'+row[key]);counts[table]=original.data[table].length;}
const oldDb=new DatabaseSync(path.join(stage,'originais/opencode-before-update.db'),{readOnly:true});
const newDb=new DatabaseSync(path.join(data,'perfil/.local/share/opencode/opencode.db'),{readOnly:true});
try{for(const [table,columns] of [['session_message','id,session_id,type,seq,time_created,data'],['session_v2','id,title,directory']]){const rows=oldDb.prepare(`SELECT ${columns} FROM ${table}`).all();const query=newDb.prepare(`SELECT ${columns} FROM ${table} WHERE id=?`);for(const row of rows)assert.deepEqual(query.get(row.id),row,table+'/'+row.id);counts[table]=rows.length;}}finally{oldDb.close();newDb.close();}
const files=JSON.parse(fs.readFileSync(path.join(stage,'evidencias/original-files.json')));
for(const file of files){const target=path.join(process.env.USERPROFILE,'Documents/PEMARA Aulas',file.path);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),file.sha256,file.path);}counts.teacherFiles=files.length;
for(const file of fs.readdirSync(path.join(stage,'originais/ai-jobs'))){assert.deepEqual(JSON.parse(fs.readFileSync(path.join(data,'aulas/ai-jobs',file))),JSON.parse(fs.readFileSync(path.join(stage,'originais/ai-jobs',file))),file);}
const report={passed:true,counts,originalJobsUnchanged:true,at:new Date().toISOString()};fs.writeFileSync(path.join(stage,'evidencias/preservation-final.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
