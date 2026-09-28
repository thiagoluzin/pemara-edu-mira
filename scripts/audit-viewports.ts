/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — AUDITORIA VISUAL E DE VIEWPORTS (E7 / MULTI-MONITOR)
 * Executa auditoria automatizada em navegador Chrome real via CDP sobre 3 viewports:
 * 1. 1024x768 (Projetor / Monitor legado 4:3)
 * 2. 1366x768 (Laptop educacional padrão)
 * 3. 1920x1080 (Full HD / Monitor moderno)
 * 
 * Percorre todas as 21 cenas dos 4 pilotos pedagógicos no Modo Apresentação:
 * - Grécia Antiga (10 cenas)
 * - Sistema Solar (4 cenas)
 * - Lançamento Oblíquo (4 cenas)
 * - Função Quadrática (3 cenas)
 * 
 * Valida:
 * - Ausência de overflow horizontal (scrollWidth <= clientWidth)
 * - Preservação de layout, margens e legibilidade
 * - Interatividade real (planetas, pausa/play, sliders, questionário)
 * - Salva screenshots comprobatórios em evidencias/viewports/
 * - Emite evidencias/relatorio_auditoria_visual.json
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { launchHeadlessChrome, CdpBrowser } from '../test/helpers/cdpBrowser';
import {
  TEMPLATE_GREECE_6EF,
  TEMPLATE_SOLAR_SYSTEM,
  TEMPLATE_PROJECTILE_MOTION,
  TEMPLATE_MATH_FUNCTION,
} from '../src/templates/deterministicTemplates';
import { generatePrintDocumentHtml } from '../src/components/ExportModal';
import { LessonSpec } from '../src/types/lesson';

export interface ViewportAuditResult {
  viewport: { name: string; width: number; height: number };
  pilot: string;
  sceneIndex: number;
  sceneTitle: string;
  sceneType: string;
  horizontalOverflow: boolean;
  scrollWidth: number;
  clientWidth: number;
  interactiveControlsOk: boolean;
  screenshotPath?: string;
  details?: string;
}

export async function runViewportAudit(): Promise<{
  totalChecks: number;
  violationsCount: number;
  results: ViewportAuditResult[];
  reportPath: string;
}> {
  const distPath = path.resolve('dist-test');
  if (!fs.existsSync(distPath)) {
    throw new Error('dist-test não encontrado. Execute vite build antes da auditoria.');
  }

  const evidenciasDir = path.resolve('evidencias', 'viewports');
  if (!fs.existsSync(evidenciasDir)) {
    fs.mkdirSync(evidenciasDir, { recursive: true });
  }

  // 1. Inicia servidor Express estático local com rota dedicada para impressão/PDF
  const app = express();

  const templateMap: Record<string, LessonSpec> = {
    grecia_antiga: TEMPLATE_GREECE_6EF,
    sistema_solar: TEMPLATE_SOLAR_SYSTEM,
    lancamento_obliquo: TEMPLATE_PROJECTILE_MOTION,
    funcao_quadratica: TEMPLATE_MATH_FUNCTION,
  };

  app.get('/export/print/:slug', (req, res) => {
    const lesson = templateMap[req.params.slug];
    if (!lesson) return res.status(404).send('Piloto não encontrado');
    const html = generatePrintDocumentHtml(lesson, { includeTeacherNotes: false });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  const appUrl = `http://127.0.0.1:${port}`;

  let browser: CdpBrowser | null = null;
  const auditResults: ViewportAuditResult[] = [];

  const viewports = [
    { name: '1024x768', width: 1024, height: 768, description: 'Monitor antigo / Projetor XGA 4:3' },
    { name: '1366x768', width: 1366, height: 768, description: 'Laptop escolar padrão' },
    { name: '1920x1080', width: 1920, height: 1080, description: 'Full HD / Monitor moderno' },
  ];

  const pilots = [
    { title: 'Grécia Antiga: Pólis, Democracia e Sociedade', slug: 'grecia_antiga', scenesCount: 10 },
    { title: 'O Sistema Solar e os Movimentos da Terra', slug: 'sistema_solar', scenesCount: 4 },
    { title: 'Lançamento Oblíquo: Trajetória e Vetores', slug: 'lancamento_obliquo', scenesCount: 4 },
    { title: 'Função Quadrática e a Parábola: y = ax² + bx + c', slug: 'funcao_quadratica', scenesCount: 3 },
  ];

  try {
    browser = await launchHeadlessChrome(9557);

    for (const vp of viewports) {
      console.log(`\n--- Iniciando auditoria para Viewport: ${vp.name} (${vp.description}) ---`);
      await browser.setViewport(vp.width, vp.height);
      await browser.navigate(appUrl);
      await browser.evaluate(`localStorage.clear()`);
      await browser.navigate(appUrl);
      await new Promise((r) => setTimeout(r, 600));

      for (const pilot of pilots) {
        console.log(`  Pilot: ${pilot.title}`);

        // Vai para a aba Minhas Aulas para selecionar e apresentar a aula
        await browser.evaluate(`
          (() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const libBtn = btns.find(b => (b.innerText || '').includes('Minhas Aulas'));
            if (libBtn) libBtn.click();
          })()
        `);
        await new Promise((r) => setTimeout(r, 400));

        // Encontra o card da aula correspondente e clica em Apresentar
        const opened = await browser.evaluate(`
          (() => {
            const cards = Array.from(document.querySelectorAll('h3')).filter(h => (h.innerText || '').includes(${JSON.stringify(pilot.title)}));
            if (cards.length === 0) return false;
            const cardContainer = cards[0].closest('.rounded-2xl');
            if (!cardContainer) return false;
            const presentBtn = Array.from(cardContainer.querySelectorAll('button')).find(b => (b.innerText || '').includes('Apresentar'));
            if (presentBtn) {
              presentBtn.click();
              return true;
            }
            return false;
          })()
        `);

        if (!opened) {
          throw new Error(`Não foi possível abrir apresentação do piloto ${pilot.title}`);
        }

        await new Promise((r) => setTimeout(r, 600)); // Aguarda animação de abertura do modo apresentação

        // Itera por todas as cenas da aula
        for (let s = 0; s < pilot.scenesCount; s++) {
          await new Promise((r) => setTimeout(r, 300));

          // Medições de layout e overflow
          const metrics = await browser.evaluate(`
            (() => {
              const docWidth = document.documentElement.clientWidth;
              const scrollW = document.documentElement.scrollWidth;
              const bodyScrollW = document.body.scrollWidth;
              const windowW = window.innerWidth;
              
              // Verifica se há overflow horizontal na página
              const hasOverflow = (scrollW > windowW + 1) || (bodyScrollW > windowW + 1);

              // Detecta tipo da cena e título no DOM da apresentação ativa
              const presEl = document.querySelector('.fixed.inset-0.z-50') || document.body;
              const mainEl = presEl.querySelector('main') || presEl;
              const titleEl = mainEl.querySelector('h1, h2, h3') || presEl.querySelector('header span');
              const sceneTitle = titleEl ? titleEl.innerText.trim() : 'Cena ' + (${s} + 1);

              let sceneType = 'standard';
              if (mainEl.querySelector('input[type="radio"], [role="radio"]')) sceneType = 'quiz';
              else if (mainEl.querySelector('svg')) sceneType = 'svg_graphic';
              else if (mainEl.querySelector('canvas')) sceneType = 'canvas_simulation';

              return {
                docWidth,
                scrollW,
                bodyScrollW,
                windowW,
                hasOverflow,
                sceneTitle,
                sceneType
              };
            })()
          `);

          let interactiveOk = true;
          let details = 'Layout íntegro sem transbordamento';

          // Testa controles interativos específicos da cena com medição real de causa e efeito
          if (pilot.slug === 'sistema_solar' && s === 2) {
            // 1. Testar Pausa e Reprodução
            await browser.evaluate(`
              (() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const pauseBtn = btns.find(b => (b.innerText || '').includes('Pausar'));
                if (pauseBtn) pauseBtn.click();
              })()
            `);
            await new Promise((r) => setTimeout(r, 200));
            // Medir dias congelados
            const dPaused1 = await browser.evaluate(`
              (() => {
                const m = (document.body.innerText || '').match(/([0-9]+)\\s+dias corridos/);
                return m ? parseInt(m[1], 10) : -1;
              })()
            `);
            await new Promise((r) => setTimeout(r, 250));
            const dPaused2 = await browser.evaluate(`
              (() => {
                const m = (document.body.innerText || '').match(/([0-9]+)\\s+dias corridos/);
                return m ? parseInt(m[1], 10) : -1;
              })()
            `);
            const pauseHalted = (dPaused1 === dPaused2) && (dPaused1 !== -1);

            // 2. Testar Velocidade: despausar e acelerar para 5x
            await browser.evaluate(`
              (() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const playBtn = btns.find(b => (b.innerText || '').includes('Girar Órbitas'));
                if (playBtn) playBtn.click();
                const spd5 = btns.find(b => (b.innerText || '').trim() === '5x');
                if (spd5) spd5.click();
              })()
            `);
            await new Promise((r) => setTimeout(r, 350));
            const dFast = await browser.evaluate(`
              (() => {
                const m = (document.body.innerText || '').match(/([0-9]+)\\s+dias corridos/);
                return m ? parseInt(m[1], 10) : -1;
              })()
            `);
            const speedAccelerated = dFast > dPaused2;

            // 3. Testar Foco no Planeta Marte e Ficha
            await browser.evaluate(`
              (() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const marteBtn = btns.find(b => (b.innerText || '').includes('Marte'));
                if (marteBtn) marteBtn.click();
              })()
            `);
            await new Promise((r) => setTimeout(r, 200));
            const marteCardOk = await browser.evaluate(`
              (() => {
                const card = document.querySelector('.planet-data-card');
                if (!card) return false;
                const txt = card.innerText || '';
                return txt.includes('Marte') && txt.includes('1.52 UA');
              })()
            `);

            // 4. Testar Controle de Órbitas no SVG
            const orbitsInitial = await browser.evaluate(`document.querySelectorAll('.orbit-path').length`);
            await browser.evaluate(`
              (() => {
                const chk = document.querySelector('#orbit-toggle-orbits');
                if (chk) chk.click();
              })()
            `);
            await new Promise((r) => setTimeout(r, 150));
            const orbitsDisabled = await browser.evaluate(`document.querySelectorAll('.orbit-path').length`);
            await browser.evaluate(`
              (() => {
                const chk = document.querySelector('#orbit-toggle-orbits');
                if (chk) chk.click();
              })()
            `);
            await new Promise((r) => setTimeout(r, 150));
            const orbitsRestored = await browser.evaluate(`document.querySelectorAll('.orbit-path').length`);
            const orbitsToggleOk = (orbitsInitial === 8 && orbitsDisabled === 0 && orbitsRestored === 8);

            // 5. Testar Controle de Ficha/Cartão
            await browser.evaluate(`
              (() => {
                const chk = document.querySelector('#orbit-toggle-cards');
                if (chk) chk.click();
              })()
            `);
            await new Promise((r) => setTimeout(r, 150));
            const cardHidden = await browser.evaluate(`!document.querySelector('.planet-data-card')`);
            await browser.evaluate(`
              (() => {
                const chk = document.querySelector('#orbit-toggle-cards');
                if (chk) chk.click();
              })()
            `);
            await new Promise((r) => setTimeout(r, 150));
            const cardRestored = await browser.evaluate(`!!document.querySelector('.planet-data-card')`);
            const cardToggleOk = cardHidden && cardRestored;

            interactiveOk = pauseHalted && speedAccelerated && marteCardOk && orbitsToggleOk && cardToggleOk;
            details = `Simulador Solar: pausa congelou tempo (${pauseHalted}), 5x acelerou ritmo (${speedAccelerated}), Marte focado (${marteCardOk}), órbitas controladas no SVG [8->0->8] (${orbitsToggleOk}), ficha controlada (${cardToggleOk})`;
          } else if (pilot.slug === 'lancamento_obliquo' && s === 2) {
            // Trajetória inicial
            const initialD = await browser.evaluate(`
              (() => {
                const p = document.querySelector('path[stroke-dasharray="4 4"]');
                return p ? p.getAttribute('d') : '';
              })()
            `);

            // Altera slider de velocidade V0 (min=5, max=60) para um valor diferente do atual
            const targetV = await browser.evaluate(`
              (() => {
                const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
                const vSlider = sliders.find(s => s.getAttribute('min') === '5' && s.getAttribute('max') === '60');
                if (vSlider) {
                  const currentVal = parseFloat(vSlider.value);
                  const nextVal = currentVal === 20 ? '30' : '20';
                  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                  if (setter) setter.call(vSlider, nextVal);
                  else vSlider.value = nextVal;
                  vSlider.dispatchEvent(new Event('input', { bubbles: true }));
                  vSlider.dispatchEvent(new Event('change', { bubbles: true }));
                  return nextVal;
                }
                return '20';
              })()
            `);
            await new Promise((r) => setTimeout(r, 200));

            const afterVD = await browser.evaluate(`
              (() => {
                const p = document.querySelector('path[stroke-dasharray="4 4"]');
                return p ? p.getAttribute('d') : '';
              })()
            `);

            // Altera slider de ângulo θ (min=5, max=85) para um valor diferente do atual
            const targetAngle = await browser.evaluate(`
              (() => {
                const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
                const aSlider = sliders.find(s => s.getAttribute('min') === '5' && s.getAttribute('max') === '85');
                if (aSlider) {
                  const currentVal = parseFloat(aSlider.value);
                  const nextVal = currentVal === 70 ? '60' : '70';
                  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                  if (setter) setter.call(aSlider, nextVal);
                  else aSlider.value = nextVal;
                  aSlider.dispatchEvent(new Event('input', { bubbles: true }));
                  aSlider.dispatchEvent(new Event('change', { bubbles: true }));
                  return nextVal;
                }
                return '70';
              })()
            `);
            await new Promise((r) => setTimeout(r, 200));

            const afterAngleD = await browser.evaluate(`
              (() => {
                const p = document.querySelector('path[stroke-dasharray="4 4"]');
                return p ? p.getAttribute('d') : '';
              })()
            `);

            const telemetriaOk = await browser.evaluate(`
              (() => {
                const txt = document.body.innerText;
                return txt.includes(${JSON.stringify(targetV)} + ' m/s') && txt.includes(${JSON.stringify(targetAngle)} + '°');
              })()
            `);

            const pathChangedV = (initialD !== '' && afterVD !== '' && initialD !== afterVD);
            const pathChangedAngle = (afterVD !== '' && afterAngleD !== '' && afterVD !== afterAngleD);

            interactiveOk = pathChangedV && pathChangedAngle && telemetriaOk;
            details = `Simulador Projétil: velocidade (${targetV} m/s) recalculou curva (${pathChangedV}), ângulo (${targetAngle}°) recalculou curva (${pathChangedAngle}), telemetria atualizada (${telemetriaOk})`;
          } else if (pilot.slug === 'funcao_quadratica' && s === 1) {
            const initialParabolaD = await browser.evaluate(`
              (() => {
                const p = document.querySelector('svg path[stroke="#10b981"]');
                return p ? p.getAttribute('d') : '';
              })()
            `);

            // Altera coeficiente 'a' (min="-5", max="5") para valor diferente do atual
            const targetA = await browser.evaluate(`
              (() => {
                const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
                const aSlider = sliders.find(s => s.getAttribute('min') === '-5' && s.getAttribute('max') === '5');
                if (aSlider) {
                  const currentVal = parseFloat(aSlider.value);
                  const nextVal = currentVal === -2 ? '2' : '-2';
                  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                  if (setter) setter.call(aSlider, nextVal);
                  else aSlider.value = nextVal;
                  aSlider.dispatchEvent(new Event('input', { bubbles: true }));
                  aSlider.dispatchEvent(new Event('change', { bubbles: true }));
                  return nextVal;
                }
                return '-2';
              })()
            `);
            await new Promise((r) => setTimeout(r, 200));

            const afterAD = await browser.evaluate(`
              (() => {
                const p = document.querySelector('svg path[stroke="#10b981"]');
                return p ? p.getAttribute('d') : '';
              })()
            `);
            const mathTextAfterA = await browser.evaluate(`document.body.innerText`);
            const concavidadeOk = targetA === '-2'
              ? (mathTextAfterA.includes('Concavidade voltada para baixo') || mathTextAfterA.includes('-2x²'))
              : (mathTextAfterA.includes('Concavidade voltada para cima') || mathTextAfterA.includes('2x²'));

            // Altera coeficiente 'c' (min="-10", max="10") para valor diferente do atual
            const targetC = await browser.evaluate(`
              (() => {
                const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
                const cSlider = sliders.find(s => s.getAttribute('min') === '-10' && s.getAttribute('max') === '10');
                if (cSlider) {
                  const currentVal = parseFloat(cSlider.value);
                  const nextVal = currentVal === 4 ? '-3' : '4';
                  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                  if (setter) setter.call(cSlider, nextVal);
                  else cSlider.value = nextVal;
                  cSlider.dispatchEvent(new Event('input', { bubbles: true }));
                  cSlider.dispatchEvent(new Event('change', { bubbles: true }));
                  return nextVal;
                }
                return '4';
              })()
            `);
            await new Promise((r) => setTimeout(r, 200));

            const afterCD = await browser.evaluate(`
              (() => {
                const p = document.querySelector('svg path[stroke="#10b981"]');
                return p ? p.getAttribute('d') : '';
              })()
            `);

            const curveChangedA = (initialParabolaD !== '' && afterAD !== '' && initialParabolaD !== afterAD);
            const curveChangedC = (afterAD !== '' && afterCD !== '' && afterAD !== afterCD);

            interactiveOk = curveChangedA && curveChangedC && concavidadeOk;
            details = `Explorador Parábola: coeficiente 'a' (${targetA}) recalculou curva (${curveChangedA}), coeficiente 'c' (${targetC}) recalculou curva (${curveChangedC}), texto atualizado (${concavidadeOk})`;
          } else if (metrics.sceneType === 'quiz') {
            const quizFeedback = await browser.evaluate(`
              (() => {
                const quizContainer = document.querySelector('.space-y-3');
                if (!quizContainer) return { clicked: false, hasExplanation: false, hasStyle: false };
                const optionButtons = Array.from(quizContainer.querySelectorAll('button'));
                if (optionButtons.length === 0) return { clicked: false, hasExplanation: false, hasStyle: false };

                // Clica na primeira alternativa
                optionButtons[0].click();

                // Verifica se a explicação apareceu no DOM
                const txt = document.body.innerText;
                const hasExplanation = txt.includes('Veja a explicação') || txt.includes('Resposta Correta') || txt.includes('Parabéns');

                // Verifica estilo de feedback
                const buttonClasses = optionButtons.map(b => b.className).join(' ');
                const hasStyle = buttonClasses.includes('border-emerald-500') || buttonClasses.includes('border-rose-500') || buttonClasses.includes('bg-emerald-950') || buttonClasses.includes('bg-rose-950');

                return {
                  clicked: true,
                  hasExplanation,
                  hasStyle
                };
              })()
            `);

            interactiveOk = quizFeedback.clicked && quizFeedback.hasExplanation && quizFeedback.hasStyle;
            details = `Questionário interativo: alternativa clicada (${quizFeedback.clicked}), feedback explicativo exibido (${quizFeedback.hasExplanation}), estilo de acerto/erro aplicado (${quizFeedback.hasStyle})`;
          }

          // Salva screenshot comprobatório para cenas marcantes (ou a cada 3 cenas)
          let shotPath: string | undefined;
          if (s === 0 || s === 1 || s === 2 || s === pilot.scenesCount - 1) {
            shotPath = path.resolve(evidenciasDir, `vp_${vp.name}_${pilot.slug}_cena_${s + 1}.png`);
            await browser.screenshot(shotPath);
          }

          auditResults.push({
            viewport: { name: vp.name, width: vp.width, height: vp.height },
            pilot: pilot.title,
            sceneIndex: s + 1,
            sceneTitle: metrics.sceneTitle,
            sceneType: metrics.sceneType,
            horizontalOverflow: metrics.hasOverflow,
            scrollWidth: metrics.scrollW,
            clientWidth: metrics.windowW,
            interactiveControlsOk: interactiveOk,
            screenshotPath: shotPath,
            details
          });

          // Avança para o próximo slide
          if (s < pilot.scenesCount - 1) {
            await browser.evaluate(`
              (() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const nextBtn = btns.find(b => (b.innerText || '').includes('Próximo'));
                if (nextBtn) nextBtn.click();
              })()
            `);
          }
        }

        // Fecha apresentação (botão Sair ou Escape)
        await browser.evaluate(`
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const closeBtn = btns.find(b => (b.innerText || '').includes('Sair do Modo Apresentação'));
            if (closeBtn) closeBtn.click();
          })()
        `);
        await browser.pressKey('Escape');
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    // 2. Geração e verificação dos 4 PDFs reais dos pilotos pedagógicos
    console.log('\n--- Gerando e conferindo PDFs reais dos quatro pilotos pedagógicos ---');
    const pdfsDir = path.resolve('evidencias', 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }

    for (const pilot of pilots) {
      const pdfFilePath = path.resolve(pdfsDir, `piloto_${pilot.slug}.pdf`);
      await browser.navigate(`${appUrl}/export/print/${pilot.slug}`);
      await new Promise((r) => setTimeout(r, 600));

      await browser.printToPdf(pdfFilePath);

      const exists = fs.existsSync(pdfFilePath);
      if (!exists) {
        throw new Error(`Falha ao gerar arquivo PDF para piloto ${pilot.slug}`);
      }
      const buf = fs.readFileSync(pdfFilePath);
      const validHeader = buf.slice(0, 5).toString() === '%PDF-';
      const sizeBytes = buf.length;

      console.log(`  PDF gerado: piloto_${pilot.slug}.pdf (${sizeBytes} bytes, cabeçalho %PDF-: ${validHeader})`);
      if (!validHeader || sizeBytes < 5000) {
        throw new Error(`PDF gerado para ${pilot.slug} é inválido ou truncado: tamanho=${sizeBytes}`);
      }
    }

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // Gera relatório JSON consolidado
  const reportPath = path.resolve('evidencias', 'relatorio_auditoria_visual.json');
  const violations = auditResults.filter((r) => r.horizontalOverflow || !r.interactiveControlsOk);

  const summary = {
    timestamp: new Date().toISOString(),
    viewportsAudited: viewports,
    totalScenesChecked: auditResults.length,
    violationsCount: violations.length,
    status: violations.length === 0 ? 'APROVADO' : 'REPROVADO',
    results: auditResults
  };

  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`\nAuditoria concluída! Total de verificações: ${auditResults.length}. Violações: ${violations.length}.`);
  console.log(`Relatório salvo em: ${reportPath}`);

  return {
    totalChecks: auditResults.length,
    violationsCount: violations.length,
    results: auditResults,
    reportPath
  };
}

if (process.argv[1] && process.argv[1].endsWith('audit-viewports.ts')) {
  runViewportAudit()
    .then((res) => {
      if (res.violationsCount > 0) {
        console.error(`Auditoria falhou com ${res.violationsCount} violações.`);
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Erro na auditoria visual:', err);
      process.exit(1);
    });
}
