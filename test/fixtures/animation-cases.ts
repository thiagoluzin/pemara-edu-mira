import {ATLAS} from '../../src/animations/atlas';
import {VISUAL_LAYOUTS} from '../../src/engine/teachingVisual';
import {TEMPLATE_SOLAR_SYSTEM} from '../../src/templates/deterministicTemplates';
import type {Scene,Subject,LessonSpec} from '../../src/types/lesson';
export interface AnimationCase {id:string;family:string;spec:LessonSpec}
const make=(id:string,family:string,scene:Scene,subject:Subject='science'):AnimationCase=>{
 const spec=structuredClone(TEMPLATE_SOLAR_SYSTEM);spec.lesson.subject=subject;spec.lesson.title=id;spec.scenes=[{...scene,teacher_notes:'Notas de teste para '+id+'. Observe, pause, compare e explique o modelo.'}];return {id,family,spec};
};
export const animationCases:AnimationCase[]=[
 ...ATLAS.map(p=>make('atlas-'+p.id,'atlas',{id:p.id,type:'text',title:p.name,content:['Observe o modelo. Compare e explique.'],atlas_model:p.id},p.subjects[0])),
 ...([
 ['cell','Citoplasma','science'],['organization','Organização: células, tecidos e órgãos','science'],
 ['fractions','Fração 3/8','math'],['number_line','Reta numérica de inteiros','math'],
 ['timeline','Eventos em 1800 e 1900','history'],['particles','Estados físicos: sólido e líquido','chemistry'],
 ['circuit','Circuito elétrico','physics'],['water_cycle','Ciclo da água','science'],
 ['geometry','Polígonos','math'],['earth_layers','Camadas da Terra','geography'],
 ['orbit','Translação da Terra','science'],['language','Organização do texto','portuguese'],
 ['movement','Coordenação','physical_education'],['colors','RGB: luz digital','arts'],['concepts','Perguntas da turma','science'],
 ] as [string,string,Subject][]).map(([id,title,subject])=>make('base-'+id,'base',{id,type:'text',title,content:[title+'.','Observe o modelo. Compare e explique.']},subject)),
 ...VISUAL_LAYOUTS.map(layout=>make('visual-'+layout,'teaching',{id:layout,type:'text',title:layout,content:['Primeira ideia.','Segunda ideia.'],visual:{layout,caption:'Leitura guiada de relações explicitadas pelo professor.',nodes:[{id:'a',label:'Primeira ideia',icon:'document',step:0},{id:'b',label:'Segunda ideia',icon:'book',step:1}],links:layout==='cards'||layout==='comparison'?[]:[{from:'a',to:'b',label:'relação'}]}})),
 ...(['animal','plant'] as const).map(cell_type=>make('biology-'+cell_type,'biology',{id:cell_type,type:'biology_model',title:'Estrutura celular',params:{model:'cell_structure',cell_type}})),
 make('biology-organization','biology',{id:'organization',type:'biology_model',title:'Níveis de organização',params:{model:'organization',cell_type:'animal'}}),
 make('projectile','simulation',{id:'projectile',type:'physics_projectile',title:'Lançamento oblíquo',params:{velocity:20,angle:45,gravity:9.81,initial_height:2,show_vectors:true,show_trajectory:true}}),
 make('solar','simulation',{id:'solar',type:'solar_system',title:'Sistema solar',params:{central_body:'Sun',focused_planet:'Earth',speed_multiplier:1,show_orbits:true,show_labels:true,show_data_cards:true}}),
 ...(['parabola','linear','sine'] as const).map(function_type=>make('function-'+function_type,'interactive',{id:function_type,type:'math_function',title:'Função '+function_type,params:{function_type,a:1,b:2,c:0}},'math')),
 make('timeline','interactive',{id:'timeline',type:'timeline',title:'Linha do tempo',params:{events:[{year:'1800',title:'Exemplo A',description:'Primeiro evento hipotético.'},{year:'1900',title:'Exemplo B',description:'Segundo evento hipotético.'}]}}),
 make('map','interactive',{id:'map',type:'map',title:'Brasil',params:{region_name:'Brasil',focus_points:[{name:'Brasília',lat:-15.79,lon:-47.88,region:'Brasil',role:'Capital'}]}}),
 make('comparison','interactive',{id:'comparison',type:'comparison',title:'Comparação',params:{columns:['A','B'],rows:[{criteria:'Exemplo',A:'Um',B:'Dois'}]}}),
 make('quiz','interactive',{id:'quiz',type:'quiz',title:'Verificação',question:'Quanto é 1 + 1?',answers:['2','3'],correct_index:0,explanation:'Um mais um corresponde a dois.'}),
 make('title','static',{id:'title',type:'title',title:'Abertura',subtitle:'Apresentação da aula'}),
 make('summary','teaching',{id:'summary',type:'summary',title:'Síntese',takeaways:['Primeira conclusão.','Segunda conclusão.']})
];
