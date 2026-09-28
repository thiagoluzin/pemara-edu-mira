import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {movePresentation,sceneStepCount} from '../src/engine/presentationNavigation';
import {readCompleteCatalog,makePayload} from '../server/curriculum/completeCatalog';
import {LessonComposer} from '../src/composer/lessonComposer';
import {PemaraRenderer} from '../src/renderer/PemaraRenderer';

test('Setas percorrem todas as etapas e voltam sem pular fronteiras',()=>{
 const counts=[1,4,2,1];let cursor={page:0,step:0};
 const visited=[cursor];for(let i=0;i<7;i++){cursor=movePresentation(counts,cursor,1);visited.push(cursor);}
 assert.deepEqual(visited,[{page:0,step:0},{page:1,step:0},{page:1,step:1},{page:1,step:2},{page:1,step:3},{page:2,step:0},{page:2,step:1},{page:3,step:0}]);
 assert.deepEqual(movePresentation(counts,cursor,1),cursor);
 for(const expected of visited.slice(0,-1).reverse()){cursor=movePresentation(counts,cursor,-1);assert.deepEqual(cursor,expected);}
 assert.deepEqual(movePresentation(counts,cursor,-1),cursor);
});
test('Todas as aulas do acervo expõem cada etapa ao controle de apresentação',()=>{
 let checked=0;
 for(const pack of readCompleteCatalog()){
  const lesson=LessonComposer.compose({discipline:pack.subjectCode,grade:`${pack.gradeLevel}EF`,topic:pack.title,duration:45,teaching_method:'complete'},makePayload(pack,'1.0.0'));
  for(const scene of lesson.scenes){
   const count=sceneStepCount(scene,lesson.lesson);
   assert.ok(count>=1);
   if(count<=1)continue;
   for(let step=0;step<count;step++){
    const html=renderToStaticMarkup(React.createElement(PemaraRenderer,{scene,lesson:lesson.lesson,presentationStep:{value:step,onChange:()=>{}}}));
    assert.ok(html.includes('aria-pressed="true"'),pack.slug+' '+scene.id+' '+step);
    if(scene.type==='text'||scene.type==='summary')assert.ok(html.includes(` ${step+1}/${count}</h3>`));
   }
   checked++;
  }
 }
 assert.ok(checked>0); console.log(`Cenas com múltiplas etapas verificadas: ${checked}`);
});

