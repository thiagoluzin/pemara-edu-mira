/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TimelineScene, TimelineEvent } from '../../types/lesson';
import { History, Calendar, Tag, ChevronRight } from 'lucide-react';

interface Props {
  scene: TimelineScene;
}

export const PemaraTimeline: React.FC<Props> = ({ scene }) => {
  const rawEvents = Array.isArray(scene?.params?.events) ? scene.params.events : [];
  const events = rawEvents.filter((ev): ev is TimelineEvent => Boolean(ev && typeof ev === 'object'));
  const timeframe_label = scene?.params?.timeframe_label;
  const [activeEventIndex, setActiveEventIndex] = useState<number>(0);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <History className="w-4 h-4 text-amber-400" />
            Linha do Tempo Cronológica Didática
          </div>
          <h3 className="text-2xl font-black text-white">{scene.title}</h3>
        </div>
        {timeframe_label && (
          <div className="px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
            {timeframe_label}
          </div>
        )}
      </div>

      {/* Navegação Cronológica Superior */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {events.map((ev, idx) => (
          <button
            key={idx}
            onClick={() => setActiveEventIndex(idx)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${
              activeEventIndex === idx
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/80'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 opacity-80" />
            <span>{ev.year}</span>
          </button>
        ))}
      </div>

      {/* Cartão Expandido do Evento Selecionado */}
      {events[activeEventIndex] && (
        <div className="p-6 rounded-2xl bg-slate-950/80 border border-amber-500/30 text-slate-100 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {events[activeEventIndex].year}
            </span>
            {events[activeEventIndex].tag && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-cyan-300 text-xs font-medium border border-slate-700">
                <Tag className="w-3 h-3 text-cyan-400" />
                {events[activeEventIndex].tag}
              </span>
            )}
          </div>

          <h4 className="text-xl md:text-2xl font-bold text-white">
            {events[activeEventIndex].title}
          </h4>

          <p className="text-base text-slate-300 leading-relaxed font-normal">
            {events[activeEventIndex].description}
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs text-slate-400">
            <span>Marco {activeEventIndex + 1} de {events.length}</span>
            <div className="flex gap-2">
              <button
                disabled={activeEventIndex === 0}
                onClick={() => setActiveEventIndex(prev => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30"
              >
                Anterior
              </button>
              <button
                disabled={activeEventIndex === events.length - 1}
                onClick={() => setActiveEventIndex(prev => Math.min(events.length - 1, prev + 1))}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
