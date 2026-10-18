import {ATLAS} from './atlas';
import {ATLAS_REVIEW} from './atlasReview';
import {ATLAS_LAB_CSS} from './atlasLabStyle';

export const EXPLORER_MODELS:Record<string,{name:string;action:string;caption:string;variants:readonly string[]}>=Object.fromEntries([
 ...ATLAS.map(p=>[p.id,{name:p.name,caption:p.caption,variants:p.variants,action:(ATLAS_REVIEW as any)[p.id]?.action||(p.id==='moon_phases'?'Compare a mudança da parte iluminada ao longo do ciclo.':'Compare o deslocamento relativo das placas e as marcas na superfície.')}]),
 ['movement',{name:'Corpo em movimento',variants:['Braços','Caminhada','Equilíbrio'],action:'Acompanhe os ombros, cotovelos, quadris e joelhos. Compare duas posições do gesto.',caption:'Modelo articulado para observação. Não prescreve exercício nem avalia a execução de uma pessoa.'}]
]);

/** Keeps the reviewed geometry, with one deterministic clock for native animation effects.
 * The exact same controller is serialized into the standalone HTML. */
export function mountAtlasExplorer(host:HTMLElement,kind:string,variant:number,initial:any={},onChange?:(state:any)=>void,onPause?:()=>void,models=EXPLORER_MODELS,css=ATLAS_LAB_CSS):()=>void{
 const model=models[kind];if(!model)return()=>{};
 const root=host.closest('.learning-canvas') as HTMLElement;
 const original=host.querySelector('svg')?.outerHTML||'';if(!original)return()=>{};
 const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,Number.isFinite(n)?n:min));
 const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const safe=initial&&typeof initial==='object'?initial:{};
 const defaults={speed:1,tempo:60,angle:40,index:1.5,x:2,y:3,event:'even',subject:'A turma',predicate:'investigou o tema.'};
 const params={...defaults,...safe,speed:clamp(Number(safe.speed??1),.25,2),tempo:clamp(Number(safe.tempo??60),40,160),angle:clamp(Number(safe.angle??40),10,70),index:clamp(Number(safe.index??1.5),1,2),x:clamp(Number(safe.x??2),1,4),y:clamp(Number(safe.y??3),1,3),event:['even','greater','one'].includes(safe.event)?safe.event:'even',subject:String(safe.subject??defaults.subject).slice(0,32),predicate:String(safe.predicate??defaults.predicate).slice(0,40)};
 let t=0,duration=6,dead=false,raf=0,last=0,repeat=true,compare=false;
 let animations:Animation[]=[],ghost:SVGElement|null=null;
 host.innerHTML=`<style>${css}
 .atlas-explorer .atlas-scene{position:relative;min-width:0;grid-column:1;grid-row:2;align-self:center}.atlas-explorer .atlas-scene>svg{height:340px;max-height:340px;width:100%}.atlas-explorer .atlas-ghost{position:absolute;inset:0;opacity:.3;pointer-events:none}.atlas-explorer [data-settings]{display:flex;flex-direction:column;align-items:stretch;justify-content:center}.atlas-explorer .atlas-lab-foot{line-height:1.5}.atlas-explorer select,.atlas-explorer input[type=text]{width:100%;min-width:0;color:#e2e8f0;background:#0b192b;border:1px solid #52728b;border-radius:7px;padding:7px;font-size:13px}.atlas-explorer label{flex:unset;min-width:0}.atlas-explorer [data-settings] label{display:block}.atlas-explorer output{float:right;color:#5eead4}.atlas-explorer [data-settings] button{width:100%}.atlas-explorer .atlas-observe{color:#fcd34d}.atlas-explorer [data-stage-label]{font-variant-numeric:tabular-nums}.atlas-explorer .atlas-lab-readout{min-height:52px}.atlas-explorer :focus-visible{outline:2px solid #fcd34d;outline-offset:3px}
 .atlas-explorer .atlas-lab-controls:not([data-settings]) label{flex:1}
 .learning-canvas:has(.atlas-explorer)>h2{font-size:24px;margin:4px 0 8px}.learning-canvas:has(.atlas-explorer)>.learning-playback{margin:6px 0}.learning-canvas:has(.atlas-explorer)>.learning-variants{margin:6px 0 10px}.atlas-explorer .atlas-lab-head{padding:12px 16px}.atlas-explorer .atlas-lab-head h3,.atlas-explorer .atlas-lab-kicker{display:none}.atlas-explorer .atlas-scene>svg{height:280px;max-height:280px}
 @media(max-width:899px){.atlas-explorer .atlas-scene>svg{height:auto;min-height:235px}.atlas-explorer [data-settings]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.atlas-explorer .atlas-scene{grid-row:auto}.atlas-explorer [data-settings] label{font-size:13px}}@media(max-width:899px) and (max-height:800px){.atlas-explorer .atlas-lab-head{display:none}.atlas-explorer .atlas-scene>svg{height:220px;min-height:200px;max-height:220px}}@media print{.atlas-explorer .atlas-lab-controls{display:none}}
 </style><div class="atlas-lab atlas-explorer" data-controller="native" data-lab="${esc(kind)}"><div class="atlas-lab-head"><div class="atlas-lab-kicker">Laboratório interativo · Atlas</div><h3>${esc(model.name)}</h3><p>${esc(model.action)}</p></div><div class="atlas-scene"></div><div class="atlas-lab-controls" data-settings></div><div class="atlas-lab-controls"><button type="button" data-ex-step>Avançar um passo</button><label>${kind==='moon_phases'?'Posição no ciclo':kind==='tectonics'?'Deslocamento relativo':'Momento da demonstração'} <input data-ex-time type="range" min="0" max="100" step="1" value="0" aria-label="Momento da demonstração"></label><button type="button" data-ex-reset>Restaurar exemplo</button></div><div class="atlas-lab-readout" role="status" aria-live="polite"></div><div class="atlas-lab-foot"></div></div>`;
 const lab=host.querySelector('.atlas-lab') as HTMLElement,stage=lab.querySelector('.atlas-scene')!,settings=lab.querySelector('[data-settings]')!,readout=lab.querySelector('.atlas-lab-readout')!,foot=lab.querySelector('.atlas-lab-foot')!,timeline=lab.querySelector('[data-ex-time]') as HTMLInputElement;
 const tx=(x:number,y:number,s:string,size=19,fill='#e2e8f0')=>`<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-size="${size}" font-family="system-ui,sans-serif">${esc(s)}</text>`;
 const line=(d:string,color='#64748b',width=3,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
 const dot=(x:number,y:number,r=8,color='#fcd34d')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
 const flow=(d:string,role:string)=>`<g data-motion-role="${role}" class="atlas-process-flow" style="offset-path:path('${d}');animation-duration:6s">${dot(0,0)}</g>`;
 const frame=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 380" role="img" aria-label="${esc(model.name)}">${body}</svg>`;
 const num=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
 function customDiagram():string|null{
  if(kind==='optics'){
   const a=params.angle*Math.PI/180,b=Math.asin(Math.sin(a)/params.index),sx=310-180*Math.sin(a),sy=205-180*Math.cos(a),ex=variant===2?310+140*Math.sin(b):310+180*Math.sin(a),ey=variant===2?205+140*Math.cos(b):sy;
   const route=`M${sx} ${sy}L310 205`+(variant?`L${ex} ${ey}`:'');
   lab.dataset.refractedAngle=String(b*180/Math.PI);
   return frame(tx(310,30,variant===2?'Refração: do ar para outro meio':variant===1?'Reflexão: ângulos iguais':'Incidência: ângulo com a normal',22)+(variant===2?'<rect x="40" y="205" width="540" height="140" fill="#164e63"/>':'')+line('M40 205H580','#94a3b8',4)+line('M310 48V346','#9fbad0',2,'stroke-dasharray="5 6"')+line(route,'#fcd34d',4)+flow(route,'frente-luminosa')+tx(355,70,'Normal',14)+tx(100,180,'Ar · n = 1',15)+tx(498,315,variant===2?'n = '+num(params.index):'Superfície',16)+tx(120,70,num(params.angle)+'°',22,'#5eead4')+tx(310,370,variant===2?'Ângulo refratado: '+num(b*180/Math.PI)+'°':variant===1?'Reflexão: '+num(params.angle)+'°':'Ajuste o ângulo de chegada',18));
  }
  if(kind==='coordinates'){
   const x=params.x*(variant===1||variant===2?-1:1),y=params.y*(variant>1?-1:1),px=310+x*54,py=190-y*40;
   lab.dataset.point=JSON.stringify([x,y]);
   return frame(tx(310,30,`Construir o ponto (${x}, ${y})`,23)+Array.from({length:9},(_,i)=>line(`M${94+i*54} 55V325`,'#20394d',1)+tx(94+i*54,211,String(i-4),12)).join('')+Array.from({length:7},(_,i)=>line(`M65 ${70+i*40}H555`,'#20394d',1)+(i===3?'':tx(291,75+i*40,String(3-i),12))).join('')+line('M60 190H560M310 52V325','#9fbad0',2)+line(`M310 190H${px}V${py}`,'#5eead4',2,'stroke-dasharray="6 6"')+`<circle cx="${px}" cy="${py}" r="13" fill="none" stroke="#fcd34d" stroke-width="2"/>`+flow(`M310 190H${px}V${py}`,'ponto-construcao')+tx(572,184,'x',17)+tx(328,61,'y',17)+tx(310,365,'Primeiro x; depois y. O quadrante define os sinais.',16));
  }
  if(kind==='probability'){
   const favorable=(n:number)=>params.event==='even'?n%2===0:params.event==='greater'?n>4:n===1,yes=[1,2,3,4,5,6].filter(favorable),no=[1,2,3,4,5,6].filter(n=>!favorable(n));lab.dataset.probability=String(yes.length/6);
   return frame(tx(310,32,variant===0?'Seis resultados possíveis':'Separar e contar os resultados',23)+(variant?tx(310,85,'Favoráveis: '+yes.join(', '),18,'#fcd34d'):'')+[1,2,3,4,5,6].map((n,i)=>{const ok=favorable(n),arr=ok?yes:no,endX=variant?310-(arr.length-1)*40+arr.indexOf(n)*80:105+i*82,endY=variant?(ok?140:255):190,x=105+i*82,y=variant?190:110;return `<g data-motion-role="${ok?'favoravel':'nao-favoravel'}" class="atlas-process" style="--ax:0px;--ay:0px;--bx:${endX-x}px;--by:${endY-y}px;--asx:1;--asy:1;--bsx:1;--bsy:1;--ar:0deg;--br:0deg"><rect x="${x-26}" y="${y-27}" width="52" height="54" rx="10" fill="${ok?'#14565e':'#182d43'}" stroke="${ok?'#fcd34d':'#7694ae'}" stroke-width="2"/>${tx(x,y+8,String(n),26)}</g>`;}).join('')+tx(310,335,`P(evento) = ${yes.length}/6 = ${num(yes.length/6*100)}%`,21,'#5eead4')+tx(310,368,'Dado ideal. Organiza possibilidades; não simula sorteios.',15));
  }
  if(kind==='sentence'){
   const card=(x:number,label:string,color:string,role:string,active:boolean)=>{const words=label.split(' ');let rows=[''];for(const word of words){if((rows.at(-1)!.length+word.length)>19)rows.push(word);else rows[rows.length-1]+=(rows.at(-1)?' ':'')+word;}return `<g data-motion-role="${role}" class="atlas-process" style="--ax:0px;--ay:${active?-70:0}px;--bx:0px;--by:0px;--asx:1;--asy:1;--bsx:1;--bsy:1;--ar:0deg;--br:0deg"><rect x="${x}" y="155" width="244" height="125" rx="16" fill="#142e43" stroke="${color}" stroke-width="3"/>${rows.slice(0,3).map((s,i)=>tx(x+122,191+i*27,s,19)).join('')}</g>`;};
   return frame(tx(310,34,'Monte a oração do seu exemplo',23)+card(52,params.subject,'#5eead4','sujeito',variant!==2)+card(324,params.predicate,'#c4b5fd','predicado',variant!==1)+tx(174,313,'Sujeito',18,'#5eead4')+tx(446,313,'Predicado',18,'#c4b5fd')+tx(310,365,'O professor fornece os termos; não há análise automática.',15));
  }
  return null;
 }
 function pause(){onPause?.();root.dataset.running='false';}
 function notify(){onChange?.({...params});}
 function slider(label:string,key:string,min:number,max:number,step:number,value:number){return `<label>${label}<output data-out="${key}">${num(value)}</output><input aria-label="${label}" data-ex-param="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;}
 function controls(){
  settings.innerHTML=(kind==='rhythm'?slider('Andamento (BPM)','tempo',40,160,5,params.tempo):slider('Velocidade da demonstração','speed',.25,2,.25,params.speed))+
   (kind==='optics'?slider('Ângulo de incidência (°)','angle',10,70,1,params.angle)+(variant===2?slider('Índice do segundo meio','index',1,2,.05,params.index):''):kind==='coordinates'?slider('Distância horizontal |x|','x',1,4,1,params.x)+slider('Distância vertical |y|','y',1,3,1,params.y):kind==='probability'?`<label>Evento<select data-ex-param="event" aria-label="Evento"><option value="even">Número par</option><option value="greater">Maior que 4</option><option value="one">Número 1</option></select></label>`:kind==='sentence'?`<label>Sujeito do exemplo<input type="text" maxlength="32" data-ex-param="subject" aria-label="Sujeito do exemplo" value="${esc(params.subject)}"></label><label>Predicado do exemplo<input type="text" maxlength="40" data-ex-param="predicate" aria-label="Predicado do exemplo" value="${esc(params.predicate)}"></label>`:'')+
   '<button type="button" data-ex-compare aria-pressed="false">Comparar com início</button><button type="button" data-ex-repeat aria-pressed="true">Repetição ligada</button>';
  const event=settings.querySelector('select');if(event)event.value=params.event;
 }
 function build(){
  animations.forEach(a=>a.cancel());animations=[];ghost=null;
  stage.innerHTML=customDiagram()||original;
  const svg=stage.querySelector('svg')!;svg.classList.add('atlas-lab-motion');
  // Frame background joins the lab surface; textual content and reviewed paths are preserved.
  const bg=svg.querySelector(':scope>rect[width="620"][height="380"]');if(bg)bg.setAttribute('fill','transparent');
  const allowed=root.dataset.motionAllowed;root.dataset.motionAllowed='true';
  const cssAnimations=svg.getAnimations({subtree:true});
  const records=cssAnimations.map(a=>{const effect=a.effect as KeyframeEffect;return{element:effect.target!,frames:effect.getKeyframes(),timing:effect.getTiming()};});
  records.forEach(r=>(r.element as HTMLElement).style.setProperty('animation','none','important'));
  cssAnimations.forEach(a=>a.cancel());
  animations=records.map(r=>{const a=r.element.animate(r.frames,r.timing);a.pause();a.currentTime=0;return a;});
  if(allowed===undefined)delete root.dataset.motionAllowed;else root.dataset.motionAllowed=allowed;
  duration=Math.max(1,...records.map(r=>Number(r.timing.duration)/1000));
  lab.dataset.animationCount=String(animations.length);lab.dataset.duration=String(duration);
  // Capture the real initial transforms, including path motion, for the comparison overlay.
  if(compare)makeGhost();render();
 }
 function makeGhost(){
  ghost?.remove();const source=stage.querySelector('svg')!;
  const old=animations.map(a=>a.currentTime);animations.forEach(a=>a.currentTime=0);
  ghost=source.cloneNode(true) as SVGElement;ghost.classList.add('atlas-ghost');ghost.setAttribute('aria-hidden','true');ghost.removeAttribute('role');
  const originals=[source,...source.querySelectorAll('*')],copies=[ghost,...ghost.querySelectorAll('*')];
  originals.forEach((el,i)=>{const style=getComputedStyle(el),copy=copies[i] as SVGElement;copy.style.setProperty('animation','none','important');['transform','transform-origin','transform-box','offset-path','offset-distance','offset-rotate','opacity','stroke-dashoffset','fill'].forEach(k=>copy.style.setProperty(k,style.getPropertyValue(k)));copy.removeAttribute('id');copy.removeAttribute('data-motion-role');copy.removeAttribute('data-plate');copy.removeAttribute('data-joint');copy.removeAttribute('tabindex');});
  animations.forEach((a,i)=>a.currentTime=old[i]);stage.append(ghost);
 }
 function render(){
  // The controls own time. Paused native effects still respond deterministically to currentTime.
  const ms=Math.min(t,duration-.00001)*1000;animations.forEach(a=>a.currentTime=ms);
  timeline.value=String(Math.round(t/duration*100));lab.dataset.time=String(t);lab.dataset.variant=String(variant);
  readout.setAttribute('aria-live',root.dataset.running==='true'?'off':'polite');
  const progress=Math.round(t/duration*100),text=`${model.variants[variant]} · ${progress}% do percurso${compare?' · posição inicial sobreposta em transparência':''}.`;
  if(readout.textContent!==text)readout.textContent=text;
  foot.textContent=kind==='optics'?'Ângulos medidos em relação à normal. Refração calculada por n₁ sen θ₁ = n₂ sen θ₂, com n₁ = 1. Propagação visual muito desacelerada.':kind==='coordinates'?'Use o quadrante para mudar os sinais e os controles para mudar as distâncias. A velocidade altera apenas a demonstração.':kind==='probability'?'Seis faces igualmente prováveis. A alteração do evento muda os resultados favoráveis; não muda a chance de cada face.':kind==='sentence'?'Textos fornecidos pelo professor. O movimento organiza as partes; não verifica concordância nem classifica automaticamente a oração.':kind==='rhythm'?'Um compasso de quatro tempos. BPM controla o pulso visual. Não há reprodução de áudio.':model.caption+' Velocidade apenas ilustrativa.';
 }
 function input(e:Event){const target=e.target as HTMLInputElement;if(target.matches('[data-ex-time]')){pause();t=Number(target.value)/100*duration;render();return;}if(!target.matches('[data-ex-param]'))return;
  pause();const key=target.dataset.exParam!;if(['event','subject','predicate'].includes(key)){(params as any)[key]=target.value.slice(0,key==='predicate'?40:32);}else (params as any)[key]=Number(target.value);
  const out=settings.querySelector(`[data-out="${key}"]`);if(out)out.textContent=num(Number(target.value));
  if(!['speed','tempo'].includes(key)){t=0;build();}notify();render();
 }
 function click(e:Event){const button=(e.target as Element).closest('button');if(!button)return;
  if(button.hasAttribute('data-ex-step')){pause();t=Math.min(duration,t+duration/12);render();}
  if(button.hasAttribute('data-ex-reset')){pause();Object.assign(params,defaults);t=0;compare=false;repeat=true;controls();build();notify();}
  if(button.hasAttribute('data-ex-compare')){pause();compare=!compare;button.setAttribute('aria-pressed',String(compare));if(compare)makeGhost();else{ghost?.remove();ghost=null;}render();}
  if(button.hasAttribute('data-ex-repeat')){repeat=!repeat;button.setAttribute('aria-pressed',String(repeat));button.textContent=repeat?'Repetição ligada':'Repetição desligada';}
 }
 controls();build();lab.addEventListener('input',input);lab.addEventListener('change',input);lab.addEventListener('click',click);
 function tick(now:number){if(dead)return;const dt=Math.min(.05,(now-(last||now))/1000);last=now;if(root.dataset.running==='true'&&!document.hidden){if(t>=duration)t=0;t+=dt*(kind==='rhythm'?params.tempo/60:params.speed);if(t>=duration){if(repeat)t%=duration;else{t=duration;pause();}}render();}raf=requestAnimationFrame(tick);}
 raf=requestAnimationFrame(tick);
 return()=>{dead=true;cancelAnimationFrame(raf);animations.forEach(a=>a.cancel());lab.removeEventListener('input',input);lab.removeEventListener('change',input);lab.removeEventListener('click',click);};
}

export const ATLAS_EXPLORER_RUNTIME=`const EXPLORER_MODELS=${JSON.stringify(EXPLORER_MODELS)};const ATLAS_LAB_CSS=${JSON.stringify(ATLAS_LAB_CSS)};const mountAtlasExplorer=(()=>{const __name=(fn)=>fn;const mount=${mountAtlasExplorer.toString()};return (host,kind,variant,initial,onChange,onPause)=>mount(host,kind,variant,initial,onChange,onPause,EXPLORER_MODELS,ATLAS_LAB_CSS);})();`;
