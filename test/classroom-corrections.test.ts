import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSelectedMaterials,materialHeading,materialPart} from '../src/composer/materialScenes';
import {createLearningPlan} from '../src/engine/learningVisual';
import {TEMPLATE_SOLAR_SYSTEM} from '../src/templates/deterministicTemplates';
import {readCompleteCatalog} from '../server/curriculum/completeCatalog';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import type {MaterialSelection} from '../src/types/material';
import type {TextScene} from '../src/types/lesson';

const passage=(text:string,index:number):MaterialSelection=>({materialId:'preserved-original',filename:'aula.txt',sha256:'a'.repeat(64),sourceUnit:'paragrafo',sourceIndex:index,sourceLabel:`Parágrafo ${index}`,text});
const input=[passage('AVALIAÇÃO DE SAÍDA. Justifique o método escolhido.',3),passage('FILTRAÇÃO. O sal dissolvido atravessa o filtro comum.',2),passage('DESAFIO INICIAL. Um filtro separa água e sal?',1)];
test('Material como roteiro: avaliação no fim, conteúdo literal, sem temas extras nem alteração do original',()=>{
  const base=structuredClone(TEMPLATE_SOLAR_SYSTEM),before=JSON.stringify(base),selected=JSON.stringify(input);
  const result=mergeSelectedMaterials(base,input,{maxScenes:8,position:'material-only'}).lesson;
  assert.deepEqual(result.scenes.slice(1).map(s=>s.title),['Desafio inicial','Filtração','Avaliação de saída']);
  assert.deepEqual(result.scenes.slice(1).map(s=>(s as TextScene).content[0]),[input[2].text,input[1].text,input[0].text]);
  assert.ok(result.scenes.slice(1).every(s=>s.material_source?.sha256===input[0].sha256));
  assert.equal(JSON.stringify(base),before);assert.equal(JSON.stringify(input),selected);
  assert.equal(result.lesson.bncc_skill,undefined);
  assert.equal(result.scenes[0].type,'title');
  assert.equal((result.scenes[0] as any).badge,'Material do professor · revisão pedagógica');
});
test('Organização explícita do professor prevalece e conserva ordem dentro da etapa',()=>{
  const selected=[{...input[0],lessonPart:'opening' as const},{...input[2],lessonPart:'assessment' as const},input[1]];
  const result=mergeSelectedMaterials(TEMPLATE_SOLAR_SYSTEM,selected,{maxScenes:8,position:'material-only'}).lesson;
  assert.deepEqual(result.scenes.slice(1).map(s=>s.material_source?.sourceIndex),[3,2,1]);
  assert.equal(materialPart(passage('Hoje conversaremos sobre avaliação. Texto comum.',4)),'development');
  assert.equal(materialHeading(passage('Hoje conversaremos. Texto comum.',4)),'Material • Parágrafo 4');
});
test('Acervo com material: desafio antes dos conceitos, avaliação depois das atividades',()=>{
  const base=structuredClone(TEMPLATE_SOLAR_SYSTEM);
  base.scenes=[base.scenes[0],{id:'concept',type:'text',title:'Conceito',content:['Conceito']},{id:'activity',type:'text',title:'Atividade: aplicar',content:['Aplicar']},{id:'summary',type:'summary',title:'Síntese',takeaways:['Concluir']}];
  const result=mergeSelectedMaterials(base,input,{maxScenes:8,position:'lesson-flow'}).lesson;
  assert.deepEqual(result.scenes.map(s=>s.title),[base.scenes[0].title,'Desafio inicial','Conceito','Filtração','Atividade: aplicar','Avaliação de saída','Síntese']);
});
test('Atlas: reação química comparada ao gelo não vira animação de estados físicos',()=>{
  const scene:TextScene={id:'reaction',type:'text',title:'Exemplo: Quando surgem outras substâncias',content:['Vinagre e bicarbonato liberam gás por reação. Gelo derretendo continua sendo água; por isso a mudança de estado é física.']};
  const plan=createLearningPlan(scene,{subject:'science'});
  assert.equal(plan.kind,'concepts');assert.deepEqual(plan.variants,[]);assert.match(plan.caption,/não simulam uma reação/);
  assert.equal(createLearningPlan({...scene,title:'Estados físicos',content:['Estados físicos: sólido, líquido e gás.']},{subject:'science'}).kind,'particles');
});
test('Atlas abre a variante do título e não exige clique para reler o mesmo cabeçalho',()=>{
  for(const [index,title] of ['Filtração','Decantação','Evaporação'].entries()){
    const scene:TextScene={id:title,type:'text',title,content:[`${title.toUpperCase()}. Observe a mistura. Justifique a escolha.`],material_source:{materialId:'m',filename:'aula.txt',sourceUnit:'paragrafo',sourceIndex:1}};
    const plan=createLearningPlan(scene,{subject:'science'});
    assert.equal(plan.kind,'separation');assert.equal(plan.initialVariant,index+1);
    assert.equal(plan.steps[0],'Observe a mistura.');assert.equal(plan.source[0],scene.content[0]);
    const lesson=structuredClone(TEMPLATE_SOLAR_SYSTEM);lesson.scenes=[scene];lesson.lesson.subject='science';
    assert.ok(generateStandaloneHtml(lesson).includes('Observe a mistura.'));
  }
});
test('Questionário de misturas explica recuperação do sal sólido e perda da água',()=>{
  const pack=readCompleteCatalog().find(p=>p.title==='Misturas, transformações e separação')!;
  const question=pack.quiz.find(q=>q.question.includes('recuperar areia e sal'))!;
  assert.equal(question.options[question.correctIndex],'Filtrar e evaporar');
  assert.match(question.explanation,/sal sólido/);assert.match(question.explanation,/água não é recolhida/);
  assert.doesNotMatch(question.explanation,/deixa o sal dissolvido/);
});
