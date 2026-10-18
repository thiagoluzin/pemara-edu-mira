import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out='docs/evidencias/atlas-laboratorios-20261018',backup='backups/antes-atlas-laboratorios-20261018';
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const fileHash=(file:string)=>hash(fs.readFileSync(file));
const originals=JSON.parse(fs.readFileSync(out+'/acervo-original.json','utf8'));
const previousLessons=[];
for(const old of originals){const now=await(await fetch('http://127.0.0.1:3001/api/lessons/'+old.id)).json();const sha256=hash(JSON.stringify(now));assert.equal(sha256,old.sha256,old.title+' preservada');previousLessons.push({id:old.id,title:old.title,sha256,unchanged:true});}
const older=JSON.parse(fs.readFileSync('docs/evidencias/atlas-movimento-integral-20261017/manifesto-final.json','utf8'));
const originalFiles=[...older.originals,...older.exports].map((f:any)=>{const sha256=fileHash(f.file);assert.equal(sha256,f.sha256,f.file+' preservado');return{file:f.file,sha256,unchanged:true};});
function walk(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const backups=walk(backup).map(file=>({file,sha256:fileHash(file)}));
const lessons=JSON.parse(fs.readFileSync(out+'/aulas.json','utf8'));
const downloads=['C:/Users/admin_remoto/Downloads/pemara-apresentacao-respiração (1).html','C:/Users/admin_remoto/Downloads/pemara-apresentacao-evaporação (2).html','C:/Users/admin_remoto/Downloads/pemara-apresentacao-média-e-mediana.html'];
const exports=[];
for(const [i,l] of lessons.entries()){const sha256=fileHash(l.file);assert.equal(sha256,fileHash(downloads[i]));exports.push({...l,download:downloads[i],sha256,copyIdentical:true});const saved=await(await fetch('http://127.0.0.1:3001/api/lessons/'+l.id)).json();fs.writeFileSync(out+'/aula-final-'+l.slug+'.json',JSON.stringify(saved,null,2),{flag:'wx'});}
const sources=['src/animations/atlasLab.ts','src/renderer/components/PemaraLearning.tsx','src/engine/learningOffline.ts','src/engine/learningMotion.ts','src/types/lesson.ts','test/atlas-labs.test.ts','test/learning-playback.test.ts','scripts/create-atlas-lab-lessons.ts','scripts/verify-atlas-labs-delivery.ts'].map(file=>({file,sha256:fileHash(file),original:fs.existsSync(backup+'/'+file)?backup+'/'+file:null}));
const results=['programa-entrega-resultados.json','html-entrega-resultados.json'].map(file=>{const result=JSON.parse(fs.readFileSync(out+'/'+file,'utf8'));assert.equal(result.passed,true);return{file:out+'/'+file,states:result.rows.length,network:result.network,passed:true};});
fs.writeFileSync(out+'/manifesto-final.json',JSON.stringify({date:new Date().toISOString(),content_kind:'animation',scope:['respiration','separation:evaporation','statistics'],backup,backups,previousLessons,originalFiles,exports,sources,results},null,2),{flag:'wx'});
console.log(JSON.stringify({originalLessons:previousLessons.length,originalFiles:originalFiles.length,backupFiles:backups.length,exports:exports.length,allPreserved:true}));
