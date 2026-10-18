import {atlasProcessBody} from './atlasProcesses';
import {move} from './processPrimitives';
import {moonMotion,tectonicMotion} from './phenomenonMotion';
import {ATLAS,type AtlasKind} from './atlas.ts';
import {travel,readingCue} from './motionPrimitives';
/** SVG determinístico de modelos visuais. Nenhum texto do professor é interpolado em HTML. */
const c={bg:'#071529',card:'#102238',line:'#64748b',cyan:'#22d3ee',gold:'#fbbf24',green:'#4ade80',light:'#e2e8f0',red:'#fb7185',blue:'#60a5fa',violet:'#c4b5fd'};
function txt(x:number,y:number,s:string,size=18,color=c.light,anchor='middle'){return `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}" text-anchor="${anchor}">${s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]!))}</text>`;}
function rect(x:number,y:number,w:number,h:number,fill=c.card,stroke=c.line,r=12){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;}
function circ(x:number,y:number,r:number,fill=c.card,stroke=c.cyan,width=3){return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;}
function route(d:string,color=c.cyan,width=4,animated=false,dashed=false){return `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${animated?'class="learning-trace"':''} ${dashed?'stroke-dasharray="9 8"':''}/>`;}
function mark(x:number,y:number,label:string,active:boolean){return circ(x,y,11,active?c.gold:c.card,active?c.gold:c.line)+txt(x,y+4,label,12,active?c.bg:c.light);}
function label(x:number,y:number,title:string,active=false,width=158){return rect(x-width/2,y-24,width,42,active?'#164e63':c.card,active?c.gold:c.line,10)+txt(x,y+3,title,15);}
function moving(x:number,y:number,active:boolean,color=c.cyan){return `<circle cx="${x}" cy="${y}" r="7" fill="${active?c.gold:color}" class="${active?'learning-particle':''}" style="--dx:8px;--dy:-8px"/>`;}
function frame(title:string,svg:string){return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}" viewBox="0 0 620 380" style="display:block;width:100%"><rect x="0" y="0" width="620" height="380" rx="16" fill="${c.bg}"/>${svg}</svg>`;}
function arrows(x:number,y:number,dir=1,color=c.cyan){return route(`M${x-33*dir} ${y}H${x+33*dir}`,color,4,true)+route(`M${x+21*dir} ${y-11}L${x+33*dir} ${y}L${x+21*dir} ${y+11}`,color,3);}
function horizontalStage(labels:string[],v:number,y=180){return labels.map((s,i)=>label(80+i*(460/Math.max(1,labels.length-1)),y,s,v===i,110)).join('');}

export const TRANSFORMATION_BASE = [[205,267],[265,185],[306,272]] as const;
export function transformedTriangle(variant:number):number[][] {
  return TRANSFORMATION_BASE.map(([x,y])=>{
    if(variant===0)return [x+135,y];
    if(variant===1){const a=Math.PI/3,dx=x-310,dy=y-230;return [310+dx*Math.cos(a)-dy*Math.sin(a),230+dx*Math.sin(a)+dy*Math.cos(a)];}
    return [620-x,y]; // Reflection in the displayed x=310 axis.
  });
}
export function atlasSvg(kind:AtlasKind,variant=0,step=0):string {
  const profile=ATLAS.find(p=>p.id===kind);
  if(!profile)throw new Error(`Modelo não cadastrado: ${kind}`);
  const v=Math.min(Math.max(Math.floor(variant),0),profile.variants.length-1), a=(i:number)=>i===v;
  const process=atlasProcessBody(kind,v);
  if(process)return frame(profile.name,process);
  let body='';
  switch(kind){
    case 'separation':{
      const title=profile.variants[v];
      if(v===0){
        body=txt(310,32,'Três misturas: o mesmo filtro resolve?',23);
        [45,235,425].forEach((x,i)=>{
          body+=`<g data-mixture="${['sand','salt','oil'][i]}">`+txt(x+75,73,['Água + areia','Água + sal','Água + óleo'][i],19)+
            `<rect x="${x+5}" y="130" width="140" height="152" fill="#0284c7" opacity=".5"/><path d="M${x} 100V282Q${x+75} 298 ${x+150} 282V100" fill="none" stroke="#a5f3fc" stroke-width="5"/>`;
          if(i===0)body+=Array.from({length:7},(_,j)=>travel(`M${x+18+j*18} ${150+j%3*22}V${276+j%2*6}`,c.gold,6,5,-j*.6)).join('')+txt(x+75,321,'Grãos sedimentam',16);
          if(i===1)body+=Array.from({length:8},(_,j)=>`<circle class="learning-particle" cx="${x+25+j%4*30}" cy="${160+Math.floor(j/4)*65}" r="6" fill="${j%2?c.violet:c.green}" style="--dx:${j%2?12:-12}px;--dy:${j%3?16:-16}px;animation-delay:-${j*.3}s"/>`).join('')+txt(x+75,321,'Íons dispersos*',16);
          if(i===2)body+=`<rect x="${x+5}" y="130" width="140" height="44" fill="#eab308" opacity=".85"/>`+Array.from({length:3},(_,j)=>travel(`M${x+32+j*38} 242V171`,c.gold,6,7,-j*1.2)).join('')+txt(x+75,321,'Óleo forma outra fase',16);
          body+='</g>';
        });
        body+=txt(310,356,'*Íons ampliados: não são grãos visíveis de sal.',15)+txt(310,377,'Movimentos esquemáticos em repetição, sem escala.',13);
        break;
      }
      body=txt(310,40,`Separação de misturas: ${title}`,23)+
        `<path d="M220 102V294Q310 316 400 294V102" fill="none" stroke="#a5f3fc" stroke-width="6"/>`+
        (v===0?Array.from({length:18},(_,i)=>circ(239+(i%6)*27,170+Math.floor(i/6)*29,5,i%2?c.gold:c.blue,'none',0)).join(''):
         v===1?`<path d="M227 139H393L310 232L227 139Z" fill="#0e7490" stroke="${c.cyan}" stroke-width="4"/>`+Array.from({length:9},(_,i)=>moving(310+(i%3-1)*(40-Math.floor(i/3)*10),150+Math.floor(i/3)*20,false,c.gold)).join('')+Array.from({length:5},(_,i)=>travel('M310 165V293',c.blue,5,5,-i)).join('')+move('agua-filtrada',`<rect x="270" y="275" width="80" height="20" fill="${c.blue}"/>`,{fromSY:.05,sy:1,origin:'310px 295px'}):
         v===2?`<rect x="225" y="153" width="170" height="143" fill="#0284c7" opacity=".55"/>`+Array.from({length:8},(_,i)=>travel(`M${242+i*19} ${164+i%3*15}V${284+i%2*6}`,c.gold,7,5,-i*.6)).join('')+txt(310,82,'Sólido mais denso sedimenta',17):
         `<rect x="225" y="220" width="170" height="72" fill="#0284c7" opacity=".55"/>`+Array.from({length:6},(_,i)=>travel(`M${255+i*21} 220V95`,c.blue,5,5,-i*.7)).join('')+`<rect x="225" y="282" width="170" height="10" fill="${c.gold}"/>`+txt(108,250,'Água líquida',16)+txt(492,140,'Vapor de água*',16)+txt(310,332,'A água evapora; o sal permanece.',17))+
        txt(310,v===3?363:344,v===3?'*Partículas ampliadas; vapor é invisível. Sem escala.':'Modelo de procedimento — sem escala',v===3?14:17);
      break;
    }
    case 'moon_phases':{ body=moonMotion(v); break; }
    case 'tectonics':{ body=tectonicMotion(v); break; }
    case 'transformations':{
      const base=TRANSFORMATION_BASE.map(p=>p.join(',')).join(' ');
      const dest=transformedTriangle(v).map(p=>p.join(',')).join(' ');
      body=txt(310,38,`Transformação: ${profile.variants[v]}`,23)+
        `<polygon points="${base}" fill="#155e75" stroke="${c.cyan}" stroke-width="5"/>`+
        `<polygon points="${dest}" fill="none" stroke="${c.gold}" stroke-width="2" stroke-dasharray="5 5"/>`+
        (v<2?`<polygon data-motion-role="transformacao" class="atlas-transform" points="${base}" fill="#7c2d12" stroke="${c.gold}" stroke-width="5" opacity=".8" style="--tx:${v===0?135:0}px;--rotation:${v===1?60:0}deg"/>`:move('reflexao',`<polygon points="${base}" fill="#7c2d12" stroke="${c.gold}" stroke-width="5" opacity=".8"/>`,{sx:-1,origin:'310px 230px'})+TRANSFORMATION_BASE.map(([x,y],i)=>travel(`M${x} ${y}H${620-x}`,c.gold,5,6,-i)).join(''))+
        route(v===2?'M310 85V315':v===1?'M310 165Q371 92 421 156':'M305 212H360',c.line,3,v!==2,v===2)+txt(310,349,v===2?'Construção da reflexão: compare início e fim':'Figura original → imagem transformada',18);
      break;
    }

  }
  // Renderer deliberadamente sem fallback decorativo silencioso.
  if (!body) throw new Error(`Motor SVG não implementado para: ${kind}`);
  return frame(profile.name, body);
}
