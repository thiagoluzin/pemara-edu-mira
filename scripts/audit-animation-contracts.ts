import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {animationCases} from '../test/fixtures/animation-cases';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import {launchHeadlessChrome} from '../test/helpers/cdpBrowser';
import {createLearningPlan,isLearningScene} from '../src/engine/learningVisual';
import {BIOLOGY_STEPS} from '../src/engine/biologyModel';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const selectedSurface=process.argv.find(a=>a.startsWith('--surface='))?.slice(10);
const debugPort=Number(process.argv.find(a=>a.startsWith('--port='))?.slice(7)||9582);
const run=process.argv.find(a=>a.startsWith('--run='))?.slice(6)||new Date().toISOString().replace(/[:.]/g,'-');
const output=path.resolve('docs/evidencias/auditoria-total-animacoes',run);
const quality:any[]=[],parameters:any[]=[];
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.mkdir(output); // Never overwrite the evidence of a previous run.
const docs=animationCases.map(c=>generateStandaloneHtml(c.spec));
const vite=await createServer({cacheDir:path.join(output,'vite-cache'),server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'audit-offline',configureServer(s){s.middlewares.use('/audit-offline',(req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"connect-src 'none'; img-src data:; font-src 'none'; media-src 'none'");res.end(docs[Number(req.url?.slice(1))]||docs[0]);});}}]});
await vite.listen();const port=(vite.httpServer!.address() as any).port;
const browser=await launchHeadlessChrome(debugPort);await browser.setViewport(1024,768);
const rows:any[]=[],errors:string[]=[];
browser.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params.exceptionDetails));if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(JSON.stringify(m.params.entry));});
await browser.send('Log.enable');
const wait=(ms=150)=>new Promise(r=>setTimeout(r,ms));
const playPattern='^(Pausar( animação)?|Reproduzir animação|Iniciar animação|Girar Órbitas|Retomar|Disparar|Iniciar Simulação|Repetir)$';
const clickPlay=()=>browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.getBoundingClientRect().width&&new RegExp(${JSON.stringify(playPattern)}).test(b.textContent.trim()))?.click()`);
const read=()=>browser.evaluate(`(()=>{const root=document.querySelector('.learning-art,.bio-body,[data-audit-ready]')||document.querySelector('.sim-wrap')||document.querySelector('main')||document.body;return {svg:Array.from(root.querySelectorAll('svg')).map(e=>e.outerHTML).join(''),css:Array.from(root.querySelectorAll('svg *')).filter(e=>getComputedStyle(e).animationName!=='none'||e.getAnimations().length>0).map(e=>{const s=getComputedStyle(e);return [s.transform,s.opacity,s.strokeOpacity,s.strokeDashoffset,s.offsetDistance,s.clipPath,s.fill,s.stroke]}),play:Array.from(document.querySelectorAll('button')).find(b=>b.getBoundingClientRect().width&&new RegExp(${JSON.stringify(playPattern)}).test(b.textContent.trim()))?.textContent.trim()||null};})()`);
const moved=async(before:any)=>{for(let i=0;i<9;i++){await wait();const after=await read();if(JSON.stringify([before.svg,before.css])!==JSON.stringify([after.svg,after.css]))return true;}return false;};
try{
 for(const surface of ['presentation','offline'])for(const [index,c] of animationCases.entries()){
  if(selectedSurface&&surface!==selectedSurface)continue;
  if(only&&!only.split(',').includes(c.id))continue;
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await browser.navigate(`http://127.0.0.1:${port}/${surface==='presentation'?'test/fixtures/animation-audit.html?presentation=1&case=':'audit-offline/'}${index}`);
  const scene=c.spec.scenes[0];
  const readySelector=isLearningScene(scene)?'.learning-art svg':scene.type==='biology_model'?'.bio-body svg':scene.type==='math_function'?'[data-math-curve]':scene.type==='solar_system'?surface==='presentation'?'[data-planet]':'#solar-svg':scene.type==='physics_projectile'?surface==='presentation'?'input[aria-label="Velocidade inicial"]':'#proj-btn-play':'h1,h2,h3';
  const end=Date.now()+30000;while(Date.now()<end&&!await browser.evaluate(`!!document.querySelector(${JSON.stringify(readySelector)})`))await wait(100);
  if(!await browser.evaluate(`!!document.querySelector(${JSON.stringify(readySelector)})`))throw new Error('Modelo não carregou: '+surface+' '+c.id);
  const control=await browser.evaluate(`document.querySelector('.bio-steps')?'.bio-steps button':document.querySelector('.learning-variants button')?'.learning-variants button':document.querySelector('.learning-variants input')?'.learning-variants input':document.querySelector('.learning-progress button')?'.learning-progress button':null`);
  const count=control?await browser.evaluate(control.endsWith('input')?`Number(document.querySelector(${JSON.stringify(control)}).max)+1`:`document.querySelectorAll(${JSON.stringify(control)}).length`):1;
  const steps=control==='.learning-progress button'?1:await browser.evaluate("Math.max(1,document.querySelectorAll('.learning-progress button').length)");
  for(let variant=0;variant<count;variant++)for(let step=0;step<steps;step++){

   if(control)await browser.evaluate(control.endsWith('input')?`(()=>{const e=document.querySelector(${JSON.stringify(control)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${variant});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`:`document.querySelectorAll(${JSON.stringify(control)})[${variant}].click()`);
   if(steps>1)await browser.evaluate("document.querySelectorAll('.learning-progress button')["+step+"].click()");
   await wait(40);let state=await read();const row:any={surface,id:c.id,family:c.family,variant,step,hasPlay:!!state.play};
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
   }else{row.pass=['title','map','comparison','timeline','quiz'].includes(c.id)?null:false;row.classification=row.pass===false?'FALHA: controle de reprodução ausente':'Interação ou conteúdo sem reprodução contínua';}
   row.invalidSvg=await browser.evaluate(`Array.from(document.querySelectorAll('svg')).some(e=>/NaN|undefined|Infinity/.test(e.outerHTML))`);if(row.invalidSvg)row.pass=false;
   rows.push(row);
   if(step===0){
    if(control)await browser.evaluate(control.endsWith('input')?`(()=>{const e=document.querySelector(${JSON.stringify(control)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${variant});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`:`document.querySelectorAll(${JSON.stringify(control)})[${variant}].click()`);
    await browser.screenshot(path.join(output,surface+'-'+c.id+'-v'+variant+'.png'));
   }
  }
  const observed=rows.filter(r=>r.surface===surface&&r.id===c.id).length;
  const plan=isLearningScene(scene)?createLearningPlan(scene,c.spec.lesson):null;
  const expected=plan?Math.max(1,plan.variants.length)*plan.steps.length:scene.type==='biology_model'?BIOLOGY_STEPS[scene.params.model].length:1;
  if(observed!==expected)errors.push('Cobertura incompleta '+surface+' '+c.id+': '+observed+' de '+expected);
  for(const [width,height] of [[1366,768],[543,704],[390,844]]){
   await browser.setViewport(width,height);
   const selector=surface==='offline'?'#btn-notes-toggle':'button[title="Notas Pedagógicas (Atalho: N)"]';
   await browser.evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);await wait(40);
   const q=await browser.evaluate(`(()=>{const p=document.querySelector('#teacher-notes-container')||document.querySelector('aside[aria-label="Notas do professor"]');const r=p?.getBoundingClientRect();return {notesText:p?.textContent,notesVisible:!!p&&getComputedStyle(p).display!=='none',notesInViewport:!!r&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,svgInvalid:Array.from(document.querySelectorAll('svg')).some(e=>/NaN|Infinity|undefined/.test(e.outerHTML))};})()`);
   quality.push({surface,id:c.id,width,height,...q,pass:q.notesVisible&&q.notesInViewport&&q.notesText.includes('Notas de teste para '+c.id)&&!q.overflow&&!q.svgInvalid});
   if(!quality.at(-1).pass)await browser.screenshot(path.join(output,'FAIL-layout-'+surface+'-'+c.id+'-'+width+'.png'));
   await browser.evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
  }
  await browser.setViewport(1024,768);
  const inputs=await browser.evaluate("Array.from(document.querySelectorAll('input[type=range]')).map(e=>({min:e.min,max:e.max,value:e.value,label:e.getAttribute('aria-label')||e.closest('label')?.textContent||e.id}))");
  for(let n=0;n<inputs.length;n++)for(const value of [inputs[n].min,inputs[n].max,inputs[n].value]){
   await browser.evaluate(`(()=>{const e=document.querySelectorAll('input[type=range]')[${n}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait(30);
   const invalid=await browser.evaluate("Array.from(document.querySelectorAll('svg')).some(e=>/NaN|Infinity|undefined/.test(e.outerHTML))");
   parameters.push({surface,id:c.id,input:n,label:inputs[n].label,value,valid:!invalid});
  }
  await fs.writeFile(path.join(output,'interfaces.json'),JSON.stringify({quality,parameters},null,2));
  console.log(surface,c.id,count,rows.filter(r=>r.pass===false).length+' falhas');
  await fs.writeFile(path.join(output,'resultados.json'),JSON.stringify({cases:new Set(rows.map(r=>r.id)).size,rows,errors},null,2));
 }
}finally{await browser.close();await vite.close();}
const summary={cases:new Set(rows.map(r=>r.id)).size,states:rows.length,passed:rows.filter(r=>r.pass===true).length,failed:rows.filter(r=>r.pass===false).length,withoutPlayback:rows.filter(r=>r.pass===null).length,errors,interfaceFailures:quality.filter(q=>!q.pass).length,interfaceChecks:quality.length,parameterChecks:parameters.length,parameterFailures:parameters.filter(p=>!p.valid).length};
await fs.writeFile(path.join(output,'resumo.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
if(summary.failed||errors.length||summary.interfaceFailures||summary.parameterFailures)process.exitCode=1;
