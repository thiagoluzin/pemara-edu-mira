import type {PresentationStep} from '../../engine/presentationNavigation';
import React,{useMemo,useState} from 'react';
import type {LessonMeta,Scene,TextScene,SummaryScene} from '../../types/lesson';
import {BIOLOGY_CSS} from '../../engine/biologyModel';
import {createLearningPlan,learningDiagram,LEARNING_CSS} from '../../engine/learningVisual';

export function PemaraLearning({scene,lesson,onChange,presentationStep}:{presentationStep?:PresentationStep;scene:TextScene|SummaryScene;lesson?:LessonMeta;onChange?:(scene:Scene)=>void}) {
  const plan=useMemo(()=>createLearningPlan(scene,lesson),[scene,lesson]);
  const [localStep,setLocalStep]=useState(0);
  const step=presentationStep?.value??localStep;
  const setStep=(value:number)=>{if(presentationStep)presentationStep.onChange(value);else setLocalStep(value);};
  const [variant,setVariant]=useState(plan.initialVariant);
  const [playing,setPlaying]=useState(()=>typeof window!=='undefined'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [completed,setCompleted]=useState<number[]>(scene.learning_progress?.completed||[]);
  const [notes,setNotes]=useState(scene.learning_progress?.notes||'');
  const current=Math.min(step,plan.steps.length-1);
  const choose=(s:number)=>{setStep(s);};
  const updateProgress=(next:number[],text:string)=>{
    setCompleted(next);setNotes(text);
    onChange?.({...scene,learning_progress:{completed:next,notes:text}});
  };
  const activateGraphic=(target:EventTarget|null)=>{
    if(!(target instanceof Element))return;
    const node=target.closest('[data-learning-step],[data-learning-variant]');
    if(!node)return;
    
    if(node.hasAttribute('data-learning-step'))setStep(Number(node.getAttribute('data-learning-step')));
    if(node.hasAttribute('data-learning-variant'))setVariant(Number(node.getAttribute('data-learning-variant')));
  };
  return <section className="learning-canvas" data-running={playing} data-learning-kind={plan.kind}
    aria-label="Exploração visual da página">
    <style>{BIOLOGY_CSS+LEARNING_CSS}</style>
    <div className="learning-eyebrow">{({concept:'Explore e explique',example:'Exemplo em ação',activity:'Oficina da turma',summary:'Mapa de aprendizagem'})[plan.mode]}</div>
    <h2>{scene.title}</h2>
    <div className="learning-stage">
      <div className="learning-art" onClick={e=>activateGraphic(e.target)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activateGraphic(e.target);}}} dangerouslySetInnerHTML={{__html:learningDiagram(plan,current,variant)}}/>
      <div className="learning-reading"><h3>{plan.mode==='activity'?'Desafio da turma':plan.mode==='example'?'Observe o exemplo':plan.mode==='summary'?'Conecte o que aprendeu':'Explore a ideia'} • {current+1}/{plan.steps.length}</h3>
        <p>{plan.steps[current]}</p>
      </div>
    </div>
    {plan.variants.length>0&&<div className="learning-variants" aria-label="Manipular o modelo">
      {plan.kind==='fractions'?<><label htmlFor={`parts-${scene.id}`}>Partes destacadas: {variant}/{plan.denominator}</label><input id={`parts-${scene.id}`} type="range" min="0" max={plan.denominator} value={variant} onChange={e=>{setVariant(Number(e.target.value));}}/></>
      :plan.variants.map((name,i)=><button key={name} aria-pressed={variant===i} onClick={()=>{setVariant(i);}}>{name}</button>)}
    </div>}
    <p className="learning-caption">{plan.caption} Use ← e → para percorrer as ideias; depois da última, avance para a próxima página.</p>
    <div className="learning-actions">
      <button className="learning-primary" onClick={()=>setPlaying(p=>!p)}>{playing?'Pausar animação':'Reproduzir animação'}</button>
      <button disabled={current===0} onClick={()=>choose(current-1)}>Etapa anterior</button>
      <button disabled={current===plan.steps.length-1} onClick={()=>choose(current+1)}>Próxima etapa</button>
      <button onClick={()=>{choose(0);setVariant(plan.initialVariant);}}>Recomeçar exploração</button>
    </div>
    <nav className="learning-progress" aria-label="Ideias da página">{plan.steps.map((_,i)=><button key={i} aria-label={`Explorar ideia ${i+1}`} aria-pressed={current===i} onClick={()=>choose(i)}>{completed.includes(i)?'✓ ':''}{i+1}</button>)}</nav>
    {plan.mode==='activity'&&<div className="learning-workshop">
      <div className="learning-actions"><button aria-pressed={completed.includes(current)} onClick={()=>updateProgress(completed.includes(current)?completed.filter(n=>n!==current):[...completed,current],notes)}>{completed.includes(current)?'Etapa concluída — reabrir':'Marcar etapa como discutida'}</button><span>{completed.length}/{plan.steps.length} etapas discutidas</span></div>
      <label htmlFor={`response-${scene.id}`} className="block text-sm mb-2">Registro da discussão da turma</label>
      <textarea id={`response-${scene.id}`} maxLength={20000} className="w-full min-h-24 rounded-xl bg-slate-950 border border-slate-600 p-3 text-slate-100" value={notes} onChange={e=>updateProgress(completed,e.target.value)} placeholder="Registre hipóteses, observações e conclusões da turma."/>
      <p className="learning-caption">{onChange?'O registro acompanha as alterações da aula. Salve uma versão para guardá-lo no histórico.':'Registro temporário desta apresentação.'} Esta atividade aberta é discutida com o professor; não há correção automática.</p>
    </div>}
    <details><summary>Consultar conteúdo completo da página</summary>{plan.source.map((s,i)=><p key={i}>{s}</p>)}</details>
  </section>;
}
