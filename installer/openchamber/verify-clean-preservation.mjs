import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {stage} from './release.mjs';
const evidence=path.join(stage,'evidencias');
const manifest=path.join(evidence,'owner-files-before.json');
const roots=[path.join(process.env.LOCALAPPDATA,'PEMARAOpenChamber'),path.join(process.env.PEMARA_OWNER_DOCUMENTS||path.join(process.env.USERPROFILE,'Documents'),'PEMARA Aulas'),path.join(process.env.LOCALAPPDATA,'Programs/PEMARA OpenChamber')];
function snapshot(){
 const files={};
 function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  assert.ok(!entry.isSymbolicLink(),'Unexpected link in protected tree: '+file);
  if(entry.isDirectory())visit(file);else files[file]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 }}
 for(const root of roots)if(fs.existsSync(root))visit(root);
 return files;
}
fs.mkdirSync(evidence,{recursive:true});
if(process.argv.includes('--before')){
 const files=snapshot();fs.writeFileSync(manifest,JSON.stringify(files,null,2),{flag:'wx'});
 console.log(JSON.stringify({protectedFiles:Object.keys(files).length,roots}));
}else{
 const before=JSON.parse(fs.readFileSync(manifest,'utf8')),after=snapshot();
 const changes=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(file=>before[file]!==after[file]);
 const report={passed:changes.length===0,protectedFiles:Object.keys(before).length,changes,checkedAt:new Date().toISOString()};
 fs.writeFileSync(path.join(evidence,'owner-preservation.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,protectedFiles:report.protectedFiles,changedFiles:changes.length}));
 assert.equal(changes.length,0,'Existing owner data or installation changed');
}
