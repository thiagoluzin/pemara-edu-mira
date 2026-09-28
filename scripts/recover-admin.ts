/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — RECUPERAÇÃO EXPLÍCITA DA CONTA ADMINISTRATIVA (R5)
 * Redefine a credencial de uma conta 'admin' existente, revoga todas as sessões
 * e registra auditoria na mesma transação atômica.
 * 
 * Uso: npm run auth:recover-admin
 */

import { getPool, withTransaction } from '../server/db/pool';
import { UserRepository } from '../server/repositories/userRepository';
import { SessionRepository } from '../server/repositories/sessionRepository';
import { AuthEventRepository } from '../server/repositories/authEventRepository';
import { hashPassword } from '../server/auth/passwords';

async function recoverAdmin() {
  const pool = getPool();
  const userRepo = new UserRepository(pool);
  const sessionRepo = new SessionRepository(pool);
  const authEventRepo = new AuthEventRepository(pool);

  console.log('[Recover Admin] Iniciando recuperação explícita da conta de administrador...');

  try {
    const adminPassword = process.env.ADMIN_RECOVER_PASSWORD || 'admin';
    const passwordHash = hashPassword(adminPassword);

    const admin = await userRepo.findByUsername('admin');
    if (!admin) {
      console.error('[Recover Admin] Erro: usuário "admin" não encontrado no banco. Para criar a conta inicial, execute: npm run auth:bootstrap-admin');
      process.exit(1);
    }

    let revokedCount = 0;
    await withTransaction(async (client) => {
      await userRepo.updatePassword(admin.id, passwordHash, client);
      await userRepo.update(admin.id, { is_active: true, role: 'admin' }, client);
      revokedCount = await sessionRepo.revokeAllUserSessions(admin.id, client);
      await authEventRepo.recordEvent({
        userId: admin.id,
        usernameAttempted: 'admin',
        eventType: 'PASSWORD_RESET',
        details: { source: 'local_cli_recovery', action: 'admin_account_recovered', revokedSessionsCount: revokedCount },
      }, client);
    }, pool);

    console.log(`[Recover Admin] Credencial redefinida com sucesso no PostgreSQL.`);
    console.log(`[Recover Admin] ${revokedCount} sessões anteriores foram revogadas na mesma transação.`);
    console.log('✅ RECUPERAÇÃO ADMINISTRATIVA CONCLUÍDA COM SUCESSO.');
  } catch (err: any) {
    console.error('[Recover Admin] Erro fatal durante recuperação:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

recoverAdmin().catch((err) => {
  console.error('[Recover Admin] Falha na execução:', err);
  process.exit(1);
});
