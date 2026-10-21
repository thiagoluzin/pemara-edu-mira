import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {stage,version} from './release.mjs';
const root=path.resolve('evidencias/real-e2e-20261019');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const result=read(path.join(root,'result.json'));
const preservation=read(path.join(root,'preservation-after.json'));
const clean=read(path.join(stage,'evidencias/installed-clean.json'));
const installed=read(path.join(stage,'evidencias/installed-package.json'));
const pdf=read(path.join(root,'pdf-final-check.json'));
const sources=read(path.join(root,'all-installed-sources-final.json'));
const installation=read(path.join(stage,'evidencias/installation.json'));
for(const report of [result,preservation,clean,installed,pdf,sources,installation])assert.equal(report.passed,true);
assert.equal(result.appVersion,version);assert.equal(preservation.changes.length,0);
const delivery=path.resolve('ENTREGAS',`PEMARA-EDU-${version}-Limpo`);
const installer=path.join(delivery,`PEMARA-EDU-${version}-Limpo-Windows-x64-Instalar.exe`);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const installerHash=hash(installer);assert.equal(installerHash,installation.installerSHA256.toLowerCase());
const summary={version,passed:true,installer,installerBytes:fs.statSync(installer).size,installerSHA256:installerHash,
 installedExecutable:result.executablePath,installationExitCode:installation.exitCode,
 cleanOpenAndReopen:clean.passed,initialCounts:clean.cycles[0].databaseCounts,initialChatCounts:clean.chatTables,
 realAI:{model:result.job.model,lessonId:result.lesson.id,scenes:result.lesson.scenes,reviews:result.job.reviews.map(r=>({name:r.agent_name,findings:r.findings.length,model:r.model})),reviewSessions:result.reviewSessionIds.length,finalVersion:result.lesson.version,reusedAcrossPrintFix:result.reusedCompletedRealGeneration},
 checks:result.checks,pdfPages:pdf.pages,protectedFiles:preservation.protectedFiles,changedOriginalFiles:preservation.changes.length,
 previousCleanInstallationPreserved:preservation.preservedPreviousProgram,installedSourceFiles:sources.checks.length,
 scope:'Windows 11 x64; aula de Ciências, 6º ano, IA gratuita real; não é garantia universal nem aprovação pedagógica.',
 evidenceDirectory:root,checkedAt:new Date().toISOString()};
const text=`PEMARA EDU ${version} — INSTALADOR LIMPO E TESTE COM IA REAL
Validação: 19/10/2026, Windows 11 x64.

ARQUIVO FINAL
${path.basename(installer)}
Tamanho: ${summary.installerBytes} bytes.
SHA-256: ${installerHash}
Pasta: ${delivery}
O arquivo final foi instalado e conferido. Instalação silenciosa: saída 0.
Executável instalado: ${result.executablePath}
Atalho: PEMARA EDU Teste Limpo. Instalador sem assinatura digital.

RESULTADO DO FLUXO REAL
Geração com ${result.job.model}, pelo programa instalado, sem simular resposta de IA.
Aula de Ciências do 6º ano: evaporação e condensação, ${result.lesson.scenes} cenas.
Um professor autor e quatro revisores em cinco conversas independentes.
${summary.realAI.reviews.map(r=>`${r.name}: ${r.findings} apontamentos (${r.model}).`).join('\n')}
Edição de título e nota pela interface; publicação final v${result.lesson.version}.
Revisão original v1 mantida e comparada integralmente com o histórico.
Número do JSON persistido coincide com a versão publicada e exportada.
Fechamento e reabertura preservaram aula, edição e quatro pareceres.
Apresentação offline: sequência completa, notas, Atlas em movimento/pausa.
Quiz: resposta incorreta, nova tentativa e resposta correta no programa.
HTML exportado: reabertura offline, navegação completa, Atlas e quiz verificados.
JSON exportado: conteúdo comparado integralmente com a versão persistida.
Impressão: documento gerado pelo botão do aplicativo, com cenas e notas.
PDF de ${pdf.pages} páginas produzido a partir desse documento pelo Chromium,
reaberto, extraído e renderizado para conferência visual de todas as páginas.
O diálogo gráfico da impressora do Windows não foi automatizado.
Nenhum erro não tratado do renderizador no ensaio final.

CORREÇÕES ENCONTRADAS E VERIFICADAS
1. A publicação v2 guardava lesson_version 1 dentro do JSON. Agora a transação
   grava a identidade e a versão definitivas antes de calcular o hash. Criação,
   publicação, restauração e duplicação mantêm os snapshots antigos intactos.
2. A impressão usava o pedido inteiro no nome do arquivo, ultrapassando o limite
   do Windows. Agora usa o título sanitizado e limitado, com prefixo de impressão.
   O download real foi repetido e concluído no instalador final.
Passaram nove testes focados: três de integração/regressão com PostgreSQL e
OpenCode controlado, e seis de exportação/impressão. TypeScript e build passaram.
Os ${sources.checks.length} arquivos de código instalados coincidem com as fontes atuais.

INSTALADOR LIMPO E PRESERVAÇÃO
Antes de gerar, o pacote final foi aberto, fechado e reaberto com perfil vazio.
Aulas, revisões, rascunhos, materiais pessoais, tentativas de geração,
lotes de pesquisa/importação, staging e tabelas de chat: zero nos dois ciclos.
O pacote não contém banco de uso, perfil pessoal, aula criada ou credencial.
Atlas, currículo, 12 professores especialistas e habilidades são recursos do app.
Os perfis originais foram guardados antes do teste e restaurados ao terminar.
${preservation.protectedFiles} arquivos originais conferidos por SHA-256: zero alterações.
A instalação normal anterior continua preservada. A edição Teste Limpo recebeu
a versão 8; seus binários anteriores também foram guardados, sem alteração, em:
${preservation.preservedPreviousProgram}
Dados e documentos do ensaio ficaram separados em pastas resultado-e2e-20261019.
As aulas, pesquisas e conversas de teste NÃO foram incluídas no instalador.
Reinstalar a edição limpa preserva os dados existentes; não é um comando de apagar.
O programa foi deixado fechado após os testes.

RASTREABILIDADE E LIMITES
Evidências detalhadas: ${root}
Relatório automatizado final: result.json. Preservação: preservation-after.json.
A geração real da versão 8 e seus quatro pareceres foram conservados durante a
correção da impressão. A rodada final reutilizou essa aula e fez nova edição;
não trocou o conteúdo por uma resposta simulada nem gastou outra geração.
Resultados anteriores e candidato com falha de impressão foram preservados.
O ensaio foi ajustado para aguardar a versão recém-publicada, selecionar as notas
no painel correto e verificar o conteúdo do arquivo de impressão efetivamente salvo.
Uma aula de Ciências e um provedor real foram exercitados. Não foram validados
todos os temas, todas as respostas futuras da IA, Windows 10 ou outros computadores.
A geração depende de internet e disponibilidade do provedor gratuito.
Os pareceres registram limitações das fontes e melhorias; não são aprovação
docente. A aula é material de teste e ainda exige revisão pedagógica antes do uso.
PDF é estático; interações transitórias do Atlas são verificadas no app e no HTML.
Este resultado comprova o fluxo descrito; não constitui garantia de 100% universal.
`;
fs.writeFileSync('installer/openchamber/RELATORIO-PEMARA-EDU-8.txt',text);
fs.writeFileSync(path.join(delivery,'VALIDACAO.txt'),text);
fs.writeFileSync(path.join(delivery,'ENTREGA.json'),JSON.stringify(summary,null,2));
fs.copyFileSync('installer/openchamber/AULAS-PROFESSORES.txt',path.join(delivery,'GUIA-DO-PROFESSOR.txt'));
for(const [src,dst] of [['installed-clean-2-library.png','biblioteca-vazia.png'],['installed-clean-2-chat.png','chat-vazio.png']])fs.copyFileSync(path.join(stage,'evidencias',src),path.join(delivery,dst));
const hashes=fs.readdirSync(delivery).filter(n=>n!=='SHA256.json').map(name=>({name,bytes:fs.statSync(path.join(delivery,name)).size,sha256:hash(path.join(delivery,name))}));
fs.writeFileSync(path.join(delivery,'SHA256.json'),JSON.stringify(hashes,null,2));
installation.firstLaunchTest='passed';fs.writeFileSync(path.join(stage,'evidencias/installation.json'),JSON.stringify(installation,null,2));
console.log(JSON.stringify({passed:true,installerHash,files:hashes.length,protectedFiles:summary.protectedFiles,changedOriginalFiles:0,pdfPages:pdf.pages}));
