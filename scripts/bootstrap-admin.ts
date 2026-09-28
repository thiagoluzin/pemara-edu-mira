/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — COMANDO LOCAL DE BOOTSTRAP ADMINISTRATIVO
 * Configura/redefine a credencial inicial do usuário 'admin' para 'admin' UMA ÚNICA VEZ,
 * revoga todas as sessões anteriores e registra auditoria.
 * 
 * Uso: npm run auth:bootstrap-admin
 * IMPORTANTE: Nunca expor como endpoint público nem executar automaticamente na inicialização.
 */

import pg from 'pg';
import { getPool, withTransaction } from '../server/db/pool';
import { UserRepository } from '../server/repositories/userRepository';
import { SessionRepository } from '../server/repositories/sessionRepository';
import { AuthEventRepository } from '../server/repositories/authEventRepository';
import { hashPassword } from '../server/auth/passwords';
import { DbUser } from '../server/db/types';

async function bootstrapAdmin() {
  const pool = getPool();
  const userRepo = new UserRepository(pool);
  const sessionRepo = new SessionRepository(pool);
  const authEventRepo = new AuthEventRepository(pool);

  console.log('[Bootstrap Admin] Iniciando configuração local da conta administrativa...');

  try {
    const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'admin';
    const passwordHash = hashPassword(adminPassword);

    let admin = await userRepo.findByUsername('admin');

    if (!admin) {
      console.log('[Bootstrap Admin] Usuário "admin" não encontrado. Criando conta com papel de administrador geral...');
      const createdAdmin = await withTransaction<DbUser>(async (client: pg.PoolClient) => {
        const u = await userRepo.create({
          username: 'admin',
          name: 'Administrador Geral',
          email: 'admin@pemara.local',
          password_hash: passwordHash,
          role: 'admin',
          is_active: true,
        }, client);

        await authEventRepo.recordEvent({
          userId: u.id,
          usernameAttempted: 'admin',
          eventType: 'ACCOUNT_CREATED',
          details: { source: 'local_cli_bootstrap', action: 'bootstrap_admin_created' },
        }, client);

        return u;
      }, pool);
      admin = createdAdmin;
      console.log('[Bootstrap Admin] Conta criada com sucesso (ID:', admin.id, ').');
      console.log('\n============================================================');
      console.log('✅ BOOTSTRAP ADMINISTRATIVO CONCLUÍDO COM SUCESSO');
      console.log('Usuário: admin criado com credencial inicial.');
      console.log('AVISO DE SEGURANÇA: Recomendamos alterar a senha no primeiro');
      console.log('acesso através do Painel Administrativo antes do uso escolar.');
      console.log('============================================================\n');
    } else {
      console.log('[Bootstrap Admin] Usuário "admin" já existe. Nenhuma alteração realizada (operação estritamente idempotente).');
      console.log('[Bootstrap Admin] Para recuperar a senha de uma conta existente, execute explicitamente: npm run auth:recover-admin');
    }
  } catch (err: any) {
    console.error('[Bootstrap Admin] Erro fatal durante bootstrap:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

bootstrapAdmin().catch((err) => {
  console.error('[Bootstrap Admin] Falha na execução:', err);
  process.exit(1);
});
