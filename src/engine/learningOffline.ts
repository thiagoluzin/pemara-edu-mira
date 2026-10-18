import {ATLAS_LAB_RUNTIME} from '../animations/atlasLab';
import {LEARNING_MOTION_CLASSES} from './learningMotion';
// Executado no HTML autossuficiente; não depende de React, servidor ou CDN.
export const LEARNING_OFFLINE_RUNTIME = ATLAS_LAB_RUNTIME+String.raw`
const learningProgressMemory=new Map();
let cleanupLearningMotion=()=>{};
function renderLearningScene(scene,el){
  cleanupLearningMotion();
  const data=learningPlans[scene.id],plan=data.plan;
  let step=currentStep,variant=plan.initialVariant,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  let motionAllowed=false,cleanupLab=()=>{};
  let labParams=scene.atlas_parameters||{};
  let progress=learningProgressMemory.get(scene.id)||JSON.parse(JSON.stringify(scene.learning_progress||{completed:[],notes:''}));
  const storageKey='pemara-workshop-'+learningLessonId+'-'+scene.id;
  try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&Array.isArray(stored.completed)&&typeof stored.notes==='string')progress=stored;}catch{}
  el.innerHTML='<style>'+biologyStyles+learningStyles+'</style><section class="learning-canvas"><div class="learning-eyebrow">'+({concept:'Explore e explique',example:'Exemplo em ação',activity:'Oficina da turma',summary:'Mapa de aprendizagem'})[plan.mode]+'</div><h2>'+escapeHtml(plan.title)+'</h2><div data-learning-stage></div><div class="learning-variants" aria-label="Manipular o modelo"></div><p class="learning-caption">'+escapeHtml(plan.kind==='statistics'?'Amostra ilustrativa: ajuste os valores e compare os resultados calculados.':plan.caption)+'</p><div class="learning-actions"><button class="learning-primary" data-action="play"></button><button data-action="previous">Etapa anterior</button><button data-action="next">Próxima etapa</button><button data-action="reset">Recomeçar exploração</button></div><nav class="learning-progress" aria-label="Ideias da página"></nav><div data-workshop></div><details><summary>Consultar conteúdo completo da página</summary>'+plan.source.map(s=>'<p>'+escapeHtml(s)+'</p>').join('')+'</details></section>';
  const root=el.querySelector('.learning-canvas');root.dataset.learningKind=plan.kind;
  const playback=document.createElement('div');playback.className='learning-actions learning-playback';playback.append(root.querySelector('[data-action=play]'));root.querySelector('[data-learning-stage]').before(playback);
  if(scene.source_citation){const citation=document.createElement('p');citation.className='learning-caption';citation.textContent='Fonte: '+scene.source_citation;root.append(citation);}
  root.addEventListener('keydown',e=>{const item=e.target.closest('[data-learning-step],[data-learning-variant]');if(item&&(e.key==='Enter'||e.key===' ')){e.preventDefault();item.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
  root.addEventListener('click',e=>{const item=e.target.closest('[data-learning-step],[data-learning-variant]');if(!item)return;if(item.hasAttribute('data-learning-step'))step=Number(item.getAttribute('data-learning-step'));if(item.hasAttribute('data-learning-variant'))variant=Number(item.getAttribute('data-learning-variant'));draw();});
  const variantRoot=root.querySelector('.learning-variants');
  if(plan.variants.length){const hint=document.createElement('p');hint.className='learning-caption';hint.textContent='Comparar modelos — escolha o desenho. As setas abaixo percorrem o texto.';variantRoot.before(hint);}
  plan.variants.forEach((name,i)=>{const button=document.createElement('button');button.textContent=name;button.onclick=()=>{variant=i;draw();};variantRoot.appendChild(button);});
  plan.steps.forEach((_,i)=>{const button=document.createElement('button');button.setAttribute('aria-label','Explorar ideia '+(i+1));button.onclick=()=>{step=i;draw();};root.querySelector('.learning-progress').appendChild(button);});
  if(plan.mode==='activity'){
    root.querySelector('[data-workshop]').innerHTML='<div class="learning-actions"><button data-complete></button><span data-count></span></div><label>Registro da discussão da turma<textarea maxlength="20000" style="display:block;width:100%;min-height:96px;background:#020617;color:#e2e8f0;padding:12px;border:1px solid #64748b;border-radius:10px" placeholder="Registre hipóteses, observações e conclusões da turma."></textarea></label><p class="learning-caption" data-save-status>Registro local desta apresentação. A atividade aberta é discutida com o professor; não há correção automática.</p>';
    root.querySelector('textarea').value=progress.notes;
    root.querySelector('textarea').oninput=e=>{progress.notes=e.target.value;save();};
    root.querySelector('[data-complete]').onclick=()=>{progress.completed=progress.completed.includes(step)?progress.completed.filter(n=>n!==step):progress.completed.concat(step);save();draw();};
  }
  function save(){learningProgressMemory.set(scene.id,progress);try{localStorage.setItem(storageKey,JSON.stringify(progress));root.querySelector('[data-save-status]').textContent='Registro salvo neste navegador. A atividade aberta é discutida com o professor; não há correção automática.';}catch{root.querySelector('[data-save-status]').textContent='Este navegador não permitiu guardar o registro. Copie suas anotações antes de fechar.';}}
  function draw(){
    cleanupLab();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){playing=false;motionAllowed=false;}
    currentStep=step;updateNavigation();
    const frames=data.frames[plan.variants.length?variant:0];
    root.querySelector('[data-learning-stage]').innerHTML='<div class="learning-stage"><div class="learning-art">'+frames[step]+'</div><div class="learning-reading"><h3>'+({concept:'Explore a ideia',example:'Observe o exemplo',activity:'Desafio da turma',summary:'Conecte o que aprendeu'})[plan.mode]+' • '+(step+1)+'/'+plan.steps.length+'</h3><p>'+escapeHtml(plan.steps[step])+'</p></div></div>';
    cleanupLab=mountAtlasLab(root.querySelector('.learning-art'),plan.kind,variant,labParams,next=>{labParams=next;},()=>{playing=false;updatePlayback();});
    updatePlayback();
    root.querySelector('[data-action=previous]').disabled=step===0;root.querySelector('[data-action=next]').disabled=step===plan.steps.length-1;
    variantRoot.querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===variant)));
    root.querySelectorAll('.learning-progress button').forEach((button,i)=>{button.textContent=(progress.completed.includes(i)?'✓ ':'')+(i+1);button.setAttribute('aria-pressed',String(i===step));});
    if(plan.mode==='activity'){root.querySelector('[data-complete]').textContent=progress.completed.includes(step)?'Etapa concluída — reabrir':'Marcar etapa como discutida';root.querySelector('[data-complete]').setAttribute('aria-pressed',String(progress.completed.includes(step)));root.querySelector('[data-count]').textContent=progress.completed.length+'/'+plan.steps.length+' etapas discutidas';}
  }
  function updatePlayback(){
    const animated=!!root.querySelector(${JSON.stringify(LEARNING_MOTION_CLASSES.map(name=>'.learning-art .'+name).join(','))});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const button=root.querySelector('[data-action=play]');
    root.dataset.running=String(playing&&animated&&(!reduced||motionAllowed));
    root.dataset.motionAllowed=String(motionAllowed);
    button.hidden=!animated;
    button.textContent=playing?'Pausar animação':'Reproduzir animação';
    let notice=root.querySelector('[data-motion-notice]');
    if(!notice){notice=document.createElement('span');notice.dataset.motionNotice='';notice.className='learning-caption';button.after(notice);}
    notice.hidden=animated&&(!reduced||motionAllowed);
    notice.textContent=animated?'Movimento reduzido neste dispositivo. Reproduzir ativa somente este desenho.':'Desenho estático — explore pelos modelos e pelas etapas.';
  }
  root.querySelector('[data-action=play]').onclick=()=>{motionAllowed=true;playing=!playing;updatePlayback();};
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  const motionChanged=()=>{if(motionPreference.matches){playing=false;motionAllowed=false;}if(root.isConnected)updatePlayback();};
  motionPreference.addEventListener('change',motionChanged);
  cleanupLearningMotion=()=>{cleanupLab();motionPreference.removeEventListener('change',motionChanged);};
  root.querySelector('[data-action=previous]').onclick=()=>{step=Math.max(0,step-1);draw();};
  root.querySelector('[data-action=next]').onclick=()=>{step=Math.min(plan.steps.length-1,step+1);draw();};
  root.querySelector('[data-action=reset]').onclick=()=>{playing=false;step=0;variant=plan.initialVariant;draw();};
  activeStepMove=direction=>{const next=step+direction;if(next<0||next>=plan.steps.length)return false;step=next;draw();return true;};
  draw();
}
`;
