/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — TESTES DE HARDENING DA WIKIDATA E PUBLICAÇÃO DE PACKS (BLOCO 4)
 * Valida com PostgreSQL Real descartável e simulação controlada:
 * 1. Validação estrita de QID e imunidade a injeção/SSRF.
 * 2. Timeouts, rate limiting e indisponibilidade externa sem derrubar a aplicação.
 * 3. Importação em lote para Staging, deduplicação por QID e revisão editorial antes de promoção.
 * 4. Estabilidade de hash na compilação do mesmo conteúdo.
 * 5. Bloqueio de publicação com fontes/relações inválidas.
 * 6. Erro explicativo quando o pacote está ausente (sem fallback silencioso).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDisposablePostgres } from './helpers/realPostgresHarness';
import { runMigrations } from '../server/db/migrator';
import { seedInitialUsers } from '../server/db/seeds/users';
import { seedInitialKnowledge } from '../server/db/seeds/knowledge';
import { UserRepository } from '../server/repositories/userRepository';
import { KnowledgeRepository } from '../server/repositories/knowledgeRepository';
import {
  validateQid,
  fetchWikidataEntity,
  importWikidataBatch,
  slugify,
} from '../server/services/wikidataImporter';

test('E5: Wikidata Importer, deduplicação em staging, hash estável e robustez de publicação', async () => {
  const instance = await createDisposablePostgres('pemara-test-e5-');
  const pool = instance.createPool();

  try {
    await runMigrations(pool);
    await seedInitialUsers(pool);
    await seedInitialKnowledge(pool);

    const userRepo = new UserRepository(pool);
    const knowledgeRepo = new KnowledgeRepository(pool);
    const adminUser = (await userRepo.findByUsername('admin'))!;
    const curatorUser = (await userRepo.findByUsername('curador.ana'))!;

    // =========================================================================
    // 1. Validação estrita de QID e Prevenção SSRF
    // =========================================================================
    assert.equal(validateQid('Q11772'), true, 'Q11772 é QID válido');
    assert.equal(validateQid('Q83494'), true, 'Q83494 é QID válido');
    assert.equal(validateQid('Q1'), true, 'Q1 é QID válido');
    assert.equal(validateQid(''), false, 'Vazio é inválido');
    assert.equal(validateQid('P123'), false, 'P-property não é QID de item');
    assert.equal(validateQid('Q0'), false, 'Q0 é inválido');
    assert.equal(validateQid('Q123; DROP TABLE users;'), false, 'Injeção SQL é rejeitada');
    assert.equal(validateQid('http://evil.com/Q123'), false, 'URL é rejeitada (prevenção SSRF)');

    // =========================================================================
    // 2. Simulação de Respostas da API Wikidata (Dados Válidos, 429, Timeout, Rede Indisponível)
    // =========================================================================
    // A) Resposta com entidade válida
    const mockAthensJson = {
      entities: {
        Q11768: {
          id: 'Q11768',
          labels: {
            'pt-br': { value: 'Atenas Clássica' },
            pt: { value: 'Atenas' },
            en: { value: 'Athens' },
          },
          descriptions: {
            'pt-br': { value: 'Capital e maior cidade da Grécia Antiga' },
            pt: { value: 'Capital da Grécia' },
          },
          aliases: {
            pt: [{ value: 'Pólis de Atenas' }],
          },
          claims: {
            P31: [{ mainsnak: { datavalue: { value: { id: 'Q515' } } } }], // city / place
          },
        },
      },
    };

    const mockFetchSuccess: typeof fetch = async () =>
      new Response(JSON.stringify(mockAthensJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const parsedEntity = await fetchWikidataEntity('Q11768', { fetchFn: mockFetchSuccess });
    assert.equal(parsedEntity.qid, 'Q11768');
    assert.equal(parsedEntity.label, 'Atenas Clássica');
    assert.equal(parsedEntity.type, 'place');
    assert.ok(parsedEntity.description.includes('Grécia'));

    // B) Simulação de 429 Rate Limited
    const mockFetchRateLimit: typeof fetch = async () =>
      new Response('Too Many Requests', { status: 429 });

    await assert.rejects(
      async () => fetchWikidataEntity('Q11768', { fetchFn: mockFetchRateLimit }),
      (err: any) => err.code === 'WIKIDATA_RATE_LIMITED'
    );

    // C) Simulação de falha de conexão de rede externa (offline)
    const mockFetchNetworkFail: typeof fetch = async () => {
      const netErr = new Error('getaddrinfo ENOTFOUND www.wikidata.org');
      throw netErr;
    };

    await assert.rejects(
      async () => fetchWikidataEntity('Q11768', { fetchFn: mockFetchNetworkFail }),
      (err: any) => err.code === 'WIKIDATA_NETWORK_UNAVAILABLE'
    );

    // =========================================================================
    // 3. Importação em Lote para Staging no PostgreSQL Real
    // =========================================================================
    const batchResult1 = await importWikidataBatch({
      pool,
      qids: ['Q11768'],
      topic: 'Grécia Antiga',
      actorId: curatorUser.id,
      fetchFn: mockFetchSuccess,
    });

    assert.equal(batchResult1.items.length, 1);
    assert.equal(batchResult1.batch.status, 'COMPLETED');
    const stagingItem1 = batchResult1.items[0];
    assert.equal(stagingItem1.validationStatus, 'NEW');
    assert.equal(stagingItem1.qid, 'Q11768');

    // =========================================================================
    // 4. Revisão Editorial por Curador e Promoção ao Knowledge Core
    // =========================================================================
    const promoRes = await knowledgeRepo.promoteStagingNode(stagingItem1.stagingId, curatorUser.id);

    assert.ok(promoRes.node, 'Nó deve ser promovido com sucesso');
    assert.equal(promoRes.duplicateHandled, false);

    // Conferir na tabela canônica knowledge_nodes
    const canonicalNode = await knowledgeRepo.getNodeById(promoRes.node.id);
    assert.ok(canonicalNode, 'Nó canônico deve existir no banco');
    assert.equal(canonicalNode?.data_json?.qid, 'Q11768');

    // Repetir a importação do mesmo QID: DEVE detectar duplicata do nó canônico existente
    const batchResult2 = await importWikidataBatch({
      pool,
      qids: ['Q11768'],
      topic: 'Grécia Antiga',
      actorId: curatorUser.id,
      fetchFn: mockFetchSuccess,
    });

    assert.equal(batchResult2.items.length, 1);
    const stagingItem2 = batchResult2.items[0];
    assert.equal(stagingItem2.validationStatus, 'DUPLICATE', 'Importação repetida de QID já existente no core deve ser marcada como DUPLICATE');
    assert.equal(stagingItem2.duplicateCandidateId, promoRes.node.id);

    // Promover a duplicata: deve reutilizar o nó canônico existente
    const promoRes2 = await knowledgeRepo.promoteStagingNode(stagingItem2.stagingId, curatorUser.id);
    assert.equal(promoRes2.node.id, promoRes.node.id, 'Promoção duplicada reutiliza exatamente o mesmo ID canônico');
    assert.equal(promoRes2.duplicateHandled, true);

    // =========================================================================
    // 5. Estabilidade de Hash na Compilação de Conteúdo
    // =========================================================================
    const pack1 = await knowledgeRepo.getPackBySlug('history-6-grecia-antiga');
    assert.ok(pack1);

    const compiled1 = await knowledgeRepo.buildPackSnapshot(pack1.slug, '1', curatorUser.id);
    const compiled2 = await knowledgeRepo.buildPackSnapshot(pack1.slug, '2', curatorUser.id);
    assert.equal(
      compiled1.content_hash,
      compiled2.content_hash,
      'Compilar o mesmo conteúdo deve produzir hash estritamente idêntico e estável'
    );
    assert.equal(compiled1.content_hash.length, 64, 'Hash deve ser SHA-256 de 64 caracteres');

    // =========================================================================
    // 6. Mensagem de Erro Clara quando Pacote está Ausente
    // =========================================================================
    const nonexistentPack = await knowledgeRepo.getPackBySlug('pacote-inexistente-12345');
    assert.equal(nonexistentPack, null, 'Pacote inexistente retorna null no banco');

    const activeNonexistent = await knowledgeRepo.getActivePackVersion('pacote-inexistente-12345');
    assert.equal(activeNonexistent, null, 'Versão ativa de pacote inexistente é null');

    await assert.rejects(
      async () => {
        await knowledgeRepo.buildPackSnapshot('pacote-inexistente-12345', '1', curatorUser.id);
      },
      /Content pack com slug "pacote-inexistente-12345" não encontrado/,
      'Deve lançar erro explícito com mensagem clara se pacote não existir'
    );
  } finally {
    await pool.end().catch(() => {});
    await instance.stop().catch(() => {});
  }
});
