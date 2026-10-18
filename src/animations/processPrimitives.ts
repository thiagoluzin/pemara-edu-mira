export const palette={bg:'#071529',card:'#102238',line:'#64748b',cyan:'#22d3ee',gold:'#fbbf24',green:'#4ade80',light:'#e2e8f0',red:'#fb7185',blue:'#60a5fa',violet:'#c4b5fd'};
export const esc=(s:string)=>s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));
export const txt=(x:number,y:number,s:string,size=18,color=palette.light,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}">${esc(s)}</text>`;
export const box=(x:number,y:number,w:number,h:number,fill=palette.card,stroke=palette.line,r=8)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
export const dot=(x:number,y:number,r:number,fill=palette.gold)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
export const line=(d:string,color=palette.cyan,width=4,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
export const card=(x:number,y:number,w:number,label:string,color=palette.cyan)=>box(x,y,w,42,palette.card,color)+txt(x+w/2,y+27,label,17);
type Motion={x?:number;y?:number;fromX?:number;fromY?:number;sx?:number;sy?:number;fromSX?:number;fromSY?:number;rotate?:number;fromRotate?:number;origin?:string;seconds?:number;delay?:number;alternate?:boolean};
export function move(role:string,body:string,m:Motion={}){
 return `<g data-motion-role="${role}" class="atlas-process" style="--ax:${m.fromX||0}px;--ay:${m.fromY||0}px;--bx:${m.x||0}px;--by:${m.y||0}px;--asx:${m.fromSX??1};--asy:${m.fromSY??1};--bsx:${m.sx??1};--bsy:${m.sy??1};--ar:${m.fromRotate||0}deg;--br:${m.rotate||0}deg;transform-origin:${m.origin||'0px 0px'};animation-duration:${m.seconds||6}s;animation-delay:${m.delay||0}s;animation-direction:${m.alternate?'alternate':'normal'}">${body}</g>`;
}
export function flow(role:string,path:string,body:string,seconds=5,delay=0){
 return `<g data-motion-role="${role}" class="atlas-process-flow" style="offset-path:path('${path}');animation-duration:${seconds}s;animation-delay:${delay}s">${body}</g>`;
}
export const particle=(role:string,path:string,color=palette.gold,seconds=5,r=7,delay=0)=>flow(role,path,dot(0,0,r,color),seconds,delay);
export const finish=(title:string,body:string,explanation:string)=>txt(310,34,title,23)+body+txt(310,344,explanation,16)+txt(310,373,'Modelo didático em repetição • pause para comparar as etapas',13,'#a5b4cc');
export const PROCESS_CSS=`
.atlas-process{transform-box:view-box;animation:atlas-process 6s linear infinite}
@keyframes atlas-process{0%{transform:translate(var(--ax),var(--ay)) rotate(var(--ar)) scale(var(--asx),var(--asy))}80%,100%{transform:translate(var(--bx),var(--by)) rotate(var(--br)) scale(var(--bsx),var(--bsy))}}
.atlas-sort{animation-name:atlas-sort}
@keyframes atlas-sort{0%{transform:translate(0,0)}30%{transform:translate(0,var(--lane))}65%{transform:translate(var(--bx),var(--lane))}100%{transform:translate(var(--bx),0)}}
.atlas-rhythm-hand{animation:atlas-rhythm-hand 4s linear infinite}
@keyframes atlas-rhythm-hand{0%{transform:translate(118px,135px)}12.5%{transform:translate(182px,85px)}25%{transform:translate(246px,135px)}37.5%{transform:translate(310px,85px)}50%{transform:translate(374px,var(--third-y))}62.5%{transform:translate(438px,85px)}75%{transform:translate(502px,135px)}87.5%{transform:translate(310px,85px)}100%{transform:translate(118px,135px)}}
.atlas-process-flow{offset-rotate:0deg;animation:atlas-process-flow 5s linear infinite}
@keyframes atlas-process-flow{from{offset-distance:0%}to{offset-distance:100%}}
.atlas-draw{stroke-dasharray:1;animation:atlas-draw 6s linear infinite}
@keyframes atlas-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.atlas-process,.atlas-process-flow,.atlas-draw{animation-play-state:paused!important}
.learning-canvas[data-running=true] .atlas-process,.learning-canvas[data-running=true] .atlas-process-flow,.learning-canvas[data-running=true] .atlas-draw{animation-play-state:running!important}
`;
