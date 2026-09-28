/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — MODAL DE RESOLUÇÃO DE CONFLITOS DE CONCORRÊNCIA (R6 / B2)
 * Protege contra sobrescrita silenciosa quando duas abas ou clientes alteram a mesma aula.
 */

import React from 'react';
import { AlertTriangle, Download, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { LessonSpec } from '../types/lesson';

interface Props {
  isOpen: boolean;
  expectedVersion?: number;
  actualVersion?: number;
  currentSpec?: LessonSpec;
  serverDraft?: any;
  onReloadServer: () => void;
  onForceSave?: () => void;
  onExportLocalBackup: () => void;
  onClose: () => void;
}

export const ConflictModal: React.FC<Props> = ({
  isOpen,
  expectedVersion,
  actualVersion,
  serverDraft,
  onReloadServer,
  onForceSave,
  onExportLocalBackup,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-amber-500/10 flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">Conflito de Concorrência Detectado (HTTP 409)</h3>
            <p className="text-xs text-amber-200/80 mt-1">
              Outra aba ou sessão já comitou alterações nesta mesma aula.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-2 font-mono">
            <div className="flex justify-between items-center text-slate-400">
              <span>Sua versão base:</span>
              <span className="font-bold text-amber-400">v{expectedVersion || '?'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Versão atual no banco de dados:</span>
              <span className="font-bold text-emerald-400">v{actualVersion || '?'}</span>
            </div>
            {serverDraft && (
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                <span>Rascunho concorrente atualizado em: </span>
                <span className="text-white">{new Date(serverDraft.updated_at).toLocaleTimeString('pt-BR')}</span>
              </div>
            )}
          </div>

          <p className="leading-relaxed">
            Para garantir a <strong>integridade autoral</strong> e impedir perdas silenciosas de conteúdo, o servidor bloqueou a gravação direta. Escolha como prosseguir:
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <RefreshCw className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold text-white block mb-0.5">Recarregar Versão do Servidor (Recomendado)</span>
                <span className="text-slate-400 text-[11px]">
                  Descarta as alterações locais pendentes e sincroniza com a versão mais recente salva no banco.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <Download className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold text-white block mb-0.5">Exportar Cópia Local de Segurança</span>
                <span className="text-slate-400 text-[11px]">
                  Baixe um arquivo JSON com todas as suas edições locais atuais antes de sincronizar.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onExportLocalBackup}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Baixar Cópia de segurança Local (.json)</span>
          </button>

          <div className="flex items-center gap-2">
            {onForceSave && (
              <button
                onClick={onForceSave}
                className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-semibold text-xs border border-rose-500/30 transition-colors"
                title="Sobrescreve a versão do servidor com a sua edição atual"
              >
                Sobrescrever Forçadamente
              </button>
            )}

            <button
              onClick={onReloadServer}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recarregar do Servidor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
