/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QuizScene } from '../../types/lesson';
import { HelpCircle, CheckCircle2, XCircle, Sparkles, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  scene: QuizScene;
}

export const PemaraQuiz: React.FC<Props> = ({ scene }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  const handleSelect = (idx: number) => {
    if (hasSubmitted) return;
    setSelectedIndex(idx);
    setHasSubmitted(true);

    if (idx === scene.correct_index) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // Fallback se confetti falhar
      }
    }
  };

  const handleRetry = () => {
    setSelectedIndex(null);
    setHasSubmitted(false);
  };

  const isCorrect = selectedIndex === scene.correct_index;

  return (
    <div className="flex flex-col min-h-[480px] p-6 md:p-10 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden justify-between">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            Avaliação Formativa Diagnóstica
          </div>
          {scene.hint && (
            <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
              Dica Disponível
            </span>
          )}
        </div>

        {/* Questão */}
        <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-tight mb-8">
          {scene.question}
        </h3>

        {/* Lista de Alternativas */}
        <div className="space-y-3">
          {scene.answers.map((answer, idx) => {
            const isThisSelected = selectedIndex === idx;
            const isThisCorrect = idx === scene.correct_index;

            let buttonStyle = 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-700/60 text-slate-200';
            if (hasSubmitted) {
              if (isThisCorrect) {
                buttonStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-950/50';
              } else if (isThisSelected && !isThisCorrect) {
                buttonStyle = 'bg-rose-950/80 border-rose-500 text-rose-200';
              } else {
                buttonStyle = 'bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-60';
              }
            }

            return (
              <button
                key={idx}
                disabled={hasSubmitted}
                onClick={() => handleSelect(idx)}
                className={`w-full text-left p-4 rounded-xl border flex items-center justify-between gap-4 transition-all duration-200 ${buttonStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-900/80 border border-slate-700 flex items-center justify-center text-xs font-bold font-mono text-slate-300">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-sm md:text-base font-medium">{answer}</span>
                </div>

                {hasSubmitted && isThisCorrect && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                )}
                {hasSubmitted && isThisSelected && !isThisCorrect && (
                  <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Didático Explicativo */}
      {hasSubmitted && (
        <div className={`mt-8 p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isCorrect
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>{isCorrect ? 'Resposta Correta! Parabéns!' : 'Não foi dessa vez! Veja a explicação:'}</span>
            </div>
            <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-normal">
              {scene.explanation}
            </p>
          </div>

          <button
            onClick={handleRetry}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-600 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      )}
    </div>
  );
};
