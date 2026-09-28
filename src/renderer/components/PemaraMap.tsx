import React,{useMemo,useState} from 'react';
import type {MapScene} from '../../types/lesson';
import {prepareMap,mapSvg,coordinate} from '../../engine/mapModel';
export const PemaraMap:React.FC<{scene:MapScene}>=({scene})=>{
 const model=useMemo(()=>prepareMap(scene),[scene]);
 const [selected,setSelected]=useState(0);
 const points=model.params.focus_points,p=points[selected]||points[0];
 const activate=(target:EventTarget|null)=>{if(target instanceof Element){const el=target.closest('[data-map-point]');if(el)setSelected(Number(el.getAttribute('data-map-point')));}};
 return <section className="p-5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 w-full min-w-0" aria-label="Mapa interativo" onKeyDown={e=>{if(e.key!=='Escape')e.stopPropagation();}}>
  <p className="text-cyan-300 text-sm">Localização geográfica • {model.params.region_name}</p>
  <h2 className="text-2xl font-bold my-3">{model.title}</h2>
  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)] gap-5">
   <div className="min-w-0" onClick={e=>activate(e.target)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e.target);}}} dangerouslySetInnerHTML={{__html:mapSvg(model,selected)}}/>
   <div className="min-w-0"><h3 className="text-cyan-300 font-semibold mb-3">Localidades em destaque</h3>
    <div className="flex flex-wrap gap-2">{points.map((point,i)=><button key={i} aria-pressed={selected===i} onClick={()=>setSelected(i)} className={`rounded-lg border p-2 text-left text-sm ${selected===i?'bg-cyan-900 border-cyan-300':'bg-slate-800 border-slate-600'}`}>{i+1}. {point.name}</button>)}</div>
    {p?<div className="bg-slate-800 rounded-xl p-4 mt-4"><h4 className="font-bold text-lg">{p.name}</h4><p className="text-slate-300">{p.region}</p><p className="my-3">{p.role}</p><p className="text-sm">Latitude: {coordinate(p.lat,'lat')} • Longitude: {coordinate(p.lon,'lon')}</p></div>:<p className="my-4">Este recurso não contém localidades com coordenadas válidas. Nenhum ponto foi inventado.</p>}
   </div>
  </div>
  <p className="mt-4 text-sm text-slate-300">{model.params.historical_notes||'Base de localização contemporânea. Não representa fronteiras históricas ou áreas temáticas.'}</p>
  {scene.source_citation&&<p className="mt-2 text-xs text-slate-400">{/(BNCC|EF\d|EM\d)/.test(scene.source_citation)?'Referência curricular':'Referência do conteúdo'}: {scene.source_citation}</p>}
 </section>;
};

