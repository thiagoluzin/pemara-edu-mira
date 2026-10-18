import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root} from './launch.mjs';
const base = path.resolve(root, '../..');
const paths = ['src', 'server', 'installer', 'EXPORTACOES', 'package.json', 'package-lock.json', 'server.ts'];
const files = [];
function visit(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) for (const name of fs.readdirSync(file)) visit(path.join(file, name));
  else if (stat.isFile()) files.push(file);
}
for (const relative of paths) visit(path.join(base, relative));
const hashes = Object.fromEntries(files.map(file => [path.relative(base, file), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const manifest = path.join(root, 'evidencias', 'originais-sha256.json');
fs.mkdirSync(path.dirname(manifest), {recursive:true});
if (process.argv.includes('--verify')) {
  const before = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const changed = Object.keys(before).filter(key => before[key] !== hashes[key]);
  const report = {filesChecked:Object.keys(before).length, changed, verifiedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(root,'evidencias','preservacao.json'),JSON.stringify(report,null,2));
  console.log(report); if(changed.length) process.exitCode=1;
} else {
  fs.writeFileSync(manifest,JSON.stringify(hashes,null,2),{flag:'wx'});
  console.log(`Preservation baseline: ${files.length} files`);
}
