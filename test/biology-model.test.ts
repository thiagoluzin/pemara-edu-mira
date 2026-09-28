import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCompleteCatalog,makePayload} from '../server/curriculum/completeCatalog';
import {LessonComposer} from '../src/composer/lessonComposer';
import {validateLessonSpec} from '../src/schemas/lessonValidator';
import {biologyScenesForSkills,biologySvg} from '../src/engine/biologyModel';
import {generateStandaloneHtml,renderAllScenesForPrint} from '../src/components/ExportModal';

const pack=readCompleteCatalog().find(p=>p.slug==='science-6-celulas-e-niveis-de-organizacao-dos-seres-vivos')!;
const lesson=()=>LessonComposer.compose({discipline:'science',grade:'6EF',topic:pack.title,duration:45,teaching_method:'visual'},makePayload(pack,'1.0.0'));

test('A aula curricular de células recebe dois modelos animados e conserva o conteúdo',()=>{
  const result=lesson();
  assert.deepEqual(result.scenes.filter(s=>s.type==='biology_model').map(s=>s.params.model),['cell_structure','organization']);
  assert.equal(validateLessonSpec(result).isValid,true);
  for(const node of pack.nodes) assert.ok(result.scenes.some(s=>s.title===node.title),node.title);
  assert.equal(result.scenes.filter(s=>s.type==='quiz').length,pack.quiz.length);
  const restored=JSON.parse(JSON.stringify(result));
  assert.equal(validateLessonSpec(restored).isValid,true);
  restored.scenes.find((s:any)=>s.type==='biology_model').params.model='modelo-inexistente';
  assert.equal(validateLessonSpec(restored).isValid,false);
});

test('Seleção curricular não espalha animações de células em assuntos incompatíveis',()=>{
  assert.equal(biologyScenesForSkills('math','EF06CI05').length,0);
  assert.equal(biologyScenesForSkills('science','EF08CI07').length,0);
  assert.equal(biologyScenesForSkills('science','EF06CI05').length,1);
  assert.equal(biologyScenesForSkills('science','EF06CI06').length,1);
  assert.equal(biologyScenesForSkills('science','EF06CI05; EF06CI05; EF06CI06').length,2);
});

test('Modelo vegetal tem parede e vacúolo; modelo animal não recebe essas estruturas',()=>{
  const animal=biologySvg('cell_structure',0,false);
  const plant=biologySvg('cell_structure',0,true);
  assert.ok(plant.includes('Parede')&&plant.includes('Vacúolo'));
  assert.ok(!animal.includes('Parede')&&!animal.includes('Vacúolo'));
  assert.notEqual(biologySvg('organization',0),biologySvg('organization',4));
});

test('Exportação offline conserva modelos, controles e JavaScript válido; impressão tem figuras',()=>{
  const result=lesson();
  const html=generateStandaloneHtml(result);
  const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length>0);
  for(const [,script] of scripts) new vm.Script(script);
  assert.ok(html.includes('renderBiologyScene(scene, el)'));
  assert.ok(html.includes('Pausar animação'));
  const print=renderAllScenesForPrint(result);
  assert.ok(print.includes('Modelo de célula animal'));
  assert.ok(print.includes('Células, tecidos, órgãos, sistemas e organismo'));
  result.scenes.find(s=>s.type==='biology_model')!.title='</script><script>alert(1)</script>';
  assert.ok(!generateStandaloneHtml(result).includes('</script><script>alert(1)</script>'));
});
