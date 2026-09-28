/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA COMPONENTE DE FUNÇÃO MATEMÁTICA E PARÁBOLA
 * Visualizador e manipulador dinâmico de funções cartesianas (y = ax² + bx + c)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { MathFunctionScene, MathFunctionParams } from '../../types/lesson';
import { LineChart, CheckCircle2, ArrowRight } from 'lucide-react';

interface Props {
  scene: MathFunctionScene;
  onParamsChange?: (newParams: MathFunctionParams) => void;
}

export const PemaraFunctionGraph: React.FC<Props> = ({ scene, onParamsChange }) => {
  const [params, setParams] = useState<MathFunctionParams>(scene.params);

  useEffect(() => {
    setParams(scene.params);
  }, [scene.params]);

  const updateParam = (key: keyof MathFunctionParams, val: any) => {
    const updated = { ...params, [key]: val };
    setParams(updated);
    if (onParamsChange) onParamsChange(updated);
  };

  const a = typeof params?.a === 'number' && Number.isFinite(params.a) ? params.a : 1;
  const b = typeof params?.b === 'number' && Number.isFinite(params.b) ? params.b : 0;
  const c = typeof params?.c === 'number' && Number.isFinite(params.c) ? params.c : 0;

  // Cálculo de Discriminante Delta (Δ = b² - 4ac)
  const delta = useMemo(() => b * b - 4 * a * c, [a, b, c]);

  // Vértice da Parábola (Xv = -b / 2a, Yv = -Δ / 4a)
  const vertex = useMemo(() => {
    if (a === 0) return { x: 0, y: c };
    const xv = -b / (2 * a);
    const yv = -delta / (4 * a);
    return { x: xv, y: yv };
  }, [a, b, c, delta]);

  // Raízes Reais
  const roots = useMemo(() => {
    if (a === 0) {
      // Equação linear bx + c = 0 => x = -c/b
      return b !== 0 ? [-c / b] : [];
    }
    if (delta < 0) return [];
    if (delta === 0) return [-b / (2 * a)];
    const sqrtDelta = Math.sqrt(delta);
    return [(-b - sqrtDelta) / (2 * a), (-b + sqrtDelta) / (2 * a)].sort((r1, r2) => r1 - r2);
  }, [a, b, c, delta]);

  // Dimensões do Gráfico Cartesiano SVG
  const width = 640;
  const height = 400;
  const originX = width / 2;
  const originY = height / 2;
  const scale = 25; // pixels por unidade cartesiana

  const toSvgX = (x: number) => originX + x * scale;
  const toSvgY = (y: number) => originY - y * scale;

  // Gerar curva da função
  const pathD = useMemo(() => {
    const xMin = -12;
    const xMax = 12;
    const step = 0.1;
    let d = '';

    for (let x = xMin; x <= xMax; x += step) {
      const y = a * x * x + b * x + c;
      const sx = toSvgX(x);
      const sy = toSvgY(y);

      if (d === '') {
        d = `M ${sx} ${sy}`;
      } else {
        d += ` L ${sx} ${sy}`;
      }
    }
    return d;
  }, [a, b, c]);

  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
      {/* Cabeçalho */}
      <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <LineChart className="w-4 h-4 text-emerald-400" />
            Matemática Interativa — Álgebra e Geometria Analítica
          </div>
          <h3 className="text-2xl font-black text-white">{scene.title}</h3>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-base font-mono font-bold text-emerald-300">
          f(x) = {a !== 0 ? `${a}x²` : ''} {b > 0 ? `+ ${b}x` : b < 0 ? `- ${Math.abs(b)}x` : ''}{' '}
          {c > 0 ? `+ ${c}` : c < 0 ? `- ${Math.abs(c)}` : ''}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* GRÁFICO SVG CARTESIANO */}
        <div className="lg:col-span-7 bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-hidden flex items-center justify-center relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
            {/* Grid */}
            <g stroke="#1e293b" strokeWidth="1">
              {Array.from({ length: 25 }, (_, i) => i - 12).map((val) => (
                <g key={`grid-${val}`}>
                  <line x1={toSvgX(val)} y1="0" x2={toSvgX(val)} y2={height} />
                  <line x1="0" y1={toSvgY(val)} x2={width} y2={toSvgY(val)} />
                </g>
              ))}
            </g>

            {/* Eixos X e Y */}
            <line x1="0" y1={originY} x2={width} y2={originY} stroke="#64748b" strokeWidth="2" />
            <line x1={originX} y1="0" x2={originX} y2={height} stroke="#64748b" strokeWidth="2" />

            {/* Rótulos dos eixos */}
            <text x={width - 20} y={originY - 8} fill="#94a3b8" fontSize="12" fontWeight="bold">
              X
            </text>
            <text x={originX + 8} y="20" fill="#94a3b8" fontSize="12" fontWeight="bold">
              Y
            </text>

            {/* Curva da Parábola */}
            <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" />

            {/* Vértice da Parábola */}
            {a !== 0 && (
              <g>
                <circle cx={toSvgX(vertex.x)} cy={toSvgY(vertex.y)} r="6" fill="#f59e0b" />
                <text
                  x={toSvgX(vertex.x)}
                  y={toSvgY(vertex.y) + (a > 0 ? 18 : -10)}
                  fill="#fcd34d"
                  fontSize="11"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  V({vertex.x.toFixed(1)}, {vertex.y.toFixed(1)})
                </text>
              </g>
            )}

            {/* Raízes Reais */}
            {roots.map((r, i) => (
              <g key={`root-${i}`}>
                <circle cx={toSvgX(r)} cy={toSvgY(0)} r="5" fill="#38bdf8" />
                <text
                  x={toSvgX(r)}
                  y={toSvgY(0) - 10}
                  fill="#7dd3fc"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  x{i + 1} = {r.toFixed(1)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* CONTROLES DOS COEFICIENTES E ANÁLISE DIDÁTICA */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            {/* Slider a */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-300">Coeficiente 'a' (Concavidade):</span>
                <span className="font-mono text-sm font-bold text-emerald-400">{a}</span>
              </div>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.5"
                value={a}
                onChange={(e) => updateParam('a', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {a > 0 ? '▲ Concavidade voltada para cima (a > 0)' : a < 0 ? '▼ Concavidade voltada para baixo (a < 0)' : 'Linha reta (função linear a = 0)'}
              </span>
            </div>

            {/* Slider b */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-300">Coeficiente 'b' (Inclinação no eixo Y):</span>
                <span className="font-mono text-sm font-bold text-sky-400">{b}</span>
              </div>
              <input
                type="range"
                min="-8"
                max="8"
                step="1"
                value={b}
                onChange={(e) => updateParam('b', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* Slider c */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-300">Termo independente 'c' (Interseção com Y):</span>
                <span className="font-mono text-sm font-bold text-purple-400">{c}</span>
              </div>
              <input
                type="range"
                min="-10"
                max="10"
                step="1"
                value={c}
                onChange={(e) => updateParam('c', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>

          {/* TELEMETRIA ANALÍTICA */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Discriminante (Δ = b² - 4ac):</span>
              <span className="font-mono font-bold text-amber-300">{delta.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Raízes Reais:</span>
              <span className="font-mono font-bold text-cyan-300">
                {roots.length === 0 ? 'Nenhuma raiz real (Δ < 0)' : roots.map(r => r.toFixed(2)).join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ponto do Vértice:</span>
              <span className="font-mono font-bold text-emerald-300">
                ({vertex.x.toFixed(2)}, {vertex.y.toFixed(2)}) — {a > 0 ? 'Ponto Mínimo' : 'Ponto Máximo'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
