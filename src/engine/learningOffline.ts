// Executado no HTML autossuficiente; não depende de React, servidor ou CDN.
export const LEARNING_OFFLINE_RUNTIME = String.raw`
const learningProgressMemory=new Map();
function renderLearningScene(scene,el){
  const data=learningPlans[scene.id],plan=data.plan;
  let step=currentStep,variant=plan.initialVariant,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  let progress=learningProgressMemory.get(scene.id)||JSON.parse(JSON.stringify(scene.learning_progress||{completed:[],notes:''}));
  const storageKey='pemara-workshop-'+learningLessonId+'-'+scene.id;
  try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&Array.isArray(stored.completed)&&typeof stored.notes==='string')progress=stored;}catch{}
  el.innerHTML='<style>'+biologyStyles+learningStyles+'</style><section class="learning-canvas"><div class="learning-eyebrow">'+({concept:'Explore e explique',example:'Exemplo em ação',activity:'Oficina da turma',summary:'Mapa de aprendizagem'})[plan.mode]+'</div><h2>'+escapeHtml(plan.title)+'</h2><div data-learning-stage></div><div class="learning-variants" aria-label="Manipular o modelo"></div><p class="learning-caption">'+escapeHtml(plan.caption)+'</p><div class="learning-actions"><button class="learning-primary" data-action="play"></button><button data-action="previous">Etapa anterior</button><button data-action="next">Próxima etapa</button><button data-action="reset">Recomeçar exploração</button></div><nav class="learning-progress" aria-label="Ideias da página"></nav><div data-workshop></div><details><summary>Consultar conteúdo completo da página</summary>'+plan.source.map(s=>'<p>'+escapeHtml(s)+'</p>').join('')+'</details></section>';
  const root=el.querySelector('.learning-canvas');root.dataset.learningKind=plan.kind;
  root.addEventListener('keydown',e=>{const item=e.target.closest('[data-learning-step],[data-learning-variant]');if(item&&(e.key==='Enter'||e.key===' ')){e.preventDefault();item.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
  root.addEventListener('click',e=>{const item=e.target.closest('[data-learning-step],[data-learning-variant]');if(!item)return;if(item.hasAttribute('data-learning-step'))step=Number(item.getAttribute('data-learning-step'));if(item.hasAttribute('data-learning-variant'))variant=Number(item.getAttribute('data-learning-variant'));draw();});
  const variantRoot=root.querySelector('.learning-variants');
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
    currentStep=step;updateNavigation();
    root.dataset.running=String(playing);
    const frames=data.frames[plan.variants.length?variant:0];
    root.querySelector('[data-learning-stage]').innerHTML='<div class="learning-stage"><div class="learning-art">'+frames[step]+'</div><div class="learning-reading"><h3>'+({concept:'Explore a ideia',example:'Observe o exemplo',activity:'Desafio da turma',summary:'Conecte o que aprendeu'})[plan.mode]+' • '+(step+1)+'/'+plan.steps.length+'</h3><p>'+escapeHtml(plan.steps[step])+'</p></div></div>';
    root.querySelector('[data-action=play]').textContent=playing?'Pausar animação':'Reproduzir animação';
    root.querySelector('[data-action=previous]').disabled=step===0;root.querySelector('[data-action=next]').disabled=step===plan.steps.length-1;
    variantRoot.querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===variant)));
    root.querySelectorAll('.learning-progress button').forEach((button,i)=>{button.textContent=(progress.completed.includes(i)?'✓ ':'')+(i+1);button.setAttribute('aria-pressed',String(i===step));});
    if(plan.mode==='activity'){root.querySelector('[data-complete]').textContent=progress.completed.includes(step)?'Etapa concluída — reabrir':'Marcar etapa como discutida';root.querySelector('[data-complete]').setAttribute('aria-pressed',String(progress.completed.includes(step)));root.querySelector('[data-count]').textContent=progress.completed.length+'/'+plan.steps.length+' etapas discutidas';}
  }
  root.querySelector('[data-action=play]').onclick=()=>{playing=!playing;draw();};
  root.querySelector('[data-action=previous]').onclick=()=>{step=Math.max(0,step-1);draw();};
  root.querySelector('[data-action=next]').onclick=()=>{step=Math.min(plan.steps.length-1,step+1);draw();};
  root.querySelector('[data-action=reset]').onclick=()=>{step=0;variant=plan.initialVariant;draw();};
  activeStepMove=direction=>{const next=step+direction;if(next<0||next>=plan.steps.length)return false;step=next;draw();return true;};
  draw();
}
`;
