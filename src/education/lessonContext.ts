import type {LessonSpec, LessonReference} from '../types/lesson';

// Missing objectives remain readable for legacy lessons. Never invent or persist replacements.
export function lessonObjectives(lesson: LessonSpec): string[] {
  if (lesson.objectives === undefined) return [];
  if (!Array.isArray(lesson.objectives) || lesson.objectives.some(o=>typeof o!=='string'||!o.trim())) {
    throw new Error('Os objetivos da aula precisam ser uma lista de textos. Revise esse campo antes de exportar.');
  }
  return lesson.objectives;
}
export function referenceUrl(value: unknown): string | undefined {
  if(typeof value!=='string')return;
  try{const url=new URL(value);if(['https:','http:'].includes(url.protocol))return value;}catch{}
}
export function contextFromPack(pack: any): Pick<LessonSpec,'references'|'prerequisites'> {
  const references:LessonReference[]=[];
  for(const source of [...(pack.references||[]),...(pack.sources||[])]){
    const title=source.title||source.name;if(typeof title!=='string'||!title.trim())continue;
    const url=referenceUrl(source.url||source.reference_url);
    if(references.some(r=>url?r.url===url:r.title===title))continue;
    const kind=source.kind||(/bncc|MEC.*curricular/i.test(title)?'curriculum':source.provider==='PEMARA'?'authorship':'content');
    references.push({title,...(url?{url}:{}),kind:['curriculum','content','authorship'].includes(kind)?kind:'content',
      ...(typeof source.locator==='string'?{locator:source.locator}:{}),...(typeof source.license==='string'?{license:source.license}:{})});
  }
  return {prerequisites:Array.isArray(pack.prerequisites)?[...pack.prerequisites]:[],references};
}
export const referenceKindLabel=(kind?:string)=>kind==='curriculum'?'Referência curricular':kind==='authorship'?'Autoria':'Fonte de conteúdo';
