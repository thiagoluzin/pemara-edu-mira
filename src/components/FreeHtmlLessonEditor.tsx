import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {LessonSpec} from '../types/lesson';
import type {LessonEditorProps} from './LessonEditor';
import {generateStandaloneHtml} from './ExportModal';
import {htmlPresentationIssues,presentationMetadata} from '../engine/freeHtml';
import {ATLAS,type AtlasKind} from '../animations/atlas';
import {PedagogicalReviewPanel} from './PedagogicalReviewPanel';
import {RevisionsModal} from './RevisionsModal';
import {PublishVersionModal} from './PublishVersionModal';
import {ConflictModal} from './ConflictModal';
import {gradeLabel} from '../ui/labels';

function HtmlFrame({lesson}:{lesson:LessonSpec}){
  const html=useMemo(()=>generateStandaloneHtml(lesson),[lesson.presentation,lesson.lesson.title]);
  return <iframe title="Apresentação criada pela IA" srcDoc={html} sandbox="allow-scripts" allow="fullscreen" referrerPolicy="no-referrer" className="w-full h-full border-0" />;
}
export function FreeHtmlPresentation({lesson,onClose}:{lesson:LessonSpec;onClose:()=>void}){
  const root=useRef<HTMLDivElement>(null);
  return <div ref={root} className="fixed inset-0 z-50 bg-slate-950 flex flex-col"><div className="flex gap-3 items-center p-2 text-white"><button className="border rounded px-3 py-2" onClick={onClose}>Voltar ao editor</button><button className="border rounded px-3 py-2" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void root.current?.requestFullscreen().catch(()=>{});}}>Tela cheia</button><span className="truncate">{lesson.lesson.title}</span></div><div className="flex-1 min-h-0"><HtmlFrame lesson={lesson}/></div></div>;
}
export function FreeHtmlLessonEditor(props:LessonEditorProps){
  const {lesson,onUpdateLesson}=props;
  const [draft,setDraft]=useState(lesson.presentation!.html),[error,setError]=useState(''),[preview,setPreview]=useState<LessonSpec|null>(null);
  const [history,setHistory]=useState(false),[publish,setPublish]=useState(false);
  useEffect(()=>{setDraft(lesson.presentation!.html);setPreview(null);setError('');},[lesson]);
  const revised=()=>{
    const issues=htmlPresentationIssues(draft);if(issues.length){setError(issues.join(' '));return;}
    const meta=presentationMetadata(draft);
    return {...lesson,presentation:{...lesson.presentation!,html:draft},objectives:meta.objectives,lesson:{...lesson.lesson,title:meta.title,visual_status:'NEEDS_REVIEW' as const,updatedAt:new Date().toISOString()},scenes:[{...lesson.scenes[0],title:meta.title,teacher_notes:meta.teacher_notes}]} as LessonSpec;
  };
  const selectAtlas=(id:AtlasKind,selected:boolean)=>{
    const models=lesson.presentation!.atlas_models;
    onUpdateLesson({...lesson,presentation:{...lesson.presentation!,atlas_models:selected?[...models,id]:models.filter(m=>m!==id)},lesson:{...lesson.lesson,visual_status:'NEEDS_REVIEW',updatedAt:new Date().toISOString()}});
  };
  const status=props.autosaveStatus||'idle';
  return <div className="space-y-5">
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3"><p className="text-cyan-300 font-semibold">Apresentação criada pela IA · {gradeLabel(lesson.lesson.grade)}</p><h1 className="text-2xl font-bold">{lesson.lesson.title}</h1><p role="status" className={['error','conflict'].includes(status)?'text-amber-300':'text-slate-300'}>{({idle:'',unsaved:'Alterações aguardando salvamento.',saving:'Salvando…',saved:'Aula salva no acervo.',error:'Não foi possível salvar. Preserve uma cópia e tente novamente.',conflict:'Existe outra versão no acervo. Resolva o conflito para salvar.'})[status]}</p>
      <div className="flex flex-wrap gap-3"><button className="bg-indigo-600 px-4 py-3 rounded-lg" onClick={()=>props.onStartPresentation(0)}>Apresentar</button><button className="border px-4 py-3 rounded-lg" onClick={props.onOpenExportModal}>Exportar</button>{props.onPublishVersion&&<button className="border px-4 py-3 rounded-lg" disabled={!['idle','saved'].includes(status)} onClick={()=>setPublish(true)}>Guardar versão</button>}{props.onRestoreRevision&&<button className="border px-4 py-3 rounded-lg" onClick={()=>setHistory(true)}>Histórico</button>}</div>
      <p className="text-sm text-amber-200">Confira os pareceres, a apresentação e a adequação à sua turma antes de usar em aula.</p>
    </div>
    <PedagogicalReviewPanel team={lesson.lesson.pedagogical_team} scenes={lesson.scenes}/>
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-950" style={{height:'min(78vh,900px)',minHeight:420}}><HtmlFrame lesson={preview||lesson}/></div>
    {preview&&<div className="flex gap-3"><span>Prévia da alteração — ainda não aplicada.</span><button className="border rounded px-3" onClick={()=>{onUpdateLesson(preview);setPreview(null);}}>Aplicar alteração</button><button className="border rounded px-3" onClick={()=>setPreview(null)}>Descartar prévia</button></div>}
    <details className="border border-slate-700 rounded p-4"><summary>Atlas complementar (opcional)</summary><p className="text-sm my-3">Os modelos selecionados abrem em uma aba própria. As ilustrações e animações da apresentação são preservadas.</p>{ATLAS.filter(m=>(m.subjects as readonly string[]).includes(lesson.lesson.subject)).map(m=><label className="flex gap-2 my-2" key={m.id}><input type="checkbox" checked={lesson.presentation!.atlas_models.includes(m.id)} onChange={e=>selectAtlas(m.id,e.target.checked)}/>{m.name}</label>)}</details>
    <details className="border border-slate-700 rounded p-4"><summary>Objetivos e notas do professor</summary><ul className="list-disc pl-5 my-3">{lesson.objectives.map((o,i)=><li key={i}>{o}</li>)}</ul>{lesson.scenes.map(s=><p key={s.id} className="whitespace-pre-wrap">{s.teacher_notes}</p>)}</details>
    <details className="border border-slate-700 rounded p-4"><summary>Editar ou importar HTML da apresentação</summary><p className="text-sm my-3">Confira a prévia antes de aplicar. Os pareceres anteriores pertencem à versão gerada; alterações de conteúdo precisam de nova conferência docente.</p><input aria-label="Importar HTML revisado" type="file" accept=".html,text/html" onChange={async e=>{const file=e.target.files?.[0];if(file){setDraft(await file.text());setPreview(null);setError('');}}}/><textarea aria-label="HTML da apresentação" value={draft} onChange={e=>{setDraft(e.target.value);setPreview(null);}} className="w-full h-72 bg-slate-950 border border-slate-600 rounded p-3 font-mono text-sm my-3" spellCheck={false}/><button className="bg-indigo-600 px-4 py-2 rounded" onClick={()=>{setError('');const next=revised();if(next)setPreview(next);}}>Conferir alteração</button>{error&&<p role="alert" className="text-amber-300">{error}</p>}</details>
    {props.onRestoreRevision&&<RevisionsModal isOpen={history} lessonId={lesson.lesson.id} currentVersion={lesson.lesson_version} onClose={()=>setHistory(false)} onRestoreRevision={props.onRestoreRevision}/>}
    {props.onPublishVersion&&<PublishVersionModal isOpen={publish} currentVersion={lesson.lesson_version} onClose={()=>setPublish(false)} onPublish={props.onPublishVersion}/>}
    <ConflictModal isOpen={status==='conflict'} expectedVersion={props.conflictData?.expectedVersion||lesson.lesson_version} actualVersion={props.conflictData?.actualVersion||props.conflictData?.currentVersion} serverDraft={props.conflictData?.serverDraft} onClose={()=>{}} onReloadServer={props.onReloadServerLesson||(()=>{})} onForceSave={props.onForceSaveVersion} onExportLocalBackup={props.onExportLocalBackup||(()=>{})}/>
  </div>;
}
