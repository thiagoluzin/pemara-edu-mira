import {DatabaseSync} from 'node:sqlite';
import {root} from './launch.mjs';
const db=new DatabaseSync(root+'/originais/antes-ia-20261018/perfil/.local/share/opencode/opencode.db',{readOnly:true});
const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables);
for(const table of tables.filter(x=>/session|message|event/.test(x.name))) console.log(table.name,db.prepare(`PRAGMA table_info("${table.name}")`).all().map(x=>x.name));
db.close();
