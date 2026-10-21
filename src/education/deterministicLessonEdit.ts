import type {LessonSpec} from '../types/lesson';
import type {AuthoringKind} from './teacherAuthoring';
export interface LessonEditResult {status:'applied'|'no_change'|'unsupported'|'needs_authoring';updatedLesson:LessonSpec;affectedScenes:string[];message:string;authoring?:AuthoringKind}
export function editByInstruction(original:LessonSpec,instruction:string):LessonEditResult {
  const unchanged=(status:LessonEditResult['status'],message:string,authoring?:AuthoringKind):LessonEditResult=>({status,updatedLesson:original,affectedScenes:[],message,...(authoring?{authoring}:{})});
  const command=instruction.trim().replace(/[.!]$/,'');
  const lower=command.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/^(adicione|adicionar|crie|criar) (um |uma )?(quiz|questionario|pergunta|questao)$/.test(lower))return unchanged('needs_authoring','Escreva a questão com base no conteúdo da aula e confira o gabarito.','quiz');
  if(/^(adicione|adicionar) (um |uma )?exemplos?$/.test(lower))return unchanged('needs_authoring','Escreva um exemplo relacionado ao objetivo da aula.','example');
  if(/^(deixe|deixar) (os textos |o texto )?mais (simples|facil)( e didaticos)?$/.test(lower)||lower==='simplificar')return unchanged('needs_authoring','Revise o texto mantendo os conceitos e confira a prévia antes de aplicar.','revise');
  const title=command.match(/^(?:troque|altere|mude) o t[ií]tulo (?:para|por)\s+(.+)$/i);
  const gravity=lower.match(/^(?:(?:altere|mude|ajuste) (?:a )?)?gravidade (?:para |da |de |do )?(lua|marte|jupiter|terra)$/);
  const angle=lower.match(/^(?:(?:altere|mude|ajuste) (?:o )?)?angulo(?: para)?\s+(\d+(?:[.,]\d+)?)\s*(?:graus|°)$/);
  const speed=lower.match(/^(?:(?:altere|mude|ajuste) (?:a )?)?(?:velocidade|v0)(?: para)?\s+(\d+(?:[.,]\d+)?)(?:\s*m\/s)?$/);
  if(!title&&!gravity&&!angle&&!speed)return unchanged('unsupported','Pedido não aplicado. Use um comando de título ou parâmetro da simulação, ou os formulários de autoria.');
  const lesson=structuredClone(original),affected:string[]=[];
  if(title){
    const value=title[1].trim();if(value.length>200)return unchanged('unsupported','O título deve ter até 200 caracteres.');
    if(value===lesson.lesson.title)return unchanged('no_change','O título já é esse. Nenhuma alteração feita.');
    lesson.lesson.title=value;
    if(lesson.scenes[0]?.type==='title'){lesson.scenes[0].title=value;affected.push(lesson.scenes[0].id);}
  }else{
    const key=gravity?'gravity':angle?'angle':'velocity';
    const value=gravity?({lua:1.62,marte:3.71,jupiter:24.79,terra:9.81}[gravity[1]]!):Number((angle||speed)![1].replace(',','.'));
    if(!Number.isFinite(value)||(angle&&(value<0||value>90))||(speed&&(value<=0||value>200)))return unchanged('unsupported','Parâmetro fora do intervalo: ângulo de 0 a 90 graus; velocidade maior que 0 e até 200 m/s.');
    const scenes=lesson.scenes.filter(s=>s.type==='physics_projectile');
    if(!scenes.length)return unchanged('unsupported','Esta aula não possui uma simulação de lançamento para alterar.');
    for(const scene of scenes){if(scene.params[key]!==value){scene.params[key]=value;affected.push(scene.id);}}
    if(!affected.length)return unchanged('no_change','Os parâmetros já têm esses valores. Nenhuma alteração feita.');
  }
  lesson.lesson_version+=1;lesson.lesson.updatedAt=new Date().toISOString();lesson.lesson.visual_status='NEEDS_REVIEW';
  return {status:'applied',updatedLesson:lesson,affectedScenes:affected,message:title?'Título atualizado na prévia.':'Parâmetros atualizados na prévia. Confira as páginas indicadas.'};
}
