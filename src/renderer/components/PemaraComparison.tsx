import { comparisonValue } from '../../engine/comparisonModel';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA COMPONENTE DE COMPARAÇÃO DETERMINÍSTICO (Layout: 05_comparison)
 * Comparação lado a lado (ex: Atenas vs Esparta) respeitando Safe Area e sem colisão
 */

import React, { useState } from 'react';
import { ComparisonScene } from '../../types/lesson';
import { Columns3, CheckCircle2, ShieldCheck, Scale } from 'lucide-react';

interface Props {
  scene: ComparisonScene;
}

export const PemaraComparison: React.FC<Props> = ({ scene }) => {
  const rawCols = Array.isArray(scene?.params?.columns) ? scene.params.columns : [];
  const columns = rawCols.map((c) => String(c ?? ''));
  const rows = Array.isArray(scene?.params?.rows) ? scene.params.rows.filter(Boolean) : [];
  const conclusion = scene?.params?.conclusion;
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);


  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Scale className="w-4 h-4 text-amber-400" />
            Comparação de conceitos
          </div>
          <h3 className="text-2xl font-black text-white">{scene.title}</h3>
        </div>

        {scene.source_citation && (
          <span className="text-[11px] text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
            Fonte: {scene.source_citation}
          </span>
        )}
      </div>

      {/* TABELA COMPARATIVA COM SAFE AREA (Máx 3 colunas) */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 shadow-inner">
        <table className="w-full border-collapse text-left text-xs md:text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-300 font-bold">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`p-4 ${
                    idx === 0 ? 'w-1/4 text-slate-400 uppercase tracking-wider text-[11px]' : 'w-3/8 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {idx > 0 && <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />}
                    <span>{col}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row, rIdx) => {
              const isSelected = activeRowIndex === rIdx;
              return (
                <tr
                  key={rIdx}
                  onClick={() => setActiveRowIndex(isSelected ? null : rIdx)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-950/40 ring-1 ring-indigo-500/50' : 'hover:bg-slate-800/40'
                  }`}
                >
                  {columns.map((column,index)=><td key={index} className={index===0?'p-4 font-bold text-amber-300':'p-4 text-slate-200 leading-relaxed'}>{comparisonValue(row,column,index)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Conclusão Sintética ou Dica Pedagógica */}
      {conclusion && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-300 block uppercase tracking-wider text-[10px]">
              Conclusão Didática:
            </span>
            <p className="text-slate-200">{conclusion}</p>
          </div>
        </div>
      )}
    </div>
  );
};
