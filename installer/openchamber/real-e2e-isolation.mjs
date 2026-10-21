import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out=path.resolve('evidencias/real-e2e-20261019');
const local=process.env.LOCALAPPDATA,docs=path.join(process.env.USERPROFILE,'Documents');
const roots=[path.join(local,'PEMARAOpenChamber'),path.join(docs,'PEMARA Aulas'),path.join(local,'Programs/PEMARA OpenChamber'),path.join(local,'PEMARAEduTesteLimpo'),path.join(docs,'PEMARA Aulas - Teste Limpo'),path.join(local,'Programs/PEMARA EDU Teste Limpo')];
const pairs=roots.slice(3,5).map(original=>({original,held:original+'.preservado-e2e-20261019',test:original+'.resultado-e2e-20261019'}));
const preservedProgram=roots[5]+'.preservado-e2e-20261019';
function snapshot(){const files={};function walk(dir,logical=dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){assert.ok(!e.isSymbolicLink());const p=path.join(dir,e.name),key=path.join(logical,e.name);if(e.isDirectory())walk(p,key);else files[key]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}for(const r of roots)walk(r===roots[5]&&fs.existsSync(preservedProgram)?preservedProgram:r,r);return files;}
fs.mkdirSync(out,{recursive:true});
if(process.argv.includes('--prepare')){
 for(const p of pairs){assert.equal(path.dirname(p.original),path.dirname(p.held));assert.ok(fs.existsSync(p.original));assert.ok(!fs.existsSync(p.held)&&!fs.existsSync(p.test));}
 const before=snapshot();fs.writeFileSync(path.join(out,'preservation-before.json'),JSON.stringify(before),{flag:'wx'});
 fs.writeFileSync(path.join(out,'isolation.json'),JSON.stringify({roots,pairs},null,2),{flag:'wx'});
 for(const p of pairs)fs.renameSync(p.original,p.held);
 console.log(JSON.stringify({isolated:true,protectedFiles:Object.keys(before).length,pairs}));
}else if(process.argv.includes('--next-build')){
 const previous=path.join(out,'v7');assert.ok(!fs.existsSync(previous));fs.mkdirSync(previous);
 for(const e of fs.readdirSync(out,{withFileTypes:true}))if(e.isFile()&&!e.name.startsWith('preservation')&&e.name!=='isolation.json')fs.copyFileSync(path.join(out,e.name),path.join(previous,e.name));
 const moves=[...pairs.map(p=>({source:p.original,dest:p.original+'.resultado-e2e-v7-20261019'})),{source:roots[5],dest:preservedProgram}];
 for(const p of pairs)assert.ok(fs.existsSync(p.held));
 for(const m of moves){assert.equal(path.dirname(m.source),path.dirname(m.dest));assert.ok(fs.existsSync(m.source));assert.ok(!fs.existsSync(m.dest));}
 for(const m of moves)fs.renameSync(m.source,m.dest);
 console.log(JSON.stringify({preservedPreviousTestAndProgram:moves}));
}else if(process.argv.includes('--hold-print-test')){
 for(const p of pairs){assert.ok(fs.existsSync(p.held));assert.ok(fs.existsSync(p.original));assert.ok(!fs.existsSync(p.original+'.antes-correcao-impressao'));}
 for(const p of pairs)fs.renameSync(p.original,p.original+'.antes-correcao-impressao');
 console.log('Real AI test profile preserved; final clean-open validation can run.');
}else if(process.argv.includes('--resume-print-test')){
 for(const p of pairs){assert.ok(fs.existsSync(p.held));assert.ok(fs.existsSync(p.original+'.antes-correcao-impressao'));assert.ok(fs.existsSync(p.original));assert.ok(!fs.existsSync(p.original+'.abertura-limpa-final'));}
 for(const p of pairs){fs.renameSync(p.original,p.original+'.abertura-limpa-final');fs.renameSync(p.original+'.antes-correcao-impressao',p.original);}
 console.log('Validated empty profile preserved; real AI lesson restored for final installed checks.');
}else if(process.argv.includes('--restore')){
 for(const p of pairs){assert.ok(fs.existsSync(p.held));assert.ok(!fs.existsSync(p.test));}
 for(const p of pairs){if(fs.existsSync(p.original))fs.renameSync(p.original,p.test);fs.renameSync(p.held,p.original);}
 const before=JSON.parse(fs.readFileSync(path.join(out,'preservation-before.json'))),after=snapshot();
 const changes=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(p=>before[p]!==after[p]);
 const report={passed:changes.length===0,protectedFiles:Object.keys(before).length,changes,pairs,preservedPreviousProgram:fs.existsSync(preservedProgram)?preservedProgram:null,at:new Date().toISOString()};
 fs.writeFileSync(path.join(out,'preservation-after.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(changes.length,0);
}else throw Error('Use --prepare or --restore; close the application first.');
