import {movePresentation,sceneStepCount} from '../engine/presentationNavigation';
import { label, gradeLabel } from '../ui/labels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA MODO APRESENTAÇÃO (FULLSCREEN PROFESSOR)
 * Inclui: tela cheia, teclado, timer, laser pointer virtual, caneta de anotação na tela e notas didáticas
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LessonSpec, Scene } from '../types/lesson';
import { PemaraRenderer } from '../renderer/PemaraRenderer';
import {
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  PenTool,
  Eraser,
  Flame,
  X,
  Play,
  RotateCcw
} from 'lucide-react';

interface Props {
  lesson: LessonSpec;
  initialSceneIndex?: number;
  onClose: () => void;
  onUpdateScene?: (scene: Scene) => void;
}

export const PresentationMode: React.FC<Props> = ({
  lesson,
  initialSceneIndex = 0,
  onClose,
  onUpdateScene
}) => {
  const [cursor,setCursor]=useState({page:initialSceneIndex,step:0});
  const currentIdx=cursor.page;
  const setCurrentIdx=(page:number)=>setCursor({page,step:0});
  const counts=useMemo(()=>lesson.scenes.map(scene=>sceneStepCount(scene,lesson.lesson)),[lesson]);
  const navigate=(direction:1|-1)=>setCursor(c=>movePresentation(counts,c,direction));
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [laserActive, setApontadorActive] = useState<boolean>(false);
  const [laserPos, setApontadorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Ferramenta de Caneta / Desenho Livre
  const [drawToolActive, setDrawToolActive] = useState<boolean>(false);
  const [penColor, setPenColor] = useState<string>('#f43f5e'); // vermelho/rosa
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  // Timer de Aula
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentScene = lesson.scenes[currentIdx];

  // Atalhos de Teclado (Setas ← →, Espaço, Esc, F para Fullscreen, N para Notas, L para Apontador, P para Pen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if(e.defaultPrevented)return;
      if(e.key!=='Escape' && e.target instanceof Element && (e.target.closest('input,textarea,select,[contenteditable="true"]') || (e.key===' ' && e.target.closest('button,[role="button"]'))))return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        navigate(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        navigate(-1);
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          if (document.exitFullscreen) document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key.toLowerCase() === 'l') {
        setApontadorActive((prev) => !prev);
      } else if (e.key.toLowerCase() === 'n') {
        setShowNotes((prev) => !prev);
      } else if (e.key.toLowerCase() === 'p') {
        setDrawToolActive((prev) => !prev);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [counts, isFullscreen, onClose]);

  // Timer loop
  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Apontador Tracker
  const handleMouseMove = (e: React.MouseEvent) => {
    if (laserActive) {
      setApontadorPos({ x: e.clientX, y: e.clientY });
    }
  };

  // Alternar Fullscreen nativo
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  // Desenho na Camada de Canvas Transparente
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawToolActive) return;
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawToolActive || !isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Redimensionar Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && containerRef.current) {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
    }
  }, [isFullscreen, currentIdx]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none overflow-hidden"
    >
      {/* Apontador Virtual */}
      {laserActive && (
        <div
          className="pointer-events-none fixed z-[9999] transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${laserPos.x}px`, top: `${laserPos.y}px` }}
        >
          <div className="w-5 h-5 rounded-full bg-rose-500 shadow-[0_0_15px_6px_rgba(244,63,94,0.9)] animate-ping absolute" />
          <div className="w-3.5 h-3.5 rounded-full bg-white ring-4 ring-rose-500 shadow-lg" />
        </div>
      )}

      {/* Camada Transparente de Anotações em Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className={`absolute inset-0 z-40 ${drawToolActive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
      />

      {/* BARRA SUPERIOR DE CONTROLE (Auto-discreta) */}
      <header className="relative z-30 flex flex-wrap shrink-0 items-center justify-between gap-2 px-4 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Sair do Modo Apresentação</span>
          </button>

          <span className="min-w-0 break-words text-xs text-slate-400 font-mono">
            {lesson.lesson.title} • {label(lesson.lesson.subject.toUpperCase())}
          </span>
        </div>

        {/* Timer de Aula & Ferramentas Interativas */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* Cronômetro */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-white font-bold">{formatTimer(secondsElapsed)}</span>
            <span className="text-slate-500">/ {lesson.lesson.duration_minutes}m</span>
          </div>

          {/* Apontador Apontador */}
          <button
            onClick={() => setApontadorActive(!laserActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              laserActive
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Apontador (Atalho: L)"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Apontador</span>
          </button>

          {/* Caneta de Desenho Livre */}
          <button
            onClick={() => setDrawToolActive(!drawToolActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              drawToolActive
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-600/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Caneta de Anotação (Atalho: P)"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Anotar</span>
          </button>

          {drawToolActive && (
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {['#f43f5e', '#38bdf8', '#facc15', '#ffffff'].map((color) => (
                <button
                  key={color}
                  onClick={() => setPenColor(color)}
                  className={`w-4 h-4 rounded-full transition-transform ${penColor === color ? 'scale-125 ring-2 ring-white' : 'opacity-70'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <button
                onClick={clearCanvas}
                className="p-1 text-slate-400 hover:text-white"
                title="Limpar Desenhos"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Notas do Professor */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showNotes
                ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Notas Pedagógicas (Atalho: N)"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Notas</span>
          </button>

          {/* Alternar Tela Cheia */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            title="Tela Cheia (Atalho: F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ÁREA CENTRAL DO SLIDE ATUAL */}
        <main className="relative flex-1 min-h-0 min-w-0 p-6 md:p-10 overflow-y-auto flex items-start justify-center">
          <div className="w-full min-w-0 max-w-6xl mx-auto my-auto">
          <PemaraRenderer
              lesson={lesson.lesson}
            scene={currentScene}
            presentationStep={{value:cursor.step,onChange:step=>setCursor(c=>({...c,step}))}}
            onSceneParamChange={onUpdateScene}
          />
        </div>
      </main>

      {/* PAINEL FLUTUANTE DE NOTAS DO PROFESSOR */}
      {showNotes && (
        <aside aria-label="Notas do professor" className="absolute right-4 bottom-20 z-40 w-96 max-w-[calc(100%-2rem)] max-h-[calc(100dvh-10rem)] overflow-y-auto p-5 rounded-2xl bg-slate-900/95 border border-amber-500/40 shadow-2xl backdrop-blur-xl text-sm space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              Notas do Professor (Cena {currentIdx + 1})
            </span>
            <button aria-label="Fechar notas do professor" onClick={() => setShowNotes(false)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-300 leading-relaxed font-normal whitespace-pre-wrap">
            {currentScene.teacher_notes || 'Nenhuma nota cadastrada especificamente para esta cena.'}
          </p>
        </aside>
      )}

      {/* BARRA INFERIOR DE NAVEGAÇÃO ENTRE CENAS */}
      <footer className="relative z-30 flex flex-wrap shrink-0 items-center justify-between gap-2 px-4 py-3 bg-slate-900/90 border-t border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            disabled={currentIdx === 0 && cursor.step === 0}
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <button
            disabled={currentIdx === lesson.scenes.length - 1 && cursor.step === counts[currentIdx]-1}
            onClick={() => navigate(1)}
            className="flex items-center gap-1 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-30 disabled:pointer-events-none shadow-lg shadow-indigo-600/30 transition-colors"
          >
            <span>Próximo</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Indicador de Bolinhas dos Slides */}
        <div className="flex items-center gap-1.5">
          {lesson.scenes.map((sc, i) => (
            <button
              key={sc.id}
              onClick={() => setCurrentIdx(i)}
              className={`h-2 rounded-full transition-all ${
                currentIdx === i
                  ? 'w-8 bg-indigo-500'
                  : 'w-2 bg-slate-700 hover:bg-slate-600'
              }`}
              title={`Página ${i + 1}: ${sc.title}`}
            />
          ))}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {counts[currentIdx]>1 && <span>Etapa {cursor.step+1}/{counts[currentIdx]} · </span>}
          Página <span className="text-white font-bold">{currentIdx + 1}</span> de{' '}
          <span className="text-white font-bold">{lesson.scenes.length}</span>
        </div>
      </footer>
    </div>
  );
};
