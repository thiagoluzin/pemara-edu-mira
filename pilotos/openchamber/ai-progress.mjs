import {DatabaseSync} from 'node:sqlite';
import {profile} from './launch.mjs';
const db=new DatabaseSync(profile+'/.local/share/opencode/opencode.db',{readOnly:true});
console.log(db.prepare('SELECT id,title,time_updated FROM session_v2 ORDER BY time_updated DESC LIMIT 3').all());
console.log(db.prepare('SELECT aggregate_id,type,created,length(data) bytes FROM event ORDER BY created DESC LIMIT 5').all());
console.log(db.prepare('SELECT type,created,length(data) bytes FROM event WHERE aggregate_id=? ORDER BY seq DESC LIMIT 8').all('ses_eb04e7d58ffeWKyEfRpbVV6G69'));
const retries=db.prepare("SELECT data FROM event WHERE aggregate_id=? AND type='session.retry.scheduled' ORDER BY seq DESC LIMIT 1").all('ses_eb04e7d58ffeWKyEfRpbVV6G69');
for(const row of retries) {const data=JSON.parse(row.data);console.log(JSON.stringify({attempt:data.attempt,error:data.error}));}
db.close();
