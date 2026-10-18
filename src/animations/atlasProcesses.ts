import type {AtlasKind} from './atlas';
import {palette as c,txt,box,dot,line,card,move,flow,particle,finish} from './processPrimitives';

/** Every case animates subject matter or a named reasoning operation. No blinking fallback. */
export function atlasProcessBody(kind:AtlasKind,v:number):string|null{
 switch(kind){
 case 'digestive':{
  const organ=line('M280 80V155Q365 142 354 202Q335 230 278 214L264 195',c.red,20)+line('M280 223Q370 220 345 250H262Q240 276 345 275Q367 300 268 300',c.green,14);
  const paths=['M280 78V154','M280 162Q350 158 339 200Q283 225 278 185Q319 158 339 200','M280 230Q365 224 345 250H262Q240 276 345 275Q367 300 268 300','M305 272H440'];
  const food=flow('alimento',paths[v],v===3?[0,1,2].map(i=>dot(i*12,0,4,c.gold)).join(''):box(-11,-8,22,16,c.gold,c.gold,6),6);
  const contractions=move('parede-digestiva',line(v===0?'M265 105H295':v===1?'M278 180Q320 154 349 186':'M255 251H343',c.violet,9),{sy:.65,origin:'300px 200px',alternate:true,seconds:1.2});
  return finish(['Ingestão: transporte do alimento','Estômago: mistura do conteúdo','Intestino: progressão do conteúdo','Absorção: nutrientes para a circulação'][v],organ+food+(v<3?contractions:line('M435 230V312',c.red,20))+txt(150,90,'Boca',16)+txt(453,183,'Estômago',16)+txt(152,274,'Intestino',16)+(v===3?txt(470,213,'Circulação',16):''),v===3?'Partículas ampliadas atravessam a parede intestinal.':'Movimentos e anatomia simplificados; não mostram escala.');
 }
 case 'respiration':{
  if(v===1){const alveolus=box(75,100,185,190,'#164e63',c.cyan,70),blood=box(360,100,185,190,'#7f1d1d',c.red,40);
   return finish('Alvéolos: trocas de gases',alveolus+blood+txt(168,84,'Ar alveolar',18)+txt(452,84,'Sangue',18)+line('M310 105V294',c.line,3)+
    flow('oxigenio','M200 155H421',dot(0,0,13,c.blue)+txt(0,5,'O₂',12,c.bg),5)+flow('gas-carbonico','M420 235H200',dot(0,0,17,c.gold)+txt(0,5,'CO₂',11,c.bg),5),'O₂ vai ao sangue; CO₂ vai ao ar alveolar.');}
  const lungs=`<path d="M282 142Q173 112 159 250Q172 294 280 278Z M338 142Q447 112 461 250Q448 294 340 278Z" fill="#164e63" stroke="${c.cyan}" stroke-width="4"/>`;
  return finish(v===0?'Inspiração: entrada de ar':'Expiração: saída de ar',line('M310 65V153M310 129L255 175M310 129L365 175',c.cyan,12)+
   move('pulmoes',lungs,{fromSX:v===0?.8:1,sx:v===0?1:.8,fromSY:v===0?.8:1,sy:v===0?1:.8,origin:'310px 140px',seconds:5})+
   move('diafragma',line('M150 292Q310 255 470 292',c.gold,7),{fromY:v===0?0:20,y:v===0?20:0,seconds:5})+
   [0,1,2].map(i=>particle('ar',v===0?'M310 70V139L252 215':'M365 215L310 139V70',c.light,5,7,-i)).join(''),v===0?'Diafragma desce; volume pulmonar aumenta.':'Diafragma sobe; volume pulmonar diminui.');
 }
 case 'photosynthesis':{
  const leaf=`<path d="M255 280Q140 105 400 94Q455 260 255 280Z" fill="#15803d" stroke="${c.green}" stroke-width="4"/>`+line('M255 280L371 128',c.green,3);
  const rays=Array.from({length:3},(_,i)=>flow('energia-luminosa',`M95 ${100+i*27}L250 ${140+i*27}`,line('M-12 0H12',c.gold,5),3,-i));
  const water=flow('agua','M90 276L260 235',dot(0,0,12,c.blue)+txt(0,4,'H₂O',10,c.bg),5);
  const co2=flow('co2','M535 120L374 178',dot(0,0,16,c.gold)+txt(0,4,'CO₂',10,c.bg),5);
  const products=flow('oxigenio','M375 215L520 255',dot(0,0,13,c.cyan)+txt(0,4,'O₂',11,c.bg),5)+move('materia-organica',box(268,190,42,36,c.gold,c.gold)+txt(289,214,'MO',14,c.bg),{fromSX:.2,sx:1,fromSY:.2,sy:1,origin:'289px 208px',seconds:5});
  return finish(['Fotossíntese: energia luminosa','Fotossíntese: entrada de água','Fotossíntese: entrada de CO₂','Fotossíntese: formação de produtos'][v],leaf+txt(95,75,'Luz solar',17)+txt(91,311,'Água',17)+txt(528,87,'CO₂',17)+txt(524,292,'Oxigênio',17)+[rays.join(''),water,co2,products][v],v===3?'MO: matéria orgânica • representação qualitativa.':'Luz, água e CO₂ participam do processo; sem escala.');
 }
 case 'food_chain':{
  const grass=line('M100 248V179M100 221L78 196M100 211L124 184',c.green,9);
  const insect=dot(300,215,16,c.gold)+line('M282 203L270 192M282 225L267 237M316 202L330 190M316 226L332 238',c.gold,4);
  const bird=`<path d="M477 213Q506 180 530 210L548 204L535 222Q499 247 477 213Z" fill="${c.cyan}"/>`;
  const bodies=grass+(v===1?'':insect)+(v===2?'':bird)+txt(100,274,'Capim',18)+txt(300,274,'Inseto',18)+txt(510,274,'Ave',18);
  const energy=flow('energia',v===0?'M45 100L100 185':v===1?'M100 212H300':v===2?'M300 212H505':'M105 240Q200 300 310 307',line('M-8 0H8',c.gold,9),5);
  return finish(['Produtor: incorpora energia solar','Consumidor primário: alimentação','Consumidor secundário: alimentação','Decomposição: matéria de todos os níveis'][v],bodies+energy+(v===0?move('crescimento',line('M100 215L135 174',c.green,8),{fromSY:.1,sy:1,origin:'100px 215px'}):v===1?move('inseto-alimenta',insect,{x:-90,alternate:true,seconds:3}):v===2?move('ave-alimenta',bird,{x:-110,alternate:true,seconds:3}):[100,300,510].map(x=>particle('materia-organica',`M${x} 240L310 307`,c.green,6,6,-x/200)).join('')+txt(310,320,'Decompositores',15)),v===3?'A matéria chega aos decompositores de todos os níveis.':'Transferência de energia ao organismo que se alimenta.');
 }
 case 'heat':{
  if(v===0)return finish('Condução: energia entre regiões',box(85,170,450,75,'#475569')+dot(100,207,25,c.red)+Array.from({length:8},(_,i)=>move('vibracao-local',dot(150+i*47,205,9,c.gold),{x:4,y:-4,fromX:-4,fromY:4,seconds:.25+i*.05,alternate:true})).join('')+flow('energia-termica','M115 145H510',line('M-15 0H15',c.red,8),5),'Partículas vibram localmente; a energia se transfere.');
  if(v===1)return finish('Convecção: o fluido circula',box(125,80,370,230,'#164e63',c.cyan)+line('M150 312H250',c.red,10)+Array.from({length:10},(_,i)=>particle('fluido','M195 270V135Q195 110 250 110H390Q425 110 425 150V270Q425 290 360 290H245Q195 290 195 270',c.cyan,8,9,-i*.8)).join(''),'Fluido aquecido sobe; o circuito ilustrativo retorna.');
  return finish('Radiação: propagação de energia',dot(115,190,48,c.gold)+box(490,98,35,200,'#475569')+[0,1,2,3].map(i=>flow('onda-termica',`M170 ${120+i*47}H485`,line('M-20 0Q-10 -12 0 0T20 0',c.gold,4),4,-i*.5)).join(''),'Ondas transportam energia; não exigem meio material.');
 }
 case 'optics':{
  const path=v===0?'M120 86L310 230':v===1?'M120 86L310 230L500 86':'M120 86L310 230L360 310';
  return finish(['Incidência: luz chega à superfície','Reflexão: luz retorna ao mesmo meio','Refração: luz passa a outro meio'][v],(v===2?box(45,231,530,85,'#164e63','none'):box(45,230,530,12,'#64748b','none'))+line('M310 62V313',c.line,2,'stroke-dasharray="6 7"')+line(path,c.line,3)+[0,1,2].map(i=>flow('frente-luminosa',path,line('M-8 -8L8 8',c.gold,6),6,-i*1.5)).join('')+txt(92,181,'Meio 1',16)+txt(92,287,v===2?'Meio 2':'Superfície',16),'Trajeto qualitativo; partículas visuais indicam propagação.');
 }
 case 'population_pyramid':{
  const data=v===0?[22,18,13,8,4]:[12,16,15,14,11];
  return txt(310,32,'Construção de uma pirâmide etária',23)+line('M310 70V325',c.line,2)+data.map((n,i)=>{const y=82+(4-i)*47,w=n*6;return `<g data-age-band="${i*20}">`+move('barra-etaria',box(310-w,y,w,28,'#0e7490',c.cyan,0)+box(310,y,w,28,'#7c3aed',c.violet,0),{fromSX:.03,sx:1,origin:`310px ${y}px`})+txt(133,y+20,i===4?'80+':`${i*20}–${i*20+19}`,14,c.light,'end')+txt(500,y+20,String(n),14)+'</g>';}).join('')+txt(230,338,'Grupo A',16)+txt(392,338,'Grupo B',16)+txt(310,371,'Montagem do gráfico • números fictícios fixos, não evolução no tempo',13);
 }
 case 'climate':{
  const ground=box(55,285,510,25,'#166534',c.green),sun=dot(110,95,30,c.gold),cloud=`<path d="M350 130Q335 88 374 90Q405 58 432 93Q480 74 492 131Z" fill="#cbd5e1"/>`;
  const moving=v===0?[0,1,2].map(i=>flow('radiacao-solar',`M135 ${105+i*13}L280 ${270+i*8}`,line('M-9 0H9',c.gold,4),4,-i)).join(''):
   v===1?move('ar-aquecido',box(240,242,98,26,'#9a3412',c.red,12),{y:-100,fromSX:.8,sx:1.2,origin:'289px 255px'}):v===2?Array.from({length:7},(_,i)=>particle('massa-de-ar','M205 270Q135 140 270 145Q380 150 480 267',c.blue,7,9,-i)).join(''):
   Array.from({length:5},(_,i)=>particle('goticula',`M${350+i*25} 165L${365+i*23} 122`,c.blue,5,5,-i*.8)).join('')+move('nuvem-forma',cloud,{fromSX:.55,sx:1,fromSY:.55,sy:1,origin:'415px 110px'});
  return finish(['Radiação recebida pela superfície','Superfície aquece o ar próximo','Deslocamento de massas de ar','Condensação: formação de nuvem'][v],ground+sun+(v!==3?cloud:'')+moving,'Processos selecionados; não é previsão meteorológica.');
 }
 case 'watershed':{
  const main='M132 112Q200 180 235 223Q300 292 547 307',branch='M325 107Q350 170 335 276';
  const route=[main,branch,main,'M335 276Q430 300 547 307H578'][v];
  return txt(310,32,'Água em uma rede de drenagem',23)+line('M50 300L150 110L233 210L325 105L455 206L565 98','#334155',18)+line(main,c.cyan,11,'class="learning-trace"')+line(branch,c.blue,8,'class="learning-trace"')+line('M547 307H580',c.blue,11)+Array.from({length:7},(_,i)=>particle('agua-rio',route,'#e0f2fe',7,5,-i)).join('')+txt(117,82,'Nascente',16)+txt(354,77,'Afluente',16)+txt(305,340,'Rio principal',16)+txt(550,340,'Foz',16)+txt(310,373,'Água segue para jusante • rede hipotética, sem escala',14);
 }
 case 'equation_balance':{
  const units=(side:number,count:number)=>Array.from({length:count},(_,i)=>box(side+i*28,200,23,30,c.gold,c.gold,2)).join('');
  const balance=line('M310 110V292M110 247H510M170 247V274M450 247V274',c.line,6)+line('M92 278H245M375 278H558',c.cyan,6);
  let contents='';
  if(v===0)contents=move('termos-esquerda',card(96,185,62,'x')+units(168,3),{fromY:-80})+move('termos-direita',units(365,7),{fromY:-80});
  if(v===1)contents=card(96,185,62,'x')+units(365,4)+move('menos-tres-esquerda',units(168,3),{y:-90})+move('menos-tres-direita',units(477,3),{y:-90})+txt(210,82,'−3',22)+txt(520,82,'−3',22);
  if(v===2)contents=move('valor-x',units(108,4),{fromY:-80})+units(395,4);
  return finish(['x + 3 = 7: mesma quantidade','Subtrair 3 dos dois membros','x = 4: comparar os dois membros'][v],balance+contents,'Peças iguais valem 1 • a igualdade é preservada.');
 }
 case 'probability':{
  const tiles=Array.from({length:6},(_,i)=>{const n=i+1,x=80+i*78,y=v===0?100:180;const targetX=v===0?98+i*78:n%2===0?120+(n/2-1)*160:120+((n-1)/2)*160;const targetY=v===0?194:n%2===0?140:258;return move(n%2?'nao-favoravel':'favoravel',box(x,y,54,54,n%2?c.card:'#164e63',n%2?c.line:c.gold)+txt(x+27,y+35,String(n),24),{x:targetX-x,y:targetY-y});}).join('');
  return finish(['Organizar as seis possibilidades','Separar o evento: número par','Contar favoráveis e possíveis'][v],(v?txt(310,92,'Favoráveis: 2, 4, 6',18,c.gold):'')+tiles,v===2?'P(par) = 3/6 = 1/2 • dado ideal, não sorteio.':'Organização do espaço amostral; não representa jogadas.');
 }
 case 'statistics':{
  const nums=[2,3,3,8,9];
  if(v===0)return finish('Dados: reunir os valores observados',nums.map((n,i)=>move('organizar-dados',card(90+i*90,180,65,String(n)),{fromY:i%2?55:-55})).join(''),'Cinco observações fictícias • cada cartão conserva seu valor.');
  if(v===2){const values=[8,2,9,3,3],dest=[3,0,4,1,2];return finish('Mediana: ordenar e localizar o centro',values.map((n,i)=>move('ordenar-dados',box(90+i*90,275,65,34,i===4?'#854d0e':c.card,i===4?c.gold:c.cyan)+txt(122+i*90,300,String(n),22),{x:(dest[i]-i)*90}).replace('class="atlas-process"','class="atlas-process atlas-sort"').replace('style="',`style="--lane:${-190+i*38}px;`)).join('')+line('M302 313V326',c.gold,4)+txt(310,64,'Valor central após ordenar: 3',18,c.gold),'Os mesmos cinco valores são reorganizados.');}
  return finish(v===1?'Média: redistribuir mantendo o total':'Construir barras com os dados',nums.map((n,i)=>move(v===1?'redistribuir':'construir-barra',box(105+i*86,285-n*20,52,n*20,c.cyan,'none',0),{fromSY:v===1?1:.02,sy:v===1?5/n:1,origin:`${105+i*86}px 285px`})+txt(131+i*86,311,v===1?`${n}→5`:String(n),v===1?15:17)).join('')+(v===1?line('M80 185H550',c.gold,2)+txt(568,191,'5',17):''),v===1?'Total 25 ÷ 5 valores = 5 • alturas se igualam.':'Amostra fictícia [2, 3, 3, 8, 9] • valores finais.');
 }
 case 'coordinates':{
  const [x,y]=[[418,70],[202,70],[202,310],[418,310]][v];
  return finish(`Construir o ponto (${(x-310)/54}, ${(190-y)/40})`,line('M55 190H565M310 54V320',c.line,3)+Array.from({length:9},(_,i)=>line(`M${94+i*54} 184V196`,c.line,2)).join('')+Array.from({length:7},(_,i)=>line(`M304 ${70+i*40}H316`,c.line,2)).join('')+line(`M310 190H${x}V${y}`,c.line,2,'stroke-dasharray="5 7"')+`<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${c.gold}" stroke-width="2"/>`+particle('ponto-construcao',`M310 190H${x}V${y}`,c.gold,6,10)+txt(565,180,'x',18)+txt(333,74,'y',18),'Primeiro a coordenada x; depois a coordenada y.');
 }
 case 'sentence':{
  const words=['A','turma','investigou','o tema.'],widths=[42,100,155,115],xs=[66,120,232,399];
  const body=words.map((w,i)=>move(i<2?'sujeito':'predicado',card(xs[i],180,widths[i],w,i<2?c.cyan:c.violet),{fromY:(v===1?i<2:v===2?i>=2:true)?(i%2?-45:45):0,seconds:5})).join('');
  return finish(['Montar a oração','Agrupar o sujeito','Agrupar o predicado'][v],body+line('M68 242H218',c.cyan,4)+line('M232 242H514',c.violet,4)+txt(144,275,'Sujeito',18,c.cyan)+txt(375,275,'Predicado',18,c.violet),'Exemplo: “A turma investigou o tema.”');
 }
 case 'argument':{
  const labels=['Tese','Evidências','Desenvolvimento','Conclusão'];
  return finish('Construir uma argumentação',labels.map((label,i)=>move('etapa-argumentativa',card(195,64+i*61,230,label,i===v?c.gold:c.cyan),{fromX:(i%2?1:-1)*(i===v?130:65),seconds:6})).join('')+[0,1,2].map(i=>line(`M310 ${108+i*61}V${123+i*61}`,c.line,3)).join(''),'Organização textual • evidências exigem fontes verificáveis.');
 }
 case 'genres':{
  const parts=[['Título','Fato principal','Onde? Quando?'],['Título','Contexto e dados','Fontes e detalhes'],['Tema','Posição institucional','Argumentos'],['Apresentação','Pergunta','Resposta da fonte']][v];
  return finish(['Montar uma notícia','Montar uma reportagem','Montar um editorial','Montar uma entrevista'][v],box(140,61,340,250,'#172033',c.line,4)+parts.map((p,i)=>move('parte-do-genero',card(170,88+i*70,280,p,i===0?c.gold:c.cyan),{fromX:i%2?95:-95,fromY:8,seconds:6})).join(''),'Exemplo de organização; gênero depende de propósito e contexto.');
 }
 case 'sources':{
  const labels=[['Objeto','Material','Marcas de uso'],['Documento','Autoria','Data'],['Relato oral','Memória','Entrevista'],['Fonte','Lugar e época','Quem produziu?']][v];
  const artifact=v===2?box(285,115,50,85,'#475569',c.cyan,23)+line('M270 165Q270 222 310 222Q350 222 350 165M310 222V252M285 252H335',c.cyan,5):v===0?`<path d="M283 114H337L332 146Q378 225 310 260Q242 225 288 146Z" fill="#c2410c" stroke="${c.gold}" stroke-width="3"/>`:box(261,110,98,150,'#cbd5e1','none',3)+[0,1,2,3].map(i=>line(`M278 ${140+i*26}H344`,'#475569',5)).join('');
  return finish(['Examinar uma fonte material','Examinar uma fonte escrita','Registrar uma fonte oral','Relacionar a fonte ao contexto'][v],artifact+(v===2?flow('inspecao-fonte','M370 150H465',line('M-25 0L-18 -16L-10 20L0 -25L10 14L18 0',c.gold,4),4):move('inspecao-fonte',`<circle cx="268" cy="158" r="31" fill="#22d3ee22" stroke="${c.cyan}" stroke-width="5"/>`+line('M290 180L310 200',c.cyan,8),{x:65,y:55,alternate:true,seconds:3}))+labels.map((s,i)=>move('dados-da-fonte',card(i===0?65:i===1?390:190,i===2?275:80,180,s),{fromY:i===2?25:-25,seconds:6})).join(''),v===2?'Registro oral ilustrativo • sem reprodução de áudio.':'Objeto e texto ilustrativos • não são fontes históricas reais.');
 }
 case 'historical_change':{
  const house=(x:number)=>box(x,205,55,76,'#854d0e',c.gold,0)+`<path d="M${x-8} 205L${x+27} 175L${x+62} 205Z" fill="${c.gold}"/>`;
  const bridge=line('M240 260Q310 190 380 260M240 260H380',c.cyan,9),newBuilding=box(440,115,70,166,'#475569',c.violet,0)+[0,1,2,3].map(i=>box(454,132+i*32,16,16,c.gold,'none',0)+box(481,132+i*32,16,16,c.gold,'none',0)).join('');
  return finish(['Antes: ocupação do espaço','Mudança: uma construção é substituída','Depois: novos usos do espaço','Permanência: a ponte continua'][v],line('M55 283H565',c.line,5)+bridge+house(90)+(v===0?move('construcao-inicial',house(440),{fromSY:.05,sy:1,origin:'440px 281px'}):v===1||v===3?move('construcao-antiga',house(440),{x:100})+move('construcao-nova',newBuilding,{fromSY:.02,sy:1,origin:'440px 281px'}):newBuilding)+flow('circulacao-pessoas','M90 300H520',dot(0,0,7,c.green)+line('M0 8V20M-8 16H8',c.green,4),8),'Local fictício • mudanças de uso coexistem com permanências.');
 }
 case 'rhythm':{
  const beats=[0,1,2,3].map(i=>`<circle class="${v===2&&i===2?'':'atlas-beat'}" cx="${118+i*128}" cy="174" r="30" fill="${c.card}" stroke="${c.cyan}" stroke-width="3" style="animation-delay:${-4+i}s"/>`+txt(118+i*128,180,v===2&&i===2?'pausa':String(i+1),v===2&&i===2?15:22)).join('');
  const subs=v===3?Array.from({length:8},(_,i)=>`<circle class="atlas-beat atlas-subbeat" cx="${86+i*64}" cy="249" r="10" fill="${c.card}" stroke="${c.cyan}" style="animation-delay:${-4+i*.5}s"/>`).join(''):'';
  const hand=`<g data-motion-role="marcador-ritmico" class="atlas-process atlas-rhythm-hand" style="--third-y:${v===2?95:135}px">${dot(0,0,12,c.gold)+line('M0 -8V-32',c.gold,4)}</g>`;
  return finish(['Pulso: percurso regular','Compasso: quatro tempos','Pausa: o tempo continua','Subdividir cada tempo em dois'][v],beats+subs+hand,'Marcador percorre o compasso • animação visual, sem áudio.');
 }
 case 'art_composition':{
  const circle=dot(230,196,55,c.red),square=box(360,133,105,105,'#7c3aed',c.violet,0);
  const subject=v===0?line('M130 275L305 112L490 270',c.cyan,5,'data-motion-role="traco-linha" class="atlas-draw" pathLength="1"')+flow('ponta-do-traco','M130 275L305 112L490 270',dot(0,0,9,c.gold),6):
   v===1?move('cor-sobreposta',circle,{x:96,alternate:true,seconds:3})+dot(360,196,55,c.blue):
   v===2?move('contraste-escala',circle,{fromSX:.4,sx:1.25,fromSY:.4,sy:1.25,origin:'230px 196px',alternate:true,seconds:3})+square:
   circle+square+move('enquadramento',`<rect x="130" y="100" width="235" height="193" fill="none" stroke="${c.gold}" stroke-width="8"/>`,{x:115,alternate:true,seconds:3});
  return finish(['Linha: construir um percurso','Cor: aproximar campos coloridos','Contraste: comparar tamanhos','Enquadramento: escolher o recorte'][v],box(80,65,460,245,'#111827',c.line,0)+subject,'Experimento de composição • observe como a relação visual muda.');
 }
 case 'court':{
  const player=(color:string)=>dot(0,0,15,color)+line('M-7 0H7',c.bg,3);
  const field=box(65,72,490,242,'#14532d',c.light,0)+line('M310 72V314',c.light,2)+`<circle cx="310" cy="193" r="48" fill="none" stroke="${c.light}" stroke-width="2"/>`;
  const teammates=v===0?move('jogador-abre-espaco',dot(155,130,16,c.cyan),{x:-25,y:100})+move('jogador-abre-espaco',dot(255,230,16,c.cyan),{x:40,y:-95}):dot(155,130,16,c.cyan)+(v===1?dot(255,230,16,c.cyan):flow('jogador-desloca','M255 230Q330 274 415 140',player(c.cyan),5));
  return finish(['Posicionamento: ocupar espaços','Passe: bola entre colegas','Deslocamento: jogador muda de posição'][v],field+teammates+dot(440,215,16,c.gold)+dot(477,116,16,c.gold)+(v===1?particle('bola','M155 130L255 230',c.light,4,8):''),'Situação hipotética de jogo; regras dependem da modalidade.');
 }
 case 'dialogue':{
  const people=dot(110,130,26,c.cyan)+box(77,165,66,95,'#164e63',c.cyan,20)+dot(510,130,26,c.violet)+box(477,165,66,95,'#4c1d95',c.violet,20);
  const labels=[['Fala','Escuta'],['Experiência','Contexto'],['Ideia A','Ideia B'],['Minha vez','Sua vez']][v];
  const content=v===2?move('comparar-falas',card(165,115,135,labels[0]),{y:65})+move('comparar-falas',card(325,255,135,labels[1],c.violet),{y:-75}):flow('turno-de-fala',v===3?'M185 165H430L185 235':'M185 180H430',box(-44,-22,88,44,c.card,c.gold,12)+txt(0,6,v===1?'Contexto':'Fala',16),6);
  return finish(['Escuta: acompanhar quem fala','Situar uma experiência','Comparar ideias lado a lado','Respeito: alternar os turnos'][v],people+content+txt(110,295,labels[0],17)+txt(510,295,labels[1],17),'Interação hipotética, sem atribuir crenças a grupos ou pessoas.');
 }
 default:return null;
 }
}
