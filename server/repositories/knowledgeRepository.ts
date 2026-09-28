/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — REPOSITÓRIO DE CONHECIMENTO, STAGING E ENTITY VERSIONS (E2)
 * Garante snapshots imutáveis em entity_versions, controle de versão otimista
 * e promoção idempotente de nós do staging sem duplicatas.
 */

import pg from 'pg';
import crypto from 'crypto';
import { getPool, withTransaction } from '../db/pool';
import { DbKnowledgeNode, OptimisticLockError } from '../db/types';

export class KnowledgeRepository {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool || getPool();
  }

  /**
   * Cria um novo nó de conhecimento e registra seu snapshot de versão 1 em entity_versions.
   */
  async createNode(node: {
    id?: string;
    slug: string;
    type: string;
    title: string;
    shortDescription: string;
    subjectCode: string;
    gradeLevel: number;
    dataJson?: any;
    language?: string;
    sourceId?: string | null;
    licenseId?: string | null;
    status?: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'DEPRECATED' | 'REJECTED';
  }, actorId: string): Promise<DbKnowledgeNode> {
    return withTransaction(async (client) => {
      const id = node.id || crypto.randomUUID();
      const status = node.status || 'DRAFT';
      const version = 1;
      const dataJson = node.dataJson || {};
      const language = node.language || 'pt-BR';

      const res = await client.query<DbKnowledgeNode>(
        `INSERT INTO knowledge_nodes (id, slug, type, title, short_description, subject_code, grade_level, data_json, language, source_id, license_id, status, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *;`,
        [
          id,
          node.slug,
          node.type,
          node.title,
          node.shortDescription,
          node.subjectCode,
          node.gradeLevel,
          dataJson,
          language,
          node.sourceId || null,
          node.licenseId || null,
          status,
          version,
        ]
      );
      const created = res.rows[0];

      // Registrar snapshot imutável em entity_versions
      await client.query(
        `INSERT INTO entity_versions (id, entity_type, entity_id, version, snapshot_json, changed_by, change_reason)
         VALUES ($1, 'knowledge_node', $2, $3, $4, $5, 'Criação inicial da entidade');`,
        [crypto.randomUUID(), id, version, created, actorId]
      );

      // Registrar auditoria
      await client.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
         VALUES ($1, 'knowledge_node', $2, 'created', $3, $4, $5);`,
        [crypto.randomUUID(), id, actorId, version, JSON.stringify({ slug: node.slug, title: node.title })]
      );

      return created;
    }, this.pool);
  }

  /**
   * Busca um nó por ID.
   */
  async getNodeById(id: string): Promise<DbKnowledgeNode | null> {
    const res = await this.pool.query<DbKnowledgeNode>(
      'SELECT * FROM knowledge_nodes WHERE id = $1;',
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Busca um nó por slug único.
   */
  async getNodeBySlug(slug: string): Promise<DbKnowledgeNode | null> {
    const res = await this.pool.query<DbKnowledgeNode>(
      'SELECT * FROM knowledge_nodes WHERE slug = $1;',
      [slug]
    );
    return res.rows[0] || null;
  }

  /**
   * Atualização com optimistic locking e criação atômica de snapshot em entity_versions.
   */
  async updateNodeWithOptimisticLock(params: {
    id: string;
    expectedVersion: number;
    updates: Partial<Pick<DbKnowledgeNode, 'title' | 'short_description' | 'data_json' | 'status'>>;
    actorId: string;
    reason: string;
  }): Promise<DbKnowledgeNode> {
    return withTransaction(async (client) => {
      // 1. Bloqueia linha para leitura atômica
      const lockRes = await client.query<DbKnowledgeNode>(
        'SELECT * FROM knowledge_nodes WHERE id = $1 FOR UPDATE;',
        [params.id]
      );

      if (lockRes.rows.length === 0) {
        throw new Error(`Nó de conhecimento ${params.id} não encontrado.`);
      }

      const current = lockRes.rows[0];

      // 2. Verificação de versão
      if (current.version !== params.expectedVersion) {
        throw new OptimisticLockError('knowledge_node', params.id, params.expectedVersion, current.version);
      }

      const nextVersion = current.version + 1;
      const title = params.updates.title ?? current.title;
      const shortDesc = params.updates.short_description ?? current.short_description;
      const dataJson = params.updates.data_json ?? current.data_json;
      const status = params.updates.status ?? current.status;

      // 3. Atualizar tabela principal
      const updateRes = await client.query<DbKnowledgeNode>(
        `UPDATE knowledge_nodes
         SET title = $1, short_description = $2, data_json = $3, status = $4, version = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *;`,
        [title, shortDesc, dataJson, status, nextVersion, params.id]
      );
      const updated = updateRes.rows[0];

      // 4. Inserir snapshot imutável em entity_versions
      await client.query(
        `INSERT INTO entity_versions (id, entity_type, entity_id, version, snapshot_json, changed_by, change_reason)
         VALUES ($1, 'knowledge_node', $2, $3, $4, $5, $6);`,
        [crypto.randomUUID(), params.id, nextVersion, updated, params.actorId, params.reason]
      );

      // 5. Registrar histórico de auditoria
      await client.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
         VALUES ($1, 'knowledge_node', $2, 'updated', $3, $4, $5);`,
        [crypto.randomUUID(), params.id, params.actorId, nextVersion, JSON.stringify({ reason: params.reason })]
      );

      return updated;
    }, this.pool);
  }

  /**
   * Promove um item de staging para o Knowledge Core permanente com deduplicação atômica.
   * Se duas chamadas simultâneas tentarem aprovar o mesmo item ou item com o mesmo slug,
   * a transação garante que exatamente UM nó canônico seja criado.
   */
  async promoteStagingNode(
    stagingId: string,
    actorId: string,
    options?: { beforeCommitHook?: (client: pg.PoolClient) => Promise<void> }
  ): Promise<{ node: DbKnowledgeNode; duplicateHandled: boolean }> {
    return withTransaction(async (client) => {
      // 1. Bloqueia linha do staging para atualização
      const stagingRes = await client.query<any>(
        'SELECT * FROM staging_nodes WHERE id = $1 FOR UPDATE;',
        [stagingId]
      );

      if (stagingRes.rows.length === 0) {
        throw new Error(`Item do staging ${stagingId} não localizado.`);
      }

      // Gancho opcional para controle determinístico de concorrência em testes
      if (options?.beforeCommitHook) {
        await options.beforeCommitHook(client);
      }

      const item = stagingRes.rows[0];

      // 2. Se já foi aprovado ou marcado com candidato duplicado existente
      if (item.duplicate_candidate_id) {
        const existingRes = await client.query<DbKnowledgeNode>(
          'SELECT * FROM knowledge_nodes WHERE id = $1;',
          [item.duplicate_candidate_id]
        );
        if (existingRes.rows.length > 0) {
          return { node: existingRes.rows[0], duplicateHandled: true };
        }
      }

      // 3. Verificar se já existe nó canônico com o mesmo slug (ou slug base)
      const baseSlug = item.slug.replace(/-(?:wikidata|importado|staging)$/i, '');
      const slugRes = await client.query<DbKnowledgeNode>(
        'SELECT * FROM knowledge_nodes WHERE slug = $1 OR slug = $2;',
        [item.slug, baseSlug]
      );

      if (slugRes.rows.length > 0) {
        // Trata como duplicata: vincula ao nó existente sem criar outro
        const canonical = slugRes.rows[0];
        await client.query(
          `UPDATE staging_nodes 
           SET validation_status = 'DUPLICATE', duplicate_candidate_id = $1, review_notes = 'Deduplicação automática: nó canônico com o mesmo slug já existe.'
           WHERE id = $2;`,
          [canonical.id, stagingId]
        );

        return { node: canonical, duplicateHandled: true };
      }

      // 4. Criar nó canônico novo
      const nodeId = crypto.randomUUID();
      const version = 1;
      const subjectCode = 'history'; // default ou derivado do staging
      const gradeLevel = 6;

      const nodeData = {
        ...(typeof item.data_json === 'object' && item.data_json !== null ? item.data_json : {}),
        externalId: item.external_id,
        qid: item.external_id || item.data_json?.qid,
      };

      const nodeRes = await client.query<DbKnowledgeNode>(
        `INSERT INTO knowledge_nodes (id, slug, type, title, short_description, subject_code, grade_level, data_json, status, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPROVED', $9)
         ON CONFLICT (slug) DO NOTHING
         RETURNING *;`,
        [
          nodeId,
          item.slug,
          item.type,
          item.title,
          item.short_description,
          subjectCode,
          gradeLevel,
          nodeData,
          version,
        ]
      );

      if (nodeRes.rows.length === 0) {
        // Conflito de corrida concorrente: outro processo acabou de criar o nó com este slug
        const canonicalRes = await client.query<DbKnowledgeNode>(
          'SELECT * FROM knowledge_nodes WHERE slug = $1;',
          [item.slug]
        );
        const canonical = canonicalRes.rows[0];

        await client.query(
          `UPDATE staging_nodes 
           SET validation_status = 'DUPLICATE', duplicate_candidate_id = $1, review_notes = 'Deduplicação concorrente: nó canônico criado concorrentemente.'
           WHERE id = $2;`,
          [canonical.id, stagingId]
        );

        await client.query(
          `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
           VALUES ($1, 'staging_node', $2, 'concurrent_deduplication', $3, $4, $5);`,
          [crypto.randomUUID(), stagingId, actorId, canonical.version, JSON.stringify({ nodeId: canonical.id, slug: item.slug })]
        );

        return { node: canonical, duplicateHandled: true };
      }

      const newNode = nodeRes.rows[0];

      // 5. Inserir snapshot em entity_versions
      await client.query(
        `INSERT INTO entity_versions (id, entity_type, entity_id, version, snapshot_json, changed_by, change_reason)
         VALUES ($1, 'knowledge_node', $2, $3, $4, $5, 'Promoção aprovada a partir do staging');`,
        [crypto.randomUUID(), nodeId, version, newNode, actorId]
      );

      // 6. Atualizar staging para APPROVED
      await client.query(
        `UPDATE staging_nodes 
         SET validation_status = 'APPROVED', duplicate_candidate_id = $1, review_notes = 'Aprovado para o Knowledge Core'
         WHERE id = $2;`,
        [nodeId, stagingId]
      );

      // 7. Registrar auditoria
      await client.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
         VALUES ($1, 'staging_node', $2, 'promoted_to_canonical', $3, $4, $5);`,
        [crypto.randomUUID(), stagingId, actorId, version, JSON.stringify({ nodeId, slug: item.slug })]
      );

      return { node: newNode, duplicateHandled: false };
    }, this.pool);
  }

  /**
   * Aprova item do staging com metadados curriculares (disciplina e série).
   */
  async approveStagingNode(
    stagingId: string,
    actorId: string,
    options?: {
      subjectCode?: string;
      gradeLevel?: number;
      beforeCommitHook?: (client: pg.PoolClient) => Promise<void>;
    }
  ): Promise<{ node: DbKnowledgeNode; duplicateHandled: boolean }> {
    return withTransaction(async (client) => {
      const stagingRes = await client.query<any>(
        'SELECT * FROM staging_nodes WHERE id = $1 FOR UPDATE;',
        [stagingId]
      );
      if (stagingRes.rows.length === 0) {
        throw new Error(`Item de staging ${stagingId} não encontrado.`);
      }
      const item = stagingRes.rows[0];

      // Gancho opcional para controle de concorrência em testes
      if (options?.beforeCommitHook) {
        await options.beforeCommitHook(client);
      }

      const baseSlug = item.slug.replace(/-(?:wikidata|importado|staging)$/i, '');
      const slugRes = await client.query<DbKnowledgeNode>(
        'SELECT * FROM knowledge_nodes WHERE slug = $1 OR slug = $2;',
        [item.slug, baseSlug]
      );
      if (slugRes.rows.length > 0) {
        const canonical = slugRes.rows[0];
        await client.query(
          `UPDATE staging_nodes 
           SET validation_status = 'DUPLICATE', duplicate_candidate_id = $1, review_notes = 'Deduplicação: nó canônico já existente.'
           WHERE id = $2;`,
          [canonical.id, stagingId]
        );
        return { node: canonical, duplicateHandled: true };
      }

      const nodeId = crypto.randomUUID();
      const version = 1;
      const subjectCode = options?.subjectCode || 'history';
      const gradeLevel = options?.gradeLevel || 6;

      const nodeRes = await client.query<DbKnowledgeNode>(
        `INSERT INTO knowledge_nodes (id, slug, type, title, short_description, subject_code, grade_level, data_json, status, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPROVED', $9)
         ON CONFLICT (slug) DO NOTHING
         RETURNING *;`,
        [
          nodeId,
          item.slug,
          item.type,
          item.title,
          item.short_description,
          subjectCode,
          gradeLevel,
          item.data_json || {},
          version,
        ]
      );

      if (nodeRes.rows.length === 0) {
        // Corrida concorrente: outro processo acabou de criar o nó com este slug
        const canonicalRes = await client.query<DbKnowledgeNode>(
          'SELECT * FROM knowledge_nodes WHERE slug = $1;',
          [item.slug]
        );
        const canonical = canonicalRes.rows[0];

        await client.query(
          `UPDATE staging_nodes 
           SET validation_status = 'DUPLICATE', duplicate_candidate_id = $1, review_notes = 'Deduplicação concorrente: nó canônico já existente.'
           WHERE id = $2;`,
          [canonical.id, stagingId]
        );

        await client.query(
          `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
           VALUES ($1, 'staging_node', $2, 'concurrent_deduplication', $3, $4, $5);`,
          [crypto.randomUUID(), stagingId, actorId, canonical.version, JSON.stringify({ nodeId: canonical.id, slug: item.slug })]
        );

        return { node: canonical, duplicateHandled: true };
      }

      const newNode = nodeRes.rows[0];

      await client.query(
        `INSERT INTO entity_versions (id, entity_type, entity_id, version, snapshot_json, changed_by, change_reason)
         VALUES ($1, 'knowledge_node', $2, $3, $4, $5, 'Promoção aprovada a partir do staging');`,
        [crypto.randomUUID(), nodeId, version, newNode, actorId]
      );

      await client.query(
        `UPDATE staging_nodes 
         SET validation_status = 'APPROVED', duplicate_candidate_id = $1, review_notes = 'Aprovado para o Knowledge Core'
         WHERE id = $2;`,
        [nodeId, stagingId]
      );

      await client.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
         VALUES ($1, 'staging_node', $2, 'promoted_to_canonical', $3, $4, $5);`,
        [crypto.randomUUID(), stagingId, actorId, version, JSON.stringify({ nodeId, slug: item.slug })]
      );

      return { node: newNode, duplicateHandled: false };
    }, this.pool);
  }

  /**
   * Lista nós de conhecimento com suporte a filtros e paginação.
   */
  async listNodes(filters?: {
    subjectCode?: string;
    gradeLevel?: number;
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ nodes: DbKnowledgeNode[]; total: number }> {
    const conditions: string[] = [`(knowledge_nodes.id NOT LIKE 'node-ef2-%' OR knowledge_nodes.id IN (
      SELECT el.entity_id FROM content_pack_entity_links el
      JOIN content_pack_versions pv ON pv.id=el.pack_version_id
      JOIN content_packs cp ON cp.id=pv.pack_id
      WHERE el.entity_type='knowledge_node'
        AND pv.status='PUBLISHED' AND cp.status IN ('ACTIVE','PUBLISHED')
    ))`];
    const values: any[] = [];
    let idx = 1;

    if (filters?.subjectCode && filters.subjectCode !== 'all') {
      conditions.push(`subject_code = $${idx++}`);
      values.push(filters.subjectCode);
    }
    if (filters?.gradeLevel && !isNaN(filters.gradeLevel)) {
      conditions.push(`grade_level = $${idx++}`);
      values.push(filters.gradeLevel);
    }
    if (filters?.type && filters.type !== 'all') {
      conditions.push(`type = $${idx++}`);
      values.push(filters.type);
    }
    if (filters?.status && filters.status !== 'all') {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters?.search && filters.search.trim()) {
      conditions.push(`(title ILIKE $${idx} OR slug ILIKE $${idx} OR short_description ILIKE $${idx})`);
      values.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM knowledge_nodes ${whereClause};`,
      values
    );
    const total = countRes.rows[0]?.total || 0;

    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 100;
    const offset = filters?.offset && filters.offset >= 0 ? filters.offset : 0;

    values.push(limit);
    const limitIdx = idx++;
    values.push(offset);
    const offsetIdx = idx++;

    const nodesRes = await this.pool.query<DbKnowledgeNode>(
      `SELECT * FROM knowledge_nodes ${whereClause} ORDER BY created_at DESC, id ASC LIMIT $${limitIdx} OFFSET $${offsetIdx};`,
      values
    );

    return { nodes: nodesRes.rows, total };
  }

  /**
   * Lista relações ontológicas, opcionalmente filtradas por nó.
   */
  async listRelations(nodeId?: string): Promise<any[]> {
    if (nodeId) {
      const res = await this.pool.query(
        `SELECT * FROM knowledge_relations WHERE from_node_id = $1 OR to_node_id = $1 ORDER BY created_at ASC;`,
        [nodeId]
      );
      return res.rows;
    }
    const res = await this.pool.query(
      `SELECT * FROM knowledge_relations ORDER BY created_at ASC;`
    );
    return res.rows;
  }

  /**
   * Cria uma nova relação ontológica (valida contra auto-ciclos).
   */
  async createRelation(relation: {
    id?: string;
    from_node_id: string;
    relation_type: string;
    to_node_id: string;
    source_id?: string | null;
  }): Promise<any> {
    if (relation.from_node_id === relation.to_node_id) {
      throw new Error('Auto-ciclo reflexivo inválido: o nó de origem não pode ser idêntico ao nó de destino.');
    }
    const id = relation.id || `rel-${crypto.randomUUID()}`;
    const res = await this.pool.query(
      `INSERT INTO knowledge_relations (id, from_node_id, relation_type, to_node_id, source_id, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (from_node_id, relation_type, to_node_id) DO UPDATE SET status = 'ACTIVE'
       RETURNING *;`,
      [id, relation.from_node_id, relation.relation_type, relation.to_node_id, relation.source_id || null]
    );
    return res.rows[0];
  }

  /**
   * Remove uma relação ontológica.
   */
  async deleteRelation(id: string): Promise<void> {
    await this.pool.query('DELETE FROM knowledge_relations WHERE id = $1;', [id]);
  }

  /**
   * Lista fontes acadêmicas e institucionais.
   */
  async listSources(): Promise<any[]> {
    const res = await this.pool.query('SELECT * FROM sources ORDER BY title ASC;');
    return res.rows;
  }

  /**
   * Cria uma fonte acadêmica ou institucional.
   */
  async createSource(source: {
    id?: string;
    provider: string;
    title: string;
    url?: string;
    author?: string;
    language?: string;
    source_type: string;
    status?: string;
  }): Promise<any> {
    const id = source.id || `src-${crypto.randomUUID()}`;
    const res = await this.pool.query(
      `INSERT INTO sources (id, provider, title, url, author, language, source_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *;`,
      [
        id,
        source.provider,
        source.title,
        source.url || null,
        source.author || null,
        source.language || 'pt-BR',
        source.source_type,
        source.status || 'verified',
      ]
    );
    return res.rows[0];
  }

  /**
   * Lista licenças legais disponíveis.
   */
  async listLicenses(): Promise<any[]> {
    const res = await this.pool.query('SELECT * FROM licenses ORDER BY name ASC;');
    return res.rows;
  }

  /**
   * Cria uma nova licença no banco.
   */
  async createLicense(license: {
    id?: string;
    name: string;
    code: string;
    url?: string;
    commercial_use?: boolean;
    derivatives_allowed?: boolean;
    attribution_required?: boolean;
    redistribution_allowed?: boolean;
    notes?: string;
  }): Promise<any> {
    const id = license.id || `lic-${crypto.randomUUID()}`;
    const res = await this.pool.query(
      `INSERT INTO licenses (id, name, code, url, commercial_use, derivatives_allowed, attribution_required, redistribution_allowed, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *;`,
      [
        id,
        license.name,
        license.code,
        license.url || null,
        license.commercial_use ?? false,
        license.derivatives_allowed ?? true,
        license.attribution_required ?? true,
        license.redistribution_allowed ?? true,
        license.notes || null,
      ]
    );
    return res.rows[0];
  }

  /**
   * Lista matriz curricular BNCC.
   */
  async listCurriculum(filters?: { subjectCode?: string; gradeLevel?: number; search?: string }): Promise<any[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters?.subjectCode && filters.subjectCode !== 'all') {
      conditions.push(`subject_code = $${idx++}`);
      values.push(filters.subjectCode);
    }
    if (filters?.gradeLevel && !isNaN(filters.gradeLevel)) {
      conditions.push(`grade_level = $${idx++}`);
      values.push(filters.gradeLevel);
    }
    if (filters?.search && filters.search.trim()) {
      conditions.push(`(code ILIKE $${idx} OR thematic_unit ILIKE $${idx} OR knowledge_object ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await this.pool.query(`SELECT * FROM curriculum_skills ${whereClause} ORDER BY code ASC;`, values);
    return res.rows;
  }

  /**
   * Lista recursos visuais e didáticos.
   */
  async listResources(nodeId?: string): Promise<any[]> {
    if (nodeId) {
      const res = await this.pool.query(
        `SELECT r.*, rl.role FROM resources r
         INNER JOIN resource_links rl ON rl.resource_id = r.id
         WHERE rl.knowledge_node_id = $1
         ORDER BY r.created_at ASC;`,
        [nodeId]
      );
      return res.rows;
    }
    const res = await this.pool.query('SELECT * FROM resources ORDER BY created_at ASC;');
    return res.rows;
  }

  /**
   * Lista nós em staging.
   */
  async listStaging(status?: string): Promise<any[]> {
    if (status && status !== 'all') {
      const res = await this.pool.query(
        'SELECT * FROM staging_nodes WHERE validation_status = $1 ORDER BY created_at DESC;',
        [status]
      );
      return res.rows;
    }
    const res = await this.pool.query('SELECT * FROM staging_nodes ORDER BY created_at DESC;');
    return res.rows;
  }

  /**
   * Cria um novo lote de importação externa (ex: Wikidata / BNCC).
   */
  async createImportBatch(provider: string, client?: pg.PoolClient): Promise<{
    id: string;
    provider: string;
    status: string;
    records_imported?: number;
    records_duplicates?: number;
    records_rejected?: number;
    records_found?: number;
  }> {
    const executor = client || this.pool;
    const id = `batch-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const res = await executor.query(
      `INSERT INTO import_batches (id, provider, status)
       VALUES ($1, $2, 'RUNNING')
       RETURNING *;`,
      [id, provider]
    );
    return res.rows[0];
  }

  /**
   * Alias de compatibilidade para inserção de nó no staging.
   */
  async insertStagingNode(node: {
    id?: string;
    importBatchId?: string;
    sourceProvider: string;
    externalId?: string;
    title: string;
    slug: string;
    type: string;
    shortDescription: string;
    dataJson?: any;
    validationStatus?: string;
    duplicateCandidateId?: string | null;
    reviewNotes?: string | null;
  }): Promise<any> {
    return this.createStagingNode(node);
  }

  /**
   * Cria um registro no staging para triagem editorial.
   */
  async createStagingNode(node: {
    id?: string;
    importBatchId?: string;
    sourceProvider: string;
    externalId?: string;
    title: string;
    slug: string;
    type: string;
    shortDescription: string;
    dataJson?: any;
    validationStatus?: string;
    duplicateCandidateId?: string | null;
    reviewNotes?: string | null;
  }): Promise<any> {
    const id = node.id || `stg-${crypto.randomUUID()}`;
    const res = await this.pool.query(
      `INSERT INTO staging_nodes (id, import_batch_id, source_provider, external_id, title, slug, type, short_description, data_json, validation_status, duplicate_candidate_id, review_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (source_provider, external_id) DO UPDATE SET
         import_batch_id = EXCLUDED.import_batch_id,
         title = EXCLUDED.title,
         slug = EXCLUDED.slug,
         type = EXCLUDED.type,
         short_description = EXCLUDED.short_description,
         data_json = EXCLUDED.data_json,
         validation_status = EXCLUDED.validation_status,
         duplicate_candidate_id = EXCLUDED.duplicate_candidate_id,
         review_notes = EXCLUDED.review_notes
       RETURNING *;`,
      [
        id,
        node.importBatchId || null,
        node.sourceProvider,
        node.externalId || null,
        node.title,
        node.slug,
        node.type,
        node.shortDescription,
        node.dataJson || {},
        node.validationStatus || 'NEW',
        node.duplicateCandidateId || null,
        node.reviewNotes || null,
      ]
    );
    return res.rows[0];
  }

  /**
   * Descarta item do staging.
   */
  async discardStagingNode(stagingId: string, actorId: string, reason?: string): Promise<any> {
    const res = await this.pool.query(
      `UPDATE staging_nodes 
       SET validation_status = 'DISCARDED', review_notes = $1 
       WHERE id = $2 
       RETURNING *;`,
      [reason || 'Descartado pela curadoria', stagingId]
    );
    if (res.rows.length === 0) {
      throw new Error(`Item de staging ${stagingId} não encontrado.`);
    }

    await this.pool.query(
      `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, version, details_json)
       VALUES ($1, 'staging_node', $2, 'discarded', $3, 1, $4);`,
      [crypto.randomUUID(), stagingId, actorId, JSON.stringify({ reason })]
    );

    return res.rows[0];
  }

  /**
   * Lista lotes de importação externa.
   */
  async listBatches(): Promise<any[]> {
    const res = await this.pool.query('SELECT * FROM import_batches ORDER BY started_at DESC;');
    return res.rows;
  }

  /**
   * Cria um registro de lote de importação.
   */
  async createBatch(batch: {
    provider: string;
    recordsFound?: number;
    recordsImported?: number;
    recordsRejected?: number;
    recordsDuplicates?: number;
    status?: string;
  }): Promise<any> {
    const id = `batch-${Date.now()}`;
    const res = await this.pool.query(
      `INSERT INTO import_batches (id, provider, started_at, finished_at, records_found, records_imported, records_rejected, records_duplicates, status)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [
        id,
        batch.provider,
        batch.recordsFound || 0,
        batch.recordsImported || 0,
        batch.recordsRejected || 0,
        batch.recordsDuplicates || 0,
        batch.status || 'COMPLETED',
      ]
    );
    return res.rows[0];
  }

  /**
   * Lista Content Packs cadastrados.
   */
  async listPacks(): Promise<any[]> {
    const res = await this.pool.query('SELECT * FROM content_packs ORDER BY title ASC;');
    return res.rows;
  }

  /**
   * Lista versões de um Content Pack.
   */
  async listPackVersions(packId: string): Promise<any[]> {
    const res = await this.pool.query(
      'SELECT * FROM content_pack_versions WHERE pack_id = $1 ORDER BY created_at DESC;',
      [packId]
    );
    return res.rows;
  }

  /**
   * Obtém um Content Pack pelo slug canônico.
   */
  async getPackBySlug(slug: string): Promise<any | null> {
    const res = await this.pool.query('SELECT * FROM content_packs WHERE slug = $1 LIMIT 1;', [slug]);
    return res.rows[0] || null;
  }

  /**
   * Obtém a versão ativa e publicada mais recente de um Content Pack.
   */
  async getActivePackVersion(packIdOrSlug: string): Promise<any | null> {
    const res = await this.pool.query(
      `SELECT cpv.* FROM content_pack_versions cpv
       JOIN content_packs cp ON cp.id = cpv.pack_id
       WHERE (cp.id = $1 OR cp.slug = $1 OR cpv.pack_id = $1) AND cpv.status = 'PUBLISHED' AND cp.status IN ('ACTIVE', 'PUBLISHED')
       ORDER BY cpv.published_at DESC NULLS LAST, cpv.created_at DESC LIMIT 1;`,
      [packIdOrSlug]
    );
    return res.rows[0] || null;
  }

  /**
   * Cria ou registra um Content Pack no banco relacional.
   */
  async createPack(pack: {
    id?: string;
    slug: string;
    subjectCode: string;
    gradeLevel: number;
    title: string;
    topicNodeId?: string | null;
    status?: string;
  }): Promise<any> {
    const id = pack.id || `pack-${crypto.randomUUID()}`;
    const res = await this.pool.query(
      `INSERT INTO content_packs (id, slug, subject_code, grade_level, topic_node_id, title, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         subject_code = EXCLUDED.subject_code,
         grade_level = EXCLUDED.grade_level
       RETURNING *;`,
      [id, pack.slug, pack.subjectCode, pack.gradeLevel, pack.topicNodeId || null, pack.title, pack.status || 'PUBLISHED']
    );
    return res.rows[0];
  }

  /**
   * Constrói snapshot consistente de Content Pack a partir de nós publicados (B4).
   * Reúne exclusivamente nós e relações com status PUBLISHED.
   */
  async buildPackSnapshot(packSlug: string, newVersion?: string, actorId = 'system'): Promise<any> {
    return withTransaction(async (client) => {
      // 1. Obter registro mestre do Content Pack
      let packRes = await client.query<any>(
        'SELECT * FROM content_packs WHERE slug = $1 FOR UPDATE;',
        [packSlug]
      );
      let pack = packRes.rows[0];

      if (!pack && packSlug === 'history-6-grecia-antiga') {
        const insPack = await client.query<any>(
          `INSERT INTO content_packs (id, slug, subject_code, grade_level, topic_node_id, title, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISHED')
           ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
           RETURNING *;`,
          ['pack-hist-6-greece', 'history-6-grecia-antiga', 'history', 6, 'node-grecia-antiga', 'História • 6º Ano • Grécia Antiga: Pólis e Democracia']
        );
        pack = insPack.rows[0];
      }

      if (!pack) {
        throw new Error(`Content pack com slug "${packSlug}" não encontrado.`);
      }

      // 2. Determinar a versão alvo do snapshot de forma segura e estrita
      let targetVersion = newVersion;
      if (!targetVersion) {
        const verRes = await client.query<{ version: string }>(
          'SELECT version FROM content_pack_versions WHERE pack_id = $1 ORDER BY created_at DESC;',
          [pack.id]
        );
        let maxVer = 0;
        for (const row of verRes.rows) {
          const parsed = parseInt(row.version, 10);
          if (!isNaN(parsed) && parsed > maxVer) {
            maxVer = parsed;
          }
        }
        targetVersion = String(maxVer + 1);
      } else {
        targetVersion = String(targetVersion).trim().slice(0, 32);
      }

      // 3. Seleção escopada de nós publicados:
      // Se houver topic_node_id, busca os nós publicados conectados ao nó central ou escopados pelo tema/série
      let publishedNodes: any[] = [];
      if (pack.topic_node_id) {
        const scopedNodesRes = await client.query<any>(
          `WITH RECURSIVE pack_nodes AS (
             -- Nó tópico raiz
             SELECT id FROM knowledge_nodes
             WHERE id = $1 AND status = 'PUBLISHED'
             UNION
             -- Vizinhos no grafo (ambas as direções em único termo recursivo)
             SELECT 
               CASE WHEN kr.from_node_id = pn.id THEN kr.to_node_id ELSE kr.from_node_id END AS id
             FROM knowledge_relations kr
             JOIN pack_nodes pn ON (pn.id = kr.from_node_id OR pn.id = kr.to_node_id)
             JOIN knowledge_nodes kn ON kn.id = (CASE WHEN kr.from_node_id = pn.id THEN kr.to_node_id ELSE kr.from_node_id END)
             WHERE kr.status = 'ACTIVE' AND kn.status = 'PUBLISHED'
           )
           SELECT kn.* FROM knowledge_nodes kn
           WHERE kn.id IN (SELECT id FROM pack_nodes)
             AND kn.subject_code = $2
             AND kn.grade_level = $3
             AND kn.status = 'PUBLISHED'
           ORDER BY (kn.id = $1) DESC, kn.data_json->'sequence' ASC NULLS LAST, kn.title ASC;`,
          [pack.topic_node_id, pack.subject_code, pack.grade_level]
        );
        publishedNodes = scopedNodesRes.rows;
      }

      if (publishedNodes.length === 0) {
        throw new Error(`Não existem nós publicados para compor o Content Pack "${packSlug}".`);
      }

      const nodeIds = publishedNodes.map((n: any) => n.id);

      // 4. Verificação obrigatória de integridade de fontes e licenças em TODOS os nós (B4)
      for (const node of publishedNodes) {
        if (!node.license_id) {
          throw new Error(`Nó "${node.title}" (${node.id}) não possui licença legal vinculada. Publicação de Content Pack impedida.`);
        }
        if (!node.source_id) {
          throw new Error(`Nó "${node.title}" (${node.id}) não possui fonte acadêmica/institucional vinculada. Publicação de Content Pack impedida.`);
        }
      }

      // 5. Coleta relações ontológicas VÁLIDAS:
      // Ambas as pontas (from e to) PRECISAM pertencer estritamente aos nós selecionados e estar com status ACTIVE
      const relRes = await client.query<any>(
        `SELECT r.* FROM knowledge_relations r
         WHERE r.from_node_id = ANY($1::varchar[])
           AND r.to_node_id = ANY($1::varchar[])
           AND r.status = 'ACTIVE'
         ORDER BY r.from_node_id, r.to_node_id ASC;`,
        [nodeIds]
      );
      const relations = relRes.rows;

      // 6. Coleta e validação de recursos visuais associados aos nós (B4)
      // "Recurso ausente ou licença pendente impede publicação"
      const resQuery = await client.query<any>(
        `SELECT rl.knowledge_node_id, rl.role, r.*, l.code AS license_code, l.name AS license_name
         FROM resource_links rl
         JOIN resources r ON r.id = rl.resource_id
         LEFT JOIN licenses l ON l.id = r.license_id
         WHERE rl.knowledge_node_id = ANY($1::varchar[])
         ORDER BY r.title ASC;`,
        [nodeIds]
      );
      const linkedResources = resQuery.rows;

      for (const r of linkedResources) {
        if (r.status !== 'ACTIVE') {
          throw new Error(`Recurso "${r.title}" vinculado ao nó ${r.knowledge_node_id} está inativo (${r.status}). Publicação impedida.`);
        }
        if (!r.license_id || !r.license_code) {
          throw new Error(`Recurso "${r.title}" vinculado ao nó ${r.knowledge_node_id} não possui licença legal válida. Publicação impedida.`);
        }
      }

      // 7. Coleta de fontes e licenças únicas do acervo
      const licenseIds = Array.from(new Set([
        ...publishedNodes.map((n: any) => n.license_id),
        ...linkedResources.map((r: any) => r.license_id),
      ])).filter(Boolean);

      const sourceIds = Array.from(new Set([
        ...publishedNodes.map((n: any) => n.source_id),
        ...linkedResources.map((r: any) => r.source_id),
      ])).filter(Boolean);

      let licenses: any[] = [];
      if (licenseIds.length > 0) {
        const licRes = await client.query('SELECT * FROM licenses WHERE id = ANY($1::varchar[]);', [licenseIds]);
        licenses = licRes.rows;
      }

      let sources: any[] = [];
      if (sourceIds.length > 0) {
        const srcRes = await client.query('SELECT * FROM sources WHERE id = ANY($1::varchar[]);', [sourceIds]);
        sources = srcRes.rows;
      }

      // 7.5. Buscar habilidade BNCC real vinculada aos nós deste pack (elimina hardcode de EF06HI09)
      const skillRes = await client.query<{ code: string; description: string }>(
        `SELECT cs.code, cs.description 
         FROM curriculum_knowledge_links ckl
         JOIN curriculum_skills cs ON cs.id = ckl.curriculum_skill_id
         WHERE ckl.knowledge_node_id = ANY($1::varchar[])
         ORDER BY ckl.priority ASC, cs.code ASC
         LIMIT 1;`,
        [nodeIds]
      );
      const matchedSkill = skillRes.rows[0];
      const resolvedBnccSkill = matchedSkill 
        ? `${matchedSkill.code}: ${matchedSkill.description}`
        : `${pack.subject_code.toUpperCase()} • ${pack.grade_level}º ano`;

      // Coletar questionários formativos dos nós publicados
      const collectedQuizzes: any[] = [];
      for (const n of publishedNodes) {
        if (Array.isArray(n.data_json?.quizzes)) {
          collectedQuizzes.push(...n.data_json.quizzes);
        }
      }

      const previousPayload = (await client.query('SELECT payload_json FROM content_pack_versions WHERE pack_id=$1 ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 1', [pack.id])).rows[0]?.payload_json;
      // 8. Montar o payload canônico determinístico
      const payload = {
        packId: pack.id,
        slug: pack.slug,
        version: Number(targetVersion) || targetVersion,
        title: pack.title,
        subjectCode: pack.subject_code,
        gradeLevel: pack.grade_level,
        bnccSkill: resolvedBnccSkill,
        createdBy: actorId,
        keywords: previousPayload?.keywords || [],
        skillCodes: previousPayload?.skillCodes || [],
        objectives: previousPayload?.objectives || [],
        prerequisites: previousPayload?.prerequisites || [],
        editorialStatus: previousPayload?.editorialStatus || 'pending_teacher_review',
        references: previousPayload?.references || [],
        nodes: publishedNodes.map((n: any) => ({
          id: n.id,
          slug: n.slug,
          type: n.type,
          name: n.title,
          title: n.title,
          short_definition: n.short_description,
          deep_description: n.data_json?.deep_description || n.short_description,
          key_points: n.data_json?.key_points || [],
          example: n.data_json?.example || '',
          activity: n.data_json?.activity || '',
          teacherNotes: n.data_json?.teacherNotes || '', 
          version: n.version,
          source_id: n.source_id,
          license_id: n.license_id,
        })),
        relations: relations.map((r: any) => ({
          from: r.from_node_id,
          to: r.to_node_id,
          relation: r.relation_type,
          description: r.description,
        })),
        resources: linkedResources.map((r: any) => ({
          id: r.id,
          nodeId: r.knowledge_node_id,
          role: r.role,
          title: r.title,
          type: r.type,
          storagePath: r.storage_path,
          mimeType: r.mime_type,
          metadata_json: r.metadata_json,
          licenseCode: r.license_code,
        })),
        licenses: licenses.map((l: any) => ({
          id: l.id,
          code: l.code,
          name: l.name,
        })),
        sources: sources.map((s: any) => ({
          id: s.id,
          provider: s.provider,
          title: s.title,
          url: s.url,
        })),
        quizzes: collectedQuizzes,
        assembledAt: new Date().toISOString(),
      };

      // 9. Calcula hash estável do conteúdo (sem incluir timestamps voláteis no hash)
      const contentToHash = JSON.stringify({
        slug: payload.slug,
        subjectCode: payload.subjectCode,
        gradeLevel: payload.gradeLevel,
        nodes: payload.nodes,
        quizzes: payload.quizzes,
        keywords: payload.keywords,
        skillCodes: payload.skillCodes,
        objectives: payload.objectives,
        references: payload.references,
        relations: payload.relations,
        resources: payload.resources,
      });
      const contentHash = crypto.createHash('sha256').update(contentToHash).digest('hex');
      (payload as any).contentHash = contentHash;

      // 10. Manifesto completo de proveniência
      const manifest = {
        version: String(targetVersion),
        slug: pack.slug,
        title: pack.title,
        contentHash,
        nodesCount: publishedNodes.length,
        relationsCount: relations.length,
        resourcesCount: linkedResources.length,
        sourcesCount: sources.length,
        licensesCount: licenses.length,
        createdBy: actorId,
        publishedAt: new Date().toISOString(),
        licenses: licenses.map((l: any) => ({ id: l.id, code: l.code, name: l.name })),
        sources: sources.map((s: any) => ({ id: s.id, provider: s.provider, title: s.title })),
      };

      // 11. Grava em content_pack_versions com imutabilidade estrita
      const existingVer = await client.query(
        'SELECT id FROM content_pack_versions WHERE pack_id = $1 AND version = $2;',
        [pack.id, String(targetVersion)]
      );
      if (existingVer.rows.length > 0) {
        throw new Error(`A versão "${targetVersion}" do pack ${packSlug} já existe e é imutável.`);
      }

      // 10.5. Arquivar versões anteriores publicadas deste pack para manter unicidade da versão ativa
      await client.query(
        `UPDATE content_pack_versions
         SET status = 'ARCHIVED'
         WHERE pack_id = $1 AND status = 'PUBLISHED';`,
        [pack.id]
      );

      // ID com no máximo 64 caracteres
      const versionId = `cpv-${pack.slug}-v${targetVersion}`.slice(0, 64);

      const insertRes = await client.query<any>(
        `INSERT INTO content_pack_versions (id, pack_id, version, schema_version, content_hash, manifest_json, payload_json, status, published_at)
         VALUES ($1, $2, $3, '1.0', $4, $5::jsonb, $6::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP)
         RETURNING *;`,
        [versionId, pack.id, String(targetVersion), contentHash, JSON.stringify(manifest), JSON.stringify(payload)]
      );
      const createdVersion = insertRes.rows[0];

      // 12. Grava vínculos em content_pack_entity_links
      for (const node of publishedNodes) {
        await client.query(
          `INSERT INTO content_pack_entity_links (id, pack_version_id, entity_type, entity_id, entity_version)
           VALUES ($1, $2, 'knowledge_node', $3, $4)
           ON CONFLICT (pack_version_id, entity_type, entity_id, entity_version) DO NOTHING;`,
          [crypto.randomUUID(), versionId, node.id, node.version]
        );
      }

      // 13. Auditoria da publicação registrando o ator real
      await client.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, details_json)
         VALUES ($1, 'pack', $2, 'PACK_VERSION_PUBLISHED', $3, $4::jsonb);`,
        [
          crypto.randomUUID(),
          pack.id,
          actorId,
          JSON.stringify({
            version: targetVersion,
            contentHash,
            nodesCount: publishedNodes.length,
            relationsCount: relations.length,
            resourcesCount: linkedResources.length,
          }),
        ]
      );

      return createdVersion;
    }, this.pool);
  }

  /**
   * Exporta dump JSON completo do acervo canônico com versionamento do formato (E3).
   */
  async exportDumpJson(): Promise<{
    meta: {
      format_version: string;
      system: string;
      exported_at: string;
      total_nodes: number;
      total_relations: number;
      total_sources: number;
      total_licenses: number;
      total_curriculum: number;
    };
    licenses: any[];
    sources: any[];
    curriculum_skills: any[];
    knowledge_nodes: any[];
    knowledge_relations: any[];
    resources: any[];
    staging_nodes: any[];
    import_batches: any[];
    content_packs: any[];
  }> {
    const [
      licenses,
      sources,
      curriculum,
      nodes,
      relations,
      resources,
      staging,
      batches,
      packs,
    ] = await Promise.all([
      this.listLicenses(),
      this.listSources(),
      this.listCurriculum(),
      this.pool.query('SELECT * FROM knowledge_nodes ORDER BY created_at ASC;').then((r) => r.rows),
      this.listRelations(),
      this.listResources(),
      this.listStaging(),
      this.listBatches(),
      this.listPacks(),
    ]);

    return {
      meta: {
        format_version: '1.0',
        system: 'PEMARA Knowledge Core PostgreSQL v1.0',
        exported_at: new Date().toISOString(),
        total_nodes: nodes.length,
        total_relations: relations.length,
        total_sources: sources.length,
        total_licenses: licenses.length,
        total_curriculum: curriculum.length,
      },
      licenses,
      sources,
      curriculum_skills: curriculum,
      knowledge_nodes: nodes,
      knowledge_relations: relations,
      resources,
      staging_nodes: staging,
      import_batches: batches,
      content_packs: packs,
    };
  }

  /**
   * Obtém histórico completo de snapshots de uma entidade.
   */
  async getEntityVersions(entityType: string, entityId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT * FROM entity_versions 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY version DESC;`,
      [entityType, entityId]
    );
    return res.rows;
  }
}
