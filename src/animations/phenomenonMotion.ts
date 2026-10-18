// The drawing itself moves. React and the standalone export share these frames and CSS.
const ink='#e2e8f0', gold='#fbbf24', cyan='#22d3ee';
const text=(x:number,y:number,s:string,size=18)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size}" fill="${ink}">${s}</text>`;
export function moonMotion(variant:number){
 const phases=['Nova','Quarto crescente','Cheia','Quarto minguante'];
 // Four consecutive quarters of a projected illuminated hemisphere. The ellipse
 // is the terminator, not Earth's shadow. All quarters share one 24 s clock.
 return text(310,34,'Lua: a parte iluminada muda',25)+
 `<circle cx="310" cy="184" r="110" fill="#111827" stroke="#64748b" stroke-width="2"/>`+
 phases.map((_,q)=>{
  const delay=-(24+variant*6-q*6),right=q<2,grow=q%2===1;
  return `<g class="phenomenon-motion moon-quarter" data-moon-quarter="${q}" style="animation-delay:${delay}s">`+
   `<path d="M310 74 A110 110 0 0 ${right?1:0} 310 294Z" fill="#fef3c7"/>`+
   `<ellipse class="phenomenon-motion moon-terminator ${grow?'moon-grow':'moon-shrink'}" cx="310" cy="184" rx="110" ry="110" fill="${q===0||q===3?'#111827':'#fef3c7'}" style="animation-delay:${delay}s"/>`+
   `</g>`;
 }).join('')+text(310,325,`Ciclo completo • começa em: ${phases[variant]}`,19)+
 text(310,351,'Vista da Terra • ciclo acelerado e orientação ilustrativa',15)+
 text(310,374,'A Lua reflete a luz solar; as fases não são a sombra da Terra.',14);
}

const plate=(side:string,tx:number,ty:number,body:string)=>`<g class="phenomenon-motion tectonic-plate" data-plate="${side}" style="--plate-x:${tx}px;--plate-y:${ty}px">${body}</g>`;
export function tectonicMotion(variant:number){
 const title=['Convergência: subducção','Divergência: afastamento','Transformante: deslizamento'][variant];
 let body='';
 if(variant===0){
  body=`<rect x="35" y="145" width="550" height="160" fill="#7c2d12"/>`+
   plate('left',48,30,`<path d="M-30 160H265L421 263L402 293L249 194H-30Z" fill="#0e7490" stroke="${cyan}" stroke-width="3"/>`+
    [35,90,145,200,275,320,365].map((x,i)=>`<path d="M${x} ${i<4?163:177+(i-4)*30}l-14 25" stroke="#a5f3fc" stroke-width="4"/>`).join(''))+
   plate('right',-18,0,`<path d="M332 144L381 120L427 144H640V220H432L332 166Z" fill="#475569" stroke="${gold}" stroke-width="3"/>`)+
   text(150,102,'Placa oceânica',17)+text(465,90,'Placa continental',17)+text(310,332,'Uma placa mergulha sob a outra • vista em corte',17);
 }else if(variant===1){
  body=`<rect x="35" y="175" width="550" height="130" fill="#7c2d12"/><path d="M287 305L310 175L333 305Z" fill="#fb923c"/>`+
   plate('left',-55,0,`<path d="M-25 162H309V228H-25Z" fill="#334155" stroke="${cyan}" stroke-width="3"/>`+
    [60,120,180,240].map(x=>`<path d="M${x} 165v60" stroke="#64748b" stroke-width="8"/>`).join(''))+
   plate('right',55,0,`<path d="M311 162H645V228H311Z" fill="#475569" stroke="${gold}" stroke-width="3"/>`+
    [380,440,500,560].map(x=>`<path d="M${x} 165v60" stroke="#94a3b8" stroke-width="8"/>`).join(''))+
   `<path class="phenomenon-motion tectonic-magma" d="M310 290V214" stroke="#fde68a" stroke-width="12" stroke-dasharray="12 15"/>`+
   text(310,105,'As placas se afastam; material ascende no limite',17)+text(310,332,'Vista em corte • formação de nova crosta',17);
 }else{
  body=plate('left',0,-48,`<path d="M35 125H308V355H35Z" fill="#164e63" stroke="${cyan}" stroke-width="3"/>`+
    [175,225,275].map(y=>`<path d="M60 ${y}H306" stroke="#94a3b8" stroke-width="7"/>`).join(''))+
   plate('right',0,48,`<path d="M312 77H585V307H312Z" fill="#475569" stroke="${gold}" stroke-width="3"/>`+
    [175,225,275].map(y=>`<path d="M314 ${y}H560" stroke="#94a3b8" stroke-width="7"/>`).join(''))+
   `<path d="M310 105V305" stroke="#fb7185" stroke-width="3" stroke-dasharray="8 7"/>`+
   text(310,332,'Vista de cima • marcas se desencontram ao longo da falha',16);
 }
 // Nested SVG clips only the moving geological section, never the explanations.
 const split=body.indexOf('<text');
 return text(310,35,title,24)+(variant===0?text(310,62,'Movimento relativo das placas',16):'')+
  `<svg x="35" y="112" width="550" height="195" viewBox="35 112 550 195" overflow="hidden">${split<0?body:body.slice(0,split)}</svg>`+
  (split<0?'':body.slice(split))+text(310,369,'Esquema acelerado, sem escala • cada repetição recomeça o processo',13);
}

function joint(name:string,x:number,y:number,from:number,to:number,seconds:number,delay:number,contents:string){
 return `<g transform="translate(${x} ${y})"><g data-joint="${name}" class="phenomenon-motion body-joint" style="--joint-from:${from}deg;--joint-to:${to}deg;animation-duration:${seconds}s;animation-delay:${delay}s">${contents}</g></g>`;
}
const segment=(length:number,color=cyan)=>`<path d="M0 0V${length}" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"/><circle r="6" fill="${gold}"/>`;
export function bodyMotion(variant:number){
 const titles=['Elevar e baixar os braços','Caminhada no lugar','Equilíbrio: levantar e apoiar'];
 const duration=variant===1?2.4:5;
 const arm=(side:number)=>{
  const from=variant===0?-side*12:variant===1?-side*30:-side*65;
  const to=variant===0?-side*120:variant===1?side*30:-side*85;
  return joint(`shoulder-${side}`,side*16,139,from,to,duration,0,
   segment(41)+joint(`elbow-${side}`,0,41,-side*8,-side*(variant===0?30:50),duration,0,segment(38)));
 };
 const leg=(side:number)=>{
  const from=variant===1?side*25:-side*8;
  const to=variant===1?-side*25:variant===2&&side===1?-52:-side*8;
  const kneeTo=variant===1?46:variant===2&&side===1?95:0;
  return joint(`hip-${side}`,side*9,208,from,to,duration,0,
   segment(43,side===1?'#60a5fa':cyan)+joint(`knee-${side}`,0,43,0,kneeTo,duration,variant===1&&side===1?-duration/2:0,
    segment(40,side===1?'#60a5fa':cyan)+`<path d="M-4 40h20" stroke="${gold}" stroke-width="8" stroke-linecap="round"/>`));
 };
 return text(310,34,titles[variant],25)+`<path d="M120 292H500" stroke="#64748b" stroke-width="4"/>`+
 `<g transform="translate(310 0)"><circle cy="96" r="23" fill="${gold}"/><path d="M0 122V208" stroke="${cyan}" stroke-width="20" stroke-linecap="round"/>${leg(-1)}${leg(1)}${arm(-1)}${arm(1)}</g>`+
 text(310,339,variant===1?'Braços e pernas alternam; joelhos flexionam.':variant===2?'Uma perna sustenta; a outra flexiona e retorna.':'Ombros giram; cotovelos acompanham o gesto.',17)+
 text(310,370,'Modelo articulado para observar e comparar movimentos',15);
}

export const PHENOMENON_MOTION_CSS=`
.phenomenon-motion{animation-play-state:paused!important}
.learning-canvas[data-running=true] .phenomenon-motion{animation-play-state:running!important}
.moon-quarter{animation:moon-quarter 24s steps(1,end) infinite}
@keyframes moon-quarter{0%{opacity:1}25%,100%{opacity:0}}
.moon-terminator{transform-box:view-box;transform-origin:310px 184px;animation-duration:24s;animation-timing-function:linear;animation-iteration-count:infinite}
.moon-shrink{animation-name:moon-shrink}.moon-grow{animation-name:moon-grow}
@keyframes moon-shrink{0%{transform:scaleX(1)}6.25%{transform:scaleX(.92388)}12.5%{transform:scaleX(.707107)}18.75%{transform:scaleX(.382683)}25%,100%{transform:scaleX(0)}}
@keyframes moon-grow{0%{transform:scaleX(0)}6.25%{transform:scaleX(.382683)}12.5%{transform:scaleX(.707107)}18.75%{transform:scaleX(.92388)}25%,100%{transform:scaleX(1)}}
.tectonic-plate{animation:tectonic-plate 8s linear infinite}
@keyframes tectonic-plate{0%{transform:translate(0,0)}90%,100%{transform:translate(var(--plate-x),var(--plate-y))}}
.tectonic-magma{animation:tectonic-magma 2s linear infinite}
@keyframes tectonic-magma{to{stroke-dashoffset:54}}
.body-joint{transform-origin:0 0;animation:body-joint 5s ease-in-out infinite}
@keyframes body-joint{0%,100%{transform:rotate(var(--joint-from))}50%{transform:rotate(var(--joint-to))}}
`;
