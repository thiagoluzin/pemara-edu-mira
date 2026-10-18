import fs from 'node:fs/promises';
import http from 'node:http';
import {animationCases} from '../test/fixtures/animation-cases';
import {createLearningPlan,learningDiagram,LEARNING_CSS,isLearningScene,escapeLearning} from '../src/engine/learningVisual';
import {BIOLOGY_CSS,biologySvg,BIOLOGY_STEPS} from '../src/engine/biologyModel';
import {launchHeadlessChrome} from '../test/helpers/cdpBrowser';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'docs/evidencias/auditoria-total-animacoes/folhas-visuais';const sampleTime=Number(process.argv.find(a=>a.startsWith('--time='))?.slice(7)||0);const atlasOnly=process.argv.includes('--atlas-only');await fs.mkdir(out);
const entries:{id:string;variant:number;title:string;svg:string}[]=[];
for(const c of animationCases){if(atlasOnly&&c.family!=='atlas')continue;const s=c.spec.scenes[0];
 if(isLearningScene(s)){const p=createLearningPlan(s,c.spec.lesson);for(let v=0;v<Math.max(1,p.variants.length);v++)entries.push({id:c.id,variant:v,title:c.id+' · '+(p.variants[v]||'Etapa 1'),svg:learningDiagram(p,0,v)});}
 else if(s.type==='biology_model')for(let v=0;v<BIOLOGY_STEPS[s.params.model].length;v++)entries.push({id:c.id,variant:v,title:c.id+' · '+BIOLOGY_STEPS[s.params.model][v].title,svg:biologySvg(s.params.model,v,s.params.cell_type==='plant')});
}
const sheets=Array.from({length:Math.ceil(entries.length/6)},(_,i)=>entries.slice(i*6,i*6+6));
const html=(list:typeof entries)=>`<!doctype html><html><meta charset="utf-8"><style>${BIOLOGY_CSS}${LEARNING_CSS}body{margin:0;background:#020617;font:16px Arial;color:white}.grid{display:grid;grid-template-columns:620px 620px;gap:8px;padding:8px}.item{padding:0!important;box-sizing:border-box;height:410px;overflow:hidden;border:1px solid #475569}.item p{font-size:15px;margin:4px 8px}.item svg{width:100%;height:380px}</style><div class="grid">${list.map(e=>`<div class="item learning-canvas" data-running="false"><p>${escapeLearning(e.title)}</p>${e.svg}</div>`).join('')}</div></html>`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html(sheets[Number(req.url?.slice(1))]||sheets[0]));});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const browser=await launchHeadlessChrome(9595);await browser.setViewport(1280,1280);await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
const clipping:any[]=[];
try{for(let i=0;i<sheets.length;i++){await browser.navigate(`http://127.0.0.1:${(server.address() as any).port}/${i}`);await browser.evaluate(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=${sampleTime}})`);await browser.screenshot(`${out}/folha-${String(i+1).padStart(2,'0')}.png`);
 const issues=await browser.evaluate(`Array.from(document.querySelectorAll('.item')).flatMap(item=>Array.from(item.querySelectorAll('svg text')).filter(t=>{const b=t.getBoundingClientRect(),v=t.ownerSVGElement.getBoundingClientRect();return b.left<v.left-1||b.top<v.top-1||b.right>v.right+1||b.bottom>v.bottom+1}).map(t=>({case:item.querySelector('p').textContent,text:t.textContent})))`);clipping.push(...issues);
}await fs.writeFile(`${out}/indice.json`,JSON.stringify({entries:entries.map(({svg,...e})=>e),sheets:sheets.length,clipping},null,2));console.log(JSON.stringify({entries:entries.length,sheets:sheets.length,clipping}));}
finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
