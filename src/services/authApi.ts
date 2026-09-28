/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — SERVIÇO CLIENTE DE AUTENTICAÇÃO E SESSÕES (E3)
 * Comunicação com PostgreSQL exclusivamente via cookies HttpOnly.
 * NENHUM token ou hash é persistido em localStorage ou exposto no cliente.
 */

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'teacher' | 'editor' | 'curator' | 'admin';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Limpeza imediata de qualquer resíduo legado de localStorage (conforme ordem de segurança)
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('pemara_auth_session_v1');
    localStorage.removeItem('pemara_auth_user_v1');
    localStorage.removeItem('pemara_auth_token');
  } catch {}
}

export const authApi = {
  /**
   * Autentica o usuário com identificador e senha.
   * A sessão é estabelecida automaticamente pelo navegador via cookie HttpOnly.
   */
  async login(usernameOrEmail: string, password: string): Promise<AuthUser> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha na autenticação' }));
      throw new Error(err.error || `Erro de autenticação (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.user;
  },

  /**
   * Encerra a sessão do usuário no servidor e remove o cookie HttpOnly.
   */
  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Ignora falhas de rede no logout
    }
  },

  /**
   * Obtém os dados do usuário autenticado a partir do cookie HttpOnly da sessão.
   */
  async getMe(): Promise<AuthUser | null> {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      return data.user || null;
    } catch {
      return null;
    }
  },

  /**
   * Altera a própria senha da conta autenticada.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao alterar senha' }));
      throw new Error(err.error || `Erro ao alterar senha (HTTP ${res.status})`);
    }
  },
};
