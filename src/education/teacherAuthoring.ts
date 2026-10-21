import type {LessonSpec, Scene, TextScene} from '../types/lesson';
import {validateLessonSpec} from '../schemas/lessonValidator';

export type AuthoringKind='quiz'|'example'|'revise';
export interface AuthoringInput {kind:AuthoringKind;sourceSceneId:string;objective:string;title:string;question:string;answers:string[];correctIndex:number;explanation:string;content:string[];callout:string}
export function authoringSource(scene:Scene):string {
  if(scene.type==='text')return [scene.title,...scene.content,...(scene.bullets||[]),scene.callout||''].filter(Boolean).join('\n\n');
  if(scene.type==='summary')return [scene.title,...scene.takeaways].join('\n\n');
  if(scene.type==='quiz')return [scene.title,scene.question,...scene.answers,scene.explanation].join('\n\n');
  return scene.title+'\n'+(scene.teacher_notes||'Consulte esta representação na aula antes de escrever.');
}
export function prepareTeacherEdit(original:LessonSpec,input:AuthoringInput):LessonSpec {
  const source=original.scenes.find(s=>s.id===input.sourceSceneId);
  if(!source)throw Error('Selecione uma página existente como referência.');
  const text=(value:string,label:string,max=5000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`Preencha ${label} (até ${max} caracteres).`);return value.trim();};
  const lesson=structuredClone(original);
  const objective=text(input.objective,'o objetivo avaliado ou trabalhado',1000);
  const notes=`Autoria docente. Objetivo: ${objective}\nPágina de referência: ${source.id} — ${source.title}`;
  let scene:Scene;
  if(input.kind==='quiz'){
    const answers=input.answers.map(a=>text(a,'cada alternativa',500));
    if(answers.length<2||answers.length>6||new Set(answers.map(a=>a.toLocaleLowerCase('pt-BR'))).size!==answers.length)throw Error('Informe de duas a seis alternativas distintas.');
    if(!Number.isInteger(input.correctIndex)||input.correctIndex<0||input.correctIndex>=answers.length)throw Error('Selecione a alternativa correta.');
    scene={id:crypto.randomUUID(),type:'quiz',title:text(input.title,'o título',100),question:text(input.question,'o enunciado',2000),answers,correct_index:input.correctIndex,explanation:text(input.explanation,'a justificativa do gabarito e dos distratores'),teacher_notes:notes};
    lesson.scenes.push(scene);
  }else if(input.kind==='example'){
    scene={id:crypto.randomUUID(),type:'text',title:text(input.title,'o título',100),content:input.content.map(p=>text(p,'o exemplo')),teacher_notes:notes};
    if(!scene.content.length)throw Error('Escreva um exemplo relacionado ao objetivo.');
    lesson.scenes.push(scene);
  }else{
    if(source.type!=='text')throw Error('Escolha uma página de texto para revisar.');
    // Preserve paragraph indexes, diagrams, notes and quotations unless the teacher explicitly edits them.
    if(input.content.length!==source.content.length)throw Error('Mantenha a quantidade de parágrafos para preservar as etapas do desenho.');
    const revised:TextScene={...structuredClone(source),content:input.content.map(p=>text(p,'cada parágrafo'))};
    if(input.callout !== (source.callout || '')) revised.callout=input.callout;
    if(JSON.stringify(revised)===JSON.stringify(source))throw Error('Nenhuma alteração feita. A aula permanece intacta.');
    lesson.scenes=lesson.scenes.map(s=>s.id===source.id?revised:s);
  }
  const validation=validateLessonSpec(lesson);
  if(!validation.isValid)throw Error(validation.errors.join(' '));
  lesson.lesson_version+=1;lesson.lesson.updatedAt=new Date().toISOString();lesson.lesson.visual_status='NEEDS_REVIEW';
  return lesson;
}
