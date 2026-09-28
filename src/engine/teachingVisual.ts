export const VISUAL_LAYOUTS=['flow','cycle','comparison','hierarchy','cards'] as const;
export const VISUAL_ICONS=['factory','truck','ship','chip','people','money','leaf','water','book','city','network','energy','balance','magnifier','question','check','atom','document','globe','tools'] as const;
export interface TeachingVisual {
 layout:typeof VISUAL_LAYOUTS[number];
 caption:string;
 nodes:{id:string;label:string;icon:typeof VISUAL_ICONS[number];step:number}[];
 links?:{from:string;to:string;label?:string}[];
}
export function validateTeachingVisual(value:any,stepCount:number):string[]{
 const errors:string[]=[];
 if(!value||typeof value!=='object')return ['visual deve ser um objeto.'];
 if(!VISUAL_LAYOUTS.includes(value.layout))errors.push('Composição visual desconhecida.');
 if(typeof value.caption!=='string'||!value.caption.trim()||value.caption.length>300)errors.push('Legenda visual deve ter de 1 a 300 caracteres.');
 if(!Array.isArray(value.nodes)||value.nodes.length<2||value.nodes.length>6)return [...errors,'O visual deve conter de 2 a 6 elementos.'];
 const ids=new Set<string>();
 for(const n of value.nodes){
  if(!n||typeof n.id!=='string'||!n.id||ids.has(n.id)){errors.push('Identificadores visuais inválidos ou repetidos.');continue;}ids.add(n.id);
  if(typeof n.label!=='string'||!n.label.trim()||n.label.length>48)errors.push('Rótulos visuais devem ter até 48 caracteres.');
  if(!VISUAL_ICONS.includes(n.icon))errors.push('Ícone visual desconhecido.');
  if(!Number.isInteger(n.step)||n.step<0||n.step>=stepCount)errors.push('Elemento visual aponta para etapa inexistente.');
 }
 if(Array.from({length:stepCount},(_,i)=>i).some(i=>!value.nodes.some((n:any)=>n?.step===i)))errors.push('Toda etapa precisa de um elemento visual associado.');
 if(value.links!==undefined&&(!Array.isArray(value.links)||value.links.length>10))errors.push('Ligações visuais inválidas.');
 else for(const link of value.links||[]){if(!link||!ids.has(link.from)||!ids.has(link.to)||link.from===link.to||link.label!==undefined&&(typeof link.label!=='string'||link.label.length>35))errors.push('Ligação visual inválida.');}
 if(value.layout==='hierarchy'&&Array.isArray(value.links)&&value.links.some((l:any)=>l?.from!==value.nodes[0]?.id))errors.push('Hierarquia exige ligações da raiz para categorias; sequências devem usar flow.');
 return errors;
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const icons:Record<typeof VISUAL_ICONS[number],string>={
 factory:'<path d="M-24 22V-7l17 9V-9L10 1V-26h10v48Z M-15 12h5m8 0h5m8 0h5"/>',
 truck:'<path d="M-28-16H7v31h-35Z M7-6h13l9 12v9H7"/><circle cx="-17" cy="18" r="6"/><circle cx="19" cy="18" r="6"/>',
 ship:'<path d="M-29 5l28 10L29 5l-9 19h-39Z M-19 1v-16H17V1 M-7-16v-10H5v10 M-31 29q10-7 20 0t20 0t20 0"/>',
 chip:'<rect x="-20" y="-20" width="40" height="40" rx="4"/><path d="M-9-30v10m18-10v10M-9 20v10m18-10v10M-30-9h10m-10 18h10M20-9h10m-10 18h10"/><rect x="-9" y="-9" width="18" height="18"/>',
 people:'<circle cy="-15" r="10"/><circle cx="-23" cy="-8" r="7"/><circle cx="23" cy="-8" r="7"/><path d="M-15 26V10q15-15 30 0v16M-33 23V11q5-8 12-5M33 23V11q-5-8-12-5"/>',
 money:'<circle r="27"/><path d="M12-14q-25-10-25 3t25 14t-25 11M0-24v48"/>',
 leaf:'<path d="M-23 25Q-43-18 26-28Q43 30-23 25ZM-26 28L17-16M-7 8L-10-10M7-6l15 1"/>',
 water:'<path d="M0-30Q-43 13-20 28Q0 42 20 28Q43 13 0-30Z M-14 12q-3 10 9 12"/>',
 book:'<path d="M0-20q-15-12-30-5v48q15-7 30 5q15-12 30-5v-48q-15-7-30 5v48M-23-8h14m-14 11h14M9-8h14M9 3h14"/>',
 city:'<path d="M-29 28V-10h18v38M-9 28V-29h20v57M13 28V0h17v28M-23-2h6m-6 12h6M-3-19h7m-7 12h7m-7 12h7M19 9h5M-35 28h70"/>',
 network:'<path d="M0 0L-23-23M0 0L23-23M0 0L-23 23M0 0L23 23"/><circle r="9"/><circle cx="-23" cy="-23" r="7"/><circle cx="23" cy="-23" r="7"/><circle cx="-23" cy="23" r="7"/><circle cx="23" cy="23" r="7"/>',
 energy:'<path d="M6-30L-22 5H-3L-8 32L24-8H4Z"/>',
 balance:'<path d="M0-27v55M-20 28h40M-30-13h60M-23-13l-10 26h20ZM23-13L13 13h20Z"/>',
 magnifier:'<circle cx="-6" cy="-6" r="21"/><path d="M10 10L30 30"/>',
 question:'<path d="M-16-13q0-23 24-14q22 10-2 23q-6 4-6 14M0 23v4"/>',
 check:'<circle r="29"/><path d="M-17 0L-4 14L19-15"/>',
 atom:'<circle r="5"/><ellipse rx="32" ry="12"/><ellipse rx="32" ry="12" transform="rotate(60)"/><ellipse rx="32" ry="12" transform="rotate(120)"/>',
 document:'<path d="M-22-29H9l14 14v45h-45ZM9-29v14h14M-13-4h26M-13 7h26M-13 18h19"/>',
 globe:'<circle r="29"/><ellipse rx="13" ry="29"/><path d="M-27-10h54M-29 0h58M-27 10h54"/>',
 tools:'<path d="M-24-28l17 17L8 4l20 20l-6 6L2 10L-13-5l-17-17ZM11-22q18-14 19 5L15-3M-4 12L-22 30l-8-8L-12 4"/>'
};
function words(label:string,x:number,y:number,width=20){const lines:string[]=[];for(const word of label.split(/\s+/).flatMap(w=>w.match(new RegExp('.{1,'+width+'}','g'))||[])){const last=lines.length-1;if(last<0||lines[last].length+word.length+1>width)lines.push(word);else lines[last]+=' '+word;}return lines.slice(0,width===15?4:3).map((line,i)=>`<text x="${x}" y="${y+i*18}" text-anchor="middle" fill="#e2e8f0" font-size="15" font-family="Arial,sans-serif">${esc(line)}</text>`).join('');}
export function teachingDiagram(visual:TeachingVisual,step:number):string{
 const count=visual.nodes.length;
 const pos=visual.nodes.map((_,i):[number,number]=>{
  if(visual.layout==='cycle'){const a=-Math.PI/2+i*2*Math.PI/count;return [310+210*Math.cos(a),184+105*Math.sin(a)];}
  if(visual.layout==='hierarchy')return i===0?[310,70]:[60+(500*(i-1)/Math.max(1,count-2)),258];
  if(visual.layout==='comparison')return [i%2?455:165,72+Math.floor(i/2)*121];
  return [110+(visual.layout==='flow'&&i>=3?2-i%3:i%3)*200,105+Math.floor(i/3)*178];
 });
 const colors=['#22d3ee','#a78bfa','#34d399','#fbbf24','#fb7185','#60a5fa'];
 let parts=visual.layout==='comparison'?'<path d="M310 30V355" stroke="#475569" stroke-dasharray="6 9"/><text x="310" y="22" text-anchor="middle" fill="#94a3b8" font-size="13">COMPARE</text>':'';
 for(const link of visual.links||[]){const a=visual.nodes.findIndex(n=>n.id===link.from),b=visual.nodes.findIndex(n=>n.id===link.to);if(a<0||b<0)continue;const [x1,y1]=pos[a],[x2,y2]=pos[b];const active=visual.nodes[a].step===step||visual.nodes[b].step===step;const angle=Math.atan2(y2-y1,x2-x1),r=visual.layout==='hierarchy'?49:55;const sx=x1+Math.cos(angle)*r,sy=y1+Math.sin(angle)*r,ex=x2-Math.cos(angle)*r,ey=y2-Math.sin(angle)*r;
 parts+=`<path class="${active?'learning-trace':''}" d="M${sx} ${sy}L${ex} ${ey}" stroke="${active?'#fbbf24':'#475569'}" stroke-width="3" fill="none"/><path d="M${ex-9*Math.cos(angle-.5)} ${ey-9*Math.sin(angle-.5)}L${ex} ${ey}L${ex-9*Math.cos(angle+.5)} ${ey-9*Math.sin(angle+.5)}" stroke="${active?'#fbbf24':'#475569'}" stroke-width="2" fill="none"/>`;
 if(link.label)parts+=`<rect x="${(sx+ex)/2-54}" y="${(sy+ey)/2-14}" width="108" height="22" rx="5" fill="#0f172a"/><text x="${(sx+ex)/2}" y="${(sy+ey)/2+1}" text-anchor="middle" font-size="11" fill="#cbd5e1">${esc(link.label)}</text>`;
 }
 visual.nodes.forEach((node,i)=>{const [x,y]=pos[i],active=node.step===step;const cards=visual.layout==='cards'||visual.layout==='comparison';
 parts+=`<g data-learning-step="${node.step}" role="button" tabindex="0" aria-label="${esc(node.label)}"><title>${esc(node.label)}</title>`;
 if(cards)parts+=`<rect class="${active?'semantic-highlight':''}" x="${x-86}" y="${y-55}" width="172" height="${visual.layout==='comparison'?118:151}" rx="18" fill="${active?'#143448':'#111c30'}" stroke="${active?colors[i]:'#334155'}" stroke-width="3"/>`;
 else parts+=`<circle class="${active?'semantic-highlight':''}" cx="${x}" cy="${y}" r="43" fill="${active?'#143448':'#111c30'}" stroke="${active?colors[i]:'#334155'}" stroke-width="3"/>`;
 parts+=`<g transform="translate(${x} ${y+(visual.layout==='comparison'?-15:0)}) scale(${visual.layout==='comparison'?.6:.8})" stroke="${colors[i]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">${icons[node.icon]||icons.document}</g>`;
 parts+=words(node.label,x,y+(visual.layout==='comparison'?23:62),visual.layout==='hierarchy'?15:22)+`<circle cx="${x-35}" cy="${y-39}" r="11" fill="${active?'#fbbf24':'#334155'}"/><text x="${x-35}" y="${y-35}" font-size="12" text-anchor="middle" fill="${active?'#0f172a':'#e2e8f0'}">${node.step+1}</text></g>`;
 });
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 400" role="img" aria-label="${esc(visual.caption)}">${parts}</svg>`;
}
