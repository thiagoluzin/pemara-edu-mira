/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA COMPONENTE DE SISTEMA SOLAR E ÓRBITAS
 * Visualização didática de translação, rotação e telemetria planetária
 */

import React, { useState, useEffect, useRef } from 'react';
import { SolarSystemScene, SolarSystemParams } from '../../types/lesson';
import { PLANETS_DATA, SUN_DATA, PlanetData } from '../../engine/astronomyEngine';
import { Play, Pause, RotateCw, Globe, Sparkles, Compass, Eye } from 'lucide-react';

interface Props {
  scene: SolarSystemScene;
  onParamsChange?: (newParams: SolarSystemParams) => void;
}

export const PemaraOrbit: React.FC<Props> = ({ scene, onParamsChange }) => {
  const [params, setParams] = useState<SolarSystemParams>(scene.params);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(
    params.focused_planet && params.focused_planet !== 'all'
      ? PLANETS_DATA[params.focused_planet] || PLANETS_DATA.Earth
      : PLANETS_DATA.Earth
  );

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(params.speed_multiplier || 1);
  const [earthDaysElapsed, setEarthDaysElapsed] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setParams(scene.params);
    if (scene.params.focused_planet && scene.params.focused_planet !== 'all') {
      setSelectedPlanet(PLANETS_DATA[scene.params.focused_planet] || null);
    }
  }, [scene.params]);

  const updateParam = (key: keyof SolarSystemParams, value: any) => {
    const updated = { ...params, [key]: value };
    setParams(updated);
    if (onParamsChange) onParamsChange(updated);
  };

  // Loop de Animação das Órbitas
  const animateOrbits = (time: number) => {
    if (lastTimeRef.current !== null) {
      const dtSeconds = (time - lastTimeRef.current) / 1000;
      // 1 segundo real = 15 dias terrestres na simulação padrão
      const simDaysDelta = dtSeconds * 15 * speedMultiplier;
      setEarthDaysElapsed((prev) => prev + simDaysDelta);
    }
    lastTimeRef.current = time;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animateOrbits);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animateOrbits);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = null;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, speedMultiplier]);

  const svgCenter = 400;
  const svgSize = 800;

  // Planetas ordenados por distância do Sol
  const planetsList = Object.values(PLANETS_DATA);

  return (
    <div className="flex flex-col gap-3 md:gap-4 p-3 md:p-5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Globe className="w-4 h-4 text-amber-400" />
            Astronomia Didática — Modelo Heliocêntrico
          </div>
          <h3 className="text-xl md:text-2xl font-black text-white">{scene.title}</h3>
        </div>

        {/* Seletor Rápido de Planetas */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <span className="text-slate-400 px-2 font-medium">Focar em:</span>
          {planetsList.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPlanet(p);
                updateParam('focused_planet', p.id);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                selectedPlanet?.id === p.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ÁREA GRÁFICA DO SISTEMA SOLAR (SVG com Orbitais) */}
      <div className="relative w-full rounded-2xl bg-gradient-to-b from-[#030712] via-[#090d16] to-[#030712] border border-slate-800/80 overflow-hidden shadow-2xl min-h-[320px] md:min-h-[400px] flex items-center justify-center">
        {/* Fundo Estelar Sutil */}
        <div className="absolute inset-0 bg-[radial-gradient(white,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:32px_32px] opacity-25 pointer-events-none" />

        {/* Telemetria de Dias e Anos da Simulação */}
        <div className="absolute top-4 left-4 z-10 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md text-xs space-y-0.5">
          <div className="text-slate-400 font-medium">Tempo de Simulação:</div>
          <div className="font-mono text-amber-300 font-bold text-sm">
            {(earthDaysElapsed / 365.25).toFixed(2)} Anos Terrestres
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {Math.floor(earthDaysElapsed)} dias corridos
          </div>
        </div>

        {/* SVG DO SISTEMA SOLAR */}
        <svg
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="w-full h-auto max-h-[360px] md:max-h-[440px] xl:max-h-[520px] select-none"
          style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.3s ease-out' }}
        >
          <defs>
            {/* Brilho Solar Radial */}
            <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="1" />
              <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="80%" stopColor="#ea580c" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ÓRBITAS CIRCULARES DIDÁTICAS */}
          {params.show_orbits !== false && planetsList.map((planet) => {
            const isTarget = selectedPlanet?.id === planet.id;
            return (
              <circle
                key={`orbit-${planet.id}`}
                className="orbit-path"
                cx={svgCenter}
                cy={svgCenter}
                r={planet.orbitalRadiusDidactic}
                fill="none"
                stroke={isTarget ? '#38bdf8' : '#334155'}
                strokeWidth={isTarget ? '2' : '1'}
                strokeDasharray={isTarget ? 'none' : '3 3'}
                opacity={isTarget ? 0.9 : 0.4}
              />
            );
          })}

          {/* O SOL NO CENTRO */}
          <g transform={`translate(${svgCenter}, ${svgCenter})`} className="cursor-pointer">
            {/* Corona solar pulsante */}
            <circle cx="0" cy="0" r="42" fill="url(#sun-glow)" className="animate-pulse" />
            {/* Núcleo do Sol */}
            <circle cx="0" cy="0" r="22" fill="#fbbf24" stroke="#fef08a" strokeWidth="2" />
            <text
              x="0"
              y="5"
              fill="#78350f"
              fontSize="10"
              fontWeight="900"
              textAnchor="middle"
              className="select-none"
            >
              SOL
            </text>
          </g>

          {/* OS 8 PLANETAS COM TRANSLAÇÃO KEPLERIANA DIDÁTICA */}
          {planetsList.map((planet) => {
            // Ângulo orbital baseado no período em dias terrestres
            const angleRad = (earthDaysElapsed / planet.orbitalPeriodDays) * 2 * Math.PI;
            const px = svgCenter + planet.orbitalRadiusDidactic * Math.cos(angleRad);
            const py = svgCenter + planet.orbitalRadiusDidactic * Math.sin(angleRad);
            const isSelected = selectedPlanet?.id === planet.id;

            return (
              <g
                key={planet.id}
                transform={`translate(${px}, ${py})`}
                onClick={() => {
                  setSelectedPlanet(planet);
                  updateParam('focused_planet', planet.id);
                }}
                className="cursor-pointer group"
              >
                {/* Aura de seleção se for o planeta focado */}
                {isSelected && (
                  <circle
                    cx="0"
                    cy="0"
                    r={planet.relativeSize + 8}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeDasharray="2 2"
                    className="animate-spin"
                  />
                )}

                {/* Corpo do Planeta */}
                <circle
                  cx="0"
                  cy="0"
                  r={planet.relativeSize}
                  fill={planet.color}
                  stroke={isSelected ? '#ffffff' : '#1e293b'}
                  strokeWidth="1.5"
                  className="transition-transform group-hover:scale-125"
                />

                {/* Anéis para Saturno */}
                {planet.id === 'Saturn' && (
                  <ellipse
                    cx="0"
                    cy="0"
                    rx={planet.relativeSize * 2.1}
                    ry={planet.relativeSize * 0.7}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="2.5"
                    opacity="0.8"
                    transform="rotate(-25)"
                  />
                )}

                {/* Rótulo com o Nome */}
                {(params.show_labels || isSelected) && (
                  <text
                    x="0"
                    y={planet.relativeSize + 14}
                    fill={isSelected ? '#ffffff' : '#94a3b8'}
                    fontSize={isSelected ? '12' : '10'}
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    textAnchor="middle"
                    className="select-none"
                  >
                    {planet.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* CARD DIDÁTICO DO PLANETA SELECIONADO */}
        {selectedPlanet && params.show_data_cards !== false && (
          <div className="planet-data-card absolute bottom-4 right-4 max-w-sm p-4 rounded-xl bg-slate-900/95 border border-indigo-500/30 backdrop-blur-md shadow-2xl text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full ring-2 ring-white/50"
                  style={{ backgroundColor: selectedPlanet.color }}
                />
                <h4 className="text-base font-bold text-white">{selectedPlanet.name}</h4>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-mono text-[10px]">
                {selectedPlanet.realDistanceAU} UA do Sol
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed">{selectedPlanet.highlight}</p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block">Ano (Translação):</span>
                <span className="font-semibold text-amber-300">
                  {selectedPlanet.orbitalPeriodDays < 365
                    ? `${selectedPlanet.orbitalPeriodDays} dias`
                    : `${(selectedPlanet.orbitalPeriodDays / 365.25).toFixed(1)} anos`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Dia (Rotação):</span>
                <span className="font-semibold text-emerald-300">
                  {Math.abs(selectedPlanet.rotationHours)} horas
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Diâmetro Real:</span>
                <span className="font-semibold text-slate-200">
                  {selectedPlanet.diameterKm.toLocaleString('pt-BR')} km
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Satélites Naturais:</span>
                <span className="font-semibold text-cyan-300">{selectedPlanet.moons} luas</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-[10px] text-indigo-200 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span>{selectedPlanet.curiosity}</span>
            </div>
          </div>
        )}
      </div>

      {/* PAINEL DE CONTROLES DIDÁTICOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 rounded-xl bg-slate-900 border border-slate-800">
        {/* Play/Pause e Multiplicador de Velocidade */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{isPlaying ? 'Pausar' : 'Girar Órbitas'}</span>
          </button>

          <button
            onClick={() => setEarthDaysElapsed(0)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Resetar Posição Inicial"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Multiplicador de Velocidade */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Velocidade:</span>
          {[0.5, 1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => {
                setSpeedMultiplier(s);
                updateParam('speed_multiplier', s);
              }}
              className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                speedMultiplier === s ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Zoom e Alternar Nomes, Órbitas e Fichas */}
        <div className="flex items-center justify-end gap-3 text-xs flex-wrap">
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              id="orbit-toggle-orbits"
              checked={params.show_orbits !== false}
              onChange={(e) => updateParam('show_orbits', e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>Mostrar Órbitas</span>
          </label>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              id="orbit-toggle-labels"
              checked={params.show_labels !== false}
              onChange={(e) => updateParam('show_labels', e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>Mostrar Rótulos</span>
          </label>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              id="orbit-toggle-cards"
              checked={params.show_data_cards !== false}
              onChange={(e) => updateParam('show_data_cards', e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>Mostrar Ficha</span>
          </label>
        </div>
      </div>

      {/* AVISO DIDÁTICO EXPLÍCITO DE ESCALA SIMPLIFICADA (P1 / CRITÉRIO PEDAGÓGICO) */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
        <span>
          <strong className="text-amber-400">Escala didática simplificada:</strong> Distâncias e raios planetários ajustados pedagogicamente para visualização em sala de aula (modo {params.scale_mode || 'didático'}).
        </span>
        <span className="font-mono text-slate-500">PEMARA ASTRONOMIA DETERMINÍSTICA</span>
      </div>
    </div>
  );
};
