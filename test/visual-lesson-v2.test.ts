import {test} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import vm from 'node:vm';
import {TeachingVisual,VISUAL_LAYOUTS,teachingDiagram,validateTeachingVisual} from '../src/engine/teachingVisual';
import {createLearningPlan,learningDiagram} from '../src/engine/learningVisual';
import {PemaraRenderer} from '../src/renderer/PemaraRenderer';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import {validateLessonSpec} from '../src/schemas/lessonValidator';
import {visualLessonIssues,buildVisualLessonPrompt} from '../server/ai/visualLesson';
import {TEMPLATE_GREECE_6EF} from '../src/templates/deterministicTemplates';
import type {TextScene} from '../src/types/lesson';
import {ATLAS} from '../src/animations/atlas';
const scene:TextScene={id:'chain',type:'text',title:'A cadeia produtiva',content:['A indústria transforma materiais.','Os transportes conectam etapas.','O trabalho é realizado por pessoas.'],visual:{layout:'flow',caption:'Etapas do exemplo; não representa participação de países.',nodes:[{id:'f',label:'Fábrica',icon:'factory',step:0},{id:'t',label:'Transportes',icon:'ship',step:1},{id:'p',label:'Trabalhadores',icon:'people',step:2}],links:[{from:'f',to:'t',label:'distribuição'}]}};
test('Visual explícito acompanha o conteúdo, é seguro e destaca cada etapa no app e no exportado',()=>{
 const lesson=structuredClone(TEMPLATE_GREECE_6EF);lesson.scenes=[scene];lesson.lesson.subject='geography';
 assert.equal(validateLessonSpec(lesson).isValid,true);
 const plan=createLearningPlan(scene,lesson.lesson);assert.deepEqual(plan.steps,scene.content);
 for(const layout of VISUAL_LAYOUTS){const visual={...scene.visual!,layout};assert.deepEqual(validateTeachingVisual(visual,3),[]);const svg=teachingDiagram(visual,1);assert.ok(svg.includes('Transportes'));assert.ok(svg.includes('semantic-highlight'));assert.ok(!svg.includes('<ellipse'));}
 const html=renderToStaticMarkup(React.createElement(PemaraRenderer,{scene,lesson:lesson.lesson,presentationStep:{value:1,onChange:()=>{}}}));assert.ok(html.includes('Os transportes conectam etapas.'));
 const exported=generateStandaloneHtml(lesson);assert.ok(exported.includes('Fábrica'));for(const [,js]of exported.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(js);
 const unsafe={...scene.visual!,nodes:scene.visual!.nodes.map(n=>({...n,label:'<script>alert(1)</script>'}))};assert.ok(!teachingDiagram(unsafe,0).includes('<script>'));
});
test('Contrato rejeita referências inventadas e a aula pobre original não passa na nova qualidade',()=>{
 assert.ok(validateTeachingVisual({...scene.visual,nodes:[{id:'x',label:'x',icon:'unknown',step:9},{id:'y',label:'y',icon:'people',step:0}],links:[{from:'x',to:'missing'}]},3).length>=3);
 const short=structuredClone(TEMPLATE_GREECE_6EF);short.scenes=short.scenes.slice(0,3);assert.ok(visualLessonIssues(short,45,'visual').length>0);
 const prompt=buildVisualLessonPrompt({subject:'geography',grade:'8EF',topic:'Globalização',duration_minutes:45,didactic_style:'visual'});assert.ok(prompt.includes('12 cenas'));assert.ok(prompt.includes('3 composições distintas'));assert.ok(prompt.includes('hierarchy'));assert.ok(prompt.includes('teacher_notes'));
});
test('Legado não ganha relações falsas nem globo decorativo e título global não impõe célula a toda aula',()=>{
 const plan=createLearningPlan({...scene,visual:undefined},{subject:'geography',title:'Globalização'});const svg=learningDiagram(plan,0,0);assert.ok(!svg.includes('<ellipse'));assert.ok(svg.includes('Quadro de ideias'));
 const generic=createLearningPlan({id:'reading',type:'text',title:'Como pesquisar',content:['Compare os argumentos e registre suas observações.']},{subject:'science',title:'Células e organismos'});assert.equal(generic.kind,'concepts');
});

test('Every explicit Atlas model remains interactive beside AI visual metadata, without losing explanations',()=>{
 for(const model of ATLAS){const plan=createLearningPlan({...scene,atlas_model:model.id},{subject:model.subjects[0]});assert.equal(plan.kind,model.id);assert.equal(plan.visual,undefined);assert.deepEqual(plan.steps,scene.content);assert.deepEqual(plan.variants,[...model.variants]);}
 const incompatible=createLearningPlan({...scene,atlas_model:'separation'},{subject:'history'});assert.equal(incompatible.visual,scene.visual);
});

test('DeepSeek recebe formato JSON e orçamento para a aula completa; timeout tem diagnóstico próprio',async()=>{
 const {generateText}=await import('../server/ai/providers');
 const env={DEEPSEEK_MODEL:'deepseek-flash',DEEPSEEK_API_KEY:'test',AI_JSON_OUTPUT:'true'};
 await generateText('JSON da aula','deepseek',env,async(_url,init)=>{const body=JSON.parse(init!.body as string);assert.deepEqual(body.response_format,{type:'json_object'});assert.equal(body.max_tokens,12000);return Response.json({choices:[{message:{content:'{}'}}]});});
 await assert.rejects(generateText('aula','deepseek',env,async()=>{throw new DOMException('timeout','TimeoutError');}),/tempo limite/);
});

test('Pares de rótulo/explicação originam as etapas sem reordenar nem perder conteúdo',async()=>{
 const {normalizeGeneratedVisuals}=await import('../server/ai/visualLesson');
 const raw={scenes:[{id:'p',type:'text',visual:{nodes:[{label:'Fábrica',explanation:'A indústria transforma recursos.'},{label:'Transportes',explanation:'Os navios transportam mercadorias.'}]}}]};
 const result=normalizeGeneratedVisuals(raw);
 assert.deepEqual(result.scenes[0].content,['A indústria transforma recursos.','Os navios transportam mercadorias.']);
 assert.deepEqual(result.scenes[0].visual.nodes.map((n:any)=>n.step),[0,1]);assert.equal((raw.scenes[0] as any).content,undefined);
 assert.throws(()=>normalizeGeneratedVisuals({scenes:[{...raw.scenes[0],content:['Texto diferente']}]}),/difere/);
});
