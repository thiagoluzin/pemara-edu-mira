import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {TEMPLATE_SOLAR_SYSTEM} from '../src/templates/deterministicTemplates';
import type {Subject} from '../src/types/lesson';
const out='docs/evidencias/atlas-laboratorios-20261018',base='http://127.0.0.1:3001/api/lessons';
const previous=await (await fetch(base)).json();
const originals=[];
for(const l of previous.lessons){const saved=await(await fetch(base+'/'+l.id)).json();originals.push({id:l.id,title:l.title,sha256:createHash('sha256').update(JSON.stringify(saved)).digest('hex'),saved});}
fs.writeFileSync(out+'/acervo-original.json',JSON.stringify(originals,null,2),{flag:'wx'});
const pilots=[
 {slug:'respiracao',kind:'respiration',subject:'science',name:'Respiração',title:'Respiração: o tórax em movimento',content:['Antes de reproduzir, preveja: o diafragma sobe ou desce quando o ar entra?','Ajuste o ritmo, avance um passo e compare inspiração, expiração e trocas gasosas.'],notes:'Comece em 12 ciclos por minuto. Pause na inspiração: o diafragma contrai e desce, aumentando o volume torácico. Na expiração tranquila ele relaxa e sobe. Compare a troca gasosa: O₂ passa do alvéolo ao sangue e CO₂ faz o caminho inverso. O desenho é esquemático e não mede a função pulmonar. Fechamento: peça que a turma explique a relação entre diafragma, volume e entrada de ar.'},
 {slug:'evaporacao',kind:'separation',subject:'science',name:'Evaporação',title:'Evaporação: para onde vai a água?',content:['Preveja o que fica no recipiente quando parte da água de uma solução salina evapora.','Compare aquecimento baixo e alto no mesmo momento da animação. Depois compare com a ebulição.'],notes:'Ajuste o aquecimento antes de cada comparação: a mudança reinicia o esquema. Use o controle Momento da animação para comparar durações iguais. A evaporação ocorre na superfície e não exige fervura; na ebulição há formação de bolhas de vapor no interior do líquido. O sal representado permanece no recipiente. Pontos simbolizam moléculas ampliadas: o vapor é invisível. Quantidades e duração são ilustrativas. Fechamento: peça duas diferenças entre evaporação e ebulição.'},
 {slug:'media-mediana',kind:'statistics',subject:'math',name:'Média e mediana',title:'Média e mediana: experimente os valores',content:['Selecione Média e reproduza: as barras se redistribuem sem alterar a soma.','Selecione Mediana e observe a ordenação. Mude um valor extremo e compare os dois resultados.'],notes:'A amostra inicial é 2, 3, 3, 8, 9: soma 25, média 5 e mediana 3. Peça uma previsão antes de mudar 9 para 10: a média passa a 5,2 e a mediana continua 3. Os cinco valores podem ser ajustados de 0 a 10. Na opção Média, as alturas se igualam preservando a soma; na Mediana, os cartões se ordenam e o terceiro valor é central. Há valores repetidos. Fechamento: peça um exemplo em que a média e a mediana são diferentes.'}
];
const created=[];
for(const p of pilots){
 const spec=structuredClone(TEMPLATE_SOLAR_SYSTEM),title='Laboratório Atlas — '+p.name;
 spec.lesson={...spec.lesson,id:'atlas-lab-'+p.slug,subject:p.subject as Subject,title,topic:p.name,grade:'6EF',duration_minutes:15,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),generation_mode:'MODE_A_NO_AI'};
 spec.objectives=['Fazer uma previsão, experimentar os controles e explicar o resultado observado.'];
 spec.scenes=[{id:'abertura',type:'title',title,subtitle:'Preveja · experimente · explique',teacher_notes:'Roteiro de exploração de 15 minutos. Projete o laboratório, peça uma previsão, altere um controle por vez e compare. Abra a próxima página para começar. Os ajustes de apresentação são temporários; para guardar um exemplo, ajuste no editor e salve uma versão.'},{id:'experimento',type:'text',title:p.title,atlas_model:p.kind as any,content:p.content,teacher_notes:p.notes,atlas_parameters:{breathingRate:12,energy:2,values:[2,3,3,8,9]}}];
 const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,subjectCode:p.subject,gradeLevel:'6EF',topic:p.name,spec})});const result=await r.json();if(!r.ok)throw Error(JSON.stringify(result));
 const saved=await(await fetch(base+'/'+result.lesson.id)).json();fs.writeFileSync(out+'/aula-'+p.slug+'.json',JSON.stringify(saved,null,2),{flag:'wx'});
 created.push({id:result.lesson.id,title,kind:p.kind,slug:p.slug,file:'EXPORTACOES/Laboratorio-Atlas-'+p.slug+'-20261018.html'});fs.writeFileSync(out+'/aulas.json',JSON.stringify(created,null,2));
}
console.log(JSON.stringify(created));
