/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TitleScene } from '../../types/lesson';
import { Sparkles, BookOpen, Layers } from 'lucide-react';

interface Props {
  scene: TitleScene;
}

export const PemaraTitle: React.FC<Props> = ({ scene }) => {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[480px] p-8 md:p-12 text-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 shadow-2xl">
      {/* Background ambient decorative shapes */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />

      {/* Badge / Pill */}
      {scene.badge && (
        <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-indigo-300 uppercase bg-indigo-950/70 border border-indigo-500/30 rounded-full shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>{scene.badge.replaceAll('Pack v', 'Conteúdo v')}</span>
        </div>
      )}

      {/* Main Title */}
      <h1 className="relative z-10 text-4xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300 max-w-4xl tracking-tight leading-tight drop-shadow-sm">
        {scene.title}
      </h1>

      {/* Subtitle */}
      {scene.subtitle && (
        <p className="relative z-10 mt-6 text-lg sm:text-xl md:text-2xl text-slate-300 max-w-2xl font-normal leading-relaxed">
          {scene.subtitle}
        </p>
      )}

      {/* Decorative footer indicator */}
      <div className="relative z-10 mt-12 flex items-center gap-6 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          PEMARA AULA
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
        <span className="inline-flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-cyan-400" />
          Visual & Determinístico
        </span>
      </div>
    </div>
  );
};
