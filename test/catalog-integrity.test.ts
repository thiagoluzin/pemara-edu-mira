import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LessonComposer } from '../src/composer/lessonComposer';
import { PemaraMaestro } from '../src/maestro/pemaraMaestro';
import { resolvePackSlugForInput } from '../src/catalog/curriculumCatalog';
const pack = { slug: 'science-67-energia', title: 'Energia térmica', subjectCode: 'science', gradeLevel: 67, bnccSkill: 'EF07CI03', version: 1,
  nodes: Array.from({length: 5}, (_, i) => ({ title: `Conceito ${i}`, short_definition: 'A energia térmica está associada à agitação das partículas.', deep_description: 'O calor é energia transferida entre corpos devido à diferença de temperatura.', key_points: ['O fluxo espontâneo ocorre do corpo mais quente para o mais frio.'] })),
  quizzes: [{ question: 'Em que sentido ocorre o fluxo espontâneo de calor?', options: ['Do mais quente para o mais frio.', 'Do mais frio para o mais quente.'], correct_index: 0, explanation: 'A transferência espontânea acontece devido à diferença de temperatura.' }] };
const input = { discipline: 'science' as const, grade: '7EF', topic: pack.title, duration: 45, teaching_method: 'complete' as const };
test('Recurso visual não substitui a explicação do segundo conceito', () => {
  const result = LessonComposer.compose(input, { ...pack, resources: [{
    id: 'comparison', type: 'comparison_table', title: 'Comparação',
    metadata_json: { columns: ['Critério', 'A', 'B'], rows: [{ criteria: 'Temperatura', atenas: 'Alta', esparta: 'Baixa' }] }
  }] });
  for (const node of pack.nodes) assert.ok(result.scenes.some(scene => scene.title === node.title), node.title);
});
test('Rejeita assunto, disciplina, ano, conteúdo e pergunta incompatíveis', () => {
  assert.throws(() => LessonComposer.compose({...input, topic: 'Fotossíntese'}, pack), /assunto/);
  assert.throws(() => LessonComposer.compose({...input, discipline: 'history'}, pack), /disciplina/);
  assert.throws(() => LessonComposer.compose({...input, grade: '8EF'}, pack), /ano/);
  assert.throws(() => LessonComposer.compose(input, {...pack, nodes: []}), /incompleto/);
  assert.throws(() => LessonComposer.compose(input, {...pack, quizzes: []}), /perguntas/);
  assert.throws(() => LessonComposer.compose(input, {...pack, quizzes: [{...pack.quizzes[0], correct_index: 7}]}), /perguntas/);
  assert.equal(resolvePackSlugForInput('history', '6EF', 'Segunda Guerra Mundial'), null);
  assert.equal(resolvePackSlugForInput('history', '6EF', 'Grécia Antiga', []), null);
});
test('Faixa multianual mantém ano solicitado e todos os conceitos; maestro valida o resultado', async () => {
  const result = await PemaraMaestro.generateLesson({ subject: 'science', grade: '7EF', topic: pack.title, duration_minutes: 45, didactic_style: 'complete', generation_mode: 'MODE_A_NO_AI' }, pack);
  assert.equal(result.lesson.lesson.grade, '7EF');
  for (let i=0; i<5; i++) assert.ok(result.lesson.scenes.some(s => s.title === `Conceito ${i}`));
  assert.ok(result.logs.some(l => l.action.includes('Schema Aprovada')));
});
