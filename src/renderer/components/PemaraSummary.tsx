/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA COMPONENTE DE RESUMO (Layout: 11_summary)
 * Síntese final com pontos-chave e próximos passos pedagógicos
 */

import React from 'react';
import { SummaryScene } from '../../types/lesson';
import { CheckCircle2, ArrowRight, BookOpen, Sparkles } from 'lucide-react';

interface Props {
  scene: SummaryScene;
}

export const PemaraSummary: React.FC<Props> = ({ scene }) => {
  return (
    <div className="flex flex-col min-h-[480px] p-8 md:p-12 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 text-slate-100 shadow-2xl justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Síntese Pedagógica e Consolidação (Layout 11_summary)
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-8">
          {scene.title}
        </h2>

        {/* Pontos de Aprendizagem */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scene.takeaways.map((point, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-slate-900/80 border border-indigo-500/20 shadow-md flex items-start gap-3.5"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-sm md:text-base text-slate-200 leading-relaxed font-medium">
                {point}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Próximos Passos */}
      {scene.next_steps && (
        <div className="mt-8 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span><strong>Próxima Aula:</strong> {scene.next_steps}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>
      )}
    </div>
  );
};
