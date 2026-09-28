/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — REPOSITÓRIO DE CONTENT PACKS E VERSÕES IMUTÁVEIS (E2)
 */

import pg from 'pg';
import crypto from 'crypto';
import { getPool, withTransaction } from '../db/pool';
import { DbContentPackVersion } from '../db/types';

export class PackRepository {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool || getPool();
  }

  async createPack(pack: {
    id?: string;
    slug: string;
    subjectCode: string;
    gradeLevel: number;
    topicNodeId?: string | null;
    title: string;
  }): Promise<{ id: string; slug: string; title: string }> {
    const id = pack.id || crypto.randomUUID();
    const res = await this.pool.query(
      `INSERT INTO content_packs (id, slug, subject_code, grade_level, topic_node_id, title)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, slug, title;`,
      [id, pack.slug, pack.subjectCode, pack.gradeLevel, pack.topicNodeId || null, pack.title]
    );
    return res.rows[0];
  }

  async publishPackVersion(params: {
    packId: string;
    version: string;
    schemaVersion?: string;
    payload: any;
    manifest: any;
    actorId: string;
  }): Promise<DbContentPackVersion> {
    return withTransaction(async (client) => {
      // 1. Verificar se versão já existe para o pack (imutabilidade estrita)
      const existingRes = await client.query(
        'SELECT id FROM content_pack_versions WHERE pack_id = $1 AND version = $2;',
        [params.packId, params.version]
      );

      if (existingRes.rows.length > 0) {
        throw new Error(
          `A versão "${params.version}" do pack ${params.packId} já está publicada e é imutável. Publique uma nova versão sequencial.`
        );
      }

      const id = crypto.randomUUID();
      const schemaVersion = params.schemaVersion || '1.0';
      const payloadString = JSON.stringify(params.payload);
      const contentHash = crypto.createHash('sha256').update(payloadString).digest('hex');

      // 2. Inserir versão publicada
      const res = await client.query<DbContentPackVersion>(
        `INSERT INTO content_pack_versions (id, pack_id, version, schema_version, content_hash, manifest_json, payload_json, status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PUBLISHED', CURRENT_TIMESTAMP)
         RETURNING *;`,
        [
          id,
          params.packId,
          params.version,
          schemaVersion,
          contentHash,
          params.manifest,
          params.payload,
        ]
      );
      const published = res.rows[0];

      // 3. Registrar auditoria
      await client.query(
        `INSERT INTO activity_history (id, entity_type, entity_id, action, actor_id, details_json)
         VALUES ($1, 'pack', $2, 'published_version', $3, $4);`,
        [crypto.randomUUID(), params.packId, params.actorId, JSON.stringify({ version: params.version, contentHash })]
      );

      return published;
    }, this.pool);
  }

  async getPackVersion(packId: string, version: string): Promise<DbContentPackVersion | null> {
    const res = await this.pool.query<DbContentPackVersion>(
      'SELECT * FROM content_pack_versions WHERE pack_id = $1 AND version = $2;',
      [packId, version]
    );
    return res.rows[0] || null;
  }

  async listPackVersions(packId: string): Promise<DbContentPackVersion[]> {
    const res = await this.pool.query<DbContentPackVersion>(
      'SELECT * FROM content_pack_versions WHERE pack_id = $1 ORDER BY created_at DESC;',
      [packId]
    );
    return res.rows;
  }
}
