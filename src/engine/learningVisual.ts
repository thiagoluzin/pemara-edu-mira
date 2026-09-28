import {teachingDiagram,type TeachingVisual} from './teachingVisual';
import type {LessonMeta, Scene, Subject, TextScene, SummaryScene} from '../types/lesson';
import {biologySvg} from './biologyModel';

export type LearningKind = 'cell'|'organization'|'fractions'|'number_line'|'timeline'|'particles'|'circuit'|'water_cycle'|'geometry'|'earth_layers'|'orbit'|'language'|'movement'|'colors'|'concepts';
export interface LearningPlan {
  visual?:TeachingVisual;
  title:string; subject:Subject; kind:LearningKind;
  mode:'concept'|'example'|'activity'|'summary';
  steps:string[]; labels:string[]; variants:string[]; initialVariant:number;
  caption:string; denominator:number; source:string[];
  years:number[];
}
export const escapeLearning = (s:string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const isLearningScene = (scene:Scene):scene is TextScene|SummaryScene => scene.type==='text'||scene.type==='summary';

export function createLearningPlan(scene:TextScene|SummaryScene,meta?:Partial<LessonMeta>):LearningPlan {
  const source=scene.type==='summary'?[...scene.takeaways,...(scene.next_steps?[scene.next_steps]:[])]:[
    ...(Array.isArray(scene.content)?scene.content:[String(scene.content||'')]),...(scene.bullets||[]),...(scene.callout?[scene.callout]:[])];
  const unique=[...new Set(source.filter(s=>typeof s==='string'&&s.trim()))];
  // Sentenças completas, sem truncar conteúdo; a versão integral continua disponível.
  const steps=scene.visual?source.filter(s=>typeof s==='string'&&s.trim()):unique.flatMap(s=>s.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/u)).filter(Boolean);
  if(!steps.length) steps.push(scene.title);
  const subject=meta?.subject||'science';
  const local=norm([scene.title,...unique].join(' '));
  const scope=local; // O assunto geral não deve impor o mesmo desenho a todas as páginas.
  const years=[...new Set((local.match(/\b(?:1[0-9]{3}|20[0-9]{2})\b/g)||[]).map(Number))].sort((a,b)=>a-b);
  const mode=scene.type==='summary'?'summary':/^atividade\b/i.test(scene.title)?'activity':/^exemplo\b/i.test(scene.title)?'example':'concept';
  let kind:LearningKind='concepts',variants:string[]=[],caption='Quadro de estudo: cada cartão abre uma ideia do conteúdo. A disposição não representa relações de causa e efeito.';
  let denominator=8,initialVariant=3;
  if(['science','biology'].includes(subject)&&/celul|citoplasma|membrana|tecido/.test(scope)) {
    if(/(?:tecidos?.*orgaos?|organiza[cç]ao|celula ao organismo|sistemas.*organismo)/.test(local)){
      kind='organization';variants=['Célula','Tecido','Órgão','Sistema','Organismo'];initialVariant=0;
      caption='Explore os níveis de organização. A sequência não representa uma célula se transformando em um organismo.';
    }else{kind='cell';variants=['Animal','Vegetal','Bactéria'];initialVariant=0;caption='Compare os modelos: animal e vegetal têm núcleo delimitado; a bactéria não. Estruturas, tamanhos e movimentos são esquemáticos.';}
  }else if(['science','geography'].includes(subject)&&/camadas.*terra|estrutura.*terra|rochas|litosfera|manto|nucleo terrestre/.test(scope)){
    kind='earth_layers';variants=['Crosta','Manto','Núcleo externo','Núcleo interno'];initialVariant=0;caption='Corte esquemático da Terra. Selecione uma camada para localizá-la. Espessuras ilustrativas, sem escala real.';
  }else if(['science','geography','physics'].includes(subject)&&/sistema solar|translacao|rotacao.*terra|terra.*sol|terra.*movimentos/.test(scope)){
    kind='orbit';variants=['Órbita completa','Posição 1','Posição 2','Posição 3','Posição 4'];initialVariant=0;caption='Modelo simplificado da translação da Terra ao redor do Sol, sem escala real. A rotação ocorre em torno do próprio eixo; esta órbita não representa a causa das estações.';
  }else if(['science','chemistry','physics'].includes(subject)&&/circuit|corrente eletrica|condutor.*eletric/.test(scope)){
    kind='circuit';variants=['Circuito aberto','Circuito fechado'];initialVariant=0;caption='Feche o circuito e observe o caminho da corrente convencional. Modelo qualitativo de pilha, interruptor e lâmpada.';
  }else if(['science','chemistry','physics'].includes(subject)&&/estado.*fisic|solido.*liquido|particulas|transformacoes.*materia/.test(scope)){
    kind='particles';variants=['Sólido','Líquido','Gás'];initialVariant=0;caption='Altere o estado e compare arranjo e mobilidade das partículas. Esquema sem escala, não simulação quantitativa.';
  }else if(['science','geography'].includes(subject)&&/ciclo.*agua|evapora.*condensa/.test(scope)){
    kind='water_cycle';variants=['Evaporação','Condensação','Precipitação','Escoamento'];initialVariant=0;caption='Percorra os processos do ciclo da água. A água pode seguir diferentes caminhos no ambiente.';
  }else if(subject==='math'&&/fraco|fracao|porcent|racionais|decimais/.test(scope)){
    kind='fractions';const fraction=local.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
    if(fraction&&Number(fraction[2])>=2&&Number(fraction[2])<=16&&Number(fraction[1])<=Number(fraction[2])){denominator=Number(fraction[2]);initialVariant=Number(fraction[1]);}
    variants=Array.from({length:denominator+1},(_,n)=>`${n}/${denominator}`);
    caption='Laboratório de partes iguais: altere a parte destacada e compare fração, escrita decimal e porcentagem. Os valores manipulados não são um gabarito da atividade.';
  }else if(subject==='math'&&/inteiros|reta numerica/.test(scope)){
    kind='number_line';variants=Array.from({length:21},(_,i)=>String(i-10));initialVariant=10;caption='Desloque o marcador e compare posições na reta numérica. Os valores são exploratórios, não um gabarito do enunciado.';
  }else if(subject==='history'&&years.length>=2){
    kind='timeline';variants=years.map(String);initialVariant=0;caption='Linha do tempo com os anos mencionados nesta página, em ordem cronológica. Consulte o conteúdo para interpretar cada referência.';
  }else if(['math','arts'].includes(subject)&&/triang|poligon|geometr|figuras|formas|angul/.test(scope)){
    kind='geometry';variants=['Triângulo','Quadrilátero','Pentágono','Hexágono'];initialVariant=0;caption='Compare lados e vértices dos polígonos regulares. Estes modelos exploratórios não substituem as medidas do enunciado.';
  }else if(subject==='arts'&&/luz|rgb|tela|digital/.test(scope)){
    kind='colors';variants=['Vermelho e verde','Verde e azul','Azul e vermelho','As três luzes'];initialVariant=0;caption='Mistura aditiva de luzes vermelha, verde e azul, como em uma tela. Não representa mistura de tintas ou pigmentos.';
  }else if(['portuguese','english'].includes(subject)){
    kind='language';variants=['Organizar','Relacionar','Interpretar'];initialVariant=0;caption='Percurso de leitura e produção: observe a organização, as relações e o sentido. O esquema orienta a análise do conteúdo ao lado; não classifica palavras automaticamente.';
  }else if(subject==='physical_education'){
    kind='movement';variants=['Posição inicial','Deslocamento','Equilíbrio'];initialVariant=0;caption='Figura articulada para observar posições e coordenação. Esquema exploratório, sem prescrição de exercício ou avaliação corporal.';
  }
  if(scene.visual){kind='concepts';variants=[];caption=scene.visual.caption;}
  return {visual:scene.visual,title:scene.title,subject,kind,mode,steps,labels:steps.map((s,i)=>`${i+1}. ${s.length>66?s.slice(0,63)+'…':s}`),variants,initialVariant,denominator,caption,source:unique,years};
}

export const LEARNING_CSS=`
.learning-canvas{--lc-accent:#22d3ee;color:#e2e8f0;background:linear-gradient(135deg,#0b1224,#101a31);border:1px solid #334155;border-radius:20px;padding:clamp(14px,2vw,26px);width:100%;box-sizing:border-box;container-type:inline-size}
.learning-canvas *{box-sizing:border-box}.learning-canvas h2{font-size:clamp(23px,2.5vw,34px);line-height:1.2;color:#f8fafc;margin:6px 0 16px}.learning-eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.13em;color:#67e8f9;font-weight:700}
.learning-stage{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,1fr);gap:22px;align-items:center}.learning-art{min-width:0;background:#02061780;border-radius:16px;border:1px solid #1e293b;overflow:hidden}.learning-art svg{display:block;width:100%;height:auto;max-height:340px}.learning-reading{min-width:0;border-left:3px solid var(--lc-accent);padding:10px 0 10px 20px}.learning-reading h3{margin:0 0 12px;font-size:16px;color:#fbbf24}.learning-reading p{font-size:clamp(17px,1.65vw,22px);line-height:1.55;margin:0;overflow-wrap:anywhere}.learning-actions,.learning-variants{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0}.learning-canvas button{font:inherit;font-size:14px;padding:9px 13px;color:#f8fafc;background:#1e293b;border:1px solid #475569;border-radius:9px;cursor:pointer;transition:background .15s}.learning-canvas button[aria-pressed=true]{background:#155e75;border-color:#22d3ee}.learning-canvas button:disabled{opacity:.4;cursor:default}.learning-canvas button:focus-visible,.learning-canvas summary:focus-visible{outline:3px solid #fbbf24;outline-offset:3px}.learning-canvas .learning-primary{background:#155e75;border-color:#22d3ee}.learning-caption{font-size:13px;line-height:1.45;color:#a5b4cc;margin:8px 0}.learning-progress{display:flex;gap:5px;flex-wrap:wrap}.learning-progress button{min-width:34px;padding:5px}.learning-canvas details{margin-top:14px;border-top:1px solid #334155;padding-top:10px;font-size:14px;line-height:1.5}.learning-canvas summary{cursor:pointer;color:#cbd5e1}.learning-canvas details p{margin:12px 0}.learning-canvas input[type=range]{width:min(260px,60%)}
.semantic-highlight{animation:semantic-emphasis 1.8s ease-in-out infinite;animation-play-state:paused}.learning-canvas[data-running=true] .semantic-highlight{animation-play-state:running}@keyframes semantic-emphasis{50%{stroke-opacity:.45}}
.learning-trace{stroke-dasharray:12 8;animation:learning-travel 3s linear infinite;animation-play-state:paused}.learning-particle{animation:learning-jitter 2s ease-in-out infinite alternate;animation-play-state:paused;transform-box:fill-box;transform-origin:center}.learning-flow{animation:learning-flow 3s linear infinite;animation-play-state:paused;transform-box:fill-box}.learning-orbit{transform-origin:310px 190px;animation:learning-orbit 18s linear infinite;animation-play-state:paused}.learning-canvas[data-running=true] .learning-trace,.learning-canvas[data-running=true] .learning-particle,.learning-canvas[data-running=true] .learning-flow,.learning-canvas[data-running=true] .learning-orbit{animation-play-state:running}.learning-canvas[data-running=true] .bio-molecule,.learning-canvas[data-running=true] .bio-heart{animation-play-state:running}
@keyframes learning-travel{to{stroke-dashoffset:-100}}@keyframes learning-jitter{to{transform:translate(var(--dx,8px),var(--dy,-8px))}}@keyframes learning-flow{0%{transform:translateY(0);opacity:0}25%{opacity:1}90%{opacity:1}100%{transform:translateY(-80px);opacity:0}}@keyframes learning-orbit{to{transform:rotate(360deg)}}
@container(max-width:700px){.learning-stage{grid-template-columns:1fr}.learning-art svg{max-height:260px}.learning-reading p{font-size:17px}.learning-reading{padding-left:12px}}@media(prefers-reduced-motion:reduce){.learning-canvas *{animation:none!important;transition:none!important}}@media print{.learning-actions,.learning-variants,.learning-progress{display:none}.learning-canvas{background:white;color:#0f172a;break-inside:avoid}.learning-canvas h2{color:#0f172a}.learning-reading p{font-size:14px}.learning-art{background:#0b1224}.learning-canvas *{animation:none!important}}
`;

const svg=(body:string,label:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 380" role="img" aria-label="${escapeLearning(label)}">${body}</svg>`;
const text=(x:number,y:number,value:string,size=20,color='#e2e8f0')=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${size}" fill="${color}">${escapeLearning(value)}</text>`;
export function learningDiagram(plan:LearningPlan,step:number,variant:number):string {
  if(plan.visual)return teachingDiagram(plan.visual,step);
  const safeStep=Math.max(0,Math.min(step,plan.steps.length-1));
  const v=Math.max(0,Math.min(variant,Math.max(0,plan.variants.length-1)));
  if(plan.kind==='cell'){
    if(v===2)return svg(`<rect x="105" y="90" width="390" height="220" rx="110" fill="#164e63" stroke="#86efac" stroke-width="12"/><rect x="119" y="103" width="362" height="194" rx="97" fill="none" stroke="#38bdf8" stroke-width="3"/><path d="M240 165 Q330 120 350 185 Q260 270 255 195 Q330 140 370 220 Q295 260 240 165" fill="none" stroke="#f0abfc" stroke-width="5"/>`+[[175,180],[200,250],[400,155],[425,240],[325,130],[310,280]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5" fill="#fbbf24"/>`).join('')+`<path d="M495 200 Q550 150 570 210 T610 215" fill="none" stroke="#86efac" stroke-width="4"/>`+text(310,40,'Bactéria: sem núcleo delimitado',26)+text(310,350,'DNA na região do nucleoide',23),'Bactéria com membrana, citoplasma e DNA sem envoltório nuclear');
    return biologySvg('cell_structure',safeStep%4,v===1);
  }
  if(plan.kind==='organization')return biologySvg('organization',v);
  if(plan.kind==='number_line')return svg(`<path d="M50 195 H570" stroke="#94a3b8" stroke-width="4"/>`+Array.from({length:21},(_,i)=>`<path d="M${50+i*26} 185 V205" stroke="#64748b" stroke-width="2"/>`+(i%2===0?text(50+i*26,238,String(i-10),17):'')).join('')+`<path d="M310 152 H${50+v*26}" stroke="#22d3ee" stroke-width="5"/><circle cx="${50+v*26}" cy="195" r="12" fill="#fbbf24"/>`+text(310,80,`Posição: ${v-10}`,32)+text(310,310,(v-10)<0?'À esquerda do zero':v===10?'Origem da reta':'À direita do zero',23),'Reta numérica de menos dez a dez com marcador móvel');
  if(plan.kind==='timeline'){
    const selected=plan.years[v],first=plan.years[0],last=plan.years[plan.years.length-1];
    return svg(`<path class="learning-trace" d="M50 190 H570" stroke="#64748b" stroke-width="4"/>`+plan.years.map((year,i)=>{const x=50+520*(year-first)/(last-first);return `<circle cx="${x}" cy="190" r="${year===selected?14:6}" fill="${year===selected?'#fbbf24':'#38bdf8'}"/>`;}).join('')+text(310,100,String(selected),46,'#fbbf24')+text(65,255,String(first),23)+text(555,255,String(last),23)+text(310,320,'Anos citados no conteúdo',22),'Linha do tempo dos anos presentes no conteúdo');
  }
  if(plan.kind==='earth_layers')return svg([150,126,76,38].map((r,i)=>`<circle cx="260" cy="187" r="${r}" fill="${['#64748b','#c2410c','#f59e0b','#fef08a'][i]}" stroke="${v===i?'#22d3ee':'#0f172a'}" stroke-width="${v===i?7:2}"/>`).join('')+plan.variants.map((s,i)=>`<path d="M${[395,368,320,270][i]} ${[121,145,166,187][i]} L460 ${90+i*65}" stroke="${v===i?'#22d3ee':'#94a3b8'}" stroke-width="2"/>`+text(518,96+i*65,s,18,v===i?'#67e8f9':'#cbd5e1')).join(''),'Camadas internas da Terra em corte');
  if(plan.kind==='orbit'){
    const angle=(Math.max(1,v)-1)*Math.PI/2;const x=310+148*Math.cos(angle),y=190+148*Math.sin(angle);
    return svg(`<circle cx="310" cy="190" r="148" fill="none" stroke="#475569" stroke-width="2"/><circle cx="310" cy="190" r="47" fill="#fbbf24"/>`+text(310,198,'Sol',22,'#713f12')+`<g class="${v===0?'learning-orbit':''}"><circle cx="${x}" cy="${y}" r="24" fill="#0284c7" stroke="#7dd3fc" stroke-width="3"/><path d="M${x-11} ${y-8} l12 -7 12 18 -13 12 -13 -10Z" fill="#4ade80"/></g>`+text(310,32,'Translação da Terra',25),'Terra em órbita circular didática ao redor do Sol');
  }
  if(plan.kind==='colors'){
    const colors=[['#ef4444','#22c55e','#000'],['#000','#22c55e','#3b82f6'],['#ef4444','#000','#3b82f6'],['#ef4444','#22c55e','#3b82f6']][v];
    return svg(`<rect x="30" y="30" width="560" height="320" rx="25" fill="black"/>`+[[265,150],[355,150],[310,230]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="82" fill="${colors[i]}" style="mix-blend-mode:screen"/>`).join('')+text(310,325,'Mistura de luzes',24),'Sobreposição aditiva de luzes vermelha, verde e azul');
  }
  if(plan.kind==='movement'){
    const poses=[[-68,0,68,0,-55,105,55,105],[-78,-25,55,32,-85,80,70,85],[-90,-38,90,-38,0,105,90,52]][v];
    const[a,b,c,d,e,f,g,h]=poses;
    return svg(`<path d="M90 325 H530" stroke="#334155" stroke-width="5"/><g transform="translate(310 175)"><circle cy="-83" r="25" fill="#fbbf24"/><path d="M0 -52 V28 M${a} ${b} L0 -35 ${c} ${d} M${e} ${f} L0 28 ${g} ${h}" fill="none" stroke="#22d3ee" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/><circle cy="-35" r="8" fill="#fbbf24"/><circle cy="28" r="8" fill="#fbbf24"/></g>`+text(310,365,plan.variants[v],25),'Figura humana articulada em diferentes posições');
  }
  if(plan.kind==='language')return svg(`<rect x="150" y="40" width="315" height="290" rx="12" fill="#e2e8f0"/><rect x="180" y="69" width="200" height="18" rx="4" fill="${v===0?'#0891b2':'#64748b'}"/>`+Array.from({length:6},(_,i)=>`<rect x="180" y="${110+i*30}" width="${i%3===2?175:255}" height="12" rx="4" fill="${v===0?'#94a3b8':i===safeStep%6?'#0284c7':'#64748b'}"/>`).join('')+(v===1?'<path class="learning-trace" d="M480 110 Q580 155 480 210" fill="none" stroke="#fbbf24" stroke-width="5"/>':'')+(v===2?'<circle cx="445" cy="250" r="65" fill="#22d3ee30" stroke="#fbbf24" stroke-width="8"/><path d="M492 296 L540 344" stroke="#fbbf24" stroke-width="14"/>':'')+text(310,368,plan.variants[v],24),'Diagrama de organização, relações e leitura de um texto');
  if(plan.kind==='fractions'){
    const d=plan.denominator,n=v;
    const relation=Math.abs(Number((n/d).toFixed(3))-n/d)<1e-10?'=':'≈';
    const percentRelation=Math.abs(Number((100*n/d).toFixed(1))-100*n/d)<1e-10?'=':'≈';
    const parts=Array.from({length:d},(_,i)=>`<rect data-learning-variant="${i+1}" role="button" tabindex="0" aria-label="Destacar ${i+1} de ${d} partes" x="${50+i*520/d}" y="104" width="${520/d-3}" height="96" rx="5" fill="${i<n?'#22d3ee':'#1e293b'}" stroke="#64748b"/>`).join('');
    return svg(text(310,58,'Um inteiro dividido em partes iguais',23)+parts+text(310,254,`${n}/${d} ${relation} ${(n/d).toLocaleString('pt-BR',{maximumFractionDigits:3})} ${percentRelation} ${(100*n/d).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`,29,'#fbbf24')+`<path d="M50 310 H570" stroke="#94a3b8" stroke-width="3"/><circle cx="${50+520*n/d}" cy="310" r="10" fill="#22d3ee"/>`+text(50,345,'0')+text(570,345,'1'),'Fração representada por partes iguais e reta de zero a um');
  }
  if(plan.kind==='particles'){
    return svg(`<rect x="60" y="70" width="500" height="265" rx="18" fill="#0f172a" stroke="#64748b" stroke-width="3"/>`+Array.from({length:24},(_,i)=>{
      const x=v===2?95+(i%6)*82:145+(i%6)*64;const y=v===2?106+Math.floor(i/6)*63: v===1?185+Math.floor(i/6)*36:172+Math.floor(i/6)*40;
      return `<circle class="learning-particle" cx="${x}" cy="${y}" r="12" fill="${['#a5b4fc','#22d3ee','#fbbf24'][v]}" style="--dx:${v===0?2:(i%2?20:-20)}px;--dy:${v===0?2:(i%3?12:-12)}px;animation-delay:-${i/7}s"/>`;
    }).join('')+text(310,42,plan.variants[v],28),'Arranjo e movimento esquemático de partículas');
  }
  if(plan.kind==='circuit')return svg(`<path d="M100 160 V280 H500 V110 H365 M255 110 H100 V160" fill="none" stroke="#64748b" stroke-width="7"/><path d="M255 110 L365 ${v?110:55}" stroke="#fbbf24" stroke-width="7"/><circle cx="255" cy="110" r="7" fill="#fbbf24"/><circle cx="365" cy="110" r="7" fill="#fbbf24"/><path d="M75 185 H125 M85 203 H115" stroke="#f8fafc" stroke-width="7"/><circle cx="500" cy="205" r="38" fill="${v?'#fbbf24':'#334155'}" stroke="#f8fafc" stroke-width="4"/>${v?'<path class="learning-trace" d="M100 160 V110 H500 V280 H100 V210" fill="none" stroke="#22d3ee" stroke-width="3"/>':''}`+text(310,32,plan.variants[v],26)+text(100,330,'Pilha')+text(500,330,v?'Lâmpada acesa':'Lâmpada apagada'),'Circuito elétrico com pilha, interruptor e lâmpada');
  if(plan.kind==='water_cycle')return svg(`<circle cx="86" cy="70" r="32" fill="#fbbf24"/><path d="M0 285 Q80 270 155 290 T310 285 V380 H0Z" fill="#0284c7"/><path d="M270 310 L455 110 L620 310 V380 H270Z" fill="#166534"/><path d="M400 170 L455 110 L505 170Z" fill="#e2e8f0"/><path d="M235 95 Q210 43 265 44 Q305 5 340 49 Q415 35 405 96Z" fill="#cbd5e1"/>${v===0?Array.from({length:6},(_,i)=>`<circle class="learning-flow" cx="${95+i*22}" cy="254" r="5" fill="#bae6fd" style="animation-delay:-${i*.4}s"/>`).join(''):''}<path class="${v===0?'learning-trace':''}" d="M170 270 Q130 160 230 106" stroke="${v===0?'#fbbf24':'#38bdf8'}" fill="none" stroke-width="6"/><path class="${v===2?'learning-trace':''}" d="M355 109 L400 215" stroke="${v===2?'#fbbf24':'#38bdf8'}" stroke-width="6"/><path class="${v===3?'learning-trace':''}" d="M450 215 Q390 285 225 318" stroke="${v===3?'#fbbf24':'#38bdf8'}" fill="none" stroke-width="6"/>`+text(310,358,plan.variants[v],26,'#f8fafc'),'Processos do ciclo da água');
  if(plan.kind==='geometry'){
    const n=v+3;const points=Array.from({length:n},(_,i)=>({x:310+125*Math.cos(-Math.PI/2+i*2*Math.PI/n),y:185+125*Math.sin(-Math.PI/2+i*2*Math.PI/n)}));
    return svg(`<polygon points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="#164e63" stroke="#22d3ee" stroke-width="5"/>`+points.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="9" fill="#fbbf24"/>`+text(p.x,p.y-15,String(i+1),18)).join('')+text(310,355,`${n} lados • ${n} vértices`,27),'Polígono com lados e vértices identificados');
  }
  // Leitura legada sem semântica explícita: cartões fiéis ao texto, sem globo decorativo.
  const start=Math.floor(safeStep/6)*6;
  return teachingDiagram({layout:'cards',caption:'Quadro de ideias do conteúdo; cada cartão abre uma etapa de leitura.',nodes:plan.steps.slice(start,start+6).map((idea,i)=>({id:String(i),label:idea.split(/\s+/).slice(0,6).join(' ').slice(0,48),icon:plan.mode==='activity'?'question':plan.mode==='summary'?'check':'document',step:start+i}))},safeStep);

}

export function learningMarkup(plan:LearningPlan,step=0,variant=plan.initialVariant):string {
  return `<div class="learning-stage"><div class="learning-art">${learningDiagram(plan,step,variant)}</div><div class="learning-reading"><h3>${plan.mode==='activity'?'Desafio da turma':plan.mode==='example'?'Observe o exemplo':plan.mode==='summary'?'Conecte o que aprendeu':'Explore a ideia'} • ${step+1}/${plan.steps.length}</h3><p>${escapeLearning(plan.steps[step])}</p></div></div>`;
}
