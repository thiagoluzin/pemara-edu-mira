import fs from 'node:fs/promises';
import path from 'node:path';
import {animationCases} from '../test/fixtures/animation-cases';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import {readCompleteCatalog,makePayload} from '../server/curriculum/completeCatalog';
import {LessonComposer} from '../src/composer/lessonComposer';
import {createLearningPlan,isLearningScene,learningDiagram} from '../src/engine/learningVisual';
import {hasLearningMotion} from '../src/engine/learningMotion';
const folder=path.resolve(process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'docs/evidencias/auditoria-animacoes-20261017');await fs.mkdir(folder,{recursive:true});
const inventory={topics:0,scenes:0,learningFrames:0,withoutMotion:[] as string[],kinds:{} as Record<string,number>};
for(const pack of readCompleteCatalog()){
 const lesson=LessonComposer.compose({discipline:pack.subjectCode,grade:`${pack.gradeLevel}EF`,topic:pack.title,duration:45,teaching_method:'complete'},makePayload(pack,'1.0.0'));
 inventory.topics++;
 for(const scene of lesson.scenes){inventory.scenes++;if(!isLearningScene(scene))continue;const p=createLearningPlan(scene,lesson.lesson);inventory.kinds[p.kind]=(inventory.kinds[p.kind]||0)+1;
  for(let v=0;v<Math.max(1,p.variants.length);v++)for(let step=0;step<p.steps.length;step++){inventory.learningFrames++;const svg=learningDiagram(p,step,v);if(!hasLearningMotion(svg))inventory.withoutMotion.push(pack.slug+'/'+scene.id+'/'+v+'/'+step);if(/NaN|Infinity|undefined/.test(svg))throw Error('SVG inválido: '+pack.slug+'/'+scene.id);}
 }
}
await fs.writeFile(path.join(folder,'cobertura-acervo.json'),JSON.stringify(inventory,null,2));
const names:Record<string,string>={'visual-flow':'Sequência de ideias','visual-cycle':'Ciclo de relações','visual-comparison':'Comparação de ideias','visual-hierarchy':'Hierarquia de conceitos','visual-cards':'Cartões de leitura','function-parabola':'Função quadrática','function-sine':'Função seno','biology-animal':'Célula animal','biology-plant':'Célula vegetal'};
const families:Record<string,string>={atlas:'Atlas',base:'Modelo exploratório',teaching:'Leitura guiada',biology:'Biologia',simulation:'Simulação',interactive:'Atividade interativa',static:'Abertura'};
const entries=animationCases.map(item=>{const spec=structuredClone(item.spec);const title=names[item.id]||spec.scenes[0].title;spec.lesson.title=title;spec.scenes[0].title=title;return {id:item.id,title,family:families[item.family],html:generateStandaloneHtml(spec)};});
const lesson=await(await fetch('http://127.0.0.1:3001/api/lessons/lesson-1792270026130-18ee66')).json();
if(lesson.currentSpec){const html=generateStandaloneHtml(lesson.currentSpec);entries.push({id:'aula-professor',title:'Aula completa — Separação de misturas',family:'aula',html});await fs.writeFile(path.join(folder,'separacao-de-misturas-animada.html'),html);}
const data=JSON.stringify(entries).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PEMARA — Catálogo de animações para revisão</title><style>body{margin:0;font:16px system-ui;background:#071529;color:#e2e8f0}header{padding:14px 22px;background:#102238}h1{font-size:22px;margin:0 0 8px}p{font-size:14px;margin:8px 0;color:#b8c7dc}select,button{font:inherit;padding:9px;background:#18364a;border:1px solid #22d3ee;border-radius:8px;color:white;max-width:100%}iframe{width:100%;height:calc(100dvh - 180px);min-height:550px;border:0}label{display:inline-block;margin-right:12px}</style></head><body><header><h1>PEMARA · Explorar as animações</h1><p>Arquivo offline. Experimente reproduzir, pausar, recomeçar e trocar variantes. Guias de leitura destacam informações; modelos de processos mostram movimentos esquemáticos.</p><label>Modelo <select id="models"></select></label><button id="previous">Anterior</button> <button id="next">Próximo</button><p id="kind"></p></header><iframe title="Modelo selecionado" sandbox="allow-scripts"></iframe><script>const entries=${data};const select=document.querySelector('select'),frame=document.querySelector('iframe');entries.forEach((e,i)=>{const o=document.createElement('option');o.value=i;o.textContent=e.title+' · '+e.family;select.append(o)});function show(i){select.value=Math.max(0,Math.min(entries.length-1,i));const e=entries[Number(select.value)];frame.srcdoc=e.html;document.querySelector('#kind').textContent=(Number(select.value)+1)+' / '+entries.length+' · '+e.family;document.querySelector('#previous').disabled=Number(select.value)===0;document.querySelector('#next').disabled=Number(select.value)===entries.length-1;}select.onchange=()=>show(Number(select.value));document.querySelector('#previous').onclick=()=>show(Number(select.value)-1);document.querySelector('#next').onclick=()=>show(Number(select.value)+1);show(entries.findIndex(e=>e.id==='atlas-separation'));</script></body></html>`;
await fs.writeFile(path.join(folder,'EXPLORAR-ANIMACOES.html'),html);console.log(JSON.stringify({entries:entries.length,...inventory}));
