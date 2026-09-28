/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — MODAL DE PUBLICAÇÃO DE VERSÃO OFICIAL (B2 / R6)
 * Permite ao professor salvar uma nova versão imutável no banco de dados com resumo de alterações.
 */

import React, { useState } from 'react';
import { BookmarkCheck, X, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  currentVersion: number;
  onClose: () => void;
  onPublish: (changeSummary: string) => Promise<void>;
}

export const PublishVersionModal: React.FC<Props> = ({
  isOpen,
  currentVersion,
  onClose,
  onPublish,
}) => {
  const [changeSummary, setChangeSummary] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const nextVersion = (currentVersion || 1) + 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeSummary.trim()) {
      setError('Informe um resumo das alterações realizadas para o histórico.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onPublish(changeSummary.trim());
      setChangeSummary('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao publicar versão oficial.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Publicar Nova Versão Oficial</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Avançar de <span className="font-mono text-indigo-400 font-bold">v{currentVersion}</span> para{' '}
                <span className="font-mono text-emerald-400 font-bold">v{nextVersion}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Resumo das Modificações Pedagógicas / Visuais:
            </label>
            <textarea
              rows={3}
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Ex: Atualizados pontos de foco no mapa de Atenas e adicionadas 2 novas perguntas no questionário..."
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              autoFocus
            />
            <p className="text-[11px] text-slate-400">
              Este resumo ficará gravado no snapshot imutável para consulta no histórico da aula.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !changeSummary.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Gravando no Banco...' : `Publicar Versão v${nextVersion}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
