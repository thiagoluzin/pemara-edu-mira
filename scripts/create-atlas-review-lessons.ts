import fs from 'node:fs';
import {ATLAS} from '../src/animations/atlas';
import {ATLAS_REVIEW} from '../src/animations/atlasReview';
import {TEMPLATE_SOLAR_SYSTEM} from '../src/templates/deterministicTemplates';
import type {Subject} from '../src/types/lesson';
const out='docs/evidencias/atlas-movimento-integral-20261017';
const existing=await (await fetch('http://127.0.0.1:3001/api/lessons')).json();
fs.writeFileSync(out+'/acervo-antes.json',JSON.stringify(existing,null,2),{flag:'wx'});
const names:Partial<Record<Subject,string>>={science:'Ciências',geography:'Geografia',math:'Matemática',portuguese:'Língua Portuguesa',history:'História',arts:'Arte',physical_education:'Educação Física',religious_education:'Diálogo e respeito'};
const created=[];
for(const [subject,name] of Object.entries(names)){
 const profiles=ATLAS.filter(p=>p.subjects[0]===subject),spec=structuredClone(TEMPLATE_SOLAR_SYSTEM),title=`Atlas em movimento — ${name}`;
 spec.lesson={id:'atlas-review-'+subject,subject:subject as Subject,grade:'6EF',topic:'Revisão dos modelos do Atlas',title,duration_minutes:45,language:'pt-BR',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),generation_mode:'MODE_A_NO_AI',didactic_style:'visual',visual_status:'NEEDS_REVIEW'};
 spec.objectives=['Explorar os modelos, comparar as opções e explicar o que muda na representação.'];
 spec.scenes=[{id:'abertura',type:'title',title,subtitle:'Explore as opções, reproduza, pause e compare.',teacher_notes:'Esta aula reúne modelos para revisão. Escolha os adequados ao conteúdo e à turma. Não é uma sequência curricular completa. As representações são simplificadas e não estão em escala.'},...profiles.map(p=>({id:p.id,type:'text' as const,title:p.name,atlas_model:p.id,content:['Observe o movimento e pause para comparar.','Troque a opção e explique o que mudou.'],teacher_notes:((ATLAS_REVIEW as any)[p.id]?.action||'Compare as fases e os movimentos relativos representados.')+' Peça uma previsão antes de reproduzir. Pause e compare duas etapas. Diferencie o fenômeno real da simplificação do modelo; a repetição recomeça o esquema.'}))];
 const r=await fetch('http://127.0.0.1:3001/api/lessons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,subjectCode:subject,gradeLevel:'6EF',topic:spec.lesson.topic,spec})});const result=await r.json();if(!r.ok)throw new Error(JSON.stringify(result));
 const saved=await (await fetch('http://127.0.0.1:3001/api/lessons/'+result.lesson.id)).json();fs.writeFileSync(out+'/aula-'+subject+'.json',JSON.stringify(saved,null,2),{flag:'wx'});
 created.push({id:result.lesson.id,title,subject,kinds:profiles.map(p=>p.id),file:`EXPORTACOES/Atlas-integral-${subject}-20261017.html`});fs.writeFileSync(out+'/aulas.json',JSON.stringify(created,null,2));
}
console.log(JSON.stringify(created));
