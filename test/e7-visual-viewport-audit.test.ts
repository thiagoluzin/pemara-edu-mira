/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — TESTE AUTOMATIZADO DE AUDITORIA VISUAL E MULTI-MONITOR (E7)
 * Valida os 4 pilotos pedagógicos (20 cenas no total) sob 3 viewports:
 * - 1024x768 (Projetor/Legado)
 * - 1366x768 (Laptop padrão)
 * - 1920x1080 (Full HD)
 * 
 * Critérios:
 * - Zero overflow horizontal em todas as cenas.
 * - Todos os controles interativos operantes.
 * - Screenshots e métricas salvos em evidencias/.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runViewportAudit } from '../scripts/audit-viewports';

test('E7: Auditoria visual e de responsividade em navegador real (1024x768, 1366x768, 1920x1080)', async () => {
  const audit = await runViewportAudit();
  
  assert.equal(audit.totalChecks, 60, 'Devem ser validadas 60 instâncias de cena (20 cenas x 3 viewports)');
  assert.equal(audit.violationsCount, 0, `Não deve haver nenhuma violação de overflow ou controle quebrado. Encontradas: ${audit.violationsCount}`);
});
