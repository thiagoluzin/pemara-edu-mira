/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA COMPONENTE DE LANÇAMENTO OBLÍQUO
 * Implementação visual das equações físicas reais de Galileu e Newton
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProjectileScene, ProjectileParams } from '../../types/lesson';
import { calculateProjectileTelemetry, getProjectileStateAt } from '../../engine/physicsEngine';
import { Play, Pause, RotateCcw, Compass, Gauge, Activity, Sparkles } from 'lucide-react';

interface Props {
  scene: ProjectileScene;
  onParamsChange?: (newParams: ProjectileParams) => void;
}

export const PemaraProjectile: React.FC<Props> = ({ scene, onParamsChange }) => {
  // Parâmetros locais reativos
  const [params, setParams] = useState<ProjectileParams>(scene.params);

  useEffect(() => {
    setParams(scene.params);
  }, [scene.params]);

  const updateParam = (key: keyof ProjectileParams, value: any) => {
    const updated = { ...params, [key]: value };
    setParams(updated);
    if (onParamsChange) {
      onParamsChange(updated);
    }
  };

  // Cálculo da telemetria determinística
  const telemetry = useMemo(() => {
    return calculateProjectileTelemetry(params, 120);
  }, [params]);

  // Controle de Animação
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const requestRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Estado instantâneo atual
  const currentState = useMemo(() => {
    return getProjectileStateAt(params, currentTime);
  }, [params, currentTime]);

  const animate = (timestamp: number) => {
    if (lastTimestampRef.current !== null) {
      const dt = ((timestamp - lastTimestampRef.current) / 1000) * playbackSpeed;
      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= telemetry.flightTime) {
          setIsPlaying(false);
          return telemetry.flightTime;
        }
        return next;
      });
    }
    lastTimestampRef.current = timestamp;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      lastTimestampRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimestampRef.current = null;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, playbackSpeed, telemetry.flightTime]);

  const handlePlayPause = () => {
    if (currentTime >= telemetry.flightTime) {
      setCurrentTime(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Escala para o SVG do Lançamento
  const svgWidth = 800;
  const svgHeight = 420;
  const margin = { top: 40, right: 40, bottom: 50, left: 60 };

  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  // Escala dinâmica com margem de folga de 20%
  const scaleXMax = Math.max(20, telemetry.maxRange * 1.15);
  const scaleYMax = Math.max(10, telemetry.maxHeight * 1.3);

  const toSvgX = (x: number) => margin.left + (x / scaleXMax) * plotWidth;
  const toSvgY = (y: number) => svgHeight - margin.bottom - (y / scaleYMax) * plotHeight;

  // Path SVG da trajetória teórica completa
  const trajectoryPathD = useMemo(() => {
    if (telemetry.trajectoryPoints.length < 2) return '';
    return telemetry.trajectoryPoints.reduce((acc, pt, index) => {
      const sx = toSvgX(pt.x);
      const sy = toSvgY(pt.y);
      return index === 0 ? `M ${sx} ${sy}` : `${acc} L ${sx} ${sy}`;
    }, '');
  }, [telemetry, scaleXMax, scaleYMax]);

  // Path do rastro percorrido até o instante t
  const currentPathD = useMemo(() => {
    const points = telemetry.trajectoryPoints.filter((pt) => pt.t <= currentTime);
    if (points.length < 1) return '';
    let d = `M ${toSvgX(points[0].x)} ${toSvgY(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${toSvgX(points[i].x)} ${toSvgY(points[i].y)}`;
    }
    // Adicionar a posição exata atual
    d += ` L ${toSvgX(currentState.x)} ${toSvgY(currentState.y)}`;
    return d;
  }, [telemetry, currentTime, currentState, scaleXMax, scaleYMax]);

  // Projeção dos vetores de velocidade (escala visual proporcional)
  const vectorScale = 2.4;
  const currSvgX = toSvgX(currentState.x);
  const currSvgY = toSvgY(currentState.y);

  const vxVectorLength = currentState.vx * vectorScale;
  const vyVectorLength = -currentState.vy * vectorScale; // no SVG o Y cresce para baixo

  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
      {/* Cabeçalho do Experimento */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
            <Activity className="w-4 h-4 text-indigo-400" />
            Simulação Física Determinística — Cinemática Vetorial
          </div>
          <h3 className="text-2xl font-black text-white">{scene.title}</h3>
        </div>

        {/* Presets de Corpos Celestes (Gravidade) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
          <span className="text-slate-400 px-2 font-medium">Gravidade:</span>
          {[
            { name: 'Terra', g: 9.81 },
            { name: 'Lua', g: 1.62 },
            { name: 'Marte', g: 3.71 },
            { name: 'Júpiter', g: 24.79 }
          ].map((preset) => (
            <button
              key={preset.name}
              onClick={() => updateParam('gravity', preset.g)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                Math.abs(params.gravity - preset.g) < 0.1
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              {preset.name} ({preset.g} m/s²)
            </button>
          ))}
        </div>
      </div>

      {/* ÁREA GRÁFICA PRINCIPAL DO LANÇAMENTO */}
      <div className="relative w-full rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden shadow-inner">
        {/* Marcadores de Legenda de Vetores */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-3 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs backdrop-blur-md">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="w-3 h-1 bg-emerald-400 rounded-full inline-block" />
            <span>Vx (MRU) = {currentState.vx.toFixed(1)} m/s</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-blue-400">
            <span className="w-3 h-1 bg-blue-400 rounded-full inline-block" />
            <span>Vy (MUV) = {currentState.vy.toFixed(1)} m/s</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-rose-400">
            <span className="w-3 h-1 bg-rose-400 rounded-full inline-block" />
            <span>V Resultante = {currentState.vTotal.toFixed(1)} m/s</span>
          </div>
        </div>

        {/* SVG Interativo */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none overflow-visible"
        >
          <defs>
            {/* Marcadores de setas vetoriais */}
            <marker id="arrow-emerald" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#34d399" />
            </marker>
            <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#60a5fa" />
            </marker>
            <marker id="arrow-rose" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#f43f5e" />
            </marker>

            {/* Gradiente do rastro */}
            <linearGradient id="traj-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Grid de Coordenadas em Metros */}
          <g className="grid-lines" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3">
            {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
              const yVal = scaleYMax * frac;
              const sy = toSvgY(yVal);
              return (
                <g key={`y-${idx}`}>
                  <line x1={margin.left} y1={sy} x2={svgWidth - margin.right} y2={sy} />
                  <text x={margin.left - 10} y={sy + 4} textAnchor="end" fill="#64748b" fontSize="10">
                    {yVal.toFixed(0)}m
                  </text>
                </g>
              );
            })}
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((frac, idx) => {
              const xVal = scaleXMax * frac;
              const sx = toSvgX(xVal);
              return (
                <g key={`x-${idx}`}>
                  <line x1={sx} y1={margin.top} x2={sx} y2={svgHeight - margin.bottom} />
                  <text x={sx} y={svgHeight - margin.bottom + 20} textAnchor="middle" fill="#64748b" fontSize="10">
                    {xVal.toFixed(0)}m
                  </text>
                </g>
              );
            })}
          </g>

          {/* Eixos Cartesianos X e Y */}
          <line
            x1={margin.left}
            y1={svgHeight - margin.bottom}
            x2={svgWidth - margin.right + 15}
            y2={svgHeight - margin.bottom}
            stroke="#475569"
            strokeWidth="2"
          />
          <line
            x1={margin.left}
            y1={svgHeight - margin.bottom}
            x2={margin.left}
            y2={margin.top - 15}
            stroke="#475569"
            strokeWidth="2"
          />
          <text x={svgWidth - margin.right} y={svgHeight - margin.bottom - 8} fill="#94a3b8" fontSize="11" fontWeight="bold">
            X (Alcance Horizontal)
          </text>
          <text x={margin.left + 8} y={margin.top - 5} fill="#94a3b8" fontSize="11" fontWeight="bold">
            Y (Altura)
          </text>

          {/* Curva Teórica Completa (linha tracejada) */}
          <path
            d={trajectoryPathD}
            fill="none"
            stroke="#334155"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Rastro percorrido animado */}
          <path
            d={currentPathD}
            fill="none"
            stroke="url(#traj-gradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Ponto do Ápice (Altura Máxima) */}
          {telemetry.maxHeight > 0 && (
            <g>
              <circle
                cx={toSvgX(telemetry.maxRange / 2)}
                cy={toSvgY(telemetry.maxHeight)}
                r="4"
                fill="#f59e0b"
              />
              <line
                x1={toSvgX(telemetry.maxRange / 2)}
                y1={toSvgY(telemetry.maxHeight)}
                x2={toSvgX(telemetry.maxRange / 2)}
                y2={svgHeight - margin.bottom}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <text
                x={toSvgX(telemetry.maxRange / 2)}
                y={toSvgY(telemetry.maxHeight) - 8}
                fill="#fcd34d"
                fontSize="10"
                textAnchor="middle"
                fontWeight="bold"
              >
                Hmax: {telemetry.maxHeight.toFixed(1)}m (Vy = 0)
              </text>
            </g>
          )}

          {/* Marcador de Alcance Máximo no solo */}
          {telemetry.maxRange > 0 && (
            <g>
              <circle
                cx={toSvgX(telemetry.maxRange)}
                cy={toSvgY(0)}
                r="4"
                fill="#38bdf8"
              />
              <text
                x={toSvgX(telemetry.maxRange)}
                y={svgHeight - margin.bottom - 8}
                fill="#7dd3fc"
                fontSize="10"
                textAnchor="middle"
                fontWeight="bold"
              >
                Xmax: {telemetry.maxRange.toFixed(1)}m
              </text>
            </g>
          )}

          {/* Canhão de Lançamento na Origem (0,0) */}
          <g transform={`translate(${margin.left}, ${svgHeight - margin.bottom})`}>
            <circle cx="0" cy="0" r="8" fill="#475569" />
            <line
              x1="0"
              y1="0"
              x2={24 * Math.cos((params.angle * Math.PI) / 180)}
              y2={-24 * Math.sin((params.angle * Math.PI) / 180)}
              stroke="#94a3b8"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </g>

          {/* VETORES DE VELOCIDADE NO PROJÉTIL (Se habilitado) */}
          {params.show_vectors && (
            <g>
              {/* Vetor Vx (Horizontal - Verde) */}
              <line
                x1={currSvgX}
                y1={currSvgY}
                x2={currSvgX + vxVectorLength}
                y2={currSvgY}
                stroke="#34d399"
                strokeWidth="2.5"
                markerEnd="url(#arrow-emerald)"
              />

              {/* Vetor Vy (Vertical - Azul) */}
              {Math.abs(vyVectorLength) > 1 && (
                <line
                  x1={currSvgX}
                  y1={currSvgY}
                  x2={currSvgX}
                  y2={currSvgY + vyVectorLength}
                  stroke="#60a5fa"
                  strokeWidth="2.5"
                  markerEnd="url(#arrow-blue)"
                />
              )}

              {/* Vetor Resultante V (Vermelho) */}
              <line
                x1={currSvgX}
                y1={currSvgY}
                x2={currSvgX + vxVectorLength}
                y2={currSvgY + vyVectorLength}
                stroke="#f43f5e"
                strokeWidth="2.5"
                markerEnd="url(#arrow-rose)"
              />
            </g>
          )}

          {/* O PROJÉTIL (Esfera animada com brilho) */}
          <g transform={`translate(${currSvgX}, ${currSvgY})`}>
            <circle r="14" fill="#6366f1" opacity="0.3" className="animate-pulse" />
            <circle r="7" fill="#818cf8" stroke="#ffffff" strokeWidth="2" />
          </g>
        </svg>
      </div>

      {/* PAINEL DE CONTROLE DA ANIMAÇÃO E SCRUBBER */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
        {/* Botões de Reprodução */}
        <div className="md:col-span-4 flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{isPlaying ? 'Pausar' : 'Disparar'}</span>
          </button>

          <button
            onClick={handleReset}
            className="p-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            title="Reiniciar Simulação"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400">Vel:</span>
            {[0.5, 1, 2].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 py-0.5 rounded ${
                  playbackSpeed === spd ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Linha do Tempo / Slider de Tempo t */}
        <div className="md:col-span-8 flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono w-16">
            t = {currentTime.toFixed(2)}s
          </span>
          <input
            type="range"
            min="0"
            max={telemetry.flightTime || 1}
            step="0.01"
            value={currentTime}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentTime(parseFloat(e.target.value));
            }}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-xs text-slate-400 font-mono w-16 text-right">
            {telemetry.flightTime.toFixed(2)}s
          </span>
        </div>
      </div>

      {/* CONTROLES DIDÁTICOS DE PARÂMETROS FÍSICOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Velocidade Inicial V0 */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" />
              Velocidade Inicial (V₀)
            </label>
            <span className="font-mono text-sm font-bold text-indigo-300">{params.velocity} m/s</span>
          </div>
          <input
            type="range"
            min="5"
            max="60"
            step="1"
            value={params.velocity}
            onChange={(e) => updateParam('velocity', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>5 m/s</span>
            <span>60 m/s</span>
          </div>
        </div>

        {/* Ângulo de Lançamento θ */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              Ângulo de Disparo (θ)
            </label>
            <span className="font-mono text-sm font-bold text-indigo-300">{params.angle}°</span>
          </div>
          <input
            type="range"
            min="5"
            max="85"
            step="1"
            value={params.angle}
            onChange={(e) => updateParam('angle', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>5° (quase rasante)</span>
            <span>45° (alcance máx)</span>
            <span>85° (quase vertical)</span>
          </div>
        </div>

        {/* Aceleração da Gravidade g */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Gravidade Local (g)
            </label>
            <span className="font-mono text-sm font-bold text-indigo-300">{params.gravity.toFixed(2)} m/s²</span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            step="0.1"
            value={params.gravity}
            onChange={(e) => updateParam('gravity', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>1 m/s²</span>
            <span>Terra 9.8</span>
            <span>30 m/s²</span>
          </div>
        </div>
      </div>

      {/* TELEMETRIA ANALÍTICA INSTANTÂNEA */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Posição Atual (x, y)</span>
          <span className="text-base font-mono font-bold text-white">
            x: {currentState.x.toFixed(1)}m | y: {currentState.y.toFixed(1)}m
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Alcance Máximo Teórico</span>
          <span className="text-base font-mono font-bold text-sky-400">
            {telemetry.maxRange.toFixed(1)} metros
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Altura Máxima (Ápice)</span>
          <span className="text-base font-mono font-bold text-amber-400">
            {telemetry.maxHeight.toFixed(1)} metros
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Tempo Total de Voo</span>
          <span className="text-base font-mono font-bold text-emerald-400">
            {telemetry.flightTime.toFixed(2)} segundos
          </span>
        </div>
      </div>

      {/* Dica Pedagógica Fixa da Cena */}
      {scene.pedagogical_focus && (
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
          <span className="font-bold text-indigo-300">Conexão Didática: </span>
          {scene.pedagogical_focus}
        </div>
      )}
    </div>
  );
};
