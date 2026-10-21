import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {stage} from './release.mjs';
export function checkCleanPackage(resources,expectedEdition='clean-test'){
 assert.ok(['clean-test','existing-profile'].includes(expectedEdition),'Unknown distribution identity');
 const problems=[],files=[];
 const forbidden=/^(?:opencode\.db(?:-wal|-shm)?|PG_VERSION|import-once\.json|import-completed\.json|running\.json|\.env|typesafe\.env|auth\.json|id_rsa|id_ed25519)$/i;
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name),rel=path.relative(resources,full).replaceAll('\\','/');
  if(forbidden.test(entry.name))problems.push(rel);
  if(/(?:^|\/)(?:\.local-teacher|ai-jobs|perfil|cloud-cli-profile|probe-profile)(?:\/|$)/i.test(rel))problems.push(rel);
  if(entry.isDirectory())walk(full);else files.push(rel);
 }}
 walk(resources);
 assert.deepEqual(problems,[],'Personal state or credentials in installer resources');
 assert.ok(!fs.existsSync(path.join(resources,'pemara/exemplo')),'Example lessons in release');
 assert.equal(JSON.parse(fs.readFileSync(path.join(resources,'pemara/distribution.json'),'utf8')).edition,expectedEdition);
 const originals=['server.ts','src/App.tsx','server/db/seeds/knowledge.ts','server/repositories/lessonRepository.ts','src/engine/exportFilename.ts','src/engine/saveExport.ts','src/engine/teacherDocx.ts','src/components/ExportModal.tsx','src/education/teachingAgents.ts','server/ai/teacherReview.ts','server/ai/openCodeJobs.ts','src/components/PedagogicalReviewPanel.tsx'];
 originals.push('src/schemas/lessonValidator.ts','src/services/lessonsApi.ts','src/components/ConflictModal.tsx','src/components/LessonEditor.tsx','src/components/LessonAuthoringDialog.tsx','src/education/teacherAuthoring.ts','src/education/deterministicLessonEdit.ts','src/education/lessonContext.ts','src/catalog/bnccLabels.ts','src/catalog/bnccLabels.json','src/catalog/pilotCatalog.ts','src/catalog/curriculumCatalog.ts','src/knowledge/packs/history6Greece.ts','src/knowledge/studio/store.ts','src/composer/lessonComposer.ts','src/templates/deterministicTemplates.ts','src/types/lesson.ts','src/maestro/pemaraMaestro.ts','server/ai/visualLesson.ts');
 // Verify the complete application source tree, including CSS build inputs.
 function sources(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())sources(file);else originals.push(file);
 }}
 sources('src');sources('server');
 const hashes=[...new Set(originals.map(file=>file.replaceAll('\\','/')))].map(file=>{
  const original=fs.readFileSync(path.resolve(file)),packed=fs.readFileSync(path.join(resources,'education',file));
  assert.ok(original.equals(packed),'Stale source in package: '+file);
  return{file,sha256:crypto.createHash('sha256').update(packed).digest('hex')};
 });
 return{passed:true,resourceFiles:files.length,sourceHashes:hashes,checkedAt:new Date().toISOString()};
}
