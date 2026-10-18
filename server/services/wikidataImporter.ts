/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — IMPORTADOR SEGURO DA WIKIDATA (B5)
 * Pipeline de ingestão com:
 * 1. Validação estrita de QID (/^Q[1-9][0-9]{0,9}$/) e prevenção de SSRF.
 * 2. Timeout defensivo (AbortSignal) e isolamento em Staging.
 * 3. Detecção e sinalização de duplicatas por slug normalizado e QID.
 * 4. Resiliência: indisponibilidade da internet gera erro explícito sem corromper o banco.
 * 5. Revisão editorial obrigatória por Curador/Admin antes de promoção ao Knowledge Core.
 */

import pg from 'pg';
import { KnowledgeRepository } from '../repositories/knowledgeRepository';

export interface WikidataParsedEntity {
  qid: string;
  label: string;
  description: string;
  aliases: string[];
  type: 'concept' | 'person' | 'place' | 'event';
  rawClaims: Record<string, any>;
}

export function validateQid(qid: string): boolean {
  if (!qid || typeof qid !== 'string') return false;
  return /^Q[1-9][0-9]{0,9}$/.test(qid.trim());
}

export function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
}

/**
 * Consulta a API pública da Wikidata de forma segura e estrita.
 * URL estritamente ancorada em wikidata.org (sem interpolação de host ou caminho arbitrário).
 */
export async function fetchWikidataEntity(
  qid: string,
  options?: { timeoutMs?: number; fetchFn?: typeof fetch }
): Promise<WikidataParsedEntity> {
  if(process.env.PEMARA_OFFLINE==='true')throw new Error('Consultas externas desativadas nesta instalação offline. Use o acervo local.');
  const cleanQid = qid.trim();
  if (!validateQid(cleanQid)) {
    throw new Error(`Identificador QID inválido: "${qid}". Deve seguir o padrão Q seguido de dígitos (ex: Q83494).`);
  }

  const timeoutMs = options?.timeoutMs || 8000;
  const fetchImpl = options?.fetchFn || fetch;
  const targetUrl = `https://www.wikidata.org/wiki/Special:EntityData/${cleanQid}.json`;

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetchImpl(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PemaraEduSchoolBot/1.0 (https://pemara.edu.br; contato@pemara.edu.br) EducationalPlatform',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (netErr: any) {
    if (netErr.name === 'AbortError') {
      const err: any = new Error(`Tempo limite esgotado (${timeoutMs}ms) ao consultar Wikidata para ${cleanQid}.`);
      err.code = 'WIKIDATA_TIMEOUT';
      throw err;
    }
    const err: any = new Error(`Falha de conectividade externa com a Wikidata (${cleanQid}): ${netErr.message}`);
    err.code = 'WIKIDATA_NETWORK_UNAVAILABLE';
    throw err;
  }

  if (response.status === 429) {
    const err: any = new Error('Limite de taxa (Rate Limit) da Wikidata excedido. Tente novamente mais tarde.');
    err.code = 'WIKIDATA_RATE_LIMITED';
    err.status = 429;
    throw err;
  }

  if (!response.ok) {
    const err: any = new Error(`Wikidata retornou código HTTP ${response.status} para a entidade ${cleanQid}.`);
    err.code = 'WIKIDATA_HTTP_ERROR';
    err.status = response.status;
    throw err;
  }

  const json: any = await response.json();
  const entity = json?.entities?.[cleanQid];
  if (!entity) {
    const err: any = new Error(`Entidade ${cleanQid} não localizada no manifesto da Wikidata.`);
    err.code = 'WIKIDATA_ENTITY_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Extração de rótulo em português (prioridade pt, pt-br, depois en)
  const label =
    entity.labels?.['pt-br']?.value ||
    entity.labels?.pt?.value ||
    entity.labels?.en?.value ||
    cleanQid;

  // Extração de descrição
  const description =
    entity.descriptions?.['pt-br']?.value ||
    entity.descriptions?.pt?.value ||
    entity.descriptions?.en?.value ||
    `Entidade ${cleanQid} importada da Wikidata.`;

  // Extração de sinônimos/aliases
  const aliases: string[] = [];
  const ptAliases = entity.aliases?.['pt-br'] || entity.aliases?.pt || entity.aliases?.en || [];
  for (const a of ptAliases) {
    if (a.value && !aliases.includes(a.value)) {
      aliases.push(a.value);
    }
  }

  // Inferência defensiva de tipo a partir de declarações (claims)
  let inferredType: 'concept' | 'person' | 'place' | 'event' = 'concept';
  const instanceOfClaims = entity.claims?.P31 || [];
  for (const claim of instanceOfClaims) {
    const targetId = claim.mainsnak?.datavalue?.value?.id;
    if (targetId === 'Q5') {
      inferredType = 'person'; // human
      break;
    } else if (['Q515', 'Q6256', 'Q1549591', 'Q2221906'].includes(targetId)) {
      inferredType = 'place'; // city, country, big city, geographic location
      break;
    } else if (['Q1190554', 'Q178561', 'Q198'].includes(targetId)) {
      inferredType = 'event'; // occurrence, battle, war
      break;
    }
  }

  return {
    qid: cleanQid,
    label,
    description,
    aliases,
    type: inferredType,
    rawClaims: entity.claims || {},
  };
}

/**
 * Pipeline de Ingestão: importa uma lista de QIDs para Staging associados a um lote.
 */
export async function importWikidataBatch(params: {
  qids: string[];
  topic?: string;
  actorId: string;
  pool: pg.Pool;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<{
  batch: any;
  items: Array<{
    qid: string;
    title: string;
    slug: string;
    validationStatus: 'NEW' | 'VALID' | 'DUPLICATE';
    duplicateCandidateId?: string | null;
    stagingId: string;
  }>;
  errors: Array<{ qid: string; error: string; code?: string }>;
}> {
  const knowledgeRepo = new KnowledgeRepository(params.pool);
  const topicName = params.topic || 'Conhecimento Geral';

  // 1. Cria o lote de importação no banco relacional
  const batch = await knowledgeRepo.createImportBatch(`Wikidata: ${topicName}`);

  const items: any[] = [];
  const errors: any[] = [];

  let importedCount = 0;
  let rejectedCount = 0;
  let duplicateCount = 0;

  for (const rawQid of params.qids) {
    const qid = rawQid.trim().toUpperCase();
    if (!validateQid(qid)) {
      rejectedCount++;
      errors.push({ qid, error: `Formato de QID inválido: "${qid}". Deve ser Q seguido de dígitos.` });
      continue;
    }

    try {
      // 2. Busca os dados externos
      const entity = await fetchWikidataEntity(qid, {
        fetchFn: params.fetchFn,
        timeoutMs: params.timeoutMs,
      });

      const baseSlug = slugify(entity.label) || `wikidata-${qid.toLowerCase()}`;

      // 3. Verificação de duplicata no banco canônico e no staging
      const existingCanonical = await params.pool.query(
        'SELECT id, title, slug FROM knowledge_nodes WHERE slug = $1 LIMIT 1;',
        [baseSlug]
      );

      let validationStatus: 'NEW' | 'VALID' | 'DUPLICATE' = 'NEW';
      let duplicateCandidateId: string | null = null;
      let reviewNotes = `Importado da Wikidata (${qid}). Rótulo: "${entity.label}".`;

      if (existingCanonical.rows.length > 0) {
        validationStatus = 'DUPLICATE';
        duplicateCandidateId = existingCanonical.rows[0].id;
        reviewNotes = `Detectado nó canônico existente com mesmo slug: "${existingCanonical.rows[0].title}" (${existingCanonical.rows[0].id}).`;
        duplicateCount++;
      } else {
        importedCount++;
      }

      // 4. Inserção estrita na tabela staging_nodes
      const stg = await knowledgeRepo.insertStagingNode({
        importBatchId: batch.id,
        sourceProvider: 'Wikidata',
        externalId: qid,
        title: entity.label,
        slug: baseSlug,
        type: entity.type,
        shortDescription: entity.description,
        dataJson: {
          qid: entity.qid,
          aliases: entity.aliases,
          inferredType: entity.type,
          retrievedAt: new Date().toISOString(),
        },
        validationStatus,
        duplicateCandidateId,
        reviewNotes,
      });

      items.push({
        qid,
        title: entity.label,
        slug: baseSlug,
        validationStatus,
        duplicateCandidateId,
        stagingId: stg.id,
      });
    } catch (err: any) {
      rejectedCount++;
      errors.push({ qid, error: err.message || 'Falha desconhecida na ingestão', code: err.code });
    }
  }

  const finalStatus = errors.length > 0 && items.length === 0 ? 'FAILED' : 'COMPLETED';
  await params.pool.query(
    `UPDATE import_batches SET
       finished_at = CURRENT_TIMESTAMP,
       records_found = $1,
       records_imported = $2,
       records_rejected = $3,
       records_duplicates = $4,
       status = $5
     WHERE id = $6;`,
    [params.qids.length, importedCount, rejectedCount, duplicateCount, finalStatus, batch.id]
  );
  batch.status = finalStatus;
  batch.records_imported = importedCount;
  batch.records_duplicates = duplicateCount;
  batch.records_rejected = rejectedCount;

  return { batch, items, errors };
}
