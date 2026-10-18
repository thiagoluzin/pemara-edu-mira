import React, { useEffect, useRef, useState } from 'react';
import { MaterialPicker } from './MaterialPicker';
import type { MaterialSelection } from '../types/material';
type Job = { id: string; status: 'running'|'failed'|'interrupted'|'completed'; message: string; topic: string; model: string; lessonId?: string };
const key = 'pemara-opencode-brief';
const defaults = { topic: '', subject: 'science', grade: '6EF', duration_minutes: 45, material_text: '' };
function savedBrief() { try { return { ...defaults, ...JSON.parse(localStorage.getItem(key)||'{}') }; } catch { return defaults; } }
async function request(url: string, body?: object) {
  const response = await fetch('/api/ai/opencode/jobs' + url, { ...(body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(15000) });
  const data=await response.json(); if(!response.ok)throw new Error(data.error||'Não foi possível consultar o pedido.'); return data;
}
export function OpenCodeLessonCreator({model,onOpenLesson}:{model:string;onOpenLesson:(id:string)=>Promise<void>}) {
  const [selectedModel,setSelectedModel]=useState(model);
  useEffect(()=>{const refresh=()=>{void fetch('/api/ai/providers').then(r=>r.json()).then(data=>{if(data.opencode)setSelectedModel(data.model||'');}).catch(()=>{});};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
  const [brief,setBrief]=useState(savedBrief),[materials,setMaterials]=useState<MaterialSelection[]>([]);
  const [reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[submitting,setSubmitting]=useState(false);
  const [job,setJob]=useState<Job|null>(null),[error,setError]=useState('');
  const requestId=useRef<string|null>(null),open=useRef(onOpenLesson);open.current=onOpenLesson;
  useEffect(()=>{localStorage.setItem(key,JSON.stringify(brief));requestId.current=null;},[brief]);
  useEffect(()=>{setReviewed(false);requestId.current=null;},[materials,brief.material_text]);
  useEffect(()=>{let disposed=false;request('').then(data=>{if(!disposed)setJob(data.jobs[0]||null);}).catch(()=>{if(!disposed)setError('Não foi possível recuperar os pedidos. Sua descrição continua guardada.');});return()=>{disposed=true;};},[]);
  useEffect(()=>{
    if(job?.status!=='running')return;
    let disposed=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{try{const next:Job=await request('/'+job.id);if(disposed)return;setJob(next);setError('');if(next.status==='completed'&&next.lessonId){await open.current(next.lessonId);return;}if(next.status!=='running')return;}catch{if(!disposed)setError('Conexão interrompida. O pedido está salvo; aguardando o programa responder…');}if(!disposed)timer=setTimeout(poll,1500);};
    timer=setTimeout(poll,1000);return()=>{disposed=true;clearTimeout(timer);};
  },[job?.id,job?.status]);
  const generate=async()=>{
    setError('');if((materials.length||brief.material_text.trim())&&!reviewed){setError('Confira os materiais e marque a revisão antes de enviar.');return;}
    setSubmitting(true);requestId.current??=crypto.randomUUID();
    try{setJob(await request('',{...brief,materials,requestId:requestId.current}));}catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar.');}finally{setSubmitting(false);}
  };
  const field='w-full rounded-xl bg-slate-950 border border-slate-600 p-3 text-white';
  return <section className="max-w-4xl mx-auto rounded-2xl bg-slate-900 border border-slate-700 p-5 md:p-8 space-y-6" aria-label="Criar aula com OpenCode">
    <div><p className="text-cyan-300 text-sm font-semibold">PEMARA EDU · OpenCode</p><h1 className="text-3xl font-bold mt-2">Que aula vamos preparar?</h1><p className="text-slate-300 mt-2">Descreva o que a turma precisa aprender. A IA cria o roteiro, as explicações, as atividades e escolhe animações do Atlas quando forem adequadas.</p></div>
    <form className="space-y-5" onSubmit={e=>{e.preventDefault();void generate();}}>
      <label className="block space-y-2"><span>Tema e orientações para a IA</span><textarea required aria-label="Tema e orientações para a IA" maxLength={2000} rows={3} className={field} placeholder="Ex.: Evaporação no 6º ano. Explique por que a roupa seca sem ferver e proponha uma experiência com temperatura e vento." value={brief.topic} onChange={e=>setBrief({...brief,topic:e.target.value})}/></label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label>Disciplina<select aria-label="Disciplina" className={field} value={brief.subject} onChange={e=>setBrief({...brief,subject:e.target.value})}>{[['science','Ciências'],['math','Matemática'],['history','História'],['geography','Geografia'],['portuguese','Língua Portuguesa'],['english','Língua Inglesa'],['arts','Arte'],['physical_education','Educação Física'],['religious_education','Ensino Religioso'],['physics','Física'],['chemistry','Química'],['biology','Biologia']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Ano escolar<select aria-label="Ano escolar" className={field} value={brief.grade} onChange={e=>setBrief({...brief,grade:e.target.value})}>{[...Array.from({length:9},(_,i)=>[`${i+1}EF`,`${i+1}º ano — Fundamental`]),...Array.from({length:3},(_,i)=>[`${i+1}EM`,`${i+1}º ano — Médio`])].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Duração (minutos)<input aria-label="Duração (minutos)" type="number" min={10} max={240} required className={field} value={brief.duration_minutes} onChange={e=>setBrief({...brief,duration_minutes:Number(e.target.value)})}/></label>
      </div>
      <details className="rounded-xl border border-slate-700 p-4"><summary className="cursor-pointer font-semibold">Adicionar materiais e orientações (opcional)</summary><div className="mt-4 space-y-4"><MaterialPicker value={materials} onChange={setMaterials} onBusy={setBusy}/><label className="block">Texto complementar<textarea aria-label="Texto complementar" rows={4} maxLength={120000} className={field} value={brief.material_text} onChange={e=>setBrief({...brief,material_text:e.target.value})}/></label>{(materials.length>0||brief.material_text.trim())&&<label className="block"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> Conferi os trechos que serão enviados à IA.</label>}</div></details>
      <p className="text-sm text-slate-400">Modelo do OpenCode: {selectedModel||'selecione um modelo em Conversas e projetos'}. O tema e os trechos selecionados serão enviados a esse modelo. A geração usa internet; depois de salva, a aula e o HTML abrem offline.</p>
      <button type="submit" disabled={!selectedModel||busy||submitting||job?.status==='running'} className="w-full sm:w-auto rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-4 font-bold disabled:opacity-50">{submitting?'Guardando pedido…':'Criar aula com IA'}</button>
    </form>
    {error&&<p role="alert" className="text-amber-300">{error}</p>}
    {job&&<div className="rounded-xl border border-slate-600 p-4 space-y-3"><p className="font-semibold">{job.topic}</p><p role="status" className="text-slate-300">{job.status==='interrupted'?'Pedido interrompido. A descrição e a conversa estão guardadas.':job.message}</p><div className="flex flex-wrap gap-3">
      {job.status==='running'&&<button onClick={()=>{void request('/'+job.id+'/stop',{}).catch(e=>setError(e.message));}} className="border rounded-lg px-4 py-2">Parar e guardar pedido</button>}
      {(job.status==='failed'||job.status==='interrupted')&&<button disabled={submitting} onClick={async()=>{setSubmitting(true);try{setJob(await request('/'+job.id+'/resume',{}));setError('');}catch(e){setError(e instanceof Error?e.message:'Falha ao retomar.');}finally{setSubmitting(false);}}} className="bg-indigo-600 rounded-lg px-4 py-2">Retomar</button>}
      {job.lessonId&&<button onClick={()=>{void onOpenLesson(job.lessonId!).catch(e=>setError(e.message));}} className="bg-emerald-700 rounded-lg px-4 py-2">Abrir aula</button>}
    </div><p className="text-xs text-slate-400">A conversa desta aula fica em Conversas e projetos. Revise o conteúdo antes de apresentar.</p></div>}
  </section>;
}
