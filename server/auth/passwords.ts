/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — HASHING E VERIFICAÇÃO SEGURA DE SENHAS (E3)
 * Utiliza scrypt com sal aleatório e verificação em tempo constante (timingSafeEqual).
 */

import crypto from 'crypto';

/**
 * Gera um hash criptográfico seguro a partir de uma senha em texto claro.
 * Retorna string no formato `scrypt:<salt_hex>:<key_hex>`.
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('A senha deve ser uma string não vazia.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Valida uma senha fornecida contra o hash armazenado no banco de dados.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) {
    return false;
  }

  // Suporte a hash gerado pelo scrypt
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) {
      return false;
    }

    const salt = parts[1];
    const originalKeyHex = parts[2];

    try {
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const originalKeyBuf = Buffer.from(originalKeyHex, 'hex');

      if (derivedKey.length !== originalKeyBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(derivedKey, originalKeyBuf);
    } catch (_) {
      return false;
    }
  }

  // Formato desconhecido ou inválido: rejeição estrita (sem fallback em texto plano)
  return false;
}
