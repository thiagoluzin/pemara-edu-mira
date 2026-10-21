import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {stage,version} from './release.mjs';
const evidence=path.resolve('evidencias/export-v9-20261019');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const exports=read(path.join(evidence,'installed-exports.json'));
const content=read(path.join(evidence,'export-content.json'));
const word=read(path.join(evidence,'word-validation-final.json'));
const clean=read(path.join(stage,'evidencias/installed-clean.json'));
const installed=read(path.join(stage,'evidencias/installed-package.json'));
const preservation=read(path.join(evidence,'preservation-after.json'));
const installation=read(path.join(stage,'evidencias/installation.json'));
const rendering=read(path.join(evidence,'render-validation.json'));
for(const value of [exports,content,clean,installed,preservation,installation,rendering])assert.equal(value.passed,true);
assert.ok(word.editAndReopenPassed&&word.openedInMicrosoftWord);
assert.equal(exports.executablePath,path.join(process.env.LOCALAPPDATA,'Programs/PEMARA EDU Teste Limpo/PEMARA EDU Teste Limpo.exe'));
const delivery=path.resolve('ENTREGAS',`PEMARA-EDU-${version}-Limpo`);
const installer=path.join(delivery,`PEMARA-EDU-${version}-Limpo-Windows-x64-Instalar.exe`);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const installerHash=hash(installer);assert.equal(installerHash,installation.installerSHA256.toLowerCase());
const text=`PEMARA EDU ${version} — EXPORTAÇÃO COM SALVAR COMO
Validação: ${new Date().toISOString()}

COMO USAR
Abra PEMARA EDU Teste Limpo. No editor da aula, clique em Exportar.
Escolha HTML animado, PDF para os alunos ou Word do professor.
Na janela Salvar como, escolha a pasta e o nome. O caminho aparece após salvar.

HTML: arquivo autossuficiente com animações, navegação e quiz; abre offline.
PDF dos alunos: cenas completas, sem notas do professor e sem gabarito.
DOCX do professor: textos, tabelas, notas e respostas editáveis; figuras estáticas.
JSON: backup para importar a aula no PEMARA. PDF com gabarito também disponível.
Editar o Word não altera a aula no PEMARA nem o HTML. Para atualizar a apresentação,
edite no programa e exporte novamente.

TESTES EXECUTADOS
- Instalação silenciosa do instalador final, saída 0; arquivos instalados conferidos.
- Primeira abertura e reabertura sem aulas, materiais, pesquisas ou chats.
- Exportação pela interface do executável instalado para outra pasta com acentos.
- Cancelamento sem arquivo; erro de destino, nova tentativa e substituição.
- HTML com animação, pausa e quiz funcionando offline.
- PDF de ${content.studentPages} páginas: todas as ${content.allScenes} cenas, sem notas/respostas.
- Word com ${content.editableParagraphs} parágrafos e ${content.editableTables} tabela editáveis;
  aberto no Microsoft Word, editado em cópia, salvo e reaberto com a alteração.
- Cobertura adicional dos 11 tipos de cena; contraste de Biologia e paginação do
  Sistema Solar corrigidos. PDF/Word renderizados e conferidos visualmente.
- TypeScript e 6 testes de exportação aprovados; dependência docx fixada em 9.12.0.
- Aula e versão permaneceram intactas após exportação.

LIMITES DA EVIDÊNCIA
Testado em Windows 11 x64. A seleção do destino/cancelamento foi automatizada
na API do diálogo nativo, com registro dos filtros e opções; não houve clique
manual no seletor de pastas do Windows. Não é uma garantia universal de 100%.
A aula usada foi a geração real de Ciências e quatro revisores da validação .8;
esta etapa não fez nova chamada de IA. PDF e Word são estáticos.
O renderizador LibreOffice da skill não estava instalado; a conferência do DOCX
usou o próprio Microsoft Word e imagens das páginas renderizadas por ele.

PRESERVAÇÃO E INSTALADOR LIMPO
${preservation.protectedFiles} arquivos originais conferidos por SHA-256, sem alterações.
Perfis e documentos originais restaurados; resultados de teste ficaram separados.
Binários anteriores preservados em: ${preservation.preservedProgram}
O instalador contém o programa e recursos didáticos, sem aulas, pesquisas,
chats, bancos de usuário ou credenciais. Reinstalar preserva os dados existentes.

INSTALADOR
${installer}
Tamanho: ${fs.statSync(installer).size} bytes
SHA-256: ${installerHash}
Assinatura Authenticode: não assinado.

Evidências: ${evidence}
Instalação e pacote: ${path.join(stage,'evidencias')}
`;
fs.writeFileSync(path.join(delivery,'VALIDACAO.txt'),text);
fs.writeFileSync(path.resolve('installer/openchamber/RELATORIO-PEMARA-EDU-9.txt'),text);
fs.copyFileSync('installer/openchamber/AULAS-PROFESSORES.txt',path.join(delivery,'GUIA-DO-PROFESSOR.txt'));
fs.copyFileSync(path.join(evidence,'exportacao-instalada.png'),path.join(delivery,'exportar-salvar-como.png'));
fs.copyFileSync(path.join(stage,'evidencias/installed-clean-2-library.png'),path.join(delivery,'biblioteca-vazia.png'));
fs.writeFileSync(path.join(delivery,'ENTREGA.json'),JSON.stringify({version,installer,installerSHA256:installerHash,bytes:fs.statSync(installer).size,installedExports:exports.checks,content,word,preservation,cleanChecks:clean.checks,createdAt:new Date().toISOString()},null,2));
fs.writeFileSync(path.join(delivery,'SHA256.json'),JSON.stringify(fs.readdirSync(delivery).filter(name=>name!=='SHA256.json').map(name=>({file:name,sha256:hash(path.join(delivery,name))})),null,2));
console.log(JSON.stringify({passed:true,delivery,installerSHA256:installerHash,bytes:fs.statSync(installer).size}));
