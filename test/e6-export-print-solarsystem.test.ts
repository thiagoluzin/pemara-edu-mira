import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStandaloneHtml, generatePrintDocumentHtml, escapeHtml } from '../src/components/ExportModal';
import {
  TEMPLATE_SOLAR_SYSTEM,
  TEMPLATE_PROJECTILE_MOTION,
  TEMPLATE_GREECE_6EF,
  TEMPLATE_MATH_FUNCTION,
} from '../src/templates/deterministicTemplates';
import { LessonSpec, SolarSystemScene, QuizScene } from '../src/types/lesson';

test('Export & Print: Multi-scene print document generates all scenes in sequence and respects teacher notes policy', () => {
  const lesson: LessonSpec = JSON.parse(JSON.stringify(TEMPLATE_PROJECTILE_MOTION));
  assert.equal(lesson.scenes.length, 4, 'Pilot lesson should have 4 scenes');

  // 1. Generate without notes (default)
  const printDocDefault = generatePrintDocumentHtml(lesson, { includeTeacherNotes: false });
  assert.ok(printDocDefault.includes('<!DOCTYPE html>'), 'Must produce complete HTML document');
  assert.ok(printDocDefault.includes('Documento de Impressão • PEMARA EDU'), 'Header should be present');
  
  // Count slide page sections
  const pageMatches = printDocDefault.match(/class="print-slide-page"/g);
  assert.equal(pageMatches?.length, 4, 'Every scene must have its own print-slide-page break container');

  // In default print doc, print-teacher-notes must be hidden in print stylesheet
  assert.ok(
    printDocDefault.includes('.print-teacher-notes { display: none !important; }'),
    'Print stylesheet must suppress teacher notes when includeTeacherNotes is false'
  );
  assert.ok(
    printDocDefault.includes('Notas Pedagógicas Ocultas'),
    'Header indicator should confirm notes are hidden'
  );

  // 2. Generate with notes explicitly enabled
  const printDocWithNotes = generatePrintDocumentHtml(lesson, { includeTeacherNotes: true });
  assert.ok(
    !printDocWithNotes.includes('.print-teacher-notes { display: none !important; }'),
    'Print stylesheet must NOT suppress teacher notes when explicitly included'
  );
  assert.ok(
    printDocWithNotes.includes('Notas Pedagógicas Incluídas'),
    'Header indicator should confirm notes are included'
  );
  assert.ok(
    printDocWithNotes.includes('Nota Pedagógica do Professor:'),
    'Teacher notes text must be rendered in the document'
  );
});

test('Standalone HTML: Ctrl+P print media embeds all slides and suppresses teacher notes by default', () => {
  const lesson: LessonSpec = JSON.parse(JSON.stringify(TEMPLATE_SOLAR_SYSTEM));
  const html = generateStandaloneHtml(lesson);

  // Verification of print stylesheet rules
  assert.ok(
    html.includes('.container { display: none !important; }'),
    'Screen container must be hidden in @media print'
  );
  assert.ok(
    html.includes('#print-all-slides { display: block !important; }'),
    'All-slides container must be displayed in @media print'
  );
  assert.ok(
    html.includes('.teacher-notes-panel { display: none !important; }'),
    'Screen notes panel must never leak in print'
  );
  assert.ok(
    html.includes('.print-teacher-notes { display: none !important; }'),
    'Print notes must be hidden by default'
  );
  assert.ok(
    html.includes('body.include-notes-print .print-teacher-notes'),
    'Print notes must only appear when body has include-notes-print class'
  );

  // Embedded print container
  assert.ok(
    html.includes('id="print-all-slides" class="print-doc-container"'),
    'Standalone HTML must embed #print-all-slides container for multi-scene print'
  );

  // All 4 scenes must be present in the embedded print container
  const embeddedPages = html.match(/class="print-slide-page"/g);
  assert.equal(embeddedPages?.length, 4, 'All 4 scenes of solar system must be embedded for print');
});

test('Solar System Scene: Preserves distinct configurations and includes didactic scale disclosure', () => {
  // Config A: Default Earth focus, speed 1.0, orbits true, labels true
  const lessonA: LessonSpec = JSON.parse(JSON.stringify(TEMPLATE_SOLAR_SYSTEM));
  const solarSceneA = lessonA.scenes.find((s) => s.type === 'solar_system') as SolarSystemScene;
  assert.ok(solarSceneA, 'Solar system scene must exist in template');
  solarSceneA.params = {
    central_body: 'Sun',
    focused_planet: 'Earth',
    speed_multiplier: 1.0,
    show_orbits: true,
    show_labels: true,
    show_data_cards: true,
    scale_mode: 'didactic'
  };

  // Config B: Mars focus, speed 2.0, orbits false, labels false
  const lessonB: LessonSpec = JSON.parse(JSON.stringify(TEMPLATE_SOLAR_SYSTEM));
  const solarSceneB = lessonB.scenes.find((s) => s.type === 'solar_system') as SolarSystemScene;
  solarSceneB.params = {
    central_body: 'Sun',
    focused_planet: 'Mars',
    speed_multiplier: 2.0,
    show_orbits: false,
    show_labels: false,
    show_data_cards: true,
    scale_mode: 'proportional'
  };

  // Standalone HTML for Config A
  const htmlA = generateStandaloneHtml(lessonA);
  assert.ok(
    htmlA.includes('Nota didática sobre escala'),
    'Config A must display didactic scale disclosure'
  );
  assert.ok(
    htmlA.includes('"focused_planet":"Earth"') && htmlA.includes('"speed_multiplier":1'),
    'Config A must embed Earth and speed 1.0 params in scenes payload'
  );
  assert.ok(
    htmlA.includes('Terra <span style="font-size:9px; background:#0284c7; color:#fff; padding:1px 4px; border-radius:3px;">★ Foco da Aula</span>'),
    'Config A must mark Earth as focus in embedded print view'
  );

  // Standalone HTML for Config B
  const htmlB = generateStandaloneHtml(lessonB);
  assert.ok(
    htmlB.includes('Nota didática sobre escala'),
    'Config B must display didactic scale disclosure'
  );
  assert.ok(
    htmlB.includes('"focused_planet":"Mars"') && htmlB.includes('"speed_multiplier":2'),
    'Config B must embed Mars and speed 2.0 params in scenes payload'
  );
  assert.ok(
    htmlB.includes('Marte <span style="font-size:9px; background:#0284c7; color:#fff; padding:1px 4px; border-radius:3px;">★ Foco da Aula</span>'),
    'Config B must mark Mars as focus in embedded print view'
  );

  // Compare print documents
  const printDocA = generatePrintDocumentHtml(lessonA);
  const printDocB = generatePrintDocumentHtml(lessonB);

  // Print doc A highlights Earth
  assert.ok(
    printDocA.includes('Terra <span style="font-size:9px; background:#0284c7; color:#fff; padding:1px 4px; border-radius:3px;">★ Foco da Aula</span>'),
    'Print doc A must mark Earth as focus'
  );

  // Print doc B highlights Mars
  assert.ok(
    printDocB.includes('Marte <span style="font-size:9px; background:#0284c7; color:#fff; padding:1px 4px; border-radius:3px;">★ Foco da Aula</span>'),
    'Print doc B must mark Mars as focus'
  );

  // Didactic disclosure in print docs
  assert.ok(
    printDocA.includes('Nota didática: Representação esquemática'),
    'Print doc A must disclose simplified schematic representation'
  );
  assert.ok(
    printDocB.includes('Nota didática: Representação esquemática'),
    'Print doc B must disclose simplified schematic representation'
  );

  // Verificação estrita de desenho de órbitas e cartões de dados (P2):
  // Config A (show_orbits: true, show_data_cards: true):
  const printSectionA = htmlA.slice(htmlA.indexOf('id="print-all-slides"'));
  assert.ok(printSectionA.includes('class="orbit-path"'), 'Config A embedded print section must contain orbit paths');
  assert.ok(printSectionA.includes('class="planet-data-card"'), 'Config A embedded print section must contain planet data card');
  assert.ok(printDocA.includes('class="orbit-path"'), 'Print doc A must render orbit paths');
  assert.ok(printDocA.includes('class="planet-data-card"'), 'Print doc A must render planet data table');

  // Config B com show_data_cards: false e show_orbits: false
  solarSceneB.params.show_data_cards = false;
  const htmlBNoCards = generateStandaloneHtml(lessonB);
  const printDocBNoCards = generatePrintDocumentHtml(lessonB);

  // Config B (show_orbits: false, show_data_cards: false):
  const printSectionB = htmlBNoCards.slice(
    htmlBNoCards.indexOf('id="print-all-slides"'),
    htmlBNoCards.indexOf('<script>')
  );
  assert.ok(!printSectionB.includes('class="orbit-path"'), 'Config B embedded print section must strictly omit orbit paths');
  assert.ok(!printSectionB.includes('class="planet-data-card"'), 'Config B embedded print section must strictly omit planet data card');
  assert.ok(!printDocBNoCards.includes('class="orbit-path"'), 'Print doc B must strictly omit orbit paths');
  assert.ok(!printDocBNoCards.includes('class="planet-data-card"'), 'Print doc B must strictly omit planet data table');
});

test('Quiz Scene Print: Renders all alternatives in original order and defines Student vs Teacher/Answer Key versions', () => {
  const templates = [
    { name: 'História (Grécia Antiga)', template: TEMPLATE_GREECE_6EF },
    { name: 'Ciências (Sistema Solar)', template: TEMPLATE_SOLAR_SYSTEM },
    { name: 'Física (Lançamento Oblíquo)', template: TEMPLATE_PROJECTILE_MOTION },
    { name: 'Matemática (Função Quadrática)', template: TEMPLATE_MATH_FUNCTION },
  ];

  for (const { name, template } of templates) {
    const lesson: LessonSpec = JSON.parse(JSON.stringify(template));
    const quizScene = lesson.scenes.find((s) => s.type === 'quiz') as QuizScene;
    assert.ok(quizScene, `${name} must contain a quiz scene`);
    assert.ok(Array.isArray(quizScene.answers), `${name} quiz must have answers array`);
    assert.ok(quizScene.answers.length >= 2, `${name} quiz must have at least 2 answers`);

    // 1. Versão do Aluno (default / includeTeacherNotes = false)
    const studentPrintHtml = generatePrintDocumentHtml(lesson, { includeTeacherNotes: false });
    assert.ok(!studentPrintHtml.includes('Gabarito e Justificativa Pedagógica:'));
    for(const scene of lesson.scenes)if(scene.teacher_notes)assert.ok(!studentPrintHtml.includes(escapeHtml(scene.teacher_notes)), 'Student source must omit private teacher notes');

    // Pergunta e título devem estar presentes
    assert.ok(studentPrintHtml.includes(escapeHtml(quizScene.question)), `${name} student print must contain question`);
    assert.ok(studentPrintHtml.includes('Versão do Aluno'), `${name} student print must have Versão do Aluno badge`);

    // Todas as alternativas devem estar presentes na ordem original com prefixo A), B), C)...
    quizScene.answers.forEach((ans, i) => {
      const letter = String.fromCharCode(65 + i);
      assert.ok(
        studentPrintHtml.includes(letter) && studentPrintHtml.includes(escapeHtml(ans)),
        `${name} student print must contain alternative ${letter}: "${ans}"`
      );
    });

    // Na versão do aluno, o gabarito não deve ser destacado como correto nem ter badge 'Gabarito Correto'
    assert.ok(
      !studentPrintHtml.includes('Gabarito Correto'),
      `${name} student print must NOT highlight correct answer badge`
    );

    // Folha de estilos deve suprimir notas e justificativas pedagógicas
    assert.ok(
      studentPrintHtml.includes('.print-teacher-notes { display: none !important; }'),
      `${name} student print stylesheet must suppress teacher notes and quiz explanations`
    );

    // 2. Versão do Professor com Gabarito (includeTeacherNotes = true)
    const teacherPrintHtml = generatePrintDocumentHtml(lesson, { includeTeacherNotes: true });

    // Badge de versão do professor
    assert.ok(
      teacherPrintHtml.includes('Versão do Professor (Com Gabarito)'),
      `${name} teacher print must have Versão do Professor (Com Gabarito) badge`
    );

    // Pergunta e todas as alternativas devem estar presentes
    assert.ok(teacherPrintHtml.includes(escapeHtml(quizScene.question)), `${name} teacher print must contain question`);
    quizScene.answers.forEach((ans, i) => {
      const letter = String.fromCharCode(65 + i);
      assert.ok(
        teacherPrintHtml.includes(letter) && teacherPrintHtml.includes(escapeHtml(ans)),
        `${name} teacher print must contain alternative ${letter}: "${ans}"`
      );
    });

    // Na versão do professor, o gabarito deve ter o badge explícito
    assert.ok(
      teacherPrintHtml.includes('Gabarito Correto'),
      `${name} teacher print must include Gabarito Correto badge for answer key`
    );

    // Justificativa pedagógica deve ser exibida
    if (quizScene.explanation) {
      assert.ok(
        teacherPrintHtml.includes('Gabarito e Justificativa Pedagógica:'),
        `${name} teacher print must include pedagogical explanation header`
      );
      assert.ok(
        teacherPrintHtml.includes(escapeHtml(quizScene.explanation)),
        `${name} teacher print must render the explanation text`
      );
    }
  }
});

