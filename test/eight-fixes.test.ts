import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {inflateRawSync} from 'node:zlib';
import {TEMPLATE_SOLAR_SYSTEM,TEMPLATE_PROJECTILE_MOTION} from '../src/templates/deterministicTemplates';
import {validateLessonSpec} from '../src/schemas/lessonValidator';
import {visualLessonIssues} from '../server/ai/visualLesson';
import {generateTeacherDocx} from '../src/engine/teacherDocx';
import {PemaraMaestro} from '../src/maestro/pemaraMaestro';
import {prepareTeacherEdit,type AuthoringInput} from '../src/education/teacherAuthoring';
import {lessonsApi} from '../src/services/lessonsApi';
import {ConflictModal} from '../src/components/ConflictModal';
import {readCompleteCatalog,makePayload} from '../server/curriculum/completeCatalog';
import {LessonComposer} from '../src/composer/lessonComposer';
import {generateStandaloneHtml,generatePrintDocumentHtml,renderLessonContext} from '../src/components/ExportModal';
import {getOfficialBnccSkills} from '../scripts/compilar-acervo-bncc';
import {CURRICULUM_CATALOG} from '../src/catalog/curriculumCatalog';
import {PILOT_DEMOS} from '../src/catalog/pilotCatalog';
import {CONTENT_PACK_GRECIA_ANTIGA} from '../src/knowledge/packs/history6Greece';

function documentXml(bytes:Uint8Array):string {
  const b=Buffer.from(bytes);
  for(let i=0;i<b.length-46;i++)if(b.readUInt32LE(i)===0x02014b50){
    const length=b.readUInt16LE(i+28),name=b.subarray(i+46,i+46+length).toString();
    if(name==='word/document.xml'){
      const offset=b.readUInt32LE(i+42),start=offset+30+b.readUInt16LE(offset+26)+b.readUInt16LE(offset+28);
      const data=b.subarray(start,start+b.readUInt32LE(i+20));
      return (b.readUInt16LE(i+10)===8?inflateRawSync(data):data).toString();
    }
  }
  throw Error('Documento OOXML ausente');
}
test('E1: legado sem objetivos exporta Word com aviso e sem modificar o documento; novas gerações exigem objetivos',async()=>{
  const originalParser=globalThis.DOMParser;
  (globalThis as any).DOMParser=class{parseFromString(){return {querySelectorAll(){return [];}};}};
  try{
    for(const objectives of [undefined,[]]){
      const lesson=structuredClone(TEMPLATE_SOLAR_SYSTEM);lesson.objectives=objectives as any;
      const before=JSON.stringify(lesson);assert.equal(validateLessonSpec(lesson).isValid,true);
      assert.ok(visualLessonIssues(lesson,45,'visual').some(s=>s.includes('objetivos')));
      const xml=documentXml(await generateTeacherDocx(lesson,'<html></html>'));
      assert.match(xml,/Objetivos não informados/);assert.equal(JSON.stringify(lesson),before);
    }
    for(const objectives of [null,'objetivo',{},[7]]){
      const lesson={...TEMPLATE_SOLAR_SYSTEM,objectives} as any;
      assert.equal(validateLessonSpec(lesson).isValid,false);
      await assert.rejects(generateTeacherDocx(lesson,''),/objetivos.*lista/i);
    }
  }finally{globalThis.DOMParser=originalParser;}
});
test('E2: pedidos desconhecidos, negativos e sem mudança preservam todo o documento',()=>{
  const lesson=structuredClone(TEMPLATE_SOLAR_SYSTEM),before=JSON.stringify(lesson);
  for(const command of ['Traduza toda a aula','Não adicione uma pergunta','Troque o título para '+lesson.lesson.title]){
    const result=PemaraMaestro.editLessonByInstruction(lesson,command);
    assert.ok(['unsupported','no_change'].includes(result.status));assert.equal(result.updatedLesson,lesson);assert.deepEqual(result.affectedScenes,[]);
  }
  assert.equal(JSON.stringify(lesson),before);
  const title=PemaraMaestro.editLessonByInstruction(lesson,'Troque o título para Explorando o espaço');
  assert.equal(title.status,'applied');assert.equal(title.updatedLesson.lesson.title,'Explorando o espaço');assert.equal(JSON.stringify(lesson),before);
  const physical=PemaraMaestro.editLessonByInstruction(TEMPLATE_PROJECTILE_MOTION,'Gravidade da Lua');
  assert.equal(physical.status,'applied');
  assert.equal((physical.updatedLesson.scenes.find(s=>s.type==='physics_projectile') as any).params.gravity,1.62);
  assert.equal(PemaraMaestro.editLessonByInstruction(TEMPLATE_PROJECTILE_MOTION,'Ângulo 500 graus').status,'unsupported');
});
test('P1/E2: frações, gramática, ecologia e história abrem autoria sem inserir questões ou exemplos prontos',()=>{
  for(const [subject,title] of [['math','Frações equivalentes'],['portuguese','Concordância'],['science','Ecologia'],['history','Colonização']]){
    const lesson=structuredClone(TEMPLATE_SOLAR_SYSTEM);lesson.lesson.subject=subject as any;lesson.lesson.title=title;
    const before=JSON.stringify(lesson);
    for(const instruction of ['Adicione um questionário','Adicione um exemplo','Deixe os textos mais simples e didáticos']){
      const result=PemaraMaestro.editLessonByInstruction(lesson,instruction);assert.equal(result.status,'needs_authoring');assert.equal(result.updatedLesson,lesson);
    }
    assert.equal(JSON.stringify(lesson),before);
  }
});
function authoring():AuthoringInput {return {kind:'quiz',sourceSceneId:TEMPLATE_SOLAR_SYSTEM.scenes[1].id,objective:'Diferenciar rotação e translação',title:'Movimentos terrestres',question:'Qual movimento explica a alternância de dias e noites?',answers:['Translação','Rotação','Precessão'],correctIndex:1,explanation:'Rotação alterna a face iluminada. Translação é o percurso orbital; precessão é a mudança lenta da orientação do eixo.',content:['Exemplo escrito pelo professor.'],callout:''};}
test('P1: autoria exige gabarito escolhido e alternativas distintas; prévia conserva a aula original',()=>{
  const before=JSON.stringify(TEMPLATE_SOLAR_SYSTEM),input=authoring();
  assert.throws(()=>prepareTeacherEdit(TEMPLATE_SOLAR_SYSTEM,{...input,correctIndex:-1}),/correta/);
  assert.throws(()=>prepareTeacherEdit(TEMPLATE_SOLAR_SYSTEM,{...input,answers:['Igual','igual']}),/distintas/);
  assert.throws(()=>prepareTeacherEdit(TEMPLATE_SOLAR_SYSTEM,{...input,explanation:''}),/justificativa/);
  const result=prepareTeacherEdit(TEMPLATE_SOLAR_SYSTEM,input),quiz=result.scenes.at(-1)!;
  assert.equal(quiz.type,'quiz');if(quiz.type==='quiz')assert.equal(quiz.correct_index,1);
  assert.match(quiz.teacher_notes!,/Objetivo: Diferenciar/);assert.equal(JSON.stringify(TEMPLATE_SOLAR_SYSTEM),before);
  const example=prepareTeacherEdit(TEMPLATE_SOLAR_SYSTEM,{...input,kind:'example'});
  assert.equal(example.scenes.at(-1)?.type,'text');assert.equal(JSON.stringify(TEMPLATE_SOLAR_SYSTEM),before);
});
test('E2: revisão docente preserva observação, notas e demais páginas; revisão sem diferença não cria versão',()=>{
  const lesson=structuredClone(TEMPLATE_SOLAR_SYSTEM),source=lesson.scenes.find(s=>s.type==='text')!;
  if(source.type!=='text')throw Error('Fixture');
  const input={...authoring(),kind:'revise' as const,sourceSceneId:source.id,content:[...source.content],callout:source.callout||''};
  assert.throws(()=>prepareTeacherEdit(lesson,input),/Nenhuma alteração/);
  const changed=prepareTeacherEdit(lesson,{...input,content:input.content.map((p,i)=>i?'Explicação revisada pelo professor.':p)});
  const revised=changed.scenes.find(s=>s.id===source.id)!;assert.equal(revised.teacher_notes,source.teacher_notes);
  if(revised.type==='text')assert.equal(revised.callout,source.callout);
  assert.deepEqual(changed.scenes.filter(s=>s.id!==source.id),lesson.scenes.filter(s=>s.id!==source.id));
});
test('E3: autosave transmite ambas as versões até o diálogo de conflito',async()=>{
  const realFetch=globalThis.fetch;lessonsApi.clearSessionCache();
  try{
    globalThis.fetch=async()=>new Response(JSON.stringify({error:'Conflito',code:'DRAFT_CONFLICT',currentVersion:4,expectedVersion:3,serverDraft:{updated_at:'2026-10-19T10:00:00Z'}}),{status:409});
    await assert.rejects(lessonsApi.saveDraft('test',TEMPLATE_SOLAR_SYSTEM,3),(e:any)=>{
      assert.equal(e.currentVersion,4);assert.equal(e.expectedVersion,3);
      const html=renderToStaticMarkup(React.createElement(ConflictModal,{isOpen:true,actualVersion:e.currentVersion,expectedVersion:e.expectedVersion,serverDraft:e.serverDraft,onReloadServer(){},onExportLocalBackup(){},onClose(){}}));
      assert.match(html,/v4/);assert.match(html,/v3/);assert.doesNotMatch(html,/v\?/);return true;
    });
  }finally{globalThis.fetch=realFetch;lessonsApi.clearSessionCache();}
});
test('P2: descritores EF do piloto e catálogo são transcrições da base oficial',()=>{
  const official=new Map(getOfficialBnccSkills().map(s=>[s.code,s.description]));
  for(const label of [...Object.values(PILOT_DEMOS).map(p=>p.bnccSkill),...CURRICULUM_CATALOG.map(p=>p.bnccSkill),CONTENT_PACK_GRECIA_ANTIGA.bncc_skill]){
    const code=label.split(':')[0];if(!code.startsWith('EF'))continue;
    assert.equal(label,`${code}: ${official.get(code)}`,code);
  }
  assert.match(PILOT_DEMOS.solar_system_6ef.bnccSkill,/gnômon/);assert.doesNotMatch(PILOT_DEMOS.solar_system_6ef.bnccSkill,/ozônio/);
});
test('P3: gabarito distingue perpendicular e plano orbital; calendário explicita as exceções',()=>{
  const quiz=TEMPLATE_SOLAR_SYSTEM.scenes.find(s=>s.type==='quiz')!;
  if(quiz.type!=='quiz')throw Error('Fixture');
  assert.match(quiz.answers[quiz.correct_index],/23,5.*perpendicular/);assert.match(quiz.explanation,/66,5.*próprio plano/);
  const text=TEMPLATE_SOLAR_SYSTEM.scenes.find(s=>s.type==='text')!;
  if(text.type!=='text')throw Error('Fixture');assert.match(text.callout!,/100.*400/);assert.match(text.callout!,/2100 não/);
});
test('P4: todos os 162 pacotes preservam referências e pré-requisitos na composição',()=>{
  const packs=readCompleteCatalog();assert.equal(packs.length,162);
  for(const pack of packs){
    const payload=makePayload(pack),before=JSON.stringify(payload);
    const lesson=LessonComposer.compose({discipline:pack.subjectCode,grade:pack.gradeLevel,topic:pack.slug,duration:45,teaching_method:'visual'},payload);
    assert.deepEqual(lesson.prerequisites,pack.prerequisites,pack.slug);
    for(const ref of pack.references)assert.ok(lesson.references?.some(r=>r.url===ref.url),pack.slug+' '+ref.url);
    assert.equal(validateLessonSpec(lesson).isValid,true,pack.slug);assert.equal(JSON.stringify(payload),before);
    assert.ok(lesson.scenes.filter(s=>s.source_citation).every(s=>!/^EF\d/.test(s.source_citation!)));
  }
});
test('P4: HTML, impressão e OOXML mantêm URLs, localizador e pré-requisito, com escaping',async()=>{
  const lesson=structuredClone(TEMPLATE_SOLAR_SYSTEM);lesson.prerequisites=['Leitura de parágrafos'];lesson.references=[{title:'Referência <segura>',url:'https://example.invalid/fonte',kind:'content',locator:'Página 2',license:'Consulta'}];
  for(const html of [generateStandaloneHtml(lesson),generatePrintDocumentHtml(lesson)]){
    assert.match(html,/Leitura de parágrafos/);assert.match(html,/https:\/\/example.invalid\/fonte/);assert.match(html,/Página 2/);assert.doesNotMatch(html,/Referência <segura>/);
  }
  assert.doesNotMatch(renderLessonContext({...lesson,references:[{title:'Link',url:'javascript:alert(1)'}]}),/href=/);
  const original=globalThis.DOMParser;(globalThis as any).DOMParser=class{parseFromString(){return {querySelectorAll(){return [];}};}};
  try{const xml=documentXml(await generateTeacherDocx(lesson,''));assert.match(xml,/Leitura de parágrafos/);assert.match(xml,/https:\/\/example.invalid\/fonte/);assert.match(xml,/Página 2/);}finally{globalThis.DOMParser=original;}
});
