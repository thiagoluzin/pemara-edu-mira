import {mountAtlasExplorer,ATLAS_EXPLORER_RUNTIME} from './atlasExplorer';
import {ATLAS_LAB_CSS} from './atlasLabStyle';
/** Shared, self-contained lab controller: serialized into the exported HTML as well as mounted in React. */
export function mountAtlasLab(host:HTMLElement,kind:string,variant:number,initial:any={},onChange?:(state:any)=>void,onPause?:()=>void,explorer=mountAtlasExplorer,css=ATLAS_LAB_CSS):()=>void {
 if(!(kind==='respiration'||kind==='statistics'||kind==='separation'&&variant===3))return explorer(host,kind,variant,initial,onChange,onPause);
 const root=host.closest('.learning-canvas') as HTMLElement;
 const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
 const params={breathingRate:clamp(Number(initial.breathingRate??12),6,24),energy:clamp(Number(initial.energy??2),1,3),values:Array.from({length:5},(_,i)=>clamp(Number(initial.values?.[i]??[2,3,3,8,9][i]),0,10))};
 let t=0,mode='evaporation',dead=false,raf=0,last=0,drag=-1;
 const colors=['#5eead4','#7dd3fc','#c4b5fd','#fda4af','#fcd34d'];
 const fmt=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
 const text=(x:number,y:number,s:string,size=19,fill='#dbeafe',anchor='middle')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui,sans-serif">${s}</text>`;
 const path=(d:string,stroke:string,width=3,fill='none',extra='')=>`<path d="${d}" stroke="${stroke}" stroke-width="${width}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
 const circle=(x:number,y:number,r:number,fill:string,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
 const title=kind==='respiration'?'Respirar: um movimento coordenado':kind==='statistics'?'Os dados nas suas mãos':'Do líquido para o ar';
 const hint=kind==='respiration'?'Mude o ritmo e acompanhe o diafragma.':kind==='statistics'?(variant===1||variant===3?'Arraste os pontos ou ajuste os cinco valores.':'Ajuste os cinco valores e acompanhe a organização.'):'Mudar o aquecimento inicia uma nova comparação.';
 host.innerHTML=`<style>${css}</style><div class="atlas-lab" data-lab="${kind}"><div class="atlas-lab-head"><div class="atlas-lab-kicker">Laboratório interativo · Atlas</div><h3>${title}</h3><p>${hint}</p></div><svg class="atlas-lab-motion" viewBox="0 0 700 410" role="group" aria-label="${title}"></svg><div class="atlas-lab-controls" data-settings></div><div class="atlas-lab-controls"><button type="button" data-lab-step>Avançar um passo</button><label>Momento da animação <input aria-label="Momento da animação" data-time type="range" min="0" max="100" value="0"></label><button type="button" data-lab-reset>Restaurar exemplo</button></div><div class="atlas-lab-readout" role="status" aria-live="polite"></div><div class="atlas-lab-foot"></div></div>`;
 const lab=host.querySelector('.atlas-lab') as HTMLElement,svg=lab.querySelector('svg')!,settings=lab.querySelector('[data-settings]')!,readout=lab.querySelector('.atlas-lab-readout')!,foot=lab.querySelector('.atlas-lab-foot')!,timeline=lab.querySelector('[data-time]') as HTMLInputElement;
 const duration=()=>kind==='respiration'?60/params.breathingRate:kind==='statistics'?6:40;
 const progress=()=>clamp(t/duration(),0,1);
 function pause(){onPause?.();root.dataset.running='false';}
 function notify(){onChange?.({breathingRate:params.breathingRate,energy:params.energy,values:[...params.values]});}
 function slider(label:string,key:string,min:number,max:number,value:number){return `<label>${label}: <output data-output="${key}">${fmt(value)}</output><input type="range" aria-label="${label}" data-param="${key}" min="${min}" max="${max}" step="1" value="${value}"></label>`;}
 function controls(){
  settings.innerHTML=kind==='respiration'?slider('Ritmo respiratório','breathingRate',6,24,params.breathingRate):kind==='separation'?slider('Aquecimento relativo','energy',1,3,params.energy)+'<button type="button" data-mode="evaporation" aria-pressed="true">Evaporação</button><button type="button" data-mode="boiling" aria-pressed="false">Comparar ebulição</button>':`<div class="atlas-lab-values">${params.values.map((v,i)=>slider('Valor '+(i+1),String(i),0,10,v)).join('')}</div>`;
 }
 function render(){
  let body='',status='';const p=progress();timeline.value=String(Math.round(p*100));
  if(kind==='respiration'){
   const phase=(p+(variant===2?.5:0))%1,expansion=(1-Math.cos(phase*Math.PI*2))/2,inward=phase<.5;
   const lung=`M331 103C307 97 267 111 242 151C222 185 220 235 235 273C254 298 296 299 332 284Z`;
   if(variant===1){
    body=path('M142 100C40 100 45 280 150 291C255 299 267 116 180 101Z','#67e8f9',4,'#164e63')+path('M458 95C570 89 586 278 470 297L443 285C534 255 529 134 440 126Z','#fb7185',10,'#62283b')+text(154,68,'Alvéolo',23)+text(492,68,'Capilar',23)+path('M290 95V305','#476178',2)+text(350,349,'Trocas pela parede do alvéolo',18);
    for(let i=0;i<4;i++){const f=(p*2+i/4)%1;body+=`<g data-motion-role="oxigenio" transform="translate(${210+240*f},${138+i%2*34})">${circle(0,0,13,'#5eead4')+text(0,5,'O₂',12,'#052e35')}</g><g data-motion-role="gas-carbonico" transform="translate(${450-240*f},${224+i%2*34})">${circle(0,0,17,'#fcd34d')+text(0,5,'CO₂',11,'#422006')}</g>`;}
   }else{
    body=path('M287 65Q265 79 236 96Q192 147 200 288Q215 324 277 330L423 330Q485 324 500 288Q508 147 464 96Q435 79 413 65','#47728b',2,'#16314566')+path('M350 46V111M350 109L295 150M350 109L405 150','#bae6fd',14);
    body+=`<g data-motion-role="pulmoes" transform="translate(350 105) scale(${.84+.16*expansion} ${.82+.18*expansion}) translate(-350 -105)">`+path(lung,'#7dd3fc',3,'#2385a5')+`<g transform="translate(700 0) scale(-1 1)">`+path(lung,'#7dd3fc',3,'#2385a5')+'</g>'+path('M329 136L281 185L262 229M297 169L308 216M371 136L419 185L438 229M403 169L392 216','#b7edf2',4)+'</g>';
    body+=`<g data-motion-role="costelas" transform="translate(350 180) scale(${1+.045*expansion} 1) translate(-350 -180)">`+[0,1,2,3].map(i=>path(`M223 ${140+i*39}Q271 ${164+i*36} 321 ${147+i*36}M379 ${147+i*36}Q429 ${164+i*36} 477 ${140+i*39}`,'#a6c7d745',3)).join('')+'</g>';
    body+=`<g data-motion-role="diafragma" transform="translate(0 ${24*expansion})">`+path(`M208 306Q350 ${250+24*expansion} 492 306`,'#fcd34d',8)+'</g>';
    for(let i=0;i<6;i++){const f=(p*4+i/6)%1,fy=inward?f:1-f;body+=circle(350+(i%2?1:-1)*Math.max(0,fy-.45)*95,65+fy*150,4,'#e0f2fe');}
    body+=text(102,143,'Pulmões',19)+path('M147 141L235 170','#94b7c8',1)+text(104,322,'Diafragma',18)+path('M160 318L219 314','#94b7c8',1)+text(571,164,inward?'Ar entra':'Ar sai',23,'#5eead4')+text(568,196,inward?'Volume aumenta':'Volume diminui',15)+text(350,385,inward?'INSPIRAÇÃO':'EXPIRAÇÃO',20,'#fcd34d');
   }
   status=`${params.breathingRate} ciclos por minuto · ${variant===1?'O₂: alvéolo → sangue. CO₂: sangue → alvéolo.':inward?'Diafragma contrai e desce; o tórax se expande.':'Diafragma relaxa e sobe; o volume torácico diminui.'}`;
   foot.textContent='Anatomia simplificada, sem escala. O controle altera o ritmo do esquema; não é orientação de saúde.';
   lab.dataset.expansion=String(expansion);
  }else if(kind==='separation'){
   const loss=clamp(p*(.3+params.energy*.18),0,.84),surface=172+loss*123;
   body=path('M184 104V322Q350 348 516 322V104','#9acbdc',5)+`<path d="M190 ${surface}Q350 ${surface+7} 510 ${surface}V318Q350 342 190 318Z" fill="#087ea4"/><ellipse cx="350" cy="${surface}" rx="160" ry="9" fill="#38bdf8" opacity=".7" data-motion-role="superficie-agua"/>`;
   for(let i=0;i<24;i++){const x=207+i%8*40+Math.sin(t*params.energy*3+i)*5,y=surface+20+Math.floor(i/8)*(300-surface-20)/3+Math.cos(t*params.energy*2+i)*4;body+=circle(x,y,4,'#a5f3fc');}
   for(let i=0;i<9;i++){const f=(t*(.13+params.energy*.055)+i/9)%1,x=220+i*31+Math.sin(f*5+i)*12,y=surface-8-f*90;body+=`<g data-motion-role="particula-percurso" transform="translate(${x} ${y})">${circle(0,0,4,'#a5f3fc')}</g>`;}
   if(mode==='boiling')for(let i=0;i<9;i++){const f=(t*.55+i/9)%1;body+=`<circle cx="${220+i*30}" cy="${310-f*(310-surface)}" r="${4+f*7}" fill="none" stroke="#b5f0ff" stroke-width="2"/>`;}
   for(let i=0;i<13;i++){const x=216+(i%7)*42+Math.sin(t+i)*3,y=surface+18+(i%3)*(302-surface-18)/3;body+=circle(x,y,5,'#fcd34d','data-solute="salt"');}
   body+=path('M205 365H495','#334155',20)+[0,1,2].map(i=>path(`M${270+i*80} 370q-14 -13 0 -25q14 -12 0 -23`,['#fdba74','#fb923c','#f97316'][params.energy-1],3+params.energy)).join('')+text(350,59,mode==='evaporation'?'Evaporação pela superfície':'Ebulição: bolhas no líquido',24)+text(94,260,'Líquido',17)+path('M126 254L195 255','#94b7c8',1)+text(587,320,'Sal retido',17)+path('M544 315L510 321','#fcd34d',1);
   status=`Água no recipiente: ${Math.round((1-loss)*100)}% do início do esquema · aquecimento ${['baixo','médio','alto'][params.energy-1]}.`;
   foot.textContent=mode==='evaporation'?'Evaporação não exige fervura. Azul: água; dourado: sal dissolvido, que permanece. Partículas ampliadas; vapor invisível. Quantidade e tempo ilustrativos.':'Comparação idealizada: na ebulição formam-se bolhas de vapor dentro do líquido. Dourado: sal dissolvido. Não prevê temperatura, saturação ou tempo de fervura.';
   lab.dataset.remaining=String(1-loss);
  }else{
   const values=params.values,total=values.reduce((a,n)=>a+n,0),mean=total/5,ordered=values.map((n,i)=>({n,i})).sort((a,b)=>a.n-b.n||a.i-b.i),median=ordered[2].n;
   body=path('M65 325H640','#45677e',2);
   if(variant===0){
    body+=text(350,65,'Reunir os valores observados',24);values.forEach((n,i)=>{const y=220+(i%2?1:-1)*70*(1-p);body+=`<g data-motion-role="organizar-dados" transform="translate(${90+i*112} ${y})"><rect x="0" y="-33" width="74" height="66" rx="18" fill="#18354b" stroke="${colors[i]}" stroke-width="2"/>${text(37,9,fmt(n),30,colors[i])}</g>`;});
   }else if(variant===2){
    body+=text(350,57,'Ordene os valores e encontre o centro',22)+text(350,88,'O terceiro valor é a mediana',16,'#9bb8ca');
    values.forEach((n,i)=>{const end=ordered.findIndex(e=>e.i===i),f=clamp((p-.3)/.4,0,1),x=90+i*112+(end-i)*112*f,lift=p<.3?p/.3:p>.7?(1-p)/.3:1,y=292-lift*(175-i*29);body+=`<g data-motion-role="ordenar-dados" transform="translate(${x} ${y})"><rect x="0" y="-28" width="74" height="50" rx="14" fill="${end===2?'#785720':'#18354b'}" stroke="${end===2?'#fcd34d':colors[i]}" stroke-width="2"/>${text(37,5,fmt(n),25)}</g>`;});
    body+=path('M351 329V352','#fcd34d',3)+text(351,382,'Posição central',17,'#fcd34d');
   }else{
    for(let j=0;j<=10;j+=2){const y=325-j*23;body+=path(`M65 ${y}H640`,'#294254',1)+text(46,y+6,String(j),14,'#8caec2');}
    values.forEach((n,i)=>{const h=variant===1?n+(mean-n)*p:variant===3?n*(.08+.92*p):n,x=101+i*112,y=325-h*23;body+=`<g data-motion-role="${variant===1?'redistribuir':'construir-barra'}"><rect x="${x}" y="${y}" width="55" height="${Math.max(.1,h*23)}" rx="8" fill="${colors[i]}" opacity=".8"/><circle data-drag="${i}" role="slider" tabindex="0" aria-label="Arrastar valor ${i+1}" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${n}" cx="${x+27}" cy="${y}" r="11" fill="${colors[i]}" stroke="#082232" stroke-width="3"/></g>`+text(x+27,357,fmt(n),21,colors[i]);});
    if(variant===1)body+=path(`M65 ${325-mean*23}H640`,'#fcd34d',2,'none','stroke-dasharray="7 6"')+text(350,52,'Redistribuir sem alterar a soma',22);
    else body+=text(350,52,'Cinco observações · arraste para experimentar',21);
   }
   status=`Soma ${fmt(total)} ÷ 5 = média ${fmt(mean)}. Mediana ${fmt(median)}. Ordem: ${ordered.map(e=>fmt(e.n)).join(' · ')}.`;
   foot.textContent=variant===1?'A altura total das barras é conservada durante a redistribuição. Os números abaixo mostram os valores originais.':'Valores fictícios de 0 a 10. Altere um valor extremo e compare o efeito na média e na mediana.';
   lab.dataset.mean=String(mean);lab.dataset.median=String(median);lab.dataset.total=String(total);
  }
  if(readout.textContent!==status)readout.textContent=status;svg.innerHTML=body;lab.dataset.time=String(t);lab.dataset.variant=String(variant);
 }
 function changeValue(key:string,value:number){
  if(kind==='statistics'){params.values[Number(key)]=clamp(Math.round(value),0,10);t=variant===3?duration():0;}else if(key==='breathingRate'){const p=progress();params.breathingRate=clamp(value,6,24);t=p*duration();}else {params.energy=clamp(value,1,3);t=0;}
  const output=lab.querySelector(`[data-output="${key}"]`);if(output)output.textContent=fmt(value);const input=lab.querySelector(`[data-param="${key}"]`) as HTMLInputElement;if(input)input.value=String(value);notify();render();
 }
 function input(e:Event){const input=e.target as HTMLInputElement;if(input.matches('[data-param]')){pause();changeValue(input.dataset.param!,Number(input.value));}if(input.matches('[data-time]')){pause();t=Number(input.value)/100*duration();render();}}
 function click(e:Event){const target=(e.target as Element).closest('button');if(!target)return;if(target.hasAttribute('data-lab-step')){pause();t=Math.min(duration(),t+duration()/12);render();}if(target.hasAttribute('data-lab-reset')){pause();t=0;params.breathingRate=12;params.energy=2;params.values=[2,3,3,8,9];mode='evaporation';controls();notify();render();}if(target.hasAttribute('data-mode')){pause();mode=target.getAttribute('data-mode')!;t=0;settings.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-mode')===mode)));render();}}
 function down(e:PointerEvent){const node=(e.target as Element).closest('[data-drag]');if(!node)return;e.preventDefault();pause();drag=Number(node.getAttribute('data-drag'));lab.setPointerCapture(e.pointerId);}
 function move(e:PointerEvent){if(drag<0)return;const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const local=pt.matrixTransform(svg.getScreenCTM()!.inverse());changeValue(String(drag),(325-local.y)/23);}
 function up(){drag=-1;}
 function key(e:KeyboardEvent){const node=(e.target as Element).closest('[data-drag]');if(!node||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();pause();const i=Number(node.getAttribute('data-drag'));changeValue(String(i),params.values[i]+(['ArrowUp','ArrowRight'].includes(e.key)?1:-1));(svg.querySelector(`[data-drag="${i}"]`) as SVGElement)?.focus();}
 controls();render();lab.addEventListener('input',input);lab.addEventListener('click',click);lab.addEventListener('pointerdown',down);lab.addEventListener('pointermove',move);lab.addEventListener('pointerup',up);lab.addEventListener('pointercancel',up);lab.addEventListener('keydown',key);
 function tick(now:number){if(dead)return;const delta=Math.min(.05,(now-(last||now))/1000);last=now;if(root.dataset.running==='true'&&!document.hidden){t+=delta;if(t>duration()){if(kind==='separation'){t=duration();pause();}else t%=duration();}render();}raf=requestAnimationFrame(tick);}
 raf=requestAnimationFrame(tick);
 return ()=>{dead=true;cancelAnimationFrame(raf);lab.removeEventListener('input',input);lab.removeEventListener('click',click);lab.removeEventListener('pointerdown',down);lab.removeEventListener('pointermove',move);lab.removeEventListener('pointerup',up);lab.removeEventListener('pointercancel',up);lab.removeEventListener('keydown',key);};
}
export const ATLAS_LAB_RUNTIME=ATLAS_EXPLORER_RUNTIME+`const mountAtlasLab=(()=>{const __name=(fn)=>fn;const mount=${mountAtlasLab.toString()};return (host,kind,variant,initial,onChange,onPause)=>mount(host,kind,variant,initial,onChange,onPause,mountAtlasExplorer,ATLAS_LAB_CSS);})();`;
