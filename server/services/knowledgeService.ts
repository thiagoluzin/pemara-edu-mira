/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — SERVIÇO DE DOMÍNIO DE CONHECIMENTO E CURADORIA EDITORIAL (E2)
 */

import { KnowledgeRepository } from '../repositories/knowledgeRepository';
import { PackRepository } from '../repositories/packRepository';
import { AuditRepository } from '../repositories/auditRepository';
import { DbKnowledgeNode, DbContentPackVersion } from '../db/types';

export class KnowledgeService {
  private knowledgeRepo: KnowledgeRepository;
  private packRepo: PackRepository;
  private auditRepo: AuditRepository;

  constructor(customRepos?: {
    knowledgeRepo?: KnowledgeRepository;
    packRepo?: PackRepository;
    auditRepo?: AuditRepository;
  }) {
    this.knowledgeRepo = customRepos?.knowledgeRepo || new KnowledgeRepository();
    this.packRepo = customRepos?.packRepo || new PackRepository();
    this.auditRepo = customRepos?.auditRepo || new AuditRepository();
  }

  /**
   * Cria um nó no grafo de conhecimento.
   */
  async createNode(data: Parameters<KnowledgeRepository['createNode']>[0], actorId: string): Promise<DbKnowledgeNode> {
    return this.knowledgeRepo.createNode(data, actorId);
  }

  /**
   * Atualiza um nó com verificação de bloqueio otimista e snapshot auditado.
   */
  async updateNode(params: Parameters<KnowledgeRepository['updateNodeWithOptimisticLock']>[0]): Promise<DbKnowledgeNode> {
    return this.knowledgeRepo.updateNodeWithOptimisticLock(params);
  }

  /**
   * Promove item de staging para o Knowledge Core permanente com deduplicação atômica.
   */
  async promoteStaging(stagingId: string, actorId: string): Promise<{ node: DbKnowledgeNode; duplicateHandled: boolean }> {
    return this.knowledgeRepo.promoteStagingNode(stagingId, actorId);
  }

  /**
   * Publica uma versão imutável de Content Pack com validação e hash SHA-256.
   */
  async publishPack(params: Parameters<PackRepository['publishPackVersion']>[0]): Promise<DbContentPackVersion> {
    return this.packRepo.publishPackVersion(params);
  }

  /**
   * Consulta histórico de auditoria de uma entidade.
   */
  async getAuditTrail(entityType: string, entityId: string) {
    return this.auditRepo.listActivity(entityType, entityId);
  }
}
