import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFreeHtmlLesson,freeHtmlLessonPrompt} from '../server/ai/freeHtmlLesson';
import {validateLessonSpec} from '../src/schemas/lessonValidator';
import {presentationEnvelope} from '../src/engine/freeHtml';
import {freeHtmlFixture} from './fixtures/freeHtmlLesson';
const brief={subject:'history' as const,grade:'3EF',topic:'Viagens',duration_minutes:30,material_text:'Fonte fornecida pela turma.',sources:[]};
test('HTML livre mantém bytes, metadados e Atlas explícito sem exigir diagramas genéricos',()=>{
  const lesson=parseFreeHtmlLesson('```html\n'+freeHtmlFixture+'\n```',brief);
  assert.equal(lesson.presentation!.html,freeHtmlFixture);
  assert.deepEqual(lesson.presentation!.atlas_models,[]);
  assert.equal(lesson.lesson.grade,'3EF');
  assert.equal(lesson.lesson.visual_status,'NEEDS_REVIEW');
  assert.equal(validateLessonSpec(lesson).isValid,true);
  lesson.presentation!.atlas_models=['not-a-model' as any];
  assert.equal(validateLessonSpec(lesson).isValid,false);
  assert.match(freeHtmlLessonPrompt(brief),/3EF/);
  assert.match(freeHtmlLessonPrompt(brief),/Fonte fornecida pela turma/);
});
test('Respostas incompletas não viram aulas e exportação impede acesso ao aplicativo',()=>{
  for(const html of [freeHtmlFixture.replace('</html>',''),freeHtmlFixture.replace('pemara-metadata','wrong'),freeHtmlFixture.replaceAll('data-slide','data-other')])assert.throws(()=>parseFreeHtmlLesson(html,brief));
  const html=presentationEnvelope(freeHtmlFixture,'Título </title><script>injetar()</script>');
  assert.match(html,/sandbox="allow-scripts"/);
  assert.doesNotMatch(html,/allow-same-origin|allow-top-navigation|allow-popups/);
  assert.ok(!html.includes('<script>injetar()'));
});
