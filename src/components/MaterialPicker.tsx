import React,{useEffect,useRef,useState} from 'react';
import type {MaterialSelection,StoredMaterial} from '../types/material';
import {MATERIAL_TEXT_LIMIT} from '../types/material';
interface Props {value:MaterialSelection[];onChange:(value:MaterialSelection[])=>void;onBusy:(busy:boolean)=>void}
export function MaterialPicker({value,onChange,onBusy}:Props){
  const [loaded,setLoaded]=useState<StoredMaterial[]>([]),[library,setLibrary]=useState<{id:string;filename:string}[]>([]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  const [start,setStart]=useState(''),[end,setEnd]=useState('');
  const [offsets,setOffsets]=useState<Record<string,number>>({});
  const controller=useRef<AbortController|null>(null);
  const selected=(m:StoredMaterial,i:number)=>value.some(s=>s.materialId===m.id&&s.sourceUnit===m.sections[i].sourceUnit&&s.sourceIndex===m.sections[i].sourceIndex&&s.text===m.sections[i].text);
  const selection=(m:StoredMaterial,i:number):MaterialSelection=>({...m.sections[i],materialId:m.id,filename:m.filename,sha256:m.sha256});
  const total=value.reduce((n,s)=>n+s.text.length,0);
  const refresh=async(signal?:AbortSignal)=>{const r=await fetch('/api/materials',{signal});if(!r.ok)throw new Error('Não foi possível carregar a biblioteca de materiais.');setLibrary((await r.json()).materials);};
  useEffect(()=>{const abort=new AbortController();void refresh(abort.signal).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>{abort.abort();controller.current?.abort();};},[]);
  const add=(m:StoredMaterial)=>setLoaded(old=>old.some(x=>x.id===m.id)?old:[...old,m]);
  const restore=async(id:string)=>{
    if(busy)return;setError('');const c=new AbortController();controller.current=c;setBusy(true);onBusy(true);
    try{const r=await fetch(`/api/materials/${encodeURIComponent(id)}`,{signal:c.signal});const data=await r.json();if(!r.ok)throw new Error(data.error);if(!c.signal.aborted)add(data.material);}
    catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'Falha ao abrir material.');}
    finally{if(!c.signal.aborted){setBusy(false);onBusy(false);}if(controller.current===c)controller.current=null;}
  };
  const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const input=event.currentTarget,files=Array.from(input.files||[]);input.value='';
    if(!files.length||busy)return;
    if(files.length>10){setError('Selecione até dez arquivos por lote.');return;}
    if((start&&(!Number.isInteger(Number(start))||Number(start)<1))||(end&&(!Number.isInteger(Number(end))||Number(end)<Number(start||1)))){setError('Confira o intervalo de páginas.');return;}
    const abort=new AbortController();controller.current=abort;setBusy(true);onBusy(true);setError('');
    const failures:string[]=[];
    try{
      for(const [index,file] of files.entries()){
        if(abort.signal.aborted)break;
        setStatus(`Lendo ${index+1}/${files.length}: ${file.name}`);
        try{
          if(file.size>40*1024*1024)throw new Error('O limite é 40 MB por arquivo.');
          const headers:Record<string,string>={'Content-Type':'application/octet-stream','X-Filename':encodeURIComponent(file.name)};
          if(start)headers['X-Page-Start']=start;if(end)headers['X-Page-End']=end;
          const r=await fetch('/api/materials/extract',{method:'POST',headers,body:file,signal:abort.signal});
          const data=await r.json();if(!r.ok)throw new Error(data.error||'Não foi possível extrair o documento.');
          if(!abort.signal.aborted)add(data.material);
        }catch(e){if(!abort.signal.aborted)failures.push(`${file.name}: ${e instanceof Error?e.message:'Falha na importação.'}`);}
      }
      if(!abort.signal.aborted){setError(failures.join('\n'));await refresh(abort.signal);setStatus('Leitura concluída. Confira e selecione os trechos que entrarão na aula.');}
    }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Falha ao atualizar biblioteca.');}
    finally{if(!abort.signal.aborted){setBusy(false);onBusy(false);}if(controller.current===abort)controller.current=null;}
  };
  const cancel=()=>{controller.current?.abort();setBusy(false);onBusy(false);setStatus('Importação cancelada. Os materiais já concluídos continuam guardados.');};
  return <section aria-label="Materiais offline" className="space-y-4">
    <p className="text-sm text-slate-300">PDF, Word, PowerPoint, TXT e Markdown. O original é guardado neste computador. Confira a leitura antes de selecionar os trechos.</p>
    <label className="block font-semibold">Adicionar materiais<input aria-label="Adicionar materiais" type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md,.doc,.ppt" disabled={busy} onChange={upload} className="block w-full mt-2"/></label>
    <p className="text-xs text-slate-400">Até 10 arquivos por lote, 40 MB cada. PDF digitalizado usa OCR local. Antes de importar DOC e PPT antigos, salve uma cópia como DOCX/PPTX no Word, PowerPoint ou LibreOffice.</p>
    <div className="flex flex-wrap gap-3"><label>PDF: página inicial<input aria-label="Página inicial do PDF" type="number" min="1" value={start} onChange={e=>setStart(e.target.value)} className="block w-24 rounded bg-slate-950 p-2"/></label><label>Página final<input aria-label="Página final do PDF" type="number" min="1" value={end} onChange={e=>setEnd(e.target.value)} className="block w-24 rounded bg-slate-950 p-2"/></label></div>
    <p className="text-xs text-slate-400">Em branco: início do PDF, até 100 páginas e 12 páginas com OCR por importação. Para continuar, informe outro intervalo.</p>
    {busy&&<button type="button" onClick={cancel} className="rounded border px-3 py-2">Cancelar leitura</button>}
    {status&&<p role="status">{status}</p>}{error&&<p role="alert" className="text-rose-300 whitespace-pre-wrap">{error}</p>}
    {library.length>0&&<label className="block">Reutilizar material guardado<select aria-label="Reutilizar material guardado" value="" disabled={busy} onChange={e=>void restore(e.target.value)} className="block w-full bg-slate-950 p-2 rounded"><option value="">Escolha um material</option>{library.map(m=><option key={m.id} value={m.id}>{m.filename}</option>)}</select></label>}
    {loaded.map(m=>{const offset=offsets[m.id]||0;return <details key={m.id} open className="rounded border border-slate-600 p-3">
      <summary className="cursor-pointer font-semibold">{m.filename} · {m.sections.length} trechos</summary>
      <a className="underline text-cyan-300" href={`/api/materials/${m.id}/original`} download>Baixar original preservado</a>
      {m.warnings.map((w,i)=><p key={i} className="text-amber-200 text-sm">{w}</p>)}
      {m.ocrUsed&&<p className="text-amber-200 text-sm">Há texto reconhecido por OCR. Confira números, acentos e fórmulas.</p>}
      <div className="flex flex-wrap gap-2 my-2"><button type="button" onClick={()=>onChange([...value.filter(s=>s.materialId!==m.id),...m.sections.map((_,i)=>selection(m,i))])}>Selecionar todos</button><button type="button" onClick={()=>onChange(value.filter(s=>s.materialId!==m.id))}>Desmarcar todos</button><button type="button" onClick={()=>{onChange(value.filter(s=>s.materialId!==m.id));setLoaded(old=>old.filter(x=>x.id!==m.id));}}>Retirar desta aula</button></div>
      {m.sections.slice(offset,offset+20).map((s,j)=>{const i=offset+j;return <label key={i} className="block border-t border-slate-700 py-3"><input type="checkbox" checked={selected(m,i)} onChange={e=>onChange(e.target.checked?[...value,selection(m,i)]:value.filter(v=>!(v.materialId===m.id&&v.sourceUnit===s.sourceUnit&&v.sourceIndex===s.sourceIndex&&v.text===s.text)))}/> <strong>{s.sourceLabel}</strong><pre className="font-sans whitespace-pre-wrap text-sm mt-2 max-h-48 overflow-y-auto">{s.text}</pre></label>;})}
      {m.sections.length>20&&<div className="flex gap-3"><button type="button" disabled={!offset} onClick={()=>setOffsets(o=>({...o,[m.id]:Math.max(0,offset-20)}))}>Trechos anteriores</button><span>{offset+1}–{Math.min(offset+20,m.sections.length)}</span><button type="button" disabled={offset+20>=m.sections.length} onClick={()=>setOffsets(o=>({...o,[m.id]:offset+20}))}>Próximos trechos</button></div>}
    </details>;})}
    <p className={total>MATERIAL_TEXT_LIMIT?'text-rose-300':'text-slate-300'}>{value.length} trechos selecionados · {total.toLocaleString('pt-BR')} / 120.000 caracteres. A seleção mantém sua ordem; não há corte automático.</p>
  </section>;
}
