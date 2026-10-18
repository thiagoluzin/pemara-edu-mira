import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {animationCases} from '../test/fixtures/animation-cases';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import {launchHeadlessChrome} from '../test/helpers/cdpBrowser';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const output=path.resolve('docs/evidencias/auditoria-animacoes-20261017',process.argv.includes('--baseline')?'baseline':only?'recheck-'+only:'final');
await fs.mkdir(output,{recursive:true});
const docs=animationCases.map(c=>generateStandaloneHtml(c.spec));
const vite=await createServer({server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'audit-offline',configureServer(s){s.middlewares.use('/audit-offline',(req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"connect-src 'none'; img-src data:; font-src 'none'; media-src 'none'");res.end(docs[Number(req.url?.slice(1))]||docs[0]);});}}]});
await vite.listen();const port=(vite.httpServer!.address() as any).port;
const browser=await launchHeadlessChrome(9582);await browser.setViewport(1024,768);
const rows:any[]=[],errors:string[]=[];
browser.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params.exceptionDetails));});
const wait=(ms=150)=>new Promise(r=>setTimeout(r,ms));
const playPattern='^(Pausar( animação)?|Reproduzir animação|Iniciar animação|Girar Órbitas|Retomar|Disparar|Iniciar Simulação|Repetir)$';
const clickPlay=()=>browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.getBoundingClientRect().width&&new RegExp(${JSON.stringify(playPattern)}).test(b.textContent.trim()))?.click()`);
const read=()=>browser.evaluate(`(()=>{const root=document.querySelector('.learning-art,.bio-body,[data-audit-ready]')||document.querySelector('.sim-wrap')||document.querySelector('main')||document.body;return {svg:Array.from(root.querySelectorAll('svg')).map(e=>e.outerHTML).join(''),css:Array.from(root.querySelectorAll('svg *')).filter(e=>getComputedStyle(e).animationName!=='none').map(e=>{const s=getComputedStyle(e);return [s.transform,s.opacity,s.strokeOpacity,s.strokeDashoffset,s.offsetDistance,s.clipPath,s.fill,s.stroke]}),play:Array.from(document.querySelectorAll('button')).find(b=>b.getBoundingClientRect().width&&new RegExp(${JSON.stringify(playPattern)}).test(b.textContent.trim()))?.textContent.trim()||null};})()`);
const moved=async(before:any)=>{for(let i=0;i<9;i++){await wait();const after=await read();if(JSON.stringify([before.svg,before.css])!==JSON.stringify([after.svg,after.css]))return true;}return false;};
try{
 for(const surface of ['react','offline'])for(const [index,c] of animationCases.entries()){
  if(only&&c.id!==only)continue;
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await browser.navigate(`http://127.0.0.1:${port}/${surface==='react'?'test/fixtures/animation-audit.html?case=':'audit-offline/'}${index}`);
  const end=Date.now()+20000;while(Date.now()<end&&!await browser.evaluate(`!!document.querySelector('svg,h1,h2')`))await wait(100);
  const control=await browser.evaluate(`document.querySelector('.bio-steps')?'.bio-steps button':document.querySelector('.learning-variants button')?'.learning-variants button':document.querySelector('.learning-variants input')?'.learning-variants input':document.querySelector('.learning-progress button')?'.learning-progress button':null`);
  const count=control?await browser.evaluate(control.endsWith('input')?`Number(document.querySelector(${JSON.stringify(control)}).max)+1`:`document.querySelectorAll(${JSON.stringify(control)}).length`):1;
  for(let variant=0;variant<count;variant++){
   if(control)await browser.evaluate(control.endsWith('input')?`(()=>{const e=document.querySelector(${JSON.stringify(control)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${variant});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`:`document.querySelectorAll(${JSON.stringify(control)})[${variant}].click()`);
   await wait(40);let state=await read();const row:any={surface,id:c.id,family:c.family,variant,hasPlay:!!state.play};
   row.variantLabel=control&&!control.endsWith('input')?await browser.evaluate(`document.querySelectorAll(${JSON.stringify(control)})[${variant}].textContent.trim()`):String(variant);
   if(state.play){
    if(!state.play.startsWith('Pausar'))await clickPlay();
    const a=await read();row.moves=await moved(a);
    await clickPlay();await wait(60);const p=await read();await wait();const q=await read();row.pauses=JSON.stringify([p.svg,p.css])===JSON.stringify([q.svg,q.css]);
    await clickPlay();row.resumes=await moved(q);
    await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(40);
    state=await read();if(state.play?.startsWith('Pausar'))await clickPlay();await clickPlay();
    const m=await read();row.explicitReducedMotionWorks=await moved(m);
    await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    row.pass=row.moves&&row.pauses&&row.resumes&&row.explicitReducedMotionWorks;
    const reset=async()=>browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>/^(Recomeçar exploração|Recomeçar|Reiniciar|Reiniciar Órbitas)$/.test(b.textContent.trim())||/^(Resetar Posição Inicial|Reiniciar Simulação)$/.test(b.title))?.click()`);
    await reset();await wait(80);const start=await read();await clickPlay();await wait();await reset();await wait(80);const again=await read();
    row.restarts=JSON.stringify([start.svg,start.css])===JSON.stringify([again.svg,again.css])&&!again.play?.startsWith('Pausar');
    row.pass=row.pass&&row.restarts;
   }else{row.pass=null;row.classification=c.family==='atlas'||c.family==='base'?'Sem reprodução contínua':'Interação ou conteúdo sem reprodução contínua';}
   row.invalidSvg=await browser.evaluate(`Array.from(document.querySelectorAll('svg')).some(e=>/NaN|undefined|Infinity/.test(e.outerHTML))`);if(row.invalidSvg)row.pass=false;
   rows.push(row);
  }
  await browser.screenshot(path.join(output,`${surface}-${c.id}.png`));
  console.log(surface,c.id,count,rows.filter(r=>r.pass===false).length+' falhas');
  await fs.writeFile(path.join(output,'resultados.json'),JSON.stringify({cases:animationCases.length,rows,errors},null,2));
 }
}finally{await browser.close();await vite.close();}
const summary={cases:animationCases.length,states:rows.length,passed:rows.filter(r=>r.pass===true).length,failed:rows.filter(r=>r.pass===false).length,withoutPlayback:rows.filter(r=>r.pass===null).length,errors};
await fs.writeFile(path.join(output,'resumo.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
if(summary.failed||errors.length)process.exitCode=1;
