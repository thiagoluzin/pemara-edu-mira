import {LessonAuthoringDialog} from './LessonAuthoringDialog';
import {FreeHtmlLessonEditor} from './FreeHtmlLessonEditor';
import type {AuthoringKind} from '../education/teacherAuthoring';
import type {LessonEditResult} from '../education/deterministicLessonEdit';
import {referenceUrl,referenceKindLabel} from '../education/lessonContext';
import { label, gradeLabel } from '../ui/labels';
import {PedagogicalReviewPanel} from './PedagogicalReviewPanel';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA TELA DE RESULTADO & EDITOR VISUAL (V1 COM VISUAL VALIDATOR)
 * Indicadores por slide:
 * - Status [READY] ou [NEEDS_REVIEW]
 * - Verificação da Safe Area, colisão e limites tipográficos 1920x1080
 * - Botão de Pré-visualização determinística com miniaturas
 */

import React, { useState, useEffect } from 'react';
import { LessonSpec, Scene } from '../types/lesson';
import { biologyScenesForSkills } from '../engine/biologyModel';
import { PemaraRenderer } from '../renderer/PemaraRenderer';
import { PemaraMaestro } from '../maestro/pemaraMaestro';
import { VisualValidator, SlideValidationReport } from '../validator/visualValidator';
import {
  Play,
  Share2,
  Wand2,
  HelpCircle,
  Minimize2,
  PlusCircle,
  Trash2,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  ShieldCheck,
  RotateCcw,
  History,
  BookmarkCheck,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { RevisionsModal } from './RevisionsModal';
import { PublishVersionModal } from './PublishVersionModal';
import { ConflictModal } from './ConflictModal';
import { AuthUser } from '../services/authApi';

export interface LessonEditorProps {
  lesson: LessonSpec;
  onUpdateLesson: (updatedLesson: LessonSpec) => void;
  onStartPresentation: (startSceneIndex: number) => void;
  onOpenExportModal: () => void;
  onOpenMaestroLogs: () => void;
  currentUser?: AuthUser | null;
  autosaveStatus?: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict';
  lastSavedAt?: string;
  onPublishVersion?: (changeSummary: string) => Promise<void>;
  onRestoreRevision?: (revisionId: string, summary: string) => Promise<void>;
  conflictData?: any;
  onReloadServerLesson?: () => void;
  onForceSaveVersion?: () => void;
  onExportLocalBackup?: () => void;
}

export const LessonEditor:React.FC<LessonEditorProps>=props=>props.lesson.presentation?<FreeHtmlLessonEditor {...props}/>:<StructuredLessonEditor {...props}/>;
const StructuredLessonEditor: React.FC<LessonEditorProps> = ({
  lesson,
  onUpdateLesson,
  onStartPresentation,
  onOpenExportModal,
  onOpenMaestroLogs,
  autosaveStatus = 'idle',
  lastSavedAt,
  onPublishVersion,
  onRestoreRevision,
  conflictData,
  onReloadServerLesson,
  onForceSaveVersion,
  onExportLocalBackup,
}) => {
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const missingModels = biologyScenesForSkills(lesson.lesson.subject, lesson.lesson.bncc_skill || '')
    .filter(model => !lesson.scenes.some(scene => scene.type==='biology_model' && scene.params.model===model.params.model));
  const addVisualModels = () => {
    if (!missingModels.length) return;
    const models = missingModels.map(scene=>({...scene,id:`${scene.id}-${Date.now()}`}));
    onUpdateLesson({...lesson,lesson:{...lesson.lesson,updatedAt:new Date().toISOString()},
      scenes:[...lesson.scenes.slice(0,2),...models,...lesson.scenes.slice(2)]});
    setActiveSceneIndex(Math.min(2,lesson.scenes.length));
  };
  const [authoringKind,setAuthoringKind]=useState<AuthoringKind|null>(null);
  const [editPreview,setEditPreview]=useState<LessonEditResult|null>(null);
  useEffect(()=>{setEditPreview(null);setAuthoringKind(null);},[lesson]);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState<string>('');
  const [editFeedback, setEditFeedback] = useState<string | null>(null);
  const [showValidationDrawer, setShowValidationDrawer] = useState<boolean>(false);
  const [isRevisionsModalOpen, setIsRevisionsModalOpen] = useState<boolean>(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);

  // Garantir índice estritamente válido mesmo ao trocar para aulas com menos cenas (A20)
  const safeSceneIndex = Math.min(
    Math.max(0, activeSceneIndex),
    Math.max(0, (lesson?.scenes?.length || 1) - 1)
  );

  const currentScene: Scene | undefined = lesson.scenes[safeSceneIndex] || lesson.scenes[0];

  // Validação em tempo real do slide ativo protegendo contra scene indefinida
  const currentValidation: SlideValidationReport = currentScene
    ? VisualValidator.validateScene(
        currentScene,
        currentScene.layout_id || '02_title_body'
      )
    : {
        slideId: 'empty',
        layoutId: '02_title_body',
        status: 'FAIL',
        issues: [{ type: 'TEXT_OVERFLOW', severity: 'FAIL', message: 'Nenhum slide disponível nesta aula.' }],
        autoFixed: false,
        fixAttempts: 0,
        boundingBoxes: []
      };

  // Validação geral de todos os slides da aula
  const allValidationReports = lesson.scenes.map((s) => ({
    scene: s,
    report: VisualValidator.validateScene(s, s.layout_id || '02_title_body')
  }));

  const hasFails = allValidationReports.some((r) => r.report.status === 'FAIL');
  const hasWarnings = allValidationReports.some((r) => r.report.status === 'WARNING');
  const overallVisualStatus = hasFails ? 'NEEDS_REVIEW' : 'READY';

  // Disparar Auto-Correction determinístico no slide atual (sem perda de texto e com verificação real)
  const handleAutoCorrectCurrentSlide = () => {
    if (!currentScene) return;
    const layoutId = currentScene.layout_id || '02_title_body';
    const { correctedScene, newScenes, resolved } = VisualValidator.autoCorrectScene(currentScene, layoutId);

    const updatedScenes = [...lesson.scenes];
    updatedScenes[safeSceneIndex] = correctedScene;
    if (newScenes && newScenes.length > 0) {
      updatedScenes.splice(safeSceneIndex + 1, 0, ...newScenes);
    }

    const recheckAll = updatedScenes.map((s) => VisualValidator.validateScene(s, s.layout_id || '02_title_body'));
    const anyFails = recheckAll.some((r) => r.status === 'FAIL');

    const updated: LessonSpec = {
      ...lesson,
      scenes: updatedScenes,
      lesson_version: lesson.lesson_version + 1,
      lesson: {
        ...lesson.lesson,
        visual_status: anyFails ? 'NEEDS_REVIEW' : 'READY',
        updatedAt: new Date().toISOString()
      }
    };
    onUpdateLesson(updated);
    if (resolved && !anyFails) {
      setEditFeedback('Auto-Correction executado com sucesso: divisões de slides e parâmetros reajustados para a Safe Area sem perda de texto.');
    } else if (resolved) {
      setEditFeedback('Slide atual corrigido com sucesso. Outros slides ainda requerem revisão.');
    } else {
      setEditFeedback('Auto-Correction aplicado parcialmente: o slide ainda excede os limites ideais e requer ajuste manual do professor.');
    }
  };

  const handleAddQuiz = () => setAuthoringKind('quiz');
  const handleAddExamples = () => setAuthoringKind('example');
  const handleMakeSimpler = () => {
    if(!lesson.scenes.some(s=>s.type==='text')){setEditFeedback('Esta aula não possui página de texto para revisar.');return;}
    setAuthoringKind('revise');
  };
  const handleNaturalLanguageSubmit = (e: React.FormEvent) => {
    e.preventDefault();setEditPreview(null);
    const result=PemaraMaestro.editLessonByInstruction(lesson,naturalLanguageInput);
    setEditFeedback(result.message);
    if(result.status==='needs_authoring'&&result.authoring)setAuthoringKind(result.authoring);
    else if(result.status==='applied')setEditPreview(result);
  };

  const handleUpdateCurrentScene = (updatedScene: Scene) => {
    const newScenes = [...lesson.scenes];
    newScenes[safeSceneIndex] = updatedScene;
    onUpdateLesson({
      ...lesson,
      scenes: newScenes,
      lesson_version: lesson.lesson_version + 1
    });
  };

  const handleDeleteCurrentScene = () => {
    if (lesson.scenes.length <= 1) return;
    const newScenes = lesson.scenes.filter((_, idx) => idx !== safeSceneIndex);
    const newIndex = Math.max(0, activeSceneIndex - 1);
    onUpdateLesson({
      ...lesson,
      scenes: newScenes,
      lesson_version: lesson.lesson_version + 1
    });
    setActiveSceneIndex(newIndex);
  };

  return (
    <div className="flex flex-col gap-6">
      {authoringKind&&<LessonAuthoringDialog key={lesson.lesson.id+authoringKind} lesson={lesson} kind={authoringKind} sceneId={currentScene?.id||''} onClose={()=>setAuthoringKind(null)} onApply={updated=>{onUpdateLesson(updated);setAuthoringKind(null);setEditFeedback('Alteração docente aplicada após conferência.');}}/>}
      {(lesson.objectives===undefined||lesson.prerequisites?.length||lesson.references?.length)?<details className="border border-slate-700 rounded p-3"><summary>Preparação e referências da aula</summary>
        {lesson.objectives===undefined&&<p>Objetivos não informados nesta aula. Revise antes do uso em turma.</p>}
        {!!lesson.prerequisites?.length&&<><h3>Pré-requisitos</h3><ul>{lesson.prerequisites.map((p,i)=><li key={i}>{p}</li>)}</ul></>}
        {!!lesson.references?.length&&<><h3>Referências e autoria</h3><ul>{lesson.references.map((r,i)=><li key={i}>{referenceKindLabel(r.kind)}: {r.title}{referenceUrl(r.url)&&<> — <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a></>}{r.locator&&' — '+r.locator}{r.license&&' — '+r.license}</li>)}</ul><p>A referência curricular não implica homologação ou alinhamento automático desta aula.</p></>}
      </details>:null}
      <PedagogicalReviewPanel team={lesson.lesson.pedagogical_team} scenes={lesson.scenes}/>
      <label className="text-sm text-slate-300">Título da aula<input aria-label="Título da aula" key={`${lesson.lesson.id}-${lesson.lesson.title}`} defaultValue={lesson.lesson.title} maxLength={160} onBlur={e=>{const title=e.target.value.trim();if(title&&title!==lesson.lesson.title)onUpdateLesson({...lesson,lesson:{...lesson.lesson,title},scenes:lesson.scenes.map(s=>s.type==='title'?{...s,title}:s)});}} className="block mt-1 w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"/></label>
      {/* BARRA SUPERIOR DE AÇÕES RÁPIDAS COM STATUS DO VISUAL VALIDATOR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
              Aula Criada • Versão {lesson.lesson_version}
            </span>
            {/* Tag do Visual Status */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                overallVisualStatus === 'READY'
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-950/70 border-rose-500/40 text-rose-400'
              }`}
            >
              {overallVisualStatus === 'READY' ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Estrutura verificada · revise o conteúdo</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 text-rose-400" />
                  <span>Revisar estrutura e conteúdo</span>
                </>
              )}
            </span>

            {/* Autosave Status Badge */}
            {autosaveStatus === 'saving' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/70 border border-indigo-500/40 text-indigo-300">
                <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                <span>Autossave...</span>
              </span>
            )}
            {autosaveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Salvo no banco de dados {lastSavedAt && 'às ' + new Date(lastSavedAt).toLocaleTimeString('pt-BR')}</span>
              </span>
            )}
            {autosaveStatus === 'unsaved' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/70 border border-amber-500/40 text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>Alterações pendentes</span>
              </span>
            )}
            {autosaveStatus === 'conflict' && (
              <button
                type="button"
                onClick={() => setIsConflictModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 border border-rose-500/50 text-rose-300 hover:bg-rose-900 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Conflito 409 (Resolver)</span>
              </button>
            )}
            {autosaveStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/70 border border-rose-500/40 text-rose-300">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span>Erro no autossave</span>
              </span>
            )}
          </div>

          <h2 className="text-xl xl:text-2xl font-black text-white">{lesson.lesson.title}</h2>
          <span className="text-xs text-slate-400">
            {label(lesson.lesson.subject.toUpperCase())} • {gradeLabel(lesson.lesson.grade)} • {lesson.lesson.duration_minutes} min • {lesson.scenes.length} Cenas
          </span>
        </div>

        {/* BOTOES DE AÇÃO */}
        <div className="flex flex-wrap items-center gap-2">
          {/* [ SALVAR VERSÃO OFICIAL ] */}
          {onPublishVersion && (
            <button
              onClick={() => setIsPublishModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all"
              title="Salvar uma nova versão oficial imutável com resumo no banco de dados"
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>Salvar Versão</span>
            </button>
          )}

          {/* [ HISTÓRICO DE REVISÕES ] */}
          {onRestoreRevision && (
            <button
              onClick={() => setIsRevisionsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Visualizar versões anteriores e restaurar histórico"
            >
              <History className="w-4 h-4 text-indigo-400" />
              <span>Histórico</span>
            </button>
          )}
          {/* [ APRESENTAR ] (Bloqueado se houver FAIL na Seção de Critério de Aceite) */}
          <button
            disabled={hasFails}
            onClick={() => onStartPresentation(activeSceneIndex)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all transform hover:scale-105 ${
              hasFails
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/40'
            }`}
            title={hasFails ? 'Corrija os erros visuais antes de apresentar' : 'Apresentar em tela cheia'}
          >
            <Play className="w-4 h-4 fill-white" />
            <span>APRESENTAR</span>
          </button>

          {/* [ RELATÓRIO DO VISUAL VALIDATOR ] */}
          <button
            onClick={() => setShowValidationDrawer(!showValidationDrawer)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              showValidationDrawer
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Revisar apresentação</span>
          </button>

          {/* [ CRIAR QUESTIONÁRIO ] */}
          <button
            onClick={handleAddQuiz}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <span>CRIAR QUESTIONÁRIO</span>
          </button>

          {/* [ REVISAR TEXTO ] */}
          <button
            onClick={handleMakeSimpler}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Minimize2 className="w-4 h-4 text-cyan-400" />
            <span>REVISAR TEXTO</span>
          </button>

          {/* [ ADICIONAR EXEMPLOS ] */}
          <button
            onClick={handleAddExamples}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span>ADICIONAR EXEMPLOS</span>
          </button>

          {missingModels.length>0 && <button onClick={addVisualModels}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold">
            <Play className="w-4 h-4"/>ADICIONAR MODELOS ANIMADOS
          </button>}

          {/* [ EXPORTAR ] */}
          <button
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>EXPORTAR</span>
          </button>

          {/* [ MAESTRO LOGS ] */}
          <button
            onClick={onOpenMaestroLogs}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Ver etapas de criação"
          >
            <Wand2 className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* PAINEL INFORMATIVO DO VISUAL VALIDATOR */}
      {showValidationDrawer && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                Auditoria de Qualidade Visual (1920x1080 Safe Area & No-Collision)
              </h3>
            </div>
            <button
              onClick={() => setShowValidationDrawer(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-xs block">Resolução de Referência</span>
              <span className="font-mono text-sm font-bold text-white">1920 x 1080 px</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-xs block">Safe Area Bounds</span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                L:100 R:100 T:80 B:80
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-xs block">Situação do Página Atual</span>
              <span
                className={`font-mono text-sm font-bold ${
                  currentValidation.status === 'PASS'
                    ? 'text-emerald-400'
                    : currentValidation.status === 'WARNING'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {label(currentValidation.status)} 
              </span>
            </div>
          </div>

          {currentValidation.issues.length > 0 ? (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Apontamentos do Validador:</span>
              {currentValidation.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    issue.severity === 'FAIL'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {issue.severity === 'FAIL' ? (
                      <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    )}
                    <span>{issue.message}</span>
                  </div>

                  <button
                    onClick={handleAutoCorrectCurrentSlide}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[11px] flex items-center gap-1 border border-slate-600 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Auto-Corrigir</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Nenhum overflow, colisão ou violação de margem detectado neste página.</span>
            </div>
          )}
        </div>
      )}

      {/* FEEDBACK DE EDIÇÃO */}
      {editFeedback && (
        <div className="p-3.5 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>{editFeedback}</span>
          </div>
          <button onClick={() => setEditFeedback(null)} className="text-slate-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* ÁREA PRINCIPAL: MINIATURAS À ESQUERDA & PREVIEW AO VIVO */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: MINIATURAS DAS CENAS */}
        <div className="xl:col-span-3 space-y-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Roteiro de Cenas ({lesson.scenes.length})
            </span>
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin">
            {lesson.scenes.map((scene, index) => {
              const isActive = activeSceneIndex === index;
              const valReport = VisualValidator.validateScene(scene, scene.layout_id || '02_title_body');

              return (
                <div
                  key={scene.id}
                  onClick={() => setActiveSceneIndex(index)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                    isActive
                      ? 'bg-indigo-950/70 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-indigo-400 flex items-center gap-1.5">
                      <span>Página {index + 1}</span>
                      {valReport.status === 'PASS' && (
                        <span title="Estrutura verificada; conteúdo requer revisão"><CheckCircle2 className="w-3 h-3 text-emerald-400" /></span>
                      )}
                      {valReport.status === 'WARNING' && (
                        <span title="Atenção"><AlertTriangle className="w-3 h-3 text-amber-400" /></span>
                      )}
                      {valReport.status === 'FAIL' && (
                        <span title="Falha"><XCircle className="w-3 h-3 text-rose-400" /></span>
                      )}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 uppercase font-semibold text-slate-300">
                      {label(scene.type)}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate">{scene.title}</h4>
                  <div className="flex gap-2">
                    {([-1,1] as const).map(delta=><button key={delta} aria-label={`${delta<0?'Subir':'Descer'} página ${index+1}`} disabled={index+delta<0||index+delta>=lesson.scenes.length} className="border border-slate-600 rounded px-2 py-1 text-xs disabled:opacity-30" onClick={e=>{e.stopPropagation();const scenes=[...lesson.scenes];[scenes[index],scenes[index+delta]]=[scenes[index+delta],scenes[index]];onUpdateLesson({...lesson,scenes});setActiveSceneIndex(index+delta);}}>{delta<0?'↑ Subir':'↓ Descer'}</button>)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botão de Excluir Cena Atual */}
          {lesson.scenes.length > 1 && (
            <button
              onClick={handleDeleteCurrentScene}
              className="w-full py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remover Página Atual</span>
            </button>
          )}
        </div>

        {/* COLUNA DIREITA: RENDERIZADOR AO VIVO & AJUSTES */}
        <div className="xl:col-span-9 space-y-6">
          <div className="relative">
            <PemaraRenderer
              lesson={lesson.lesson}
              scene={currentScene}
              onSceneParamChange={handleUpdateCurrentScene}
            />
          </div>

          {editPreview&&<section aria-label="Prévia do comando" className="p-4 border border-cyan-700 rounded"><h3>Confira a alteração</h3><p>{editPreview.message}</p><p>Título: {editPreview.updatedLesson.lesson.title}</p>{editPreview.updatedLesson.scenes.filter(s=>editPreview.affectedScenes.includes(s.id)&&s.type==='physics_projectile').map(s=><p key={s.id}>{s.title}: {s.type==='physics_projectile'?`ângulo ${s.params.angle}°, velocidade ${s.params.velocity} m/s, gravidade ${s.params.gravity} m/s²`:''}</p>)}<button className="bg-emerald-700 p-2 rounded" onClick={()=>{onUpdateLesson(editPreview.updatedLesson);setEditPreview(null);setNaturalLanguageInput('');setEditFeedback('Alteração aplicada após conferência.');}}>Aplicar comando revisado</button><button className="p-2" onClick={()=>setEditPreview(null)}>Cancelar prévia</button></section>}
          {/* EDIÇÃO POR LINGUAGEM NATURAL */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Descreva a alteração na aula
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Comandos disponíveis: "Troque o título para ...", "Ângulo 45 graus", "Velocidade 20 m/s" e "Gravidade da Lua". Questões, exemplos e revisão de texto abrem um formulário para sua autoria.
            </p>

            <form onSubmit={handleNaturalLanguageSubmit} className="flex gap-2">
              <input
                type="text"
                value={naturalLanguageInput}
                onChange={(e) => {setNaturalLanguageInput(e.target.value);setEditPreview(null);}}
                placeholder="Ex.: Troque o título para Explorando as frações"
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={!naturalLanguageInput.trim()}
                className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Aplicar</span>
              </button>
            </form>
          </div>

          {/* NOTAS DO PROFESSOR */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
            <span className="font-semibold text-slate-300 block">
              Notas Pedagógicas do Slide {activeSceneIndex + 1} (Visíveis apenas para o professor durante a apresentação):
            </span>
            <textarea
              rows={2}
              value={currentScene?.teacher_notes || ''}
              onChange={(e) => {
                handleUpdateCurrentScene({
                  ...currentScene,
                  teacher_notes: e.target.value
                });
              }}
              placeholder="Digite orientações de mediação ou perguntas provocativas para a turma..."
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* MODAL DE PUBLICAÇÃO DE VERSÃO OFICIAL */}
      {onPublishVersion && (
        <PublishVersionModal
          isOpen={isPublishModalOpen}
          currentVersion={lesson.lesson_version}
          onClose={() => setIsPublishModalOpen(false)}
          onPublish={async (summary) => {
            await onPublishVersion(summary);
          }}
        />
      )}

      {/* MODAL DE HISTÓRICO DE REVISÕES */}
      {onRestoreRevision && (
        <RevisionsModal
          isOpen={isRevisionsModalOpen}
          lessonId={lesson.lesson.id}
          currentVersion={lesson.lesson_version}
          onClose={() => setIsRevisionsModalOpen(false)}
          onRestoreRevision={onRestoreRevision}
        />
      )}

      {/* MODAL DE CONFLITO DE CONCORRÊNCIA (409) */}
      <ConflictModal
        isOpen={isConflictModalOpen || autosaveStatus === 'conflict'}
        expectedVersion={conflictData?.expectedVersion || lesson.lesson_version}
        actualVersion={conflictData?.actualVersion || conflictData?.currentVersion}
        serverDraft={conflictData?.serverDraft}
        onReloadServer={() => {
          setIsConflictModalOpen(false);
          onReloadServerLesson?.();
        }}
        onForceSave={onForceSaveVersion}
        onExportLocalBackup={() => {
          onExportLocalBackup?.();
        }}
        onClose={() => setIsConflictModalOpen(false)}
      />
    </div>
  );
};
