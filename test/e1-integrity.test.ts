import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LessonComposer } from '../src/composer/lessonComposer';
import { PemaraMaestro } from '../src/maestro/pemaraMaestro';
import { VisualValidator } from '../src/validator/visualValidator';
import { validateLessonSpec } from '../src/schemas/lessonValidator';
import { TEMPLATES_LIBRARY } from '../src/templates/deterministicTemplates';

test('E1: História sobre Revolução Industrial ou Roma NÃO gera Grécia e lança erro explícito de indisponibilidade', async () => {
  const inputRevolucao = {
    subject: 'history' as const,
    grade: '8EF',
    topic: 'Revolução Industrial',
    duration_minutes: 30,
    didactic_style: 'review' as const,
    generation_mode: 'MODE_A_NO_AI' as const
  };

  await assert.rejects(
    async () => {
      await PemaraMaestro.generateLesson(inputRevolucao);
    },
    /Tema ou disciplina não suportado/,
    'Deve rejeitar tema fora do catálogo determinístico com erro explícito'
  );

  const inputRoma = {
    ...inputRevolucao,
    topic: 'Roma Antiga'
  };

  await assert.rejects(
    async () => {
      await PemaraMaestro.generateLesson(inputRoma);
    },
    /Tema ou disciplina não suportado/,
    'Roma Antiga não pode gerar Grécia silenciosamente'
  );
});

test('E1: Duas gerações da mesma disciplina/tema produzem IDs distintos e exclusivos', async () => {
  const mathInput = {
    subject: 'math' as const,
    grade: '9EF',
    topic: 'função quadrática',
    duration_minutes: 30,
    didactic_style: 'review' as const,
    generation_mode: 'MODE_A_NO_AI' as const
  };

  const genA = await PemaraMaestro.generateLesson(mathInput);
  const genB = await PemaraMaestro.generateLesson(mathInput);

  assert.notEqual(
    genA.lesson.lesson.id,
    genB.lesson.lesson.id,
    'Duas gerações sucessivas devem ter IDs diferentes'
  );
});

test('E1: Todos os quatro templates canônicos da biblioteca são válidos no schema', () => {
  for (const [key, template] of Object.entries(TEMPLATES_LIBRARY)) {
    const result = validateLessonSpec(template);
    assert.equal(
      result.isValid,
      true,
      `Template "${key}" deve ser válido no schema. Erros: ${result.errors.join('; ')}`
    );
  }
});

test('E1: Cena de texto com content escalar (string) é rejeitada pelo schema e não quebra o VisualValidator', () => {
  const badSpec = structuredClone(TEMPLATES_LIBRARY.grecia_antiga);
  const badTextScene = { id: 'text-1', type: 'text', title: 'Texto Inválido', content: 'texto escalar não-array' };
  badSpec.scenes = [badTextScene as any];

  const schemaResult = validateLessonSpec(badSpec);
  assert.equal(schemaResult.isValid, false, 'Schema deve rejeitar content como string');
  assert.ok(
    schemaResult.errors.some((e) => e.includes('array de strings')),
    'Deve acusar erro específico de array de strings'
  );

  // O VisualValidator não deve lançar exceção "join is not a function"
  assert.doesNotThrow(() => {
    const report = VisualValidator.validateScene(badTextScene as any, '02_title_body');
    assert.ok(report, 'Deve retornar relatório válido');
  });
});

test('E1: Quiz com correct_index fracionário (0.5) é rejeitado pelo schema', () => {
  const spec = structuredClone(TEMPLATES_LIBRARY.grecia_antiga);
  spec.scenes = [
    {
      id: 'quiz-1',
      type: 'quiz',
      title: 'Questão',
      question: 'Pergunta?',
      answers: ['Opção A', 'Opção B'],
      correct_index: 0.5,
      explanation: 'Explicação'
    }
  ];

  const result = validateLessonSpec(spec);
  assert.equal(result.isValid, false, 'Schema deve rejeitar índice fracionário');
  assert.ok(
    result.errors.some((e) => e.includes('inteiro')),
    'Erro deve exigir índice inteiro'
  );
});

test('E1: Cena wave não implementada no renderizador é estritamente rejeitada pelo schema', () => {
  const spec = structuredClone(TEMPLATES_LIBRARY.grecia_antiga);
  spec.scenes = [
    {
      id: 'wave-1',
      type: 'wave',
      title: 'Onda Mecânica',
      params: { amplitude: 2, frequency: 10, wavelength: 0.5 }
    } as any
  ];

  const result = validateLessonSpec(spec);
  assert.equal(result.isValid, false, 'Schema deve rejeitar componente wave não implementado');
  assert.ok(
    result.errors.some((e) => e.includes('não implementado')),
    'Erro deve alertar que o componente não é implementado'
  );
});

test('E1: Auto-Correction de texto com 1.000 caracteres não perde caracteres nem trunca com reticências', () => {
  const longParagraph = 'x'.repeat(1000);
  const longTextScene = {
    id: 'sc-long',
    type: 'text' as const,
    title: 'Texto Extenso',
    content: [longParagraph]
  };

  const result = VisualValidator.autoCorrectScene(longTextScene as any, '02_title_body');
  assert.equal(result.resolved, true, 'Deve resolver a quebra de texto');

  const allParts = [result.correctedScene, ...(result.newScenes || [])];
  const totalCharsAfter = allParts.reduce((acc, scene: any) => {
    const text = Array.isArray(scene.content) ? scene.content.join('') : '';
    return acc + text.length;
  }, 0);

  assert.equal(totalCharsAfter, 1000, 'Nenhum caractere pode ser perdido durante o Auto-Correction');
  assert.ok(
    allParts.every((s: any) => !s.content.some((p: string) => p.endsWith('...'))),
    'Nenhum texto deve ser truncado com reticências'
  );
});

test('E1: Auto-Correction de lista com 20 itens divide em partes válidas sem erro FAIL nas continuações', () => {
  const bulletScene = {
    id: 'sc-bullets',
    type: 'text' as const,
    title: 'Lista Longa de 20 Itens',
    content: ['Introdução aos tópicos:'],
    bullets: Array.from({ length: 20 }, (_, i) => `Item de estudo ${i + 1}`)
  };

  const splitResult = VisualValidator.autoCorrectScene(bulletScene as any, '02_title_body');
  assert.equal(splitResult.resolved, true, 'Auto-Correction de bullets deve ser resolvido');

  const allParts = [splitResult.correctedScene, ...(splitResult.newScenes || [])];
  assert.ok(allParts.length >= 4, '20 itens com máximo de 6 devem gerar pelo menos 4 slides');

  // Todas as partes geradas devem ter status PASS ou WARNING (nenhum FAIL)
  const reports = allParts.map((s) => VisualValidator.validateScene(s, '02_title_body'));
  for (const rep of reports) {
    assert.notEqual(rep.status, 'FAIL', `Slide ${rep.slideId} não pode ter status FAIL`);
  }
});

test('E1: LessonComposer.compose com Geografia e Climas lança erro explícito de indisponibilidade', () => {
  assert.throws(
    () => {
      LessonComposer.compose({
        discipline: 'geography',
        grade: 9,
        topic: 'Climas',
        duration: 45,
        teaching_method: 'exercises'
      });
    },
    /Tema ou disciplina não suportado no Content Pack/,
    'Composer deve rejeitar temas não implementados no piloto'
  );
});

test('E1: VisualValidator.validateScene protege contra scene undefined sem lançar TypeError', () => {
  assert.doesNotThrow(() => {
    const report = VisualValidator.validateScene(undefined as any, '02_title_body');
    assert.equal(report.status, 'FAIL');
  });
});
