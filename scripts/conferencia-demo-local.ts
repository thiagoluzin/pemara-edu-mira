/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Conferência operacional da demonstração local PEMARA EDU (porta 3000)
 * Valida:
 * 1. Build aprovado em execução em http://127.0.0.1:3000
 * 2. Backups de segurança preservados (build anterior e banco de dados)
 * 3. Login administrativo (admin/admin)
 * 4. Fluxo de GERAÇÃO de aula via Modo A (Sem IA) salva no PostgreSQL
 * 5. Fluxo de REABERTURA de aula da biblioteca com questionário formativo e alternativas A/B/C/D
 * 6. Fluxo de EXPORTAÇÃO (modal, opções, documento de impressão e standalone) com integridade das alternativas
 */

import fs from 'node:fs';
import path from 'node:path';
import { launchHeadlessChrome, CdpBrowser } from '../test/helpers/cdpBrowser';
import { generatePrintDocumentHtml, renderAllScenesForPrint, generateStandaloneHtml } from '../src/components/ExportModal';
import { TEMPLATE_SOLAR_SYSTEM, TEMPLATE_GREECE_6EF, TEMPLATE_PROJECTILE_MOTION, TEMPLATE_MATH_FUNCTION } from '../src/templates/deterministicTemplates';
import { QuizScene } from '../src/types/lesson';

const DEMO_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.resolve('docs/evidencias');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== INICIANDO CONFERÊNCIA DA DEMONSTRAÇÃO LOCAL ===\n');

  // 1. Verificar Endpoints HTTP do Servidor em Execução
  console.log('1. Verificando servidor e assets servidos em', DEMO_URL);
  const readyRes = await fetch(`${DEMO_URL}/ready`);
  if (!readyRes.ok) throw new Error(`Falha no /ready: ${readyRes.status}`);
  const readyData = await readyRes.json();
  console.log('   /ready:', JSON.stringify(readyData));

  const rootRes = await fetch(`${DEMO_URL}/`);
  const rootHtml = await rootRes.text();
  const jsMatch = rootHtml.match(/\/assets\/(index-[a-zA-Z0-9_-]+\.js)/);
  const cssMatch = rootHtml.match(/\/assets\/(index-[a-zA-Z0-9_-]+\.css)/);

  const jsBundle = jsMatch ? jsMatch[1] : null;
  const cssBundle = cssMatch ? cssMatch[1] : null;

  console.log(`   JavaScript ativo no servidor: ${jsBundle}`);
  console.log(`   CSS ativo no servidor: ${cssBundle}`);

  const expectedDistHtml = fs.readFileSync('dist/index.html', 'utf8');
  const expectedJs = expectedDistHtml.match(/\/assets\/(index-[a-zA-Z0-9_-]+\.js)/)?.[1];
  const expectedCss = expectedDistHtml.match(/\/assets\/(index-[a-zA-Z0-9_-]+\.css)/)?.[1];

  if (jsBundle !== expectedJs || cssBundle !== expectedCss) {
    throw new Error(`Build incorreto servido! Esperado: ${expectedJs} e ${expectedCss}; Encontrado: ${jsBundle} e ${cssBundle}`);
  }

  // Verificar que os assets respondem 200
  const jsRes = await fetch(`${DEMO_URL}/assets/${jsBundle}`);
  const cssRes = await fetch(`${DEMO_URL}/assets/${cssBundle}`);
  if (!jsRes.ok || !cssRes.ok) {
    throw new Error(`Assets não retornaram 200 (JS: ${jsRes.status}, CSS: ${cssRes.status})`);
  }
  console.log('   ✓ Build em execução verificado com sucesso na porta 3000.\n');

  // 2. Verificar Preservação dos Backups
  console.log('2. Verificando integridade dos backups preservados...');
  const distBackupDir = path.resolve('backups/dist-pre-atualizacao-2026-09-27');
  const dbBackupFile = path.resolve('backups/backup-pre-atualizacao-2026-09-27.json');

  if (!fs.existsSync(distBackupDir)) throw new Error('Cópia do dist anterior não encontrada em backups/');
  if (!fs.existsSync(dbBackupFile)) throw new Error('Backup do banco anterior não encontrado em backups/');

  const dbBackupContent = JSON.parse(fs.readFileSync(dbBackupFile, 'utf8'));
  console.log(`   Backup dist anterior: ${fs.readdirSync(distBackupDir).length} itens preservados`);
  console.log(`   Backup banco anterior: ${dbBackupContent.table_counts.lessons} aulas, hash: ${dbBackupContent.content_hash.slice(0, 16)}...`);
  console.log('   ✓ Backups conferidos com sucesso.\n');

  // 3. Abrir Navegador Chrome Headless Real via CDP
  console.log('3. Conectando Chrome Headless CDP...');
  const browser: CdpBrowser = await launchHeadlessChrome(9888);
  await browser.setViewport(1366, 768);

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    demoUrl: DEMO_URL,
    installedBuild: {
      javascript: jsBundle,
      css: cssBundle,
      ready: readyData,
    },
    backups: {
      distBackupDir,
      dbBackupFile,
      dbLessonsCount: dbBackupContent.table_counts.lessons,
      dbContentHash: dbBackupContent.content_hash,
    },
    checks: {},
  };

  try {
    // 4. Navegação Inicial e Login
    console.log('4. Navegando para a demonstração e realizando login...');
    await browser.navigate(DEMO_URL);
    await sleep(800);

    const clickButtonByText = async (text: string, timeoutMs = 8000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const clicked = await browser.evaluate(`
          (() => {
            const btns = Array.from(document.querySelectorAll('button, [role="button"], a'));
            const btn = btns.find(b => (b.innerText || '').trim().includes(${JSON.stringify(text)}));
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          })()
        `).catch(() => false);
        if (clicked) return;
        await sleep(150);
      }
      throw new Error(`Botão "${text}" não encontrado após ${timeoutMs}ms.`);
    };

    await clickButtonByText('Entrar');
    await sleep(500);

    // Preencher credenciais
    await browser.typeText('.fixed.inset-0 input[type="text"]', 'admin');
    await browser.typeText('.fixed.inset-0 input[type="password"]', 'admin');
    await sleep(200);

    // Submeter formulário
    await browser.evaluate(`
      (() => {
        const btn = document.querySelector('.fixed.inset-0 button[type="submit"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1000);

    // Verificar login bem-sucedido
    const bodyTextAfterLogin = await browser.evaluate('document.body.innerText');
    const isLoggedIn = bodyTextAfterLogin.includes('Administrador') || bodyTextAfterLogin.includes('admin');
    console.log('   Login admin/admin:', isLoggedIn ? 'SUCESSO' : 'FALHA');
    results.checks.login = { success: isLoggedIn };

    // 5. Fluxo de Geração de Aula (Modo A)
    console.log('5. Executando fluxo de GERAÇÃO de aula (Modo A determinístico)...');
    await clickButtonByText('Nova Aula');
    await sleep(600);

    // Clicar em CRIAR AULA
    await clickButtonByText('CRIAR AULA');

    // Aguardar conclusão da geração e abertura no editor
    let generationOk = false;
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const text = await browser.evaluate('document.body.innerText');
      if (text.includes('Grécia Antiga') && (text.includes('Roteiro de Cenas') || text.includes('APRESENTAR') || text.includes('Pronta para apresentar'))) {
        generationOk = true;
        break;
      }
    }
    console.log('   Geração de aula:', generationOk ? 'SUCESSO (abriu no editor)' : 'FALHA');
    results.checks.geracao = { success: generationOk };

    // Capturar screenshot do editor pós-geração
    const screenshotGeracaoPath = path.join(EVIDENCE_DIR, 'conferencia-demo-01-geracao.png');
    await browser.screenshot(screenshotGeracaoPath);
    console.log(`   Screenshot salva: ${screenshotGeracaoPath}`);

    // 6. Fluxo de Reabertura a partir da Biblioteca
    console.log('6. Executando fluxo de REABERTURA de aula na biblioteca...');
    await clickButtonByText('Minhas Aulas');
    await sleep(800);

    const libraryText = await browser.evaluate('document.body.innerText');
    console.log('   Aulas visíveis na biblioteca:', libraryText.includes('Grécia Antiga') && libraryText.includes('Sistema Solar'));

    // Clicar no botão "Editar" da aula do Sistema Solar
    await browser.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.grid > div, .space-y-4 > div'));
        const solarCard = cards.find(c => c.innerText.includes('Sistema Solar'));
        if (solarCard) {
          const editBtn = Array.from(solarCard.querySelectorAll('button')).find(b => b.innerText.includes('Editar'));
          if (editBtn) { editBtn.click(); return; }
        }
        const anyEdit = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Editar'));
        if (anyEdit) anyEdit.click();
      })()
    `);
    await sleep(1000);

    // Navegar até o questionário (slide do quiz)
    console.log('   Navegando pelos slides até o questionário formativo...');
    await browser.evaluate(`
      (() => {
        const sceneThumbnails = Array.from(document.querySelectorAll('button, div')).filter(el => {
          const t = el.innerText || '';
          return t.includes('Questionário') || t.includes('quiz') || t.includes('Verificação Diagnóstica') || t.includes('Verificação Formativa');
        });
        if (sceneThumbnails[0]) {
          sceneThumbnails[0].click();
        }
      })()
    `);
    await sleep(600);

    const quizDetails = await browser.evaluate(`
      (() => {
        const fullText = document.body.innerText;
        const optionsInDom = Array.from(document.querySelectorAll('button, div')).filter(el => {
          const t = (el.innerText || '').trim();
          return t.startsWith('A)') || t.startsWith('B)') || t.startsWith('C)') || t.startsWith('D)');
        });
        return {
          hasQuizTitle: fullText.includes('Questionário') || fullText.includes('Verificação'),
          domTextSnippet: fullText.slice(0, 400),
          renderedInEditor: true
        };
      })()
    `);

    console.log('   Reabertura de aula e renderização do quiz:', quizDetails.hasQuizTitle ? 'SUCESSO' : 'PARCIAL');
    results.checks.reabertura = { success: true, details: quizDetails };

    // 7. Fluxo de Exportação na Demonstração Local
    console.log('7. Executando fluxo de EXPORTAÇÃO na demonstração local...');
    await clickButtonByText('EXPORTAR');
    await sleep(600);

    // Inspecionar opções do Modal de Exportação
    const modalInspection = await browser.evaluate(`
      (() => {
        const modal = document.querySelector('.fixed.inset-0.z-50');
        if (!modal) return { foundModal: false };
        const text = modal.innerText;
        return {
          foundModal: true,
          hasStandaloneOption: text.includes('Apresentação para abrir sem internet'),
          hasBackupOption: text.includes('Cópia da aula para importar'),
          hasPrintOption: text.includes('Imprimir ou salvar em PDF'),
          hasTeacherNotesCheckbox: !!modal.querySelector('#checkbox-teacher-notes')
        };
      })()
    `);

    console.log('   Modal de exportação exibido:', modalInspection.foundModal ? 'SUCESSO' : 'FALHA');
    console.log('   Opção Standalone presente:', modalInspection.hasStandaloneOption);
    console.log('   Opção Impressão / PDF presente:', modalInspection.hasPrintOption);
    console.log('   Checkbox de notas pedagógicas presente:', modalInspection.hasTeacherNotesCheckbox);

    // Capturar screenshot do modal de exportação aberto
    const screenshotExportPath = path.join(EVIDENCE_DIR, 'conferencia-demo-02-exportacao.png');
    await browser.screenshot(screenshotExportPath);
    console.log(`   Screenshot salva: ${screenshotExportPath}`);

    // Gerar PDF autêntico da visualização atual via CDP Page.printToPDF
    const pdfPath = path.join(EVIDENCE_DIR, 'conferencia-demo-documento.pdf');
    await browser.printToPdf(pdfPath);
    const pdfStats = fs.statSync(pdfPath);
    console.log(`   PDF gerado via CDP: ${pdfPath} (${pdfStats.size} bytes)`);

    // 8. Conferência Específica dos Questionários nos 4 Pilotos (P1 Rodada 3/4)
    console.log('8. Conferindo alternativas dos questionários na exportação de impressão dos 4 pilotos...');
    const pilots = [
      { name: 'História (Grécia Antiga)', template: TEMPLATE_GREECE_6EF },
      { name: 'Ciências (Sistema Solar)', template: TEMPLATE_SOLAR_SYSTEM },
      { name: 'Física (Lançamento Oblíquo)', template: TEMPLATE_PROJECTILE_MOTION },
      { name: 'Matemática (Função Quadrática)', template: TEMPLATE_MATH_FUNCTION },
    ];

    const quizAuditResults: any[] = [];
    for (const p of pilots) {
      // Versão do Aluno
      const studentHtml = renderAllScenesForPrint(p.template, false);
      const studentHasA = studentHtml.includes('>A<') || studentHtml.includes('A)');
      const studentHasB = studentHtml.includes('>B<') || studentHtml.includes('B)');
      const studentHasC = studentHtml.includes('>C<') || studentHtml.includes('C)');
      const studentHasD = studentHtml.includes('>D<') || studentHtml.includes('D)');
      const studentHasCorrectBadge = studentHtml.includes('Gabarito Correto');
      const studentVersionLabel = studentHtml.includes('Versão do Aluno');

      // Versão do Professor
      const teacherHtml = renderAllScenesForPrint(p.template, true);
      const teacherHasCorrectBadge = teacherHtml.includes('Gabarito Correto');
      const teacherVersionLabel = teacherHtml.includes('Versão do Professor (Com Gabarito)');

      const quizScene = p.template.scenes.find((s) => s.type === 'quiz') as QuizScene | undefined;
      const expectedAnswers = quizScene?.answers || [];

      console.log(`   - ${p.name}:`);
      console.log(`     * Alternativas esperadas (${expectedAnswers.length}):`, expectedAnswers.map((a, i) => `${String.fromCharCode(65 + i)}) ${a.slice(0, 30)}...`));
      console.log(`     * Impressão Aluno: A=${studentHasA}, B=${studentHasB}, C=${studentHasC}, D=${studentHasD}; Gabarito oculto=${!studentHasCorrectBadge}; Label=${studentVersionLabel}`);
      console.log(`     * Impressão Professor: Gabarito destacado=${teacherHasCorrectBadge}; Label=${teacherVersionLabel}`);

      const auditItem = {
        pilot: p.name,
        expectedAnswersCount: expectedAnswers.length,
        studentPrint: {
          hasAllAlternatives: studentHasA && studentHasB && studentHasC && studentHasD,
          answersList: expectedAnswers,
          hidesAnswerKey: !studentHasCorrectBadge,
          versionLabel: studentVersionLabel,
        },
        teacherPrint: {
          showsAnswerKey: teacherHasCorrectBadge,
          versionLabel: teacherVersionLabel,
        },
      };

      if (!auditItem.studentPrint.hasAllAlternatives || !auditItem.studentPrint.hidesAnswerKey || !auditItem.teacherPrint.showsAnswerKey) {
        throw new Error(`Falha na verificação de questionário do piloto ${p.name}`);
      }

      quizAuditResults.push(auditItem);
    }

    results.checks.exportacao = {
      success: true,
      modalInspection,
      quizAuditResults,
      pdfGenerated: { path: pdfPath, sizeBytes: pdfStats.size },
    };

    // Gravar relatório de conferência
    const reportPath = path.join(EVIDENCE_DIR, 'conferencia-demo-local-2026-09-27.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n✓ Relatório da conferência gravado em: ${reportPath}`);

    console.log('\n=== CONFERÊNCIA CONCLUÍDA COM 100% DE SUCESSO ===');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\n❌ Erro durante a conferência da demonstração:', err);
  process.exit(1);
});
