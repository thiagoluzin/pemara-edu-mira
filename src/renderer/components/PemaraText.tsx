/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TextScene } from '../../types/lesson';
import { Info, CheckCircle2, Lightbulb } from 'lucide-react';

interface Props {
  scene: TextScene;
}

export const PemaraText: React.FC<Props> = ({ scene }) => {
  return (
    <div className="relative flex flex-col min-h-[480px] p-8 md:p-12 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-100 shadow-xl overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="border-b border-slate-800 pb-5 mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
          <Info className="w-3.5 h-3.5" />
          Fundamentação Teórica
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          {scene.title}
        </h2>
      </div>

      {/* Paragraphs and Content */}
      <div className="space-y-5 text-base md:text-lg text-slate-300 leading-relaxed font-normal flex-1">
        {Array.isArray(scene.content) ? (
          scene.content.map((paragraph, idx) => (
            <p key={idx} className="flex items-start gap-3">
              <span className="w-2 h-2 mt-2.5 rounded-full bg-cyan-400 flex-shrink-0" />
              <span>{paragraph}</span>
            </p>
          ))
        ) : (
          <p>{scene.content}</p>
        )}

        {scene.bullets && scene.bullets.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-800/60">
            {scene.bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-sm text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Callout box */}
      {scene.callout && (
        <div className="mt-8 flex items-start gap-4 p-5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-400 text-amber-200 text-sm md:text-base">
          <Lightbulb className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-amber-300 block uppercase text-xs tracking-wider">Atenção Pedagógica:</span>
            <p className="text-slate-200">{scene.callout}</p>
          </div>
        </div>
      )}
    </div>
  );
};
