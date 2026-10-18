import test from 'node:test';
import assert from 'node:assert/strict';
import {functionModel,functionSvg} from '../src/engine/functionModel';
import {animationCases} from './fixtures/animation-cases';
import {createLearningPlan,learningDiagram} from '../src/engine/learningVisual';
import {hasLearningMotion} from '../src/engine/learningMotion';
import {ATLAS} from '../src/animations/atlas';
test('Toda variante do Atlas e dos modelos-base tem movimento ou guia explícito',()=>{
 for(const item of animationCases.filter(c=>c.family==='atlas'||c.family==='base')){
  const p=createLearningPlan(item.spec.scenes[0] as any,item.spec.lesson);
  for(let v=0;v<Math.max(1,p.variants.length);v++)for(let s=0;s<p.steps.length;s++)assert.ok(hasLearningMotion(learningDiagram(p,s,v)),item.id+' / '+v+' / '+s);
 }
 assert.equal(ATLAS.length,26);
});
test('Funções: reta não vira parábola; seno respeita radianos; degenerados não ganham vértices falsos',()=>{
 const line=functionModel({function_type:'linear',a:99,b:2,c:4});assert.deepEqual(line.roots,[-2]);assert.equal(line.vertex,null);assert.ok(!line.formula.includes('²'));
 const parabola=functionModel({function_type:'parabola',a:1,b:-2,c:-3});assert.deepEqual(parabola.roots,[-1,3]);assert.deepEqual(parabola.vertex,{x:1,y:-4});
 const zero=functionModel({function_type:'parabola',a:0,b:0,c:0});assert.match(zero.analysis,/todo x é raiz/);assert.equal(zero.vertex,null);
 const sine=functionModel({function_type:'sine',a:2,b:1,c:0});assert.match(sine.analysis,/radianos/);assert.match(sine.analysis,/6.283/);assert.match(sine.formula,/sen/);assert.equal(sine.vertex,null);
 for(const kind of ['linear','parabola','sine'] as const)assert.doesNotMatch(functionSvg({function_type:kind,a:0,b:0,c:0}),/NaN|Infinity|undefined/);
 const graph={function_type:'parabola' as const,a:1,b:-2,c:-3};assert.equal((functionSvg(graph).match(/data-math-root/g)||[]).length,2);assert.match(functionSvg(graph),/data-math-vertex/);assert.doesNotMatch(functionSvg({...graph,show_roots:false,show_vertex:false}),/data-math-root|data-math-vertex/);
});
