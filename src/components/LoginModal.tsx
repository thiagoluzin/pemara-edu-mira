/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — FORMULÁRIO REAL DE LOGIN INDIVIDUAL (E3)
 * Digitação obrigatória de usuário e senha sem autenticação automática
 * ou credenciais embutidas no frontend.
 */

import React, { useState } from 'react';
import { Lock, User, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { authApi, AuthUser } from '../services/authApi';

interface Props {
  isOpen: boolean;
  onSuccess: (user: AuthUser) => void;
  onClose?: () => void;
}

export const LoginModal: React.FC<Props> = ({ isOpen, onSuccess, onClose }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage('Por favor, informe seu usuário ou e-mail e a senha.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await authApi.login(identifier.trim(), password);
      setIsLoading(false);
      onSuccess(user);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Falha ao autenticar. Verifique seus dados.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-400">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Acesso Individual ao Sistema</h2>
          <p className="text-xs text-slate-400 mt-1">
            Entre com suas credenciais para acessar sua área de trabalho e acervo.
          </p>
        </div>

        {/* Aviso de primeiro acesso institucional */}
        <div className="mb-5 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-indigo-200 text-[11px] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-indigo-300">Primeiro Acesso:</span> Use o usuário <code className="bg-indigo-900/60 px-1 py-0.5 rounded text-indigo-200">admin</code> e senha <code className="bg-indigo-900/60 px-1 py-0.5 rounded text-indigo-200">admin</code>. Altere sua senha antes do uso escolar.
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Usuário ou E-mail
            </label>
            <div className="relative">
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Ex: admin ou prof.helena"
                required
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span>ENTRAR</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {onClose && (
          <div className="mt-4 text-center">
            <button
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Continuar navegando no modo de consulta
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
