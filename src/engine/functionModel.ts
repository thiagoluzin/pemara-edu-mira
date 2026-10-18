import type {MathFunctionParams} from '../types/lesson';
/** Pure shared model; also serialized into the standalone HTML, without dependencies. */
export function functionModel(p:MathFunctionParams){
 const a=Number.isFinite(p.a)?p.a:1,b=Number.isFinite(p.b)?p.b:0,c=Number.isFinite(p.c)?p.c:0;
 const kind=p.function_type||'parabola';
 const xmin=Number.isFinite(p.x_min)?p.x_min!:-8,xmax=Number.isFinite(p.x_max)&&p.x_max!>xmin?p.x_max!:xmin+16;
 const points:{x:number;y:number}[]=[];let low=0,high=0;
 for(let i=0;i<=160;i++){const x=xmin+(xmax-xmin)*i/160;const y=kind==='sine'?a*Math.sin(b*x)+c:kind==='linear'?b*x+c:a*x*x+b*x+c;points.push({x,y});low=Math.min(low,y);high=Math.max(high,y);}
 const span=Math.max(2,high-low);low-=span*.1;high+=span*.1;
 let d='';for(const point of points){const x=45+(point.x-xmin)/(xmax-xmin)*530,y=325-(point.y-low)/(high-low)*270;d+=(d?' L':'M')+x.toFixed(3)+' '+y.toFixed(3);}
 const formula=kind==='sine'?`f(x) = ${a} sen(${b}x) + (${c})`:kind==='linear'?`f(x) = ${b}x + (${c})`:`f(x) = ${a}x² + (${b})x + (${c})`;
 let analysis='';const roots:number[]=[];let vertex:{x:number;y:number}|null=null;
 if(kind==='sine'){analysis='Seno: x em radianos. Amplitude = '+Math.abs(a)+'. '+(b===0?'Função constante.':'Período = '+(2*Math.PI/Math.abs(b)).toFixed(3)+'.');}
 else if(kind==='linear'||a===0){if(b!==0){roots.push(-c/b);analysis='Reta: coeficiente angular '+b+'. Raiz x = '+(-c/b).toFixed(3)+'.';}else analysis=c===0?'Função nula: todo x é raiz.':'Função constante não nula: não possui raiz.';}
 else{const delta=b*b-4*a*c;vertex={x:-b/(2*a),y:-delta/(4*a)};if(delta>=0){roots.push((-b-Math.sqrt(delta))/(2*a));if(delta>0)roots.push((-b+Math.sqrt(delta))/(2*a));}analysis='Δ = '+delta.toFixed(3)+'. Vértice ('+vertex.x.toFixed(3)+', '+vertex.y.toFixed(3)+'). '+(roots.length?'Raízes: '+roots.join(', ')+'.':'Sem raízes reais.');}
 return {kind,a,b,c,xmin,xmax,low,high,d,formula,analysis,roots,vertex};
}
export function functionSvg(p:MathFunctionParams){
 const m=functionModel(p);let s='<svg role="img" aria-label="Gráfico da função e ponto percorrendo a curva" viewBox="0 0 620 380"><rect width="620" height="380" fill="#071529"/>';
 const zeroX=45+(0-m.xmin)/(m.xmax-m.xmin)*530,zeroY=325-(0-m.low)/(m.high-m.low)*270;
 for(let i=0;i<=4;i++){const x=45+i*132.5,y=325-i*67.5;if(p.show_grid!==false)s+='<path d="M'+x+' 55V325 M45 '+y+'H575" stroke="#334155" fill="none"/>';s+='<text x="'+x+'" y="348" text-anchor="middle" fill="#e2e8f0" font-size="14">'+(m.xmin+(m.xmax-m.xmin)*i/4).toFixed(1)+'</text><text x="40" y="'+y+'" text-anchor="end" fill="#e2e8f0" font-size="12">'+(m.low+(m.high-m.low)*i/4).toFixed(1)+'</text>';}
 if(zeroX>=45&&zeroX<=575)s+='<path d="M'+zeroX+' 55V325" stroke="#94a3b8"/>';
 if(zeroY>=55&&zeroY<=325)s+='<path d="M45 '+zeroY+'H575" stroke="#94a3b8"/>';
 if(p.show_roots!==false)for(const root of m.roots){if(root<m.xmin||root>m.xmax)continue;const x=45+(root-m.xmin)/(m.xmax-m.xmin)*530;s+='<circle data-math-root cx="'+x+'" cy="'+zeroY+'" r="5" fill="#60a5fa"/><text x="'+x+'" y="'+(zeroY-12)+'" text-anchor="middle" fill="#60a5fa" font-size="12">x = '+root.toFixed(2)+'</text>';}
 if(p.show_vertex!==false&&m.vertex&&m.vertex.x>=m.xmin&&m.vertex.x<=m.xmax){const x=45+(m.vertex.x-m.xmin)/(m.xmax-m.xmin)*530,y=325-(m.vertex.y-m.low)/(m.high-m.low)*270;s+='<circle data-math-vertex cx="'+x+'" cy="'+y+'" r="5" fill="#fb923c"/><text x="'+x+'" y="'+(y-12)+'" text-anchor="middle" fill="#fb923c" font-size="12">V ('+m.vertex.x.toFixed(2)+', '+m.vertex.y.toFixed(2)+')</text>';}
 s+='<path data-math-curve d="'+m.d+'" stroke="#22d3ee" fill="none" stroke-width="3"/><circle class="atlas-travel" data-math-cursor r="7" fill="#fbbf24" style="offset-path:path(\''+m.d+'\');animation-duration:8s"/><text x="310" y="26" text-anchor="middle" fill="#e2e8f0" font-size="19">'+m.formula+'</text><text x="590" y="348" fill="#e2e8f0">x</text><text x="28" y="35" fill="#e2e8f0">y</text></svg>';
 return s;
}
