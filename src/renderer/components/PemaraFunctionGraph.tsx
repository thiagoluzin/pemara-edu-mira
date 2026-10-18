import React,{useEffect,useMemo,useState} from 'react';
import type {MathFunctionScene,MathFunctionParams} from '../../types/lesson';
import {functionModel,functionSvg} from '../../engine/functionModel';
import {LEARNING_CSS} from '../../engine/learningVisual';
export const PemaraFunctionGraph:React.FC<{scene:MathFunctionScene;onParamsChange?:(p:MathFunctionParams)=>void}>=({scene,onParamsChange})=>{
 const [params,setParams]=useState(scene.params),[playing,setPlaying]=useState(false),[replay,setReplay]=useState(0);
 useEffect(()=>{setParams(scene.params);setPlaying(false);},[scene.params]);
 const model=useMemo(()=>functionModel(params),[params]),svg=useMemo(()=>functionSvg(params),[params]);
 const change=(key:'a'|'b'|'c',value:number)=>{const next={...params,[key]:value};setParams(next);setPlaying(false);onParamsChange?.(next);};
 return <section className="learning-canvas" data-running={playing} data-motion-allowed="true" aria-label="Função matemática interativa"><style>{LEARNING_CSS}</style>
  <h2>{scene.title}</h2><div key={replay} className="learning-art" dangerouslySetInnerHTML={{__html:svg}}/>
  <p>{model.analysis}</p><p className="learning-caption">O ponto percorre a curva para relacionar x e f(x). Velocidade didática; os coeficientes permanecem fixos durante a reprodução. A escala vertical se ajusta aos valores.</p>
  <div className="learning-actions"><button onClick={()=>setPlaying(p=>!p)}>{playing?'Pausar animação':'Reproduzir animação'}</button><button onClick={()=>{setPlaying(false);setReplay(n=>n+1);}}>Recomeçar</button></div>
  <div className="learning-actions">{(['a','b','c'] as const).filter(k=>model.kind!=='linear'||k!=='a').map(k=><label key={k}>Coeficiente {k}: {params[k]} <input aria-label={'Coeficiente '+k} type="range" min={k==='a'?-5:k==='c'?-10:-8} max={k==='a'?5:k==='c'?10:8} step="0.5" value={params[k]} onChange={e=>change(k,Number(e.target.value))}/></label>)}</div>
 </section>;
};
