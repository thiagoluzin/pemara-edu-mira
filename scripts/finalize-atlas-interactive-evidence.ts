import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {ATLAS} from '../src/animations/atlas';
const out='docs/evidencias/atlas-interativo-completo-20261018',backup='backups/antes-atlas-interativo-completo-20261018';
const hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex'),fileHash=(p:string)=>hash(fs.readFileSync(p)),read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const previousLessons=[];for(const original of read(out+'/acervo-original.json')){const current=await(await fetch('http://127.0.0.1:3001/api/lessons/'+original.id)).json();assert.equal(hash(JSON.stringify(current)),original.sha256,original.title);previousLessons.push({id:original.id,title:original.title,sha256:original.sha256,unchanged:true});}
const originalFiles=read(out+'/exports-originais.json').map((f:any)=>{assert.equal(fileHash(f.file),f.sha256,f.file);return{...f,unchanged:true};});
const older=read('docs/evidencias/atlas-laboratorios-20261018/manifesto-final.json');for(const f of older.originalFiles){assert.equal(fileHash(f.file),f.sha256,f.file);if(!originalFiles.some((o:any)=>o.file===f.file))originalFiles.push({...f,unchanged:true});}
function walk(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const backups=walk(backup).map(file=>({file,sha256:fileHash(file)}));
const lessons=read(out+'/aulas.json'),receipts=read(out+'/downloads-ui.json'),exports=[];
for(const l of lessons){const receipt=receipts.find((r:any)=>r.file===l.file);assert.ok(receipt?.final);const sha256=fileHash(l.file);assert.equal(sha256,fileHash(receipt.source));exports.push({...l,download:receipt.source,sha256,copyIdentical:true});const saved=await(await fetch('http://127.0.0.1:3001/api/lessons/'+l.id)).json();fs.writeFileSync(out+'/aula-final-'+l.subject+'.json',JSON.stringify(saved,null,2),{flag:'wx'});}
const results=['programa-entrega.json','html-entrega.json'].map(file=>{const data=read(out+'/'+file);assert.equal(data.passed,true);assert.equal(data.rows.length,96);assert.equal(data.errors.length,0);assert.equal(data.external.length,0);if(file.startsWith('html'))for(const f of data.files)assert.equal(fileHash(f.file),f.sha256);return{file:out+'/'+file,states:96,navigation:data.navigation,network:data.network,passed:true};});
const contracts=read('docs/evidencias/auditoria-total-animacoes/atlas-interativo-completo-20261018-final/resumo.json');assert.equal(contracts.cases,27);assert.equal(contracts.states,390);assert.equal(contracts.failed,0);assert.equal(contracts.interfaceFailures,0);assert.equal(contracts.parameterFailures,0);assert.deepEqual(contracts.errors,[]);
const compare=read(out+'/comparacao-posicao-inicial.json');assert.equal(compare.passed,true);assert.equal(compare.rows.length,88);
const suite=fs.readFileSync(out+'/suite-final.log','utf8');assert.match(suite,/pass 158/);assert.match(suite,/fail 0/);assert.equal(fs.readFileSync(out+'/typecheck-final.log','utf8').trim(),'');
const sources=walk('src').filter(file=>!fs.existsSync(path.join(backup,file))||fileHash(file)!==fileHash(path.join(backup,file))).map(file=>({file,sha256:fileHash(file),original:fs.existsSync(path.join(backup,file))?path.join(backup,file):null}));
const manifest={date:new Date().toISOString(),content_kind:'animation',models:27,variants:96,additionalVariants:88,backup,backups,previousLessons,originalFiles,exports,sources,results,contracts,comparisonStates:88,suite:{tests:158,failed:0},typecheck:true};
fs.writeFileSync(out+'/manifesto-final.json',JSON.stringify(manifest,null,2),{flag:'wx'});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const cards=lessons.map((l:any)=>{const count=l.kinds.reduce((n:number,k:string)=>n+(k==='movement'?3:ATLAS.find(p=>p.id===k)!.variants.length),0);return `<a href="${esc(path.basename(l.file))}"><span>${l.kinds.length} modelos · ${count} variantes</span><h2>${esc(l.title.replace('Atlas interativo — ',''))}</h2><p>Abrir apresentação →</p></a>`;}).join('');
fs.writeFileSync('EXPORTACOES/Atlas-interativo-ABRIR-20261018.html',`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atlas interativo — coleções offline</title><style>*{box-sizing:border-box}body{background:#081323;color:#e2e8f0;font:16px/1.6 system-ui;margin:0}main{max-width:1100px;margin:auto;padding:48px 24px}small{color:#5eead4;text-transform:uppercase;letter-spacing:.15em}h1{font-size:clamp(30px,5vw,48px);line-height:1.15}header p{max-width:760px;color:#b5c9d8}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin:32px 0}a{color:inherit;text-decoration:none;border:1px solid #31506a;border-radius:18px;padding:24px;background:linear-gradient(135deg,#12344b,#101b30)}a:hover,a:focus-visible{outline:2px solid #5eead4}a span{color:#8daac0;font-size:13px}h2{font-size:23px;margin:12px 0}a p{color:#5eead4}footer{color:#b5c9d8;border-top:1px solid #31506a;padding-top:20px}code{color:#5eead4}</style><main><header><small>PEMARA · no seu computador</small><h1>Explore. Compare. Explique.</h1><p>27 modelos, 96 variantes e oito coleções para escolher conforme sua aula. Todos os arquivos foram exportados pelo programa e testados sem internet.</p><p>Escolha a variante, reproduza e pause. Use <b>Avançar um passo</b> ou a linha do tempo para observar detalhes. Nos novos laboratórios, ajuste a velocidade, compare com a posição inicial e desligue a repetição para encerrar um ciclo.</p></header><section>${cards}</section><footer><p>Cada aula é um HTML independente: pode ser copiada para outro computador e aberta no navegador. Para manter este índice funcionando, copie também os oito HTMLs da versão <code>r2</code> para a mesma pasta.</p><p>No programa: <b>Minhas Aulas → Atlas interativo → Editar → EXPORTAR → Apresentação para abrir sem internet</b>. Ajustes feitos durante a apresentação são temporários. Para guardar parâmetros, altere no editor e use <b>Salvar Versão</b>.</p><p>Os esquemas são representações didáticas, com limites explicados em cada modelo. As coleções não equivalem a uma aula inteira nem estabelecem alinhamento curricular automático.</p></footer></main></html>`,{flag:'wx'});
const table=[...ATLAS.map(p=>({name:p.name,variants:p.variants.length})),{name:'Corpo em movimento',variants:3}].map(p=>`| ${p.name} | ${p.variants} | Passou | Passou |`).join('\n');
fs.writeFileSync(out+'/RELATORIO.md',`# Atlas interativo — entrega de 18/10/2026

O padrão dos três pilotos foi aplicado às 85 variantes restantes do catálogo e aos três movimentos corporais. Total integrado: **26 modelos do Atlas + corpo em movimento, 96 variantes**. As versões anteriores foram preservadas.

## Uso pelo professor

Abra **Minhas Aulas** e escolha uma das oito coleções **Atlas interativo**. Cada página traz variantes, reproduzir/pausar, avanço por passo, linha do tempo e restauração. Os novos laboratórios acrescentam velocidade (ou BPM), comparação com a posição inicial e repetição opcional. Óptica tem ângulo e índice de refração; coordenadas têm distâncias; probabilidade tem evento; oração tem sujeito e predicado editáveis.

As configurações no editor são gravadas com **Salvar Versão**. Foi comprovada a persistência após recarregar: Matemática v2 guardou x=4; v3 restaurou x=2, y=3 e esclareceu as notas. Durante a apresentação, os ajustes são temporários.

Os oito HTMLs finais foram baixados pelo botão **EXPORTAR** do próprio programa e copiados sem alteração. Abra [o índice das coleções](../../../EXPORTACOES/Atlas-interativo-ABRIR-20261018.html). Cada aula é autossuficiente; o índice apenas organiza os links.

## Verificações concluídas

- **158 testes passaram; zero falhas.** Build de produção e verificação de tipos concluídos.
- **96 variantes no programa e as mesmas 96 nos HTMLs realmente baixados**: deslocamento/transformação da geometria, pausa estável, retomada, avanço, busca temporal, restauração, notas e navegação de todas as páginas/etapas.
- Programa testado com requisições externas bloqueadas, permitindo somente o servidor local. HTMLs abertos como arquivos locais com a rede do navegador totalmente desativada. Nenhuma requisição externa observada.
- Auditoria complementar: **390 estados**, ${contracts.interfaceChecks} verificações de interface e ${contracts.parameterChecks} verificações de parâmetros, sem falhas. Inclui movimento reduzido, reinício, todas as etapas e telas de 1366, 543 e 390 pixels.
- **88 comparações de posição inicial**: sobreposição corresponde à geometria inicial (tolerância de 0,02 px por serialização CSS) e permanece fixa ao percorrer o tempo.
- Parâmetros específicos conferidos: lei de Snell, sinais dos quadrantes, contagem de probabilidades, texto escapado, velocidade/BPM e reprodução após completar um ciclo.
- Capturas dos 27 modelos e das 96 variantes por formato estão nesta pasta. A revisão visual verificou a organização, a legibilidade e os controles; os testes geométricos não dependem de um botão ter mudado de nome ou de uma cor piscar.

## Problemas encontrados e corrigidos

1. Variantes com SVG idêntico podiam reutilizar o DOM alterado pelo controlador e perder os efeitos. O componente agora remonta a partir do SVG original ao trocar variante/etapa.
2. O cabeçalho redundante deixava o desenho abaixo da área visível em telas baixas. A interface foi compactada, preservando desenho e botão de reprodução juntos nos tamanhos testados.
3. Após um ciclo sem repetição, reproduzir precisava reiniciar o percurso. O controle agora volta ao início.
4. Legendas de coordenadas, evento e oração foram ajustadas para reconhecer os exemplos editáveis.

Os registros iniciais com falhas foram preservados. O primeiro teste de passo também foi ajustado para medir dentro do trecho móvel, pois algumas animações têm uma pausa intencional no final. A comparação de matrizes usa tolerância menor que um pixel devido ao arredondamento de estilos pelo navegador.

## Cobertura final

| Modelo | Variantes | Programa offline | HTML offline |
|---|---:|---|---|
${table}

## Preservação e rastreabilidade

- ${previousLessons.length} aulas anteriores, com conteúdo e versões idênticos ao início desta revisão.
- ${originalFiles.length} arquivos originais/HTMLs anteriores conferidos por SHA-256.
- ${backups.length} arquivos preservados em **${backup}**.
- Manifesto de fontes, cópias e exportações: [manifesto-final.json](manifesto-final.json).
- Comprovação dos downloads pela interface: [downloads-ui.json](downloads-ui.json).
- Resultados reais: [programa](programa-entrega.json), [HTML exportado](html-entrega.json), [comparação](comparacao-posicao-inicial.json), [suíte](suite-final.log), [galeria das 96 variantes](galeria-final.html).

## Limites pedagógicos

São modelos didáticos esquemáticos. Velocidade ilustrativa não significa duração real; barras demográficas e exemplos textuais não constituem dados históricos nem análise automática. BPM é visual, sem áudio. Probabilidade organiza resultados de um dado ideal, sem sorteio. O professor escolhe tema, ano e objetivos; as coleções de demonstração não implicam alinhamento BNCC nem validação em uma turma real.

A refração usa n₁ sen θ₁ = n₂ sen θ₂, com n₁=1 e ângulos medidos em relação à normal; referência: [OpenStax — Refraction](https://openstax.org/books/university-physics-volume-3/pages/1-3-refraction). Nenhum recurso externo é carregado pelo laboratório.
`,{flag:'wx'});
console.log(JSON.stringify({preservedLessons:previousLessons.length,preservedFiles:originalFiles.length,backupFiles:backups.length,exports:exports.length,tests:158,deliveryStates:192,contracts:contracts.states,passed:true}));
