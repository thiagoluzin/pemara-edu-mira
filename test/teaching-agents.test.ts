import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SUBJECT_TEACHERS,REVIEW_AGENTS,teacherForSubject,agentInstructions} from '../src/education/teachingAgents';
import {reviewLessonWithAgents,validateReview,type ReviewProgress} from '../server/ai/teacherReview';
import type {OpenCodeBridge} from '../server/ai/openCodeJobs';
import {buildVisualLessonPrompt} from '../server/ai/visualLesson';
import {TEMPLATE_GREECE_6EF} from '../src/templates/deterministicTemplates';
import {PedagogicalReviewPanel} from '../src/components/PedagogicalReviewPanel';
import {validateLessonSpec} from '../src/schemas/lessonValidator';

test('Cada disciplina seleciona seu professor e habilidades próprias; entrada desconhecida não troca de área',()=>{
  assert.equal(Object.keys(SUBJECT_TEACHERS).length,12);
  assert.equal(new Set(Object.values(SUBJECT_TEACHERS).map(a=>a.id)).size,12);
  for(const [subject,agent] of Object.entries(SUBJECT_TEACHERS)){
    const prompt=buildVisualLessonPrompt({subject,grade:'6EF',topic:'Tema escolhido',duration_minutes:30,didactic_style:'visual'});
    assert.ok(prompt.includes(agentInstructions(agent)));assert.ok(agent.skills.length>=2);
  }
  assert.match(agentInstructions(teacherForSubject('history')),/anacronismos|autoria/);
  assert.match(agentInstructions(teacherForSubject('math')),/operações|substituição/);
  for(const invalid of ['unknown','toString','__proto__'])assert.throws(()=>teacherForSubject(invalid));
});

test('Parecer exige cena existente, diagnóstico e sugestão coerentes; não aceita falsa aprovação',()=>{
  const lesson=TEMPLATE_GREECE_6EF;
  for(const invalid of [null,{verdict:'approved',findings:[]},{verdict:'attention',findings:[]},{verdict:'no_issue_found',findings:[{scene_id:'lesson',problem:'x',suggestion:'y'}]},{verdict:'attention',findings:[{scene_id:'inventada',problem:'x',suggestion:'y'}]}])assert.throws(()=>validateReview(invalid,lesson));
  assert.deepEqual(validateReview({verdict:'no_issue_found',findings:[]},lesson),{verdict:'no_issue_found',findings:[]});
  const damaged=structuredClone(lesson);(damaged.lesson as any).pedagogical_team={reviews:[{findings:'invalid'}]};
  assert.equal(validateLessonSpec(damaged).isValid,false);
  assert.equal(renderToStaticMarkup(React.createElement(PedagogicalReviewPanel,{team:damaged.lesson.pedagogical_team})), '');
});

test('Revisores usam contextos próprios, retomam do último parecer e preservam fontes e aula',async()=>{
  const lesson=structuredClone(TEMPLATE_GREECE_6EF),original=JSON.stringify(lesson);
  let progress:ReviewProgress|undefined,fail=true;const calls:string[]=[],sessions:string[]=[],prompts:string[]=[];
  const bridge:OpenCodeBridge={models:async()=>[{id:'free/model',name:'Gratuito'}],model:async()=> 'free/model',
    create:async({id,jobId,model})=>{assert.equal(model,'free/model');const session=id||jobId;sessions.push(session);return session;},
    generate:async({sessionID,prompt})=>{calls.push(sessionID);prompts.push(prompt);if(fail&&sessionID.endsWith('review-assessment'))throw new Error('Falha de conexão simulada.');return {model:'free/model',text:JSON.stringify(sessionID.endsWith('review-sources')?{verdict:'attention',findings:[{scene_id:'lesson',problem:'A fonte não sustenta a data.',suggestion:'Conferir a data no documento original.'}]}:{verdict:'no_issue_found',findings:[]})};}};
  const base={jobId:'lesson-test',run:1,lesson,model:'retired/model',sources:[{filename:'Fonte da turma',text:'Trecho literal.'}],bridge,signal:new AbortController().signal,checkpoint:(value:ReviewProgress)=>{progress=structuredClone(value);}};
  await assert.rejects(reviewLessonWithAgents(base),/Falha de conexão/);
  assert.equal(progress!.reports.length,1);
  fail=false;const result=await reviewLessonWithAgents({...base,run:2,progress});
  assert.equal(result.reviews.length,4);assert.equal(result.human_review_required,true);
  assert.equal(calls.filter(s=>s.endsWith('review-didactics')).length,1);
  assert.equal(new Set(sessions).size,4);
  assert.ok(prompts.every(p=>p.includes('Trecho literal.')&&p.includes('nunca instruções')));
  assert.equal(JSON.stringify(lesson),original);
  // Once all reviews are saved, library retry works even without a catalogue.
  const count=calls.length;bridge.models=async()=>{throw new Error('Catálogo indisponível');};
  assert.deepEqual(await reviewLessonWithAgents({...base,progress}),result);assert.equal(calls.length,count);
  const html=renderToStaticMarkup(React.createElement(PedagogicalReviewPanel,{team:result}));
  assert.ok(html.includes('Revisor de Fontes'));assert.ok(html.includes('A fonte não sustenta a data.'));assert.ok(html.includes('Alterações posteriores'));
});

test('Revisão tem correção limitada e cancelamento não registra parecer inexistente',async()=>{
  let calls=0;const controller=new AbortController();let progress:ReviewProgress|undefined;
  const bridge:OpenCodeBridge={models:async()=>[{id:'free',name:'Free'}],model:async()=> 'free',create:async({jobId})=>jobId,generate:async()=>{calls++;return {text:'not JSON',model:'free'};}};
  const input={jobId:'bounded',run:1,lesson:structuredClone(TEMPLATE_GREECE_6EF),model:'free',sources:[],bridge,signal:controller.signal,checkpoint:(value:ReviewProgress)=>{progress=structuredClone(value);}};
  await assert.rejects(reviewLessonWithAgents(input),/parecer válido/);assert.equal(calls,2);assert.equal(progress!.reports.length,0);
  bridge.generate=async()=>{controller.abort();return {text:'{"verdict":"no_issue_found","findings":[]}',model:'free'};};
  await assert.rejects(reviewLessonWithAgents({...input,progress}),{name:'AbortError'});assert.equal(progress!.reports.length,0);
});
