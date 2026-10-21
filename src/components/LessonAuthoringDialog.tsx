import React,{useEffect,useRef,useState} from 'react';
import type {LessonSpec} from '../types/lesson';
import {authoringSource,prepareTeacherEdit,type AuthoringKind,type AuthoringInput} from '../education/teacherAuthoring';

export function LessonAuthoringDialog({lesson,kind,sceneId,onApply,onClose}:{lesson:LessonSpec;kind:AuthoringKind;sceneId:string;onApply:(value:LessonSpec)=>void;onClose:()=>void}){
  const sources=lesson.scenes.filter(s=>kind!=='revise'||s.type==='text');
  const source=sources.find(s=>s.id===sceneId&&s.type!=='title')||sources.find(s=>s.type==='text')||sources[0];
  const dialog=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const active=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    dialog.current?.querySelector<HTMLElement>('select,input,button')?.focus();
    return()=>{document.body.style.overflow=overflow;active?.focus();};
  },[]);
  const [input,setInput]=useState<AuthoringInput>({kind,sourceSceneId:source?.id||'',objective:lesson.objectives?.[0]||'',title:kind==='quiz'?'Questão da aula':'Exemplo da aula',question:'',answers:['','',''],correctIndex:-1,explanation:'',content:kind==='revise'&&source?.type==='text'?[...source.content]:[''],callout:source?.type==='text'?source.callout||'':''});
  const [preview,setPreview]=useState<LessonSpec|null>(null),[error,setError]=useState('');
  const current=sources.find(s=>s.id===input.sourceSceneId);
  const update=(patch:Partial<AuthoringInput>)=>{setInput({...input,...patch});setPreview(null);setError('');};
  const field='w-full p-2 rounded bg-slate-950 border border-slate-600 text-white';
  return <div ref={dialog} style={{maxHeight:'100dvh'}} className="fixed inset-0 z-50 bg-slate-950/90 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Autoria e revisão docente" onKeyDown={e=>{
    if(e.key==='Escape'){e.preventDefault();onClose();}
    if(e.key==='Tab'){
      const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,summary')||[]);
      const first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  }}>
    <form className="mx-auto max-w-3xl bg-slate-900 border border-slate-600 rounded-xl p-6 space-y-4" onSubmit={e=>{e.preventDefault();try{setPreview(prepareTeacherEdit(lesson,input));setError('');}catch(e){setError((e as Error).message);}}}>
      <h2 className="text-xl font-bold">{kind==='quiz'?'Escrever questão da aula':kind==='example'?'Escrever exemplo da aula':'Revisar o texto da página'}</h2>
      <p>Use o conteúdo abaixo como referência. Aplique somente após conferir o significado e a adequação à turma.</p>
      <label className="block">Página de referência<select className={field} aria-label="Página de referência" value={input.sourceSceneId} onChange={e=>{const scene=sources.find(s=>s.id===e.target.value);update({sourceSceneId:e.target.value,...(kind==='revise'&&scene?.type==='text'?{content:[...scene.content],callout:scene.callout||''}:{})});}}>{sources.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      {current&&<details open><summary>Conteúdo original</summary><p className="whitespace-pre-wrap p-3 border border-slate-700">{authoringSource(current)}</p></details>}
      <label className="block">Objetivo trabalhado<input required className={field} aria-label="Objetivo trabalhado" value={input.objective} onChange={e=>update({objective:e.target.value})}/></label>
      {kind!=='revise'&&<label className="block">Título<input required maxLength={100} className={field} aria-label="Título do novo item" value={input.title} onChange={e=>update({title:e.target.value})}/></label>}
      {kind==='quiz'?<>
        <label className="block">Enunciado<textarea required className={field} aria-label="Enunciado" value={input.question} onChange={e=>update({question:e.target.value})}/></label>
        {input.answers.map((answer,i)=><label className="block" key={i}>Alternativa {String.fromCharCode(65+i)}<input required className={field} aria-label={'Alternativa '+String.fromCharCode(65+i)} value={answer} onChange={e=>update({answers:input.answers.map((a,n)=>n===i?e.target.value:a)})}/></label>)}
        <label className="block">Gabarito<select required className={field} aria-label="Gabarito" value={input.correctIndex} onChange={e=>update({correctIndex:Number(e.target.value)})}><option value={-1}>Selecione após conferir</option>{input.answers.map((_,i)=><option key={i} value={i}>{String.fromCharCode(65+i)}</option>)}</select></label>
        <label className="block">Justificativa do gabarito e dos distratores<textarea required className={field} aria-label="Justificativa" value={input.explanation} onChange={e=>update({explanation:e.target.value})}/></label>
      </>:<>{input.content.map((p,i)=><label className="block" key={i}>{kind==='revise'?`Parágrafo ${i+1} revisado`:'Exemplo'}<textarea required rows={4} className={field} aria-label={kind==='revise'?`Parágrafo ${i+1} revisado`:'Exemplo'} value={p} onChange={e=>update({content:input.content.map((v,n)=>n===i?e.target.value:v)})}/></label>)}{kind==='revise'&&<label className="block">Observação da página<textarea className={field} aria-label="Observação da página" value={input.callout} onChange={e=>update({callout:e.target.value})}/></label>}</>}
      {error&&<p role="alert" className="text-amber-300">{error}</p>}
      {preview&&<section aria-label="Prévia da alteração" className="p-3 border border-cyan-600"><h3>Confira antes de aplicar</h3><p className="whitespace-pre-wrap">{authoringSource(kind==='revise'?preview.scenes.find(s=>s.id===input.sourceSceneId)!:preview.scenes.at(-1)!)}</p>{kind==='quiz'&&<p>Gabarito: {String.fromCharCode(65+input.correctIndex)}</p>}<button type="button" className="mt-3 bg-emerald-700 p-3 rounded" onClick={()=>onApply(preview)}>Aplicar alteração revisada</button></section>}
      <div className="flex gap-3"><button type="submit" disabled={!source} className="bg-indigo-600 p-3 rounded">Conferir prévia</button><button type="button" onClick={onClose} className="border p-3 rounded">Cancelar</button></div>
    </form>
  </div>;
}
