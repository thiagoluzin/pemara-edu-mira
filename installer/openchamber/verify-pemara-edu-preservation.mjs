import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const stage=path.resolve('build/openchamber/2.4.0-pemara.5');
const original=path.join(stage,'originais');
const data=path.join(process.env.LOCALAPPDATA,'PEMARAOpenChamber');
const latest=directory=>JSON.parse(fs.readFileSync(path.join(directory,fs.readdirSync(directory).filter(n=>/^backup-\d+\.json$/.test(n)).sort().at(-1))));
const old=latest(path.join(original,'aulas/backups')),current=latest(path.join(data,'aulas/backups'));
const counts={};
for(const table of ['lessons','lesson_revisions','lesson_drafts','teacher_materials']){
 const key=table==='lesson_drafts'?'lesson_id':'id';
 for(const row of old.data[table])assert.deepEqual(current.data[table].find(r=>r[key]===row[key]),row,table+'/'+row[key]);
 counts[table]=old.data[table].length;
}
const before=new DatabaseSync(path.join(original,'opencode.db'),{readOnly:true});
const after=new DatabaseSync(path.join(data,'perfil/.local/share/opencode/opencode.db'),{readOnly:true});
try{
 for(const [table,columns] of [['session_message','id,session_id,type,seq,time_created,data'],['session_v2','id,title,directory']]){
  const rows=before.prepare(`SELECT ${columns} FROM ${table}`).all();
  const find=after.prepare(`SELECT ${columns} FROM ${table} WHERE id=?`);
  for(const row of rows)assert.deepEqual(find.get(row.id),row,table+'/'+row.id);
  counts[table]=rows.length;
 }
 // The genuine rejected AI request must also retain its OpenCode conversation.
 assert.ok(after.prepare('SELECT id FROM session_v2 WHERE id=?').get('ses_344d9708a8f943d8a267ea0c02c4dcd0'));
}finally{before.close();after.close();}
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let files=0;
function visit(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())visit(file);else{const relative=path.relative(path.join(original,'arquivos-professor'),file);assert.equal(hash(path.join(process.env.USERPROFILE,'Documents/PEMARA Aulas',relative)),hash(file),relative);files++;}}}
visit(path.join(original,'arquivos-professor'));counts.teacherFiles=files;
const report={passed:true,counts,failedAiConversationRetained:true,at:new Date().toISOString()};
fs.writeFileSync(path.join(stage,'evidencias/preservation-final.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
