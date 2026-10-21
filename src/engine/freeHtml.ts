import type {LessonSpec} from '../types/lesson';
import {ATLAS,isAtlasKind} from '../animations/atlas';

export const MAX_PRESENTATION_HTML=120000;
export const escapeHtmlAttribute=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function extractPresentationHtml(text:string):string {
  const start=text.search(/<!doctype\s+html\b/i),end=text.toLowerCase().lastIndexOf('</html>');
  if(start<0||end<start)throw Error('Retorne um documento HTML completo, do DOCTYPE ao fechamento html.');
  return text.slice(start,end+7);
}
export function presentationMetadata(html:string):{title:string;objectives:string[];teacher_notes:string} {
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  const found=scripts.filter(m=>/\bid\s*=\s*["']pemara-metadata["']/i.test(m[1])&&/\btype\s*=\s*["']application\/json["']/i.test(m[1]));
  if(found.length!==1)throw Error('Inclua um script application/json com id pemara-metadata, title, objectives e teacher_notes.');
  const data=JSON.parse(found[0][2]);
  if(typeof data.title!=='string'||!data.title.trim()||data.title.length>160||!Array.isArray(data.objectives)||!data.objectives.length||data.objectives.length>10||data.objectives.some((v:unknown)=>typeof v!=='string'||!v.trim()||v.length>500)||typeof data.teacher_notes!=='string'||!data.teacher_notes.trim()||data.teacher_notes.length>12000)throw Error('Metadados incompletos: título, objetivos observáveis e notas do professor são obrigatórios.');
  return {title:data.title.trim(),objectives:data.objectives,teacher_notes:data.teacher_notes};
}
export function htmlPresentationIssues(html:unknown):string[] {
  if(typeof html!=='string'||html.length<500||html.length>MAX_PRESENTATION_HTML)return ['A apresentação deve conter um HTML completo de até 120 mil caracteres.'];
  const issues:string[]=[];
  if(!/^<!doctype\s+html\b/i.test(html)||!/<head[\s>]/i.test(html)||!/<body[\s>]/i.test(html)||!/<\/html>\s*$/i.test(html))issues.push('Documento HTML incompleto.');
  if(!/\bdata-slide(?:\s|=|>)/i.test(html))issues.push('Marque os slides com data-slide para leitura, impressão e revisão.');
  try{presentationMetadata(html);}catch(e){issues.push(e instanceof Error?e.message:'Metadados inválidos.');}
  return issues;
}
export function validateFreePresentation(p:any,subject:string):string[] {
  if(!p||p.format!=='html'||p.content_kind!=='animation')return ['Formato de apresentação livre inválido.'];
  const errors=htmlPresentationIssues(p.html);
  if(!Array.isArray(p.atlas_models)||p.atlas_models.length>26||new Set(p.atlas_models).size!==p.atlas_models.length||p.atlas_models.some((id:any)=>!isAtlasKind(id)||!(ATLAS.find(a=>a.id===id)!.subjects as readonly string[]).includes(subject)))errors.push('Complementos Atlas inválidos para a disciplina.');
  return errors;
}
const contentPolicy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export function isolatedHtml(html:string):string {
  // First policy is owned by the application. Later policies can only restrict it.
  return html.replace(/<head\b[^>]*>/i,m=>m+`<meta http-equiv="Content-Security-Policy" content="${contentPolicy}">`);
}
export function presentationEnvelope(html:string,title:string,atlasHtml?:string):string {
  const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src about: data: blob:; img-src data:; base-uri 'none'; form-action 'none'";
  // The trusted outer document blocks child navigations to HTTP/file destinations.
  // Neither iframe grants same-origin, forms, downloads, popups or top navigation.
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>${escapeHtmlAttribute(title)}</title><style>html,body{margin:0;width:100%;height:100%;background:#081323}body{display:flex;flex-direction:column}nav{padding:8px;display:flex;gap:8px;font:15px system-ui;color:white}button{padding:8px 16px;cursor:pointer}iframe{width:100%;flex:1;min-height:0;border:0}iframe[hidden]{display:none}</style></head><body>${atlasHtml?'<nav aria-label="Conteúdo da aula"><button id="lesson-tab">Apresentação</button><button id="atlas-tab">Atlas complementar</button></nav>':''}<iframe id="lesson" title="${escapeHtmlAttribute(title)}" sandbox="allow-scripts" allow="fullscreen" referrerpolicy="no-referrer" srcdoc="${escapeHtmlAttribute(isolatedHtml(html))}"></iframe>${atlasHtml?`<iframe id="atlas" title="Atlas complementar" hidden sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${escapeHtmlAttribute(isolatedHtml(atlasHtml))}"></iframe><script>const lesson=document.getElementById('lesson'),atlas=document.getElementById('atlas');document.getElementById('lesson-tab').onclick=()=>{lesson.hidden=false;atlas.hidden=true};document.getElementById('atlas-tab').onclick=()=>{lesson.hidden=true;atlas.hidden=false};</script>`:''}</body></html>`;
}
export function atlasSupplement(lesson:LessonSpec):LessonSpec|undefined {
  const models=lesson.presentation?.atlas_models||[];
  if(!models.length)return;
  const copy=structuredClone(lesson);delete copy.presentation;
  copy.lesson.title='Atlas complementar — '+lesson.lesson.title;
  copy.scenes=models.map(id=>{const model=ATLAS.find(m=>m.id===id)!;return {id:'atlas-'+id,type:'text',title:model.name,atlas_model:id,content:[model.caption],teacher_notes:'Complemento selecionado pelo professor. Relacione a exploração com a apresentação e explique os limites do modelo.'};});
  return copy;
}
/** Static copy of the actual slide DOM, never a second invented lesson transcript. */
export function printFreePresentation(lesson:LessonSpec,includeNotes=false):string {
  if(typeof DOMParser==='undefined')throw Error('Abra a aula no navegador para preparar a impressão.');
  const doc=new DOMParser().parseFromString(lesson.presentation!.html,'text/html');
  // Screen breakpoints can hide diagrams in Chromium's small PDF window.
  // Keep the base design and explicit print rules in this static copy.
  if(typeof CSSStyleSheet!=='undefined')for(const style of doc.querySelectorAll('style')){
    try{const sheet=new CSSStyleSheet();sheet.replaceSync(style.textContent||'');style.textContent=[...sheet.cssRules].filter(rule=>!(rule instanceof CSSMediaRule)||/\b(?:print|all)\b/i.test(rule.conditionText)).map(rule=>rule.cssText).join('\n');}catch{/* Preserve a stylesheet if this browser cannot parse it. */}
  }
  // Freeze SVG travel at its first point instead of dropping the object at (0,0).
  for(const motion of doc.querySelectorAll('animateMotion')){
    try{
      const link=motion.querySelector('mpath')?.getAttribute('href')||motion.querySelector('mpath')?.getAttribute('xlink:href');
      const data=motion.getAttribute('path')||(link?.startsWith('#')?doc.getElementById(link.slice(1))?.getAttribute('d'):null);
      if(data&&motion.parentElement){const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',data);const point=path.getPointAtLength(0);const parent=motion.parentElement;parent.setAttribute('transform',`${parent.getAttribute('transform')||''} translate(${point.x} ${point.y})`);}
    }catch{/* Unknown motion syntax retains the author's static fallback. */}
  }
  doc.querySelectorAll('script,iframe,frame,object,embed,form,base,meta,link,animate,animateMotion,animateTransform,set,nav,[role="navigation"]').forEach(el=>el.remove());
  // Activity choices are content too. Keep their labels in paper/Word.
  doc.querySelectorAll('button').forEach(button=>{const text=doc.createElement('span');text.textContent=button.textContent;button.replaceWith(text);});
  if(!includeNotes)doc.querySelectorAll('[data-teacher-notes],[data-answer]').forEach(el=>el.remove());
  else doc.querySelectorAll('[data-teacher-notes],[data-answer]').forEach(el=>el.removeAttribute('hidden'));
  doc.querySelectorAll('*').forEach(el=>{
    for(const attr of [...el.attributes])if(/^on/i.test(attr.name)||['srcdoc','action','formaction'].includes(attr.name)||(/^(?:href|xlink:href)$/i.test(attr.name)&&!/^(?:#|https?:\/\/)/i.test(attr.value))||(attr.name==='src'&&!/^data:image\//i.test(attr.value)))el.removeAttribute(attr.name);
  });
  const slides=[...doc.querySelectorAll('[data-slide]')];
  if(!slides.length)throw Error('Esta apresentação não identifica os slides para impressão.');
  // Drop presentation chrome outside slides, keeping shared SVG definitions.
  const sharedDefs=[...doc.querySelectorAll('svg defs')].filter(el=>!el.closest('[data-slide]')).map(el=>el.cloneNode(true));
  for(const el of [...doc.body.querySelectorAll('*')])if(!el.closest('[data-slide]')&&!el.querySelector('[data-slide]'))el.remove();
  if(sharedDefs.length){const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('style','position:absolute');svg.append(...sharedDefs);doc.body.prepend(svg);}
  for(const slide of slides){slide.classList.add('print-slide-page');slide.removeAttribute('hidden');slide.removeAttribute('aria-hidden');for(let parent=slide.parentElement;parent;parent=parent.parentElement)parent.setAttribute('data-print-container','');}
  const style=doc.createElement('style');
  style.textContent=`@page{size:A4 landscape;margin:12mm}html,body,[data-print-container]{display:block!important;position:static!important;width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;transform:none!important}.print-slide-page{display:block!important;position:relative!important;inset:auto!important;width:100%!important;height:auto!important;min-height:160mm!important;max-height:none!important;overflow:visible!important;transform:none!important;break-after:page!important;padding:16px!important;opacity:1!important;visibility:visible!important}.print-slide-page *{animation:none!important;transition:none!important;opacity:1!important;visibility:visible!important}.print-slide-page [hidden]{display:none!important}[data-print-last]{break-after:auto!important}body>header,body>footer{display:none!important}`;
  doc.head.append(style);
  if(includeNotes){const section=doc.createElement('section');section.className='print-slide-page';const h=doc.createElement('h2');h.textContent='Notas do professor';section.append(h);for(const scene of lesson.scenes){if(scene.teacher_notes){const p=doc.createElement('p');p.textContent=scene.teacher_notes;section.append(p);}}doc.body.append(section);}
  [...doc.querySelectorAll('.print-slide-page')].at(-1)?.setAttribute('data-print-last','');
  return '<!doctype html>'+isolatedHtml(doc.documentElement.outerHTML);
}
