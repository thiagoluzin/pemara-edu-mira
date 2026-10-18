import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
const stage = path.resolve('build/openchamber/2.4.0-pemara.4');
const data = path.join(process.env.LOCALAPPDATA, 'PEMARAOpenChamber');
const original = JSON.parse(fs.readFileSync(path.join(stage,'originais/acervo-anterior.json')));
const backups = fs.readdirSync(path.join(data,'aulas/backups')).filter(name=>/^backup-\d+\.json$/.test(name)).sort();
assert.ok(backups.length);
const latest = JSON.parse(fs.readFileSync(path.join(data,'aulas/backups',backups.at(-1))));
const counts = {};
for (const table of ['lessons','lesson_revisions','lesson_drafts','teacher_materials']) {
  for (const row of original.data[table]) {
    const key = table === 'lesson_drafts' ? 'lesson_id' : 'id';
    const actual = latest.data[table].find(item=>item[key]===row[key]);
    assert.ok(isDeepStrictEqual(actual,row),`Original changed: ${table}/${row[key]}`);
  }
  counts[table]=original.data[table].length;
}
const oldDb = new DatabaseSync(path.join(stage,'originais/perfil/.local/share/opencode/opencode.db'),{readOnly:true});
const newDb = new DatabaseSync(path.join(data,'perfil/.local/share/opencode/opencode.db'),{readOnly:true});
try {
  const messages = oldDb.prepare('SELECT id,session_id,type,seq,time_created,data FROM session_message ORDER BY id').all();
  const find = newDb.prepare('SELECT id,session_id,type,seq,time_created,data FROM session_message WHERE id=?');
  for(const message of messages) assert.deepEqual(find.get(message.id),message,`Conversation content changed: ${message.id}`);
  counts.messages=messages.length;
  const sessions=oldDb.prepare('SELECT id,title,directory FROM session_v2').all();
  for(const session of sessions)assert.deepEqual(newDb.prepare('SELECT id,title,directory FROM session_v2 WHERE id=?').get(session.id),session);
  counts.conversations=sessions.length;
} finally {oldDb.close();newDb.close();}
const oldFiles=JSON.parse(fs.readFileSync(path.join(stage,'evidencias/arquivos-antes.json')));
for(const file of oldFiles)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),file.sha256,file.path);
counts.originalFiles=oldFiles.length;
fs.writeFileSync(path.join(stage,'evidencias/preservation-final.json'),JSON.stringify({passed:true,counts,checkedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({passed:true,counts}));
