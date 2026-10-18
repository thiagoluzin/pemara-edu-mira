import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {root,profile,projectsRoot} from './launch.mjs';
const backup=root+'/originais/antes-ia-20261018';
const before=new DatabaseSync(backup+'/perfil/.local/share/opencode/opencode.db',{readOnly:true});
const after=new DatabaseSync(profile+'/.local/share/opencode/opencode.db',{readOnly:true});
const report={checkedAt:new Date().toISOString(),files:0,sessions:0,messages:0,passed:false};
try {
  for(const session of before.prepare('SELECT id,title,directory FROM session_v2').all()) {
    assert.deepEqual(after.prepare('SELECT id,title,directory FROM session_v2 WHERE id=?').get(session.id),session);
    report.sessions++;
  }
  for(const message of before.prepare('SELECT id,session_id,type,data FROM session_message').all()) {
    assert.deepEqual(after.prepare('SELECT id,session_id,type,data FROM session_message WHERE id=?').get(message.id),message);
    report.messages++;
  }
  async function compare(relative='') {
    for(const entry of await fs.readdir(path.join(backup,'projetos',relative),{withFileTypes:true})) {
      const file=path.join(relative,entry.name);
      if(entry.isDirectory()) await compare(file);
      else {
        assert.deepEqual(await fs.readFile(path.join(projectsRoot,file)),await fs.readFile(path.join(backup,'projetos',file)));
        report.files++;
      }
    }
  }
  await compare();
  report.passed=true;
} catch(error) { report.error=String(error);process.exitCode=1; }
finally {
  before.close();after.close();
  await fs.writeFile(root+'/evidencias/ia-preservacao.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
