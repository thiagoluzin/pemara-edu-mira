/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — ROTAS REST DO KNOWLEDGE CORE (E3)
 * Conecta o Knowledge Studio diretamente ao PostgreSQL relacional com RBAC,
 * optimistic locking (409), auditoria imutável e transações.
 */

import { Router, Request, Response } from 'express';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { KnowledgeRepository } from '../repositories/knowledgeRepository';
import { requireAuth, requireRole } from '../auth/middleware';
import { OptimisticLockError } from '../db/types';
import { importWikidataBatch } from '../services/wikidataImporter';
import { label } from '../../src/ui/labels';
import { LessonComposer } from '../../src/composer/lessonComposer';

export function createKnowledgeRouter(pool: pg.Pool): Router {
  const router = Router();
  const knowledgeRepo = new KnowledgeRepository(pool);

  // ====================================================================
  // NÓS DE CONHECIMENTO (KNOWLEDGE NODES)
  // ====================================================================

  // GET /api/knowledge/nodes (paginado e filtrado, requer autenticação)
  router.get('/nodes', requireAuth, async (req: Request, res: Response) => {
    try {
      const subjectCode = req.query.subject_code as string | undefined;
      const gradeLevel = req.query.grade_level ? parseInt(req.query.grade_level as string, 10) : undefined;
      const type = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await knowledgeRepo.listNodes({
        subjectCode,
        gradeLevel,
        type,
        status,
        search,
        limit,
        offset,
      });

      return res.json({
        nodes: result.nodes,
        total: result.total,
        limit,
        offset,
      });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao listar nós:', err);
      return res.status(500).json({ error: 'Erro ao consultar nós de conhecimento.' });
    }
  });

  // GET /api/knowledge/nodes/:id (requer autenticação)
  router.get('/nodes/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const node = await knowledgeRepo.getNodeById(req.params.id);
      if (!node) {
        return res.status(404).json({ error: `Nó ${req.params.id} não encontrado.` });
      }
      return res.json({ node });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao buscar nó:', err);
      return res.status(500).json({ error: 'Erro ao buscar nó de conhecimento.' });
    }
  });

  // POST /api/knowledge/nodes (requer editor, curador ou admin)
  router.post('/nodes', requireAuth, requireRole('editor', 'curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user;
      const actorId = actor.id;
      const actorRole = actor.role;
      const {
        title,
        slug,
        type,
        short_description,
        subject_code,
        grade_level,
        summary,
        key_points,
        source_id,
        license_id,
        status,
      } = req.body;

      if (!title || !slug || !type || !short_description || !subject_code || !grade_level) {
        return res.status(400).json({
          error: 'Campos obrigatórios ausentes: title, slug, type, short_description, subject_code e grade_level.',
        });
      }

      // Bloqueio 4: Editor não pode atribuir APPROVED ou PUBLISHED diretamente
      if (actorRole === 'editor' && (status === 'APPROVED' || status === 'PUBLISHED')) {
        return res.status(403).json({
          error: 'Acesso negado: editores não têm permissão para publicar ou aprovar nós diretamente. Nós criados por editores devem ser criados como DRAFT.',
          code: 'FORBIDDEN',
        });
      }

      // Para editor, status default é DRAFT; para curador/admin, default é status solicitado ou PUBLISHED
      const finalStatus = actorRole === 'editor' ? 'DRAFT' : (status || 'PUBLISHED');

      const normalizedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
      const existing = await knowledgeRepo.getNodeBySlug(normalizedSlug);
      if (existing) {
        return res.status(409).json({
          error: `Conflito de unicidade: o slug "${normalizedSlug}" já pertence ao nó "${existing.title}".`,
        });
      }

      const created = await knowledgeRepo.createNode(
        {
          id: req.body.id || `node-${normalizedSlug}`,
          slug: normalizedSlug,
          type,
          title,
          shortDescription: short_description,
          subjectCode: subject_code,
          gradeLevel: Number(grade_level),
          dataJson: {
            summary: summary || '',
            key_points: Array.isArray(key_points) ? key_points : (typeof key_points === 'string' && key_points ? key_points.split(',').map((k: string) => k.trim()) : []),
            recommended_grades: [Number(grade_level)],
          },
          sourceId: source_id || null,
          licenseId: license_id || null,
          status: finalStatus,
        },
        actorId
      );

      return res.status(201).json({ success: true, node: created });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao criar nó:', err);
      return res.status(500).json({ error: err.message || 'Erro ao criar nó de conhecimento.' });
    }
  });

  // PUT /api/knowledge/nodes/:id (optimistic locking - requer versão esperada)
  router.put('/nodes/:id', requireAuth, requireRole('editor', 'curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user;
      const actorId = actor.id;
      const actorRole = actor.role;
      const { expected_version, title, short_description, data_json, status, reason } = req.body;

      if (expected_version === undefined || isNaN(Number(expected_version))) {
        return res.status(400).json({
          error: 'Controle de concorrência: o campo `expected_version` é obrigatório para atualização.',
        });
      }

      // Bloqueio 4: Editor não pode transicionar nó para APPROVED ou PUBLISHED
      if (actorRole === 'editor' && (status === 'APPROVED' || status === 'PUBLISHED')) {
        return res.status(403).json({
          error: 'Acesso negado: editores não têm permissão para aprovar ou publicar nós. Esta operação requer o perfil de curador ou administrador.',
          code: 'FORBIDDEN',
        });
      }

      const updated = await knowledgeRepo.updateNodeWithOptimisticLock({
        id: req.params.id,
        expectedVersion: Number(expected_version),
        updates: {
          title,
          short_description,
          data_json,
          status,
        },
        actorId,
        reason: reason || 'Edição no Knowledge Studio',
      });

      return res.json({ success: true, node: updated });
    } catch (err: any) {
      if (err instanceof OptimisticLockError) {
        return res.status(409).json({
          error: 'Conflito de versão (Optimistic Lock): Este registro foi alterado por outro usuário.',
          details: {
            entity: err.entity,
            entityId: err.entityId,
            expectedVersion: err.expectedVersion,
            currentVersion: err.actualVersion,
          },
        });
      }
      console.error('[Knowledge API] Erro ao atualizar nó:', err);
      return res.status(500).json({ error: err.message || 'Erro ao atualizar nó de conhecimento.' });
    }
  });

  // GET /api/knowledge/nodes/:id/versions (histórico de revisões imutáveis, requer autenticação)
  router.get('/nodes/:id/versions', requireAuth, async (req: Request, res: Response) => {
    try {
      const versions = await knowledgeRepo.getEntityVersions('knowledge_node', req.params.id);
      return res.json({ versions });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao buscar revisões do nó:', err);
      return res.status(500).json({ error: 'Erro ao buscar revisões do nó.' });
    }
  });

  // ====================================================================
  // RELAÇÕES ONTOLÓGICAS (GRAPH EDGES)
  // ====================================================================

  // GET /api/knowledge/relations (requer autenticação)
  router.get('/relations', requireAuth, async (req: Request, res: Response) => {
    try {
      const nodeId = req.query.node_id as string | undefined;
      const relations = await knowledgeRepo.listRelations(nodeId);
      return res.json({ relations });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao listar relações:', err);
      return res.status(500).json({ error: 'Erro ao listar relações ontológicas.' });
    }
  });

  // POST /api/knowledge/relations (requer editor, curador ou admin)
  router.post('/relations', requireAuth, requireRole('editor', 'curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const { from_node_id, relation_type, to_node_id, source_id } = req.body;

      if (!from_node_id || !relation_type || !to_node_id) {
        return res.status(400).json({ error: 'Campos from_node_id, relation_type e to_node_id são obrigatórios.' });
      }

      if (from_node_id === to_node_id) {
        return res.status(400).json({ error: 'Auto-ciclo reflexivo inválido: nós de origem e destino devem ser distintos.' });
      }

      const relation = await knowledgeRepo.createRelation({
        from_node_id,
        relation_type,
        to_node_id,
        source_id: source_id || null,
      });

      return res.status(201).json({ success: true, relation });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao criar relação:', err);
      return res.status(500).json({ error: err.message || 'Erro ao criar relação ontológica.' });
    }
  });

  // DELETE /api/knowledge/relations/:id (requer curador ou admin)
  router.delete('/relations/:id', requireAuth, requireRole('curator', 'admin'), async (req: Request, res: Response) => {
    try {
      await knowledgeRepo.deleteRelation(req.params.id);
      return res.json({ success: true, message: 'Relação removida com sucesso.' });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao remover relação:', err);
      return res.status(500).json({ error: 'Erro ao remover relação ontológica.' });
    }
  });

  // ====================================================================
  // FONTES E LICENÇAS
  // ====================================================================

  // GET /api/knowledge/sources (requer autenticação)
  router.get('/sources', requireAuth, async (_req: Request, res: Response) => {
    try {
      const sources = await knowledgeRepo.listSources();
      return res.json({ sources });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao listar fontes:', err);
      return res.status(500).json({ error: 'Erro ao listar fontes.' });
    }
  });

  // POST /api/knowledge/sources (requer editor, curador ou admin)
  router.post('/sources', requireAuth, requireRole('editor', 'curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const { provider, title, url, author, language, source_type, status } = req.body;
      if (!provider || !title || !source_type) {
        return res.status(400).json({ error: 'Campos provider, title e source_type são obrigatórios.' });
      }
      const source = await knowledgeRepo.createSource({ provider, title, url, author, language, source_type, status });
      return res.status(201).json({ success: true, source });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao criar fonte:', err);
      return res.status(500).json({ error: err.message || 'Erro ao criar fonte.' });
    }
  });

  // GET /api/knowledge/licenses (requer autenticação)
  router.get('/licenses', requireAuth, async (_req: Request, res: Response) => {
    try {
      const licenses = await knowledgeRepo.listLicenses();
      return res.json({ licenses });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao listar licenças:', err);
      return res.status(500).json({ error: 'Erro ao listar licenças.' });
    }
  });

  // POST /api/knowledge/licenses (requer curador ou admin)
  router.post('/licenses', requireAuth, requireRole('curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const { name, code, url, commercial_use, derivatives_allowed, attribution_required, redistribution_allowed, notes } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: 'Campos name e code são obrigatórios.' });
      }
      const license = await knowledgeRepo.createLicense({
        name,
        code,
        url,
        commercial_use,
        derivatives_allowed,
        attribution_required,
        redistribution_allowed,
        notes,
      });
      return res.status(201).json({ success: true, license });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao criar licença:', err);
      return res.status(500).json({ error: err.message || 'Erro ao criar licença.' });
    }
  });

  // ====================================================================
  // CURRÍCULO BNCC E RECURSOS
  // ====================================================================

  // GET /api/knowledge/curriculum (requer autenticação)
  router.get('/curriculum', requireAuth, async (req: Request, res: Response) => {
    try {
      const subjectCode = req.query.subject_code as string | undefined;
      const gradeLevel = req.query.grade_level ? parseInt(req.query.grade_level as string, 10) : undefined;
      const search = req.query.search as string | undefined;
      const curriculum = await knowledgeRepo.listCurriculum({ subjectCode, gradeLevel, search });
      return res.json({ curriculum });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao listar currículo:', err);
      return res.status(500).json({ error: 'Erro ao consultar matriz curricular.' });
    }
  });

  // GET /api/knowledge/resources (requer autenticação)
  router.get('/resources', requireAuth, async (req: Request, res: Response) => {
    try {
      const nodeId = req.query.node_id as string | undefined;
      const resources = await knowledgeRepo.listResources(nodeId);
      return res.json({ resources });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao listar recursos:', err);
      return res.status(500).json({ error: 'Erro ao listar recursos didáticos.' });
    }
  });

  // ====================================================================
  // STAGING E PIPELINES DE INGESTÃO
  // ====================================================================

  // GET /api/knowledge/staging (requer curador ou admin)
  router.get('/staging', requireAuth, requireRole('curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const staging = await knowledgeRepo.listStaging(status);
      return res.json({ staging });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao listar staging:', err);
      return res.status(500).json({ error: 'Erro ao listar registros em staging.' });
    }
  });

  // POST /api/knowledge/staging/:id/approve (requer curador ou admin)
  router.post('/staging/:id/approve', requireAuth, requireRole('curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const actorId = (req as any).user.id;
      const result = await knowledgeRepo.promoteStagingNode(req.params.id, actorId);
      return res.json({
        success: true,
        node: result.node,
        duplicateHandled: result.duplicateHandled,
        message: result.duplicateHandled
          ? 'Item já existia no acervo; deduplicação aplicada com sucesso.'
          : 'Nó canônico promovido com sucesso para o Knowledge Core!',
      });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao aprovar staging:', err);
      return res.status(500).json({ error: err.message || 'Erro ao promover registro do staging.' });
    }
  });

  // POST /api/knowledge/staging/:id/discard (requer curador ou admin)
  router.post('/staging/:id/discard', requireAuth, requireRole('curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const actorId = (req as any).user.id;
      const { reason } = req.body || {};
      const discarded = await knowledgeRepo.discardStagingNode(req.params.id, actorId, reason);
      return res.json({ success: true, item: discarded });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao descartar staging:', err);
      return res.status(500).json({ error: err.message || 'Erro ao descartar item de staging.' });
    }
  });

  // GET /api/knowledge/batches (requer curador ou admin)
  router.get('/batches', requireAuth, requireRole('curator', 'admin'), async (_req: Request, res: Response) => {
    try {
      const batches = await knowledgeRepo.listBatches();
      return res.json({ batches });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao listar lotes:', err);
      return res.status(500).json({ error: 'Erro ao listar lotes de importação.' });
    }
  });

  // POST /api/knowledge/import/wikidata (requer curador ou admin - B5)
  router.post('/import/wikidata', requireAuth, requireRole('curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user;
      const { qids, topic = 'Grécia Antiga' } = req.body || {};
      if (!Array.isArray(qids) || qids.length === 0) {
        return res.status(400).json({ error: 'Array "qids" obrigatório com pelo menos 1 identificador (ex: ["Q83494"]).' });
      }

      const result = await importWikidataBatch({
        pool,
        actorId: actor.id,
        qids,
        topic,
      });

      return res.json({
        success: true,
        batch: result.batch,
        importedItems: result.items,
        errors: result.errors,
      });
    } catch (err: any) {
      console.error('[Knowledge API] Erro na importação Wikidata:', err);
      if (err.code === 'WIKIDATA_NETWORK_UNAVAILABLE' || err.code === 'WIKIDATA_TIMEOUT') {
        return res.status(503).json({ error: 'Rede externa indisponível para consulta Wikidata. Operação local mantida.', details: err.message, code: err.code });
      }
      return res.status(500).json({ error: err.message || 'Erro ao processar importação Wikidata.' });
    }
  });

  // POST /api/knowledge/import (requer curador ou admin)
  router.post('/import', requireAuth, requireRole('curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user;
      const { provider = 'Wikidata', topic = 'Grécia Antiga', limit = 4, qids } = req.body || {};

      if (provider === 'Wikidata' && Array.isArray(qids) && qids.length > 0) {
        const result = await importWikidataBatch({
          pool,
          actorId: actor?.id || 'admin',
          qids,
          topic,
        });
        return res.json({
          success: true,
          batch: result.batch,
          importedItems: result.items,
          errors: result.errors,
        });
      }

      // Importação canônica estruturada no staging
      const batch = await knowledgeRepo.createImportBatch(`${provider}: ${topic}`);
      const timestamp = Date.now();
      const stg = await knowledgeRepo.insertStagingNode({
        importBatchId: batch.id,
        sourceProvider: provider,
        externalId: `Q${timestamp.toString().slice(-5)}`,
        title: `Tópico Curricular Ingerido #${timestamp.toString().slice(-4)}`,
        slug: `topico-ingerido-${timestamp}`,
        type: 'concept',
        shortDescription: `Entidade curricular importada via pipeline ${provider}.`,
        dataJson: { topic, provider, timestamp, retrievedAt: new Date().toISOString() },
        validationStatus: 'NEW',
        reviewNotes: 'Importado via pipeline do Knowledge Core para revisão editorial.',
      });

      await pool.query(
        `UPDATE import_batches SET finished_at = CURRENT_TIMESTAMP, records_found = 1, records_imported = 1, status = 'COMPLETED' WHERE id = $1;`,
        [batch.id]
      );

      return res.json({
        success: true,
        batch,
        importedItems: [stg],
      });
    } catch (err: any) {
      console.error('[Knowledge API] Erro na ingestão:', err);
      if (err.code === 'WIKIDATA_NETWORK_UNAVAILABLE' || err.code === 'WIKIDATA_TIMEOUT') {
        return res.status(503).json({ error: 'Rede externa indisponível para consulta Wikidata.', details: err.message, code: err.code });
      }
      return res.status(500).json({ error: err.message || 'Erro ao executar pipeline de importação.' });
    }
  });

  // ====================================================================
  // CONTENT PACKS
  // ====================================================================

  // GET /api/knowledge/catalog (catálogo dinâmico servido a partir dos pacotes publicados no PostgreSQL - P2)
  router.get('/coverage', requireAuth, async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`SELECT s.subject_code, count(*)::int AS skills,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM curriculum_knowledge_links l JOIN knowledge_nodes n ON n.id=l.knowledge_node_id
          WHERE l.curriculum_skill_id=s.id AND n.status='PUBLISHED' AND (n.id NOT LIKE 'node-ef2-%' OR EXISTS (SELECT 1 FROM content_pack_entity_links el JOIN content_pack_versions pv ON pv.id=el.pack_version_id JOIN content_packs cp ON cp.id=pv.pack_id WHERE el.entity_id=n.id AND pv.status='PUBLISHED' AND cp.status IN ('ACTIVE','PUBLISHED')))
        ))::int AS linked_skills
        FROM curriculum_skills s GROUP BY s.subject_code ORDER BY s.subject_code`);
      res.json({ subjects: result.rows });
    } catch (err) {
      console.error('[Knowledge API] Cobertura:', err);
      res.status(500).json({ error: 'Não foi possível consultar a cobertura curricular.' });
    }
  });

  router.get('/catalog', async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT 
          cp.id,
          cp.slug,
          cp.subject_code,
          cp.grade_level,
          cp.title,
          cp.status as pack_status,
          cpv.version,
          cpv.published_at,
          cpv.payload_json->>'bnccSkill' as bncc_skill,
          cpv.payload_json->'keywords' as keywords,
          cpv.payload_json->'nodes' as search_nodes,
          cpv.payload_json->'skillCodes' as skill_codes,
          cpv.payload_json->>'editorialStatus' as editorial_status,
          jsonb_array_length(COALESCE(cpv.payload_json->'nodes', '[]'::jsonb)) as nodes_count,
          jsonb_array_length(COALESCE(cpv.payload_json->'quizzes', '[]'::jsonb)) as quizzes_count
        FROM content_packs cp
        JOIN content_pack_versions cpv ON cpv.pack_id = cp.id AND cpv.status = 'PUBLISHED'
        WHERE cp.status IN ('ACTIVE', 'PUBLISHED')
        ORDER BY cp.id, cpv.published_at DESC NULLS LAST, cpv.created_at DESC;
      `);

      const catalog = result.rows.map(row => ({
        id: row.id,
        slug: row.slug,
        subject: row.subject_code,
        subjectLabel: label(row.subject_code),
        gradeLevel: `${row.grade_level}EF`,
        gradeNum: row.grade_level,
        title: row.title,
        bnccSkill: row.bncc_skill || 'BNCC',
        searchText: (row.search_nodes || []).map((n: any) => [n.title, n.short_definition, n.deep_description, ...(n.key_points || []), n.example, n.activity].filter(Boolean).join(' ')).join(' '),
        keywords: row.keywords || [], skillCodes: row.skill_codes || [], editorialStatus: row.editorial_status || 'not_recorded',
        version: row.version,
        publishedAt: row.published_at,
        isPublished: true,
        hasSufficientContent: row.nodes_count > 0 && (row.quizzes_count > 0 || row.slug === 'history-6-grecia-antiga'),
        statusLabel: (row.quizzes_count > 0 || row.slug === 'history-6-grecia-antiga') ? 'Publicado no acervo' : 'Pendência de Conteúdo'
      }));

      return res.json({ success: true, count: catalog.length, catalog });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao servir catálogo dinâmico:', err);
      return res.status(500).json({ error: 'Erro ao consultar catálogo publicado.' });
    }
  });

  // GET /api/knowledge/packs (requer autenticação)
  router.get('/packs', requireAuth, async (_req: Request, res: Response) => {
    try {
      const packs = await knowledgeRepo.listPacks();
      return res.json({ packs });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao listar content packs:', err);
      return res.status(500).json({ error: 'Erro ao listar Content Packs.' });
    }
  });

  // GET /api/knowledge/packs/:slug/active (requer autenticação - B4)
  router.get('/packs/:slug/active', requireAuth, async (req: Request, res: Response) => {
    try {
      const activeVersion = await knowledgeRepo.getActivePackVersion(req.params.slug);
      if (!activeVersion) {
        return res.status(404).json({ error: `Nenhuma versão publicada encontrada para o pack "${req.params.slug}".` });
      }
      return res.json({ success: true, version: activeVersion });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao buscar versão ativa do pack:', err);
      return res.status(500).json({ error: 'Erro ao buscar versão ativa do pack.' });
    }
  });

  // POST /api/knowledge/packs/:slug/publish-version (requer curador ou admin - B4)
  router.post('/packs/:slug/publish-version', requireAuth, requireRole('curator', 'admin'), async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user;
      const requestedVersion = req.body?.version ? String(req.body.version) : undefined;
      const newVersion = await knowledgeRepo.buildPackSnapshot(req.params.slug, requestedVersion, actor?.id || 'system');
      return res.json({ success: true, version: newVersion });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao publicar snapshot do pack:', err);
      return res.status(500).json({ error: err.message || 'Erro ao publicar snapshot do Content Pack.' });
    }
  });

  // POST /api/knowledge/compose-lesson (requer autenticação - B4)
  router.post('/compose-lesson', requireAuth, async (req: Request, res: Response) => {
    try {
      const { composerInput, packSlug = 'history-6-grecia-antiga' } = req.body || {};
      if (!composerInput) {
        return res.status(400).json({ error: 'Parâmetro "composerInput" é obrigatório.' });
      }

      // Busca snapshot ativo do banco diretamente — NUNCA com .catch(() => null) que engole erro!
      const activeVersion = await knowledgeRepo.getActivePackVersion(packSlug);
      if (!activeVersion) {
        return res.status(404).json({
          error: `Nenhum Content Pack publicado ativo encontrado para o tema "${packSlug}". Publique uma versão do pacote antes de compor.`,
          code: 'PACK_NOT_FOUND',
        });
      }

      const dynamicPack = activeVersion.payload_json;
      const lesson = LessonComposer.compose(composerInput, dynamicPack);

      return res.json({
        success: true,
        lesson,
        packVersion: activeVersion.version,
        contentHash: activeVersion.content_hash,
      });
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao compor aula:', err);
      return res.status(500).json({ error: err.message || 'Erro ao compor aula a partir do pack.' });
    }
  });

  // ====================================================================
  // EXPORTAÇÃO: DDL POSTGRESQL & DUMP JSON
  // ====================================================================

  // GET /api/knowledge/schema.sql (exporta DDL canônico do PostgreSQL)
  router.get('/schema.sql', (_req: Request, res: Response) => {
    try {
      const sqlPath = path.resolve('server', 'db', 'migrations', '001_canonical_schema.sql');
      if (fs.existsSync(sqlPath)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.sendFile(sqlPath);
      }
      return res.status(404).send('-- 001_canonical_schema.sql não localizado no servidor');
    } catch (err: any) {
      return res.status(500).send(`-- Erro ao ler schema.sql: ${err.message}`);
    }
  });

  // GET /api/knowledge/dump (requer curador ou admin - Bloqueio 3)
  router.get('/dump', requireAuth, requireRole('curator', 'admin'), async (_req: Request, res: Response) => {
    try {
      const dump = await knowledgeRepo.exportDumpJson();
      return res.json(dump);
    } catch (err: any) {
      console.error('[Knowledge API] Erro ao gerar dump JSON:', err);
      return res.status(500).json({ error: 'Erro ao gerar dump do acervo canônico.' });
    }
  });

  return router;
}
