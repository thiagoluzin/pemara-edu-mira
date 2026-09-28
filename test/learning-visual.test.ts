import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import vm from 'node:vm';
import {readCompleteCatalog,makePayload} from '../server/curriculum/completeCatalog';
import {LessonComposer} from '../src/composer/lessonComposer';
import {PemaraRenderer} from '../src/renderer/PemaraRenderer';
import {createLearningPlan,isLearningScene,learningDiagram} from '../src/engine/learningVisual';
import {generateStandaloneHtml,renderAllScenesForPrint} from '../src/components/ExportModal';
import {validateLessonSpec} from '../src/schemas/lessonValidator';
import type {TextScene} from '../src/types/lesson';

test('Todos os 162 temas: explicações, exemplos, atividades e sínteses têm figura e exploração, inclusive páginas finais',()=>{
  const subjects=new Set<string>();let count=0,late=0;
  for(const pack of readCompleteCatalog()){
    const lesson=LessonComposer.compose({discipline:pack.subjectCode,grade:`${pack.gradeLevel}EF`,topic:pack.title,duration:45,teaching_method:'complete'},makePayload(pack,'1.0.0'));
    subjects.add(pack.subjectCode);
    lesson.scenes.forEach((scene,index)=>{
      if(!isLearningScene(scene))return;
      count++;if(index>=7)late++;
      const plan=createLearningPlan(scene,lesson.lesson);
      const html=renderToStaticMarkup(React.createElement(PemaraRenderer,{scene,lesson:lesson.lesson}));
      assert.ok(html.includes('learning-canvas')&&html.includes('<svg'),`${pack.slug} página ${index+1}`);
      assert.ok(html.includes('Consultar conteúdo completo da página'));
      assert.ok(plan.steps.every(s=>s.trim().length>0));
      for(const original of scene.type==='text'?scene.content:scene.takeaways)assert.ok(plan.source.includes(original),`Conteúdo perdido: ${pack.slug}`);
      const frame=learningDiagram(plan,plan.steps.length-1,Math.max(0,plan.variants.length-1));
      assert.ok(!frame.includes('NaN')&&!frame.includes('undefined'));
    });
  }
  assert.equal(subjects.size,9);assert.ok(count>1500);assert.ok(late>700);
});

test('Exportação dos nove componentes preserva exploração, figuras e registros; scripts compilam',()=>{
  const seen=new Set<string>();
  for(const pack of readCompleteCatalog()){
    if(seen.has(pack.subjectCode))continue;seen.add(pack.subjectCode);
    const lesson=LessonComposer.compose({discipline:pack.subjectCode,grade:`${pack.gradeLevel}EF`,topic:pack.title,duration:45,teaching_method:'complete'},makePayload(pack,'1.0.0'));
    const activity=lesson.scenes.find(s=>s.type==='text'&&s.title.startsWith('Atividade:'))!;
    activity.learning_progress={completed:[0],notes:'Conclusão registrada pela turma.'};
    assert.equal(validateLessonSpec(lesson).isValid,true);
    const html=generateStandaloneHtml(lesson);
    for(const [,script]of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script);
    assert.ok(html.includes('renderLearningScene(scene, el)'));
    const print=renderAllScenesForPrint(lesson);
    assert.ok(print.includes('Conclusão registrada pela turma.')&&print.includes('<svg'));
    activity.learning_progress={completed:[-1],notes:''};
    assert.equal(validateLessonSpec(lesson).isValid,false);
  }
  assert.equal(seen.size,9);
});

test('Modelos obedecem disciplina e representam frações sem arredondamento como igualdade falsa',()=>{
  const scene:TextScene={id:'fractions',type:'text',title:'Exemplo: frações',content:['Compare 1/3 e 1/2.']};
  const math=createLearningPlan(scene,{subject:'math'});
  assert.equal(math.kind,'fractions');assert.equal(math.denominator,3);
  assert.ok(learningDiagram(math,0,1).includes('1/3 ≈ 0,333'));
  assert.equal(createLearningPlan(scene,{subject:'history'}).kind,'concepts');
  const activity=createLearningPlan({...scene,title:'Atividade: frações'},{subject:'math'});
  assert.equal(activity.mode,'activity');
  const attack=createLearningPlan({...scene,content:['<img src=x onerror=alert(1)>']},{subject:'history'});
  assert.ok(!learningDiagram(attack,0,0).includes('<img'));
});
