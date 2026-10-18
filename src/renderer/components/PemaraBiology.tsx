import type {PresentationStep} from '../../engine/presentationNavigation';
import React, { useEffect, useState } from 'react';
import type { BiologyScene } from '../../types/lesson';
import { BIOLOGY_CSS, BIOLOGY_STEPS, biologySvg } from '../../engine/biologyModel';

export function PemaraBiology({scene,presentationStep}: {scene: BiologyScene;presentationStep?:PresentationStep}) {
  const [localStep,setLocalStep] = useState(0);
  const step=presentationStep?.value??localStep;
  const setStep=(value:number)=>{if(presentationStep)presentationStep.onChange(value);else setLocalStep(value);};
  const [playing,setPlaying] = useState(()=>typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [plant,setPlant] = useState(scene.params.cell_type==='plant');
  const [allowed,setAllowed]=useState(false),[replay,setReplay]=useState(0);
  useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>{if(m.matches){setPlaying(false);setAllowed(false);}};m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
  const steps = BIOLOGY_STEPS[scene.params.model];
  useEffect(()=>{setLocalStep(0);setPlant(scene.params.cell_type==='plant');},[scene.id,scene.params.model,scene.params.cell_type]);
  const choose=(index:number)=>{setStep(index);};
  return <section className="bio-model" data-bio-running={playing} data-motion-allowed={allowed} aria-label="Modelo animado de Ciências">
    <style>{BIOLOGY_CSS}</style>
    <h2>{scene.title}</h2>
    <div className="bio-controls">
      <button onClick={()=>{setAllowed(true);setPlaying(p=>!p);}}>{playing?'Pausar animação':'Iniciar animação'}</button>
      <button onClick={()=>choose((step+1)%steps.length)}>Próxima etapa</button>
      <button onClick={()=>{setPlaying(false);setReplay(n=>n+1);choose(0);}}>Recomeçar</button>
      {scene.params.model==='cell_structure' && <><button aria-pressed={!plant} onClick={()=>setPlant(false)}>Célula animal</button><button aria-pressed={plant} onClick={()=>setPlant(true)}>Célula vegetal</button></>}
    </div>
    <div className="bio-body">
      <div key={replay} dangerouslySetInnerHTML={{__html:biologySvg(scene.params.model,step,plant)}}/>
      <aside className="bio-detail"><h3>{steps[step].title}</h3><p>{steps[step].text}</p></aside>
    </div>
    <div className="bio-steps" aria-label="Etapas do modelo">{steps.map((item,i)=><button key={item.title} aria-pressed={step===i} onClick={()=>choose(i)}>{i+1}. {item.title}</button>)}</div>
    <p className="bio-note">Modelo didático simplificado, sem escala real. {scene.params.model==='organization'?'Os níveis mostram organização, não transformação de uma célula em um organismo.':'As estruturas são esquemáticas; células reais variam em forma e tamanho.'} O movimento pode ser pausado para discussão.</p>
  </section>;
}
