import type {LessonSpec, TextScene} from '../types/lesson';
import type {MaterialSelection, MaterialSceneOptions} from '../types/material';
import {MATERIAL_TEXT_LIMIT, MATERIAL_SCENE_LIMIT} from '../types/material';

/** Preserve every character, source and order. Only the teacher selects passages. */
export function splitMaterialText(text:string,max=345):string[] {
  if(!Number.isInteger(max)||max<2)throw new Error('Tamanho de trecho inválido.');
  const parts:string[]=[];
  while(text.length>max){
    let cut=text.lastIndexOf(' ',max);
    const newline=text.lastIndexOf('\n',max);
    cut=Math.max(cut,newline);
    if(cut<max/2)cut=max; else cut++;
    // Never split a surrogate pair.
    if(/[\uD800-\uDBFF]/.test(text[cut-1]))cut--;
    parts.push(text.slice(0,cut));text=text.slice(cut);
  }
  if(text)parts.push(text);
  return parts;
}
export function manualSelections(text:string):MaterialSelection[] {
  return text.trim()?[{materialId:'manual',filename:'Texto do professor',sourceUnit:'texto',sourceIndex:1,sourceLabel:'Texto próprio',text:text.trim()}]:[];
}
export function materialSceneCount(selections:MaterialSelection[]):number {
  return selections.reduce((n,s)=>n+splitMaterialText(s.text).length,0);
}
export function materialHeading(selection:MaterialSelection):string {
  const explicit=selection.heading?.trim();
  if(explicit)return explicit.slice(0,100);
  const lead=selection.text.trim().match(/^([^.!?\n]{3,80})[.!?\n]/u)?.[1];
  // Only use an explicit uppercase heading, never infer a summary of the passage.
  return lead && /[A-ZÀ-Ý]/.test(lead) && lead===lead.toLocaleUpperCase('pt-BR')
    ? lead.charAt(0)+lead.slice(1).toLocaleLowerCase('pt-BR') : `Material • ${selection.sourceLabel}`;
}
export function materialPart(selection:MaterialSelection):NonNullable<MaterialSelection['lessonPart']> {
  if(selection.lessonPart)return selection.lessonPart;
  const lead=selection.text.trim().split(/[.!?\n]/,1)[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/^(avaliacao|avaliacao de saida|verificacao|sintese|conclusao)$/.test(lead))return 'assessment';
  if(/^(desafio inicial|abertura|pergunta inicial|diagnostico)$/.test(lead))return 'opening';
  return 'development';
}
export function orderedMaterials(selections:MaterialSelection[]):MaterialSelection[] {
  const order={opening:0,development:1,assessment:2};
  return [...selections].sort((a,b)=>order[materialPart(a)]-order[materialPart(b)]);
}
export function mergeSelectedMaterials(lesson:LessonSpec,selections:MaterialSelection[],options:MaterialSceneOptions={maxScenes:8,position:'after-opening'}) {
  if(!selections.length)return {lesson,included:0,warnings:[] as string[]};
  const length=selections.reduce((n,s)=>n+s.text.length,0);
  if(length>MATERIAL_TEXT_LIMIT)throw new Error('Selecione até 120 mil caracteres. Nenhum trecho será cortado automaticamente.');
  if(!Number.isInteger(options.maxScenes)||options.maxScenes<1||options.maxScenes>MATERIAL_SCENE_LIMIT||!['before-summary','after-opening','lesson-flow','material-only'].includes(options.position))throw new Error('Opções de inserção de material inválidas.');
  const max=options.maxScenes;
  const count=materialSceneCount(selections);
  if(count>max)throw new Error(`Os trechos selecionados precisam de ${count} cenas; o limite escolhido é ${max}. Reduza a seleção ou aumente o limite.`);
  const next=structuredClone(lesson), ids=new Set(next.scenes.map(s=>s.id));
  const scenes:TextScene[]=[];
  const grouped:Record<string,TextScene[]>={opening:[],development:[],assessment:[]};
  for(const [i,selection] of selections.entries()){
    const label=`${selection.filename} · ${selection.sourceLabel}`;
    for(const [part,text] of splitMaterialText(selection.text).entries()){
      let id=`material-${i+1}-${part+1}`;while(ids.has(id))id+='-copy';ids.add(id);
      const scene:TextScene={id,type:'text',layout_id:'02_title_body',title:`${materialHeading(selection)}${part?' (continuação)':''}`,
        content:[text],source_citation:label,material_source:{materialId:selection.materialId,sha256:selection.sha256,filename:selection.filename,sourceUnit:selection.sourceUnit,sourceIndex:selection.sourceIndex},
        teacher_notes:'Trecho selecionado pelo professor. Conferir a extração e a pertinência ao objetivo da aula antes de apresentar.'};
      scenes.push(scene);grouped[materialPart(selection)].push(scene);
    }
  }
  const summary=next.scenes.findIndex(s=>s.type==='summary');
  const insert=options.position==='before-summary'?(summary<0?next.scenes.length:summary):(next.scenes[0]?.type==='title'?1:0);
  if(options.position==='material-only') {
    next.scenes=[...next.scenes.filter(s=>s.type==='title').slice(0,1),...grouped.opening,...grouped.development,...grouped.assessment];
    next.objectives=['Explorar o material selecionado e justificar as respostas às atividades.'];
    const title=next.scenes[0];
    if(title?.type==='title'){
      title.subtitle='Aula preparada com o material do professor';
      title.badge='Material do professor · revisão pedagógica';
      title.teacher_notes='Apresente o objetivo do material selecionado e ouça as ideias iniciais da turma.';
    }
    // The selected material is not automatically certified against the broader catalog skills.
    delete next.lesson.bncc_skill;delete next.lesson.content_pack_hash;delete next.lesson.content_pack_version;delete next.lesson.source_id;
  }else if(options.position==='lesson-flow') {
    const firstActivity=next.scenes.findIndex(s=>s.type==='quiz'||s.type==='summary'||/^atividade\b/i.test(s.title));
    next.scenes.splice(firstActivity<0?next.scenes.length:firstActivity,0,...grouped.development);
    const closing=next.scenes.findIndex(s=>s.type==='summary');
    next.scenes.splice(closing<0?next.scenes.length:closing,0,...grouped.assessment);
    next.scenes.splice(next.scenes[0]?.type==='title'?1:0,0,...grouped.opening);
  }else next.scenes.splice(insert,0,...scenes);
  return {lesson:next,included:scenes.length,warnings:['Os trechos mantêm a ordem e a origem selecionadas; revisão pedagógica do professor necessária.']};
}
/** Compatibility only: retain labels across blank paragraphs; never rank unrelated text. */
export function mergeMaterialScenes(lesson:LessonSpec,text:string,maxScenes=8){
  let label='Texto do professor';
  const selections:MaterialSelection[]=[];
  for(const block of text.replace(/\r\n/g,'\n').split(/\n\s*\n/).filter(s=>s.trim())){
    const match=block.match(/^【([^】]+)】\s*([\s\S]*)$/);
    if(match)label=match[1];
    selections.push({materialId:'manual',filename:label,sourceUnit:'texto',sourceIndex:selections.length+1,sourceLabel:label,text:match?match[2]:block});
  }
  const result=mergeSelectedMaterials(lesson,selections,{maxScenes,position:'after-opening'});
  result.lesson.scenes.filter(s=>s.material_source).forEach(s=>{s.source_citation=s.material_source!.filename;});
  return {...result,total:selections.length};
}
