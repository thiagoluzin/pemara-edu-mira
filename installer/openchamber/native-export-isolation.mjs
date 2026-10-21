import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
export const out=path.resolve('evidencias/native-exports-20261019');
const local=process.env.LOCALAPPDATA,docs=path.join(process.env.USERPROFILE,'Documents');
const roots=[path.join(local,'PEMARAOpenChamber'),path.join(docs,'PEMARA Aulas'),path.join(local,'PEMARAEduTesteLimpo'),path.join(docs,'PEMARA Aulas - Teste Limpo')];
const held=root=>root+'.preservado-native-exports-20261019';
const result=root=>root+'.resultado-native-exports-20261019';
function move(source,dest){
 source=path.resolve(source);dest=path.resolve(dest);
 assert.ok(roots.slice(2).some(root=>source===root||source===held(root)));
 assert.equal(path.dirname(source),path.dirname(dest));assert.ok(!fs.existsSync(dest));
 assert.ok(fs.lstatSync(source).isDirectory()&&!fs.lstatSync(source).isSymbolicLink());
 fs.renameSync(source,dest);
}
function snapshot(){const files={},links={};
 function walk(dir,logical){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const actual=path.join(dir,e.name),key=path.join(logical,e.name);
  if(e.isSymbolicLink()){links[key]=fs.readlinkSync(actual);continue;}
  if(e.isDirectory())walk(actual,key);else files[key]=crypto.createHash('sha256').update(fs.readFileSync(actual)).digest('hex');
 }}
 for(const root of roots)walk(fs.existsSync(held(root))?held(root):root,root);
 return {files,links};
}
fs.mkdirSync(out,{recursive:true});
if(process.argv.includes('--prepare')){
 for(const root of roots.slice(2)){assert.ok(fs.existsSync(root));assert.ok(!fs.existsSync(held(root)));assert.ok(!fs.existsSync(result(root)));}
 const before=snapshot();fs.writeFileSync(path.join(out,'preservation-before.json'),JSON.stringify(before),{flag:'wx'});
 for(const root of roots.slice(2))move(root,held(root));
 console.log(JSON.stringify({protectedFiles:Object.keys(before.files).length,linksNotFollowed:Object.keys(before.links).length,held:roots.slice(2).map(held)}));
}else if(process.argv.includes('--restore')){
 for(const root of roots.slice(2)){
  if(!fs.existsSync(held(root)))continue;
  if(fs.existsSync(root)){
   if(!fs.existsSync(result(root)))move(root,result(root));
   else move(root,root+'.residual-native-exports-20261019-'+Date.now());
  }
  if(fs.existsSync(root))move(root,root+'.residual-native-exports-20261019-'+Date.now());
  move(held(root),root);
 }
 const before=JSON.parse(fs.readFileSync(path.join(out,'preservation-before.json'))),after=snapshot();
 assert.deepEqual(after,before,'Owner files or links changed');
 const report={passed:true,protectedFiles:Object.keys(before.files).length,preservedLinks:Object.keys(before.links).length,changedFiles:0};
 fs.writeFileSync(path.join(out,'preservation-after.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else throw Error('Use --prepare or --restore with PEMARA EDU closed.');
