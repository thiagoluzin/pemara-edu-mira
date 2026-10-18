/**
 * Atlas visual PEMARA — perfis DIDÁTICOS, offline e reutilizáveis.
 * Cada modelo tem função cognitiva e limites próprios; não representa
 * verificação automática de fatos nem dispensa revisão do professor.
 *
 * Não confundir com cobertura integral da BNCC: as habilidades oficiais
 * associam-se ao conteúdo no banco, estes perfis são motores visuais.
 */
export const ATLAS = [
  {id:'digestive',name:'Trajeto da digestão',subjects:['science','biology'],keywords:['digestao','digestorio','esofago','intestino delgado'],variants:['Ingestão','Estômago','Intestino','Absorção'],caption:'Modelo anatômico esquemático. O alimento percorre órgãos; a absorção de muitos nutrientes ocorre principalmente no intestino delgado.'},
  {id:'respiration',name:'Respiração e trocas gasosas',subjects:['science','biology'],keywords:['respiracao pulmonar','sistema respiratorio','alveolos','pulmoes'],variants:['Inspiração','Troca gasosa','Expiração'],caption:'Modelo qualitativo: ar circula pelas vias respiratórias e trocas de gases ocorrem nos alvéolos. Não representa a mecânica respiratória em escala.'},
  {id:'photosynthesis',name:'Fotossíntese',subjects:['science','biology'],keywords:['fotossintese','clorofila'],variants:['Luz solar','Água','Gás carbônico','Produtos'],caption:'Esquema simplificado da fotossíntese: luz, água e CO₂ participam da produção de matéria orgânica, com liberação de O₂. Não representa equações quantitativas.'},
  {id:'food_chain',name:'Relações alimentares',subjects:['science','biology'],keywords:['cadeia alimentar','teia alimentar','niveis troficos','produtores e consumidores'],variants:['Produtor','Consumidor primário','Consumidor secundário','Decompositores'],caption:'Exemplo hipotético de fluxo de energia entre níveis tróficos. Setas mostram transferência de energia do organismo consumido para quem o consome; redes reais são mais complexas.'},
  {id:'separation',name:'Separação de misturas',subjects:['science','chemistry'],keywords:['agua com areia','agua com sal','agua com oleo','separacao de misturas','filtracao','decantacao','destilacao','evaporacao'],variants:['Mistura','Filtração','Decantação','Evaporação'],caption:'Demonstrações esquemáticas independentes. Filtração retém sólidos suspensos; decantação separa fases; evaporação pode recuperar soluto. Nem todos os métodos servem à mesma mistura.'},
  {id:'moon_phases',name:'Fases da Lua',subjects:['science','geography','physics'],keywords:['fases da lua','lua crescente','lua minguante','lua cheia'],variants:['Nova','Quarto crescente','Cheia','Quarto minguante'],caption:'Fases são diferentes frações visíveis da metade iluminada da Lua, conforme sua posição em relação à Terra e ao Sol. Esquema fora de escala.'},
  {id:'heat',name:'Transferência de calor',subjects:['science','physics','chemistry'],keywords:['conducao termica','conveccao','radiacao termica','transferencia de calor'],variants:['Condução','Convecção','Radiação'],caption:'Três mecanismos de transferência de energia térmica. Exemplos visuais são esquemáticos e não comparam taxas reais.'},
  {id:'optics',name:'Luz e interação com meios',subjects:['science','physics'],keywords:['reflexao da luz','refracao','espelho plano','raio de luz'],variants:['Incidência','Reflexão','Refração'],caption:'Traçados geométricos qualitativos; ângulos e índices de refração dependem do material. O desenho não fornece medidas experimentais.'},
  {id:'tectonics',name:'Movimentos tectônicos',subjects:['geography','science'],keywords:['placas tectonicas','limites convergentes','limites divergentes','limites transformantes','tectonismo'],variants:['Convergente','Divergente','Transformante'],caption:'Movimento relativo entre placas em limites tectônicos. Ilustração simplificada, não mostra escala, velocidade ou todas as formas geológicas possíveis.'},
  {id:'population_pyramid',name:'Estrutura etária',subjects:['geography','math'],keywords:['piramide etaria','estrutura etaria','envelhecimento populacional'],variants:['Exemplo A','Exemplo B'],caption:'Pirâmides com números fictícios para exercitar a leitura de distribuição por faixa etária; não representam países ou censos reais.'},
  {id:'climate',name:'Interações climáticas',subjects:['geography','science'],keywords:['circulacao atmosferica','clima e tempo','massas de ar','frentes frias'],variants:['Radiação','Superfície','Circulação','Nuvens'],caption:'Esquema de fatores do tempo atmosférico, não um modelo de previsão nem uma explicação única para todos os climas.'},
  {id:'watershed',name:'Rede de drenagem',subjects:['geography','science'],keywords:['bacia hidrografica','afluentes','nascente de um rio','rede de drenagem'],variants:['Nascentes','Afluentes','Rio principal','Foz'],caption:'Rede hidrográfica hipotética que ilustra conexões, sem localização cartográfica verdadeira; não confunda com mapa real.'},
  {id:'equation_balance',name:'Equações como equivalência',subjects:['math'],keywords:['equacao do primeiro grau','equacoes do 1 grau','incognita','equilibrio algebrico'],variants:['x + 3 = 7','Subtrair 3','x = 4'],caption:'Exemplo algébrico x + 3 = 7. Operações equivalentes preservam a igualdade. É um exemplo, não a resposta de um exercício da apostila.'},
  {id:'probability',name:'Eventos e probabilidade',subjects:['math'],keywords:['probabilidade','espaco amostral','eventos aleatorios'],variants:['Espaço amostral','Evento','Probabilidade'],caption:'Dado ideal de seis faces igualmente prováveis, usado como exemplo. Resultados reais podem apresentar frequências diferentes em poucas jogadas.'},
  {id:'statistics',name:'Leitura de dados',subjects:['math','geography'],keywords:['media e mediana','estatistica descritiva','distribuicao de frequencias','grafico de barras'],variants:['Dados','Média','Mediana','Representação'],caption:'Amostra ilustrativa [2,3,3,8,9]: média 5, mediana 3. Valores fictícios, não representam a turma.'},
  {id:'coordinates',name:'Plano cartesiano',subjects:['math'],keywords:['plano cartesiano','pares ordenados','quadrantes do plano'],variants:['Quadrante I','Quadrante II','Quadrante III','Quadrante IV'],caption:'Ajuste as distâncias horizontal e vertical para construir pontos. Quadrantes são definidos pelos sinais de x e y.'},
  {id:'transformations',name:'Transformações geométricas',subjects:['math','arts'],keywords:['translacao geometrica','rotacao geometrica','reflexao axial','isometrias'],variants:['Translação','Rotação','Reflexão'],caption:'Transformações planas de uma figura-exemplo; translação, rotação e reflexão preservam distâncias e ângulos.'},
  {id:'sentence',name:'Estrutura de oração',subjects:['portuguese'],keywords:['sujeito e predicado','analise sintatica','sujeito da oracao','predicado verbal'],variants:['Oração','Sujeito','Predicado'],caption:'Exemplo editável pelo professor. O recorte distingue sujeito e predicado sem analisar automaticamente o texto importado.'},
  {id:'argument',name:'Estrutura argumentativa',subjects:['portuguese','english'],keywords:['texto argumentativo','tese e argumentos','artigo de opiniao','argumentacao'],variants:['Tese','Evidências','Desenvolvimento','Conclusão'],caption:'Mapa de organização textual. As conexões representam função argumentativa; uma evidência precisa ser verificável e pertinente.'},
  {id:'genres',name:'Gêneros e suportes textuais',subjects:['portuguese','english'],keywords:['generos textuais','noticia e reportagem','editorial e noticia','entrevista jornalistica'],variants:['Notícia','Reportagem','Editorial','Entrevista'],caption:'Esquema de propósitos comunicativos; gêneros se sobrepõem em características e não podem ser identificados apenas pela aparência.'},
  {id:'sources',name:'Análise de fontes históricas',subjects:['history'],keywords:['fontes historicas','documentos historicos','historia oral','vestigios materiais'],variants:['Material','Escrita','Oral','Contexto'],caption:'Fontes são vestígios interpretados criticamente. Um desenho genérico não substitui autoria, data, procedência e análise de fontes reais.'},
  {id:'historical_change',name:'Mudança e permanência',subjects:['history'],keywords:['mudancas e permanencias','processos historicos','continuidade historica','rupturas historicas'],variants:['Antes','Transformações','Depois','Permanências'],caption:'Esquema analítico, não cronologia factual. Mudanças e permanências precisam de exemplos e datas fornecidos pelo material histórico.'},
  {id:'rhythm',name:'Pulso e compasso',subjects:['arts'],keywords:['ritmo musical','compasso musical','pulsacao musical','figuras ritmicas'],variants:['Pulso','Compasso','Pausa','Variação'],caption:'Sequência visual de pulsos em um compasso de quatro tempos. Não substitui áudio nem partitura de uma obra específica.'},
  {id:'art_composition',name:'Composição visual',subjects:['arts'],keywords:['composicao visual','contraste e escala','enquadramento artistico','elementos visuais'],variants:['Linha','Cor','Contraste','Enquadramento'],caption:'Composição visual exploratória. Interpretações artísticas devem ser discutidas considerando obras e contextos identificados.'},
  {id:'court',name:'Movimento no esporte',subjects:['physical_education'],keywords:['ocupacao de espacos','passe e deslocamento','jogo coletivo','esporte coletivo'],variants:['Posicionamento','Passe','Deslocamento'],caption:'Situação hipotética de jogo em quadra genérica, sem impor regras de modalidade específica. Movimentos são ilustrações, não prescrição física.'},
  {id:'dialogue',name:'Diálogo e diversidade',subjects:['religious_education','english','portuguese'],keywords:['dialogo inter-religioso','diversidade religiosa','convivencia e respeito','escuta ativa'],variants:['Escuta','Contexto','Comparação','Respeito'],caption:'Quadro de práticas de diálogo sem atribuir características fixas a culturas ou crenças. O conteúdo concreto depende das fontes da aula.'},
] as const;
export type AtlasKind = typeof ATLAS[number]['id'];
export interface AnimationMatch {id:AtlasKind;name:string;variants:string[];caption:string;matchedKeyword:string}
const normalize=(s:string)=>s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const normalized=ATLAS.map(profile=>({...profile, terms:profile.keywords.map(normalize)}));
export function chooseAnimation(subject:string,title:string,content='', bnccCodes='',manual?:AtlasKind):AnimationMatch|null {
  if(manual){
    const p=ATLAS.find(p=>p.id===manual && (p.subjects as readonly string[]).includes(subject));
    return p?{id:p.id,name:p.name,variants:[...p.variants],caption:p.caption,matchedKeyword:'Escolha do professor'}:null;
  }
  const t=` ${normalize(title)} `, b=` ${normalize(content.slice(0,14000))} `;
  // Só escolha animação com evidência lexical concreta, jamais apenas porque a disciplina coincide.
  const results=normalized.filter(p=>(p.subjects as readonly string[]).includes(subject)).flatMap(p=>{
    const matches=p.terms.filter(term=>t.includes(` ${term} `)||b.includes(` ${term} `));
    if(!matches.length)return [];
    const titleHits=matches.filter(term=>t.includes(` ${term} `)).length;
    const score=titleHits*10+matches.length;
    return [{p,score,matchedKeyword:matches[0]}];
  }).sort((a,b)=>b.score-a.score || a.p.id.localeCompare(b.p.id));
  void bnccCodes; // associação de habilidades é curada no banco, não inferida de código arbitrário
  const hit=results[0];
  return hit?{id:hit.p.id,name:hit.p.name,variants:[...hit.p.variants],caption:hit.p.caption,matchedKeyword:hit.matchedKeyword}:null;
}
export function isAtlasKind(kind:string):kind is AtlasKind {return ATLAS.some(p=>p.id===kind);}
export function allAnimationProfiles(){return ATLAS.map(({id,name,subjects,keywords,variants,caption})=>({id,name,subjects:[...subjects],keywords:[...keywords],variants:[...variants],caption}));}
