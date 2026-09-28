/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — MODAL DE HISTÓRICO DE REVISÕES E RESTAURAÇÃO (B2 / R6)
 * Permite que professores inspecionem versões imutáveis da aula e restaurem versões anteriores.
 */

import React, { useState, useEffect } from 'react';
import { lessonsApi, DbLessonRevisionSummary } from '../services/lessonsApi';
import { History, RotateCcw, X, CheckCircle2, Clock, GitCommit, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  lessonId: string;
  currentVersion: number;
  onClose: () => void;
  onRestoreRevision: (revisionId: string, summary: string) => Promise<void>;
}

export const RevisionsModal: React.FC<Props> = ({
  isOpen,
  lessonId,
  currentVersion,
  onClose,
  onRestoreRevision,
}) => {
  const [revisions, setRevisions] = useState<DbLessonRevisionSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !lessonId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    lessonsApi.listRevisions(lessonId)
      .then((data) => {
        if (isMounted) {
          setRevisions(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Erro ao carregar histórico de revisões.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, lessonId]);

  if (!isOpen) return null;

  const handleConfirmRestore = async (rev: DbLessonRevisionSummary) => {
    setIsSubmitting(true);
    try {
      const summary = restoreSummary.trim() || `Restauração da versão v${rev.version} pelo professor`;
      await onRestoreRevision(rev.id, summary);
      setRestoringId(null);
      setRestoreSummary('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao restaurar revisão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Histórico de Versões Imutáveis</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Versão atual no banco: <span className="text-indigo-400 font-bold font-mono">v{currentVersion}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400 font-medium">Carregando revisões...</p>
            </div>
          ) : revisions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Nenhuma revisão imutável registrada ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {revisions.map((rev) => {
                const isCurrent = rev.version === currentVersion;
                const isConfirming = restoringId === rev.id;

                return (
                  <div
                    key={rev.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-indigo-950/30 border-indigo-500/40 ring-1 ring-indigo-500/30'
                        : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            v{rev.version}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              Versão Ativa
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(rev.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-white">
                          {rev.change_summary || 'Sem resumo de alterações'}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                          <span className="flex items-center gap-1">
                            <GitCommit className="w-3 h-3" />
                            Hash: {rev.content_hash.slice(0, 12)}...
                          </span>
                          {rev.created_by && (
                            <span>Autor: {rev.created_by.slice(0, 14)}</span>
                          )}
                        </div>
                      </div>

                      {!isCurrent && (
                        <div>
                          {!isConfirming ? (
                            <button
                              onClick={() => {
                                setRestoringId(rev.id);
                                setRestoreSummary(`Restauração da v${rev.version}`);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restaurar</span>
                            </button>
                          ) : (
                            <div className="space-y-2 text-right">
                              <input
                                type="text"
                                value={restoreSummary}
                                onChange={(e) => setRestoreSummary(e.target.value)}
                                placeholder="Motivo da restauração..."
                                className="px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setRestoringId(null)}
                                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                  Cancelar
                                </button>
                                <button
                                  disabled={isSubmitting}
                                  onClick={() => handleConfirmRestore(rev)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
                                >
                                  {isSubmitting ? 'Restaurando...' : 'Confirmar'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>Todas as versões anteriores permanecem preservadas no histórico imutável.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
