import React,{useEffect,useState} from 'react';
import {PedagogicalReviewPanel} from './PedagogicalReviewPanel';
import type {PedagogicalTeamResult} from '../education/teachingAgents';
interface Job {id:string;title:string;status:string;message:string;createdAt:string;grade?:string;warnings:string[];documents:{name:string;sha256:string}[];team?:PedagogicalTeamResult}
export function DirectChatReviews() {
  const [jobs,setJobs]=useState<Job[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function refresh(){try{
      const response=await fetch('/api/ai/opencode/chat-reviews',{signal:controller.signal});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível consultar as revisões.');
      setJobs(data.jobs);setError(data.error||'');
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Falha na conexão.');}
    finally{if(!controller.signal.aborted){setLoading(false);timer=setTimeout(refresh,2500);}}}
    void refresh();return()=>{controller.abort();clearTimeout(timer);};
  },[]);
  async function retry(id:string){try{const r=await fetch('/api/ai/opencode/chat-reviews/'+id+'/retry',{method:'POST'});if(!r.ok)throw Error((await r.json()).error);setError('');}catch(e){setError(e instanceof Error?e.message:'Não foi possível retomar.');}}
  return <section className="max-w-5xl mx-auto space-y-5 p-6">
    <h1 className="text-3xl font-bold">Revisões do chat</h1>
    <p>As aulas criadas ou revisadas diretamente em Conversas e projetos passam automaticamente pelos professores agentes após a resposta do OpenCode. Os pareceres se referem à cópia capturada naquele momento; os arquivos originais são preservados.</p>
    {error&&<p role="alert" className="text-amber-300">{error}</p>}
    {loading?<p role="status">Consultando revisões…</p>:!jobs.length&&<p>Nenhuma revisão registrada. Peça uma aula no chat do OpenCode; o andamento aparecerá aqui.</p>}
    {jobs.map(job=><article key={job.id} className="rounded-xl border border-slate-700 p-5 space-y-3">
      <h2 className="text-xl font-semibold">{job.title}</h2>
      <p className="text-sm text-slate-400">{new Date(job.createdAt).toLocaleString('pt-BR')}{job.grade?' · '+job.grade:''}</p>
      <p role="status">{job.message}</p>
      {job.status==='failed'&&<button className="rounded bg-cyan-700 px-4 py-2" onClick={()=>void retry(job.id)}>Retomar revisão</button>}
      {!!job.warnings.length&&<ul className="text-amber-300">{job.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}
      {!!job.documents.length&&<details><summary>Documentos examinados</summary><ul>{job.documents.map(d=><li key={d.name}>{d.name}<span className="block text-xs break-all text-slate-400">SHA-256: {d.sha256}</span></li>)}</ul></details>}
      <PedagogicalReviewPanel team={job.team}/>
    </article>)}
  </section>;
}
