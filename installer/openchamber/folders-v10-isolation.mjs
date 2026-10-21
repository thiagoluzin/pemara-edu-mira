import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out=path.resolve('evidencias/folders-v10-20261019');
const local=process.env.LOCALAPPDATA,docs=path.join(process.env.USERPROFILE,'Documents');
const roots=[path.join(local,'PEMARAOpenChamber'),path.join(docs,'PEMARA Aulas'),path.join(local,'Programs/PEMARA OpenChamber'),path.join(local,'PEMARAEduTesteLimpo'),path.join(docs,'PEMARA Aulas - Teste Limpo'),path.join(local,'Programs/PEMARA EDU Teste Limpo')];
const held=root=>root+'.preservado-folders-v10-20261019';
function checkedMove(source,dest){
 source=path.resolve(source);dest=path.resolve(dest);
 assert.ok(roots.some(root=>source===root||source===held(root)));
 assert.equal(path.dirname(source),path.dirname(dest));assert.ok(!fs.existsSync(dest));
 assert.ok(fs.lstatSync(source).isDirectory()&&!fs.lstatSync(source).isSymbolicLink());
 fs.renameSync(source,dest);
}
function snapshot(){const files={};function walk(dir,logical){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){assert.ok(!entry.isSymbolicLink());const real=path.join(dir,entry.name),key=path.join(logical,entry.name);if(entry.isDirectory())walk(real,key);else files[key]=crypto.createHash('sha256').update(fs.readFileSync(real)).digest('hex');}}
 for(const root of roots)walk(fs.existsSync(held(root))?held(root):root,root);return files;}
fs.mkdirSync(out,{recursive:true});
if(process.argv.includes('--prepare')){
 for(const root of roots.slice(3)){assert.ok(fs.existsSync(root));assert.ok(!fs.existsSync(held(root)));}
 const before=snapshot();fs.writeFileSync(path.join(out,'preservation-before.json'),JSON.stringify(before),{flag:'wx'});
 for(const root of roots.slice(3))checkedMove(root,held(root));
 console.log(JSON.stringify({protectedFiles:Object.keys(before).length,held:roots.slice(3).map(held)}));
}else if(process.argv.includes('--restore')||process.argv.includes('--verify')){
 if(!process.argv.includes('--verify')){
 for(const root of roots.slice(3,5)){assert.ok(fs.existsSync(held(root)));assert.ok(!fs.existsSync(root+'.resultado-folders-v10-20261019'));}
 for(const root of roots.slice(3,5)){if(fs.existsSync(root))checkedMove(root,root+'.resultado-folders-v10-20261019');checkedMove(held(root),root);}
 }
 const before=JSON.parse(fs.readFileSync(path.join(out,'preservation-before.json'))),after=snapshot();
 const changes=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>before[key]!==after[key]);
 const report={passed:!changes.length,protectedFiles:Object.keys(before).length,changes,preservedProgram:held(roots[5])};
 fs.writeFileSync(path.join(out,'preservation-after.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(changes.length,0);
}else throw Error('Use --prepare or --restore with PEMARA EDU closed.');
