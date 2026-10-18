import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { exportDatabase } from '../../server/db/backup';
const stage = path.resolve('build/openchamber/2.4.0-pemara.4');
const config = JSON.parse(fs.readFileSync('.local-teacher/config.json', 'utf8'));
const pool = new pg.Pool({ host: '127.0.0.1', port: config.dbPort, user: 'postgres', password: config.password, database: 'pemara_teacher_utf8' });
try {
  const snapshot = await exportDatabase(pool);
  fs.writeFileSync(path.join(stage, 'originais/acervo-anterior.json'), JSON.stringify(snapshot), { flag: 'wx' });
  const target = path.join(process.env.LOCALAPPDATA!, 'PEMARAOpenChamber/aulas');
  fs.mkdirSync(target, { recursive: true });
  if (fs.existsSync(path.join(target, 'postgres'))) throw new Error('Destino existente: preservar e conferir antes de importar.');
  fs.writeFileSync(path.join(target, 'import-once.json'), JSON.stringify(snapshot), { flag: 'wx' });
  console.log(JSON.stringify({ sourceSnapshot: snapshot.table_counts }));
} finally { await pool.end(); }
for (const [source, name] of [
  [path.join(process.env.LOCALAPPDATA!, 'PEMARAOpenChamber/perfil'), 'perfil'],
  [path.join(process.env.USERPROFILE!, 'Documents/PEMARA Aulas'), 'aulas-arquivos'],
]) {
  fs.cpSync(source, path.join(stage, 'originais', name), { recursive: true });
}
const files: {path:string;sha256:string}[]=[];
const projects=path.join(process.env.USERPROFILE!, 'Documents/PEMARA Aulas');
function visit(dir:string) { for(const entry of fs.readdirSync(dir,{withFileTypes:true})) { const file=path.join(dir,entry.name); if(entry.isDirectory())visit(file); else files.push({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}); } }
visit(projects);
fs.writeFileSync(path.join(stage,'evidencias/arquivos-antes.json'),JSON.stringify(files,null,2),{flag:'wx'});
