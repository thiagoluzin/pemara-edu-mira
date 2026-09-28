import { label, gradeLabel, readableText } from '../ui/labels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA MAESTRO & AGENT LOG VIEWER (Seção 18 e 19)
 * Exibe a deliberação dos 5 agentes especializados:
 * Planner -> Pedagogy -> Visual Director -> Fact Check -> QA
 */

import React from 'react';
import { AgentLogEntry } from '../types/lesson';
import {
  ShieldCheck,
  Compass,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Layers
} from 'lucide-react';

interface Props {
  logs?: AgentLogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

export const MaestroLogViewer: React.FC<Props> = ({ logs = [], isOpen, onClose }) => {
  if (!isOpen) return null;

  const agentIcons: Record<string, any> = {
    Maestro: Layers,
    Planner: Compass,
    Pedagogy: GraduationCap,
    VisualDirector: Sparkles,
    FactCheck: ShieldCheck,
    QA: CheckCircle2
  };

  const statusColors: Record<string, string> = {
    info: 'border-blue-500/40 bg-blue-950/30 text-blue-300',
    success: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300',
    warning: 'border-amber-500/40 bg-amber-950/30 text-amber-300',
    alert: 'border-rose-500/40 bg-rose-950/30 text-rose-300'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-xl font-bold text-white">Pipeline de Agentes Maestro</h3>
              <p className="text-xs text-slate-400">
                Histórico de deliberação pedagógica, escolhas visuais e testes de QA.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline dos Agentes */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Nenhum log registrado para a sessão atual.
            </div>
          ) : (
            logs.map((log, index) => {
              const Icon = agentIcons[log.agent] || Info;
              const colorClass = statusColors[log.status] || statusColors.info;

              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all ${colorClass}`}
                >
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/60 flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">
                        {label(log.agent)}: <span className="font-semibold text-slate-200">{readableText(log.action)}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{log.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{readableText(log.details)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
