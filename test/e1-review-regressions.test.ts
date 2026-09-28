import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { validateLessonSpec } from '../src/schemas/lessonValidator';
import { PemaraRenderer } from '../src/renderer/PemaraRenderer';
import { PemaraMaestro } from '../src/maestro/pemaraMaestro';
import { VisualValidator } from '../src/validator/visualValidator';
import { TEMPLATES_LIBRARY } from '../src/templates/deterministicTemplates';
import {
  loadLessonsFromStorage,
  saveLessonsToStorage,
  migrateLegacyLesson,
  LOCAL_STORAGE_KEY,
  QUARANTINE_STORAGE_KEY,
  BACKUP_RAW_STORAGE_KEY
} from '../src/storage/lessonStorage';
import { matchPilotCatalog } from '../src/catalog/pilotCatalog';
import { Navbar } from '../src/components/Navbar';

// Mock simples de Storage para testes em Node
class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

test('R1 (P1): Migração transparente de aulas legadas e quarentena segura sem perda de dados', () => {
  const storage = new MockStorage();

  const legacyLesson = {
    schema_version: '1.0',
    lesson: {
      id: 'legacy-lesson-01',
      subject: 'history',
      grade: '6EF',
      title: 'Aula de História do Professor',
      duration_minutes: 45,
      generation_mode: 'MODE_A_NO_AI'
    },
    objectives: ['Compreender o contexto'],
    scenes: [
      {
        id: 'sc-legacy-text',
        type: 'text',
        title: 'Texto Legado',
        content: 'Trabalho autoral do professor salvo como string'
      }
    ]
  };

  const corruptedLesson = {
    lesson: { id: 'bad-lesson' },
    scenes: [{ type: 'invalid_type' }]
  };

  // Salvar acervo misto: 1 válida canônica, 1 legada migrável, 1 corrompida
  const initialAcervo = [
    structuredClone(TEMPLATES_LIBRARY.grecia_antiga),
    legacyLesson,
    corruptedLesson
  ];
  storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialAcervo));

  const result = loadLessonsFromStorage(storage);

  // A aula legada com content string deve ser migrada com sucesso
  assert.equal(result.validLessons.length, 2, 'Deve conter a aula canônica + a aula legada migrada');
  const migrated = result.validLessons.find((l) => l.lesson.id === 'legacy-lesson-01');
  assert.ok(migrated, 'Aula legada deve estar presente');
  const migratedScene = migrated?.scenes[0] as any;
  assert.ok(Array.isArray(migratedScene?.content), 'Content deve ter sido migrado para array');
  assert.equal(
    migratedScene?.content[0],
    'Trabalho autoral do professor salvo como string',
    'Conteúdo do professor deve ser 100% preservado'
  );

  // A aula corrompida deve estar preservada na quarentena
  assert.equal(result.quarantinedItems.length, 1, 'Registro corrompido deve estar na quarentena');
  assert.equal(result.quarantinedItems[0].id, 'bad-lesson');

  // Gravação subsequente não apaga a quarentena
  saveLessonsToStorage(storage, result.validLessons, result.quarantinedItems);
  assert.ok(storage.getItem(QUARANTINE_STORAGE_KEY), 'Chave de quarentena deve estar persistida no storage');
  assert.ok(storage.getItem(BACKUP_RAW_STORAGE_KEY), 'Backup bruto deve ter sido preservado');
});

test('R1 (P1): Storage com JSON corrompido é preservado em quarentena sem descarte', () => {
  const storage = new MockStorage();
  storage.setItem(LOCAL_STORAGE_KEY, '{ json_incompleto_sem_fechamento: ');

  const result = loadLessonsFromStorage(storage);
  assert.equal(result.validLessons.length, 0);
  assert.equal(result.quarantinedItems.length, 1);
  assert.equal(result.rawQuarantine, '{ json_incompleto_sem_fechamento: ');
});

test('R2 (P1): Schema rejeita structures nulas ou incompletas e PemaraRenderer renderiza com resiliência', () => {
  // 1. Comparison com null em columns
  const badComparison = {
    id: 'bad-comp',
    type: 'comparison',
    title: 'Tabela',
    params: { columns: [null, 'A', 'B'], rows: [{ criteria: 'Critério 1' }] }
  };
  const specComp = structuredClone(TEMPLATES_LIBRARY.grecia_antiga);
  specComp.scenes = [badComparison as any];
  const valComp = validateLessonSpec(specComp);
  assert.equal(valComp.isValid, false, 'Schema deve rejeitar columns com null');

  // Renderer não lança exceção com columns nulas
  assert.doesNotThrow(() => {
    renderToString(React.createElement(PemaraRenderer, { scene: badComparison as any }));
  });

  // 2. Timeline com null em events
  const badTimeline = {
    id: 'bad-time',
    type: 'timeline',
    title: 'Linha',
    params: { events: [null] }
  };
  const specTime = structuredClone(TEMPLATES_LIBRARY.grecia_antiga);
  specTime.scenes = [badTimeline as any];
  const valTime = validateLessonSpec(specTime);
  assert.equal(valTime.isValid, false, 'Schema deve rejeitar events com null');

  // Renderer não lança exceção com events nulos
  assert.doesNotThrow(() => {
    renderToString(React.createElement(PemaraRenderer, { scene: badTimeline as any }));
  });

  // 3. Math function com b/c ausentes
  const badMath = {
    id: 'bad-math',
    type: 'math_function',
    title: 'Gráfico',
    params: { a: 1 }
  };
  const specMath = structuredClone(TEMPLATES_LIBRARY.quadratic_function);
  specMath.scenes = [badMath as any];
  const valMath = validateLessonSpec(specMath);
  assert.equal(valMath.isValid, false, 'Schema deve rejeitar math_function sem b e c');

  // Renderer não produz NaN na string renderizada
  const htmlMath = renderToString(React.createElement(PemaraRenderer, { scene: badMath as any }));
  assert.equal(htmlMath.includes('NaN'), false, 'Renderizador não deve conter coordenadas NaN');
});

test('R3 (P1): Catálogo estrito rejeita Grécia para 9EF e função seno sem substituição silenciosa', async () => {
  // 1. Grécia Antiga para 9EF
  await assert.rejects(
    async () => {
      await PemaraMaestro.generateLesson({
        subject: 'history',
        topic: 'Grécia Antiga',
        grade: '9EF',
        duration_minutes: 45,
        didactic_style: 'visual',
        generation_mode: 'MODE_A_NO_AI'
      });
    },
    /incompatibilidade de série escolar.*Grécia Antiga.*6EF/i,
    'Não pode entregar aula de 6º ano silenciosamente para solicitação de 9EF'
  );

  // 2. Matemática com "função seno"
  await assert.rejects(
    async () => {
      await PemaraMaestro.generateLesson({
        subject: 'math',
        topic: 'função seno',
        grade: '9EF',
        duration_minutes: 45,
        didactic_style: 'visual',
        generation_mode: 'MODE_A_NO_AI'
      });
    },
    /função seno.*não suportado.*Função Quadrática/i,
    'Não pode entregar Função Quadrática para pedido de função seno'
  );

  // 3. Matemática com "função linear"
  await assert.rejects(
    async () => {
      await PemaraMaestro.generateLesson({
        subject: 'math',
        topic: 'função linear',
        grade: '9EF',
        duration_minutes: 45,
        didactic_style: 'visual',
        generation_mode: 'MODE_A_NO_AI'
      });
    },
    /função linear.*não suportado/i,
    'Não pode aceitar função linear no piloto'
  );

  // 4. As 4 demos canônicas oficiais são aprovadas com sucesso
  const demos = [
    { subject: 'history' as const, topic: 'Grécia Antiga', grade: '6EF' },
    { subject: 'physics' as const, topic: 'Lançamento Oblíquo', grade: '1EM' },
    { subject: 'science' as const, topic: 'Sistema Solar', grade: '6EF' },
    { subject: 'math' as const, topic: 'Função Quadrática', grade: '9EF' }
  ];

  for (const d of demos) {
    const res = await PemaraMaestro.generateLesson({
      subject: d.subject,
      topic: d.topic,
      grade: d.grade,
      duration_minutes: 45,
      didactic_style: 'visual',
      generation_mode: 'MODE_A_NO_AI'
    });
    assert.ok(res.lesson, `Demo ${d.subject} deve ser gerada com sucesso`);
    assert.equal(res.lesson.lesson.subject, d.subject);
    assert.equal(res.lesson.lesson.grade, d.grade);
  }
});

test('R4 (P1): Modo D apresenta logs de status honestos sem simulação de auditorias inexistentes', async () => {
  const result = await PemaraMaestro.generateLesson({
    subject: 'history',
    topic: 'Grécia Antiga',
    grade: '6EF',
    duration_minutes: 45,
    didactic_style: 'visual',
    generation_mode: 'MODE_D_AGENTS'
  });

  const factCheckLog = result.logs.find((l) => l.agent === 'FactCheck');
  assert.ok(factCheckLog, 'Deve existir log da etapa FactCheck');
  assert.equal(factCheckLog?.status, 'info', 'Status deve ser informativo, não fake success');
  assert.ok(
    factCheckLog?.details.includes('offline') || factCheckLog?.details.includes('heurística'),
    'Deve declarar honestamente que opera no modo offline/heurístico no piloto V1'
  );
  assert.equal(
    result.logs.some((l) => l.details.includes('zero colisão')),
    false,
    'Não deve reivindicar verificação formal de zero colisão não realizada'
  );
});

test('R5 (P2): Auto-Correction preserva 100% dos caracteres, source_citation e teacher_notes', () => {
  const text = 'palavra '.repeat(150); // 1.200 caracteres
  const scene = {
    id: 'sc-orig',
    type: 'text' as const,
    title: 'Texto Didático',
    content: [text],
    source_citation: 'BNCC EF06HI09 / Vernant',
    teacher_notes: 'Nota importante do professor'
  };

  const correction = VisualValidator.autoCorrectScene(scene as any, '02_title_body');
  assert.equal(correction.resolved, true, 'Deve resolver a quebra de texto');

  const parts = [correction.correctedScene, ...(correction.newScenes || [])];
  assert.ok(parts.length >= 3, '1200 caracteres devem ser divididos em pelo menos 3 slides');

  // Preservação de 100% dos caracteres (sem perda por trim)
  const totalCharsAfter = parts.map((s: any) => s.content.join('')).join('').length;
  assert.equal(
    totalCharsAfter,
    text.length,
    `Preservação estrita: antes=${text.length}, depois=${totalCharsAfter}`
  );

  // Preservação da citação da fonte em todos os slides derivados
  for (const part of parts) {
    assert.equal(
      part.source_citation,
      'BNCC EF06HI09 / Vernant',
      `Slide ${part.id} deve preservar source_citation`
    );
    assert.ok(
      part.teacher_notes?.includes('Nota importante do professor'),
      `Slide ${part.id} deve preservar a anotação original do professor`
    );
  }
});

test('Rechecagem 1 (P1): Falha na gravação da quarentena mantém acervo principal intacto e preserva o original', () => {
  const data = new Map<string, string>();
  const lost = JSON.stringify([{ lesson: { id: 'trabalho-novo' }, scenes: [{ type: 'invalid_type', content: 'Texto autoral essencial' }] }]);
  data.set(LOCAL_STORAGE_KEY, lost);
  data.set(BACKUP_RAW_STORAGE_KEY, 'backup-antigo-sem-este-trabalho');

  const faultStorage = {
    get length() { return data.size; },
    clear() { data.clear(); },
    key(i: number) { return [...data.keys()][i] ?? null; },
    removeItem(k: string) { data.delete(k); },
    getItem(k: string) { return data.get(k) ?? null; },
    setItem(k: string, v: string) {
      if (k === QUARANTINE_STORAGE_KEY) {
        throw new Error('QuotaExceededError simulada ao gravar quarentena');
      }
      data.set(k, v);
    }
  } as Storage;

  const result = loadLessonsFromStorage(faultStorage);
  assert.equal(result.quarantinedItems.length, 1);

  const saveRes = saveLessonsToStorage(faultStorage, result.validLessons, result.quarantinedItems);
  assert.equal(saveRes.success, false, 'Deve retornar erro sem lançar exceção não tratada');
  assert.ok(saveRes.error?.includes('QuotaExceededError'));

  // A chave principal NÃO pode ter sido sobrescrita com []
  const mainAfter = faultStorage.getItem(LOCAL_STORAGE_KEY);
  assert.equal(mainAfter, lost, 'Chave principal deve ter sido preservada intacta via rollback');
  assert.ok(
    [...data.values()].some((s) => s.includes('Texto autoral essencial')),
    'Texto original do professor deve ser 100% retido no storage'
  );
});

test('Rechecagem 2 (P1): Migração não inventa resposta correta de quiz nem fabrica conteúdo', () => {
  // Quiz com correct_index float não pode ser modificado para 0
  const quiz = structuredClone(TEMPLATES_LIBRARY.quadratic_function);
  const quizScene = quiz.scenes.find((s: any) => s.type === 'quiz') as any;
  quizScene.correct_index = 0.5;

  const migratedQuiz = migrateLegacyLesson(quiz);
  assert.equal(
    migratedQuiz,
    null,
    'Quiz com correct_index fracionário não pode ter resposta inventada e deve ir para quarentena'
  );

  // Aula com cena nula ou inválida não pode receber "Conteúdo recuperado automaticamente"
  const badSceneLesson = {
    schema_version: '1.0',
    lesson: { id: 'l-bad', subject: 'history', title: 'Aula', duration_minutes: 45, grade: '6EF', generation_mode: 'MODE_A_NO_AI' },
    scenes: [null]
  };
  const migratedScene = migrateLegacyLesson(badSceneLesson);
  assert.equal(migratedScene, null, 'Cena nula não pode ter conteúdo inventado');
});

test('Rechecagem 3 (P2): Validação de série exige token exato e rejeita prefixos inválidos (6EM, 60, 9EF-invalido)', () => {
  const match6EM = matchPilotCatalog('history', 'Grécia Antiga', '6EM');
  assert.equal(match6EM.isSupported, false, '6EM não pode ser aceito como 6EF');

  const match60 = matchPilotCatalog('history', 'Grécia Antiga', '60');
  assert.equal(match60.isSupported, false, '60 não pode ser aceito como 6EF');

  const match9Invalido = matchPilotCatalog('math', 'Função Quadrática', '9EF-invalido');
  assert.equal(match9Invalido.isSupported, false, '9EF-invalido deve ser rejeitado');

  // Formas válidas continuam aceitas
  assert.equal(matchPilotCatalog('history', 'Grécia Antiga', '6EF').isSupported, true);
  assert.equal(matchPilotCatalog('history', 'Grécia Antiga', '6').isSupported, true);
  assert.equal(matchPilotCatalog('history', 'Grécia Antiga', '6º ano').isSupported, true);
  assert.equal(matchPilotCatalog('physics', 'Lançamento Oblíquo', '1EM').isSupported, true);
  assert.equal(matchPilotCatalog('math', 'Função Quadrática', '9EF').isSupported, true);
});

test('Rechecagem 4 (P2): Navbar renderiza denominações honestas e padronizadas para todos os modos', () => {
  const htmlModeB = renderToString(React.createElement(Navbar, {
    activeTab: 'editor',
    onTabChange: () => {},
    activeMode: 'MODE_B_LOCAL_AI',
    onStartPresentation: () => {},
    canPresent: true
  }));
  assert.ok(htmlModeB.includes('Variações para ensinar'), 'Modo B deve apresentar sua finalidade em linguagem de professor');
  assert.equal(htmlModeB.includes('IA Local'), false, 'Navbar não pode conter termo enganoso IA Local');

  const htmlModeD = renderToString(React.createElement(Navbar, {
    activeTab: 'editor',
    onTabChange: () => {},
    activeMode: 'MODE_D_AGENTS',
    onStartPresentation: () => {},
    canPresent: true
  }));
  assert.ok(htmlModeD.includes('Criação guiada (demonstração)'), 'Modo D deve identificar a demonstração em português');
  assert.equal(htmlModeD.includes('Agentes Maestro'), false, 'Navbar não pode conter termo enganoso Agentes Maestro');
});
