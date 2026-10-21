import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {version,stage} from './release.mjs';
const out=path.resolve('evidencias/bundle-v11-20261019');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const checks={native:read(path.join(out,'installed-exports.json')),html:read(path.join(out,'html-validation.json')),content:read(path.join(out,'export-content.json')),preservation:read(path.join(out,'preservation-after.json')),clean:read(path.join(stage,'evidencias/installed-clean.json'))};
for(const item of Object.values(checks))assert.equal(item.passed,true);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const previous=read(path.join(out,'previous-program-hashes.json'));
for(const entry of previous){const original=entry.Path;const held=original.replace('Programs\\PEMARA EDU Teste Limpo\\','Programs\\PEMARA EDU Teste Limpo.preservado-bundle-v11-20261019\\');assert.equal(hash(held),entry.Hash.toLowerCase());}
const delivery=path.resolve('ENTREGAS/PEMARA-EDU-'+version+'-Limpo');
const installer=path.join(delivery,'PEMARA-EDU-'+version+'-Limpo-Windows-x64-Instalar.exe');
const installerHash=hash(installer);const bytes=fs.statSync(installer).size;
for(const file of checks.native.exports)assert.equal(hash(file.path),file.sha256);
const text=`PEMARA EDU ${version} — EXPORTAR OS TRÊS FORMATOS JUNTOS
Validação: ${new Date().toISOString()}

COMO USAR
No editor, clique em Exportar e em "Exportar HTML, PDF e Word juntos".
Escolha uma pasta uma única vez e confirme. O programa salva os três arquivos
diretamente nela. Se os nomes já existirem, cria cópias com sufixo numérico,
sem substituir os anteriores. As opções de exportação individual permanecem.

TESTES
- TypeScript e seis testes de pacote aprovados: seleção única, cancelamento,
  colisão de nomes, concorrência e falha de gravação com limpeza dos novos arquivos.
- Instalador final instalado; código nativo e recursos conferidos.
- Primeira abertura e reabertura vazias, sem aulas, materiais, pesquisas ou chats.
- Executável instalado: ${checks.native.observations.dialogs.length} seleção de pasta e
  ${checks.native.observations.individualDialogs} diálogos individuais de Salvar como.
- HTML, PDF e Word gerados juntos; arquivos anteriores e aula preservados.
- HTML offline: animação, pausa e quiz aprovados.
- PDF dos alunos: ${checks.content.studentPages} páginas, sem notas e gabarito.
- Word: ${checks.content.editableParagraphs} parágrafos editáveis e ${checks.content.editableTables} tabela.

ARQUIVOS DO TESTE
${checks.native.exports.map(e=>e.path+'\nSHA256: '+e.sha256).join('\n')}

PRESERVAÇÃO
${checks.preservation.protectedFiles} arquivos de dados e ${checks.preservation.preservedLinks} vínculos conferidos, sem alterações.
Perfil original restaurado; dados de teste separados. Binários .10 preservados
com sufixo .preservado-bundle-v11-20261019 e hashes do executável/app.asar conferidos.
O instalador contém apenas o programa e recursos, sem dados ou credenciais de usuário.

LIMITES
Windows 11 x64. Nenhuma nova chamada de IA; usou-se uma aula real anterior.
O proprietário confirmou a pasta na janela nativa porque a automação de entrada
do Windows retornava acesso negado. O observador encaminhou a chamada original
do Electron e contou os diálogos, sem simular a escolha da pasta.
Não é uma garantia universal de 100%; PDF e Word são estáticos.

INSTALADOR
${installer}
Tamanho: ${bytes} bytes
SHA256: ${installerHash}
Authenticode: não assinado.
Evidências: ${out}
`;
fs.writeFileSync(path.join(delivery,'VALIDACAO.txt'),text);fs.writeFileSync('installer/openchamber/RELATORIO-PEMARA-EDU-11.txt',text);
fs.copyFileSync(path.join(out,'bundle-button.png'),path.join(delivery,'exportar-tres-formatos.png'));
fs.writeFileSync(path.join(delivery,'ENTREGA.json'),JSON.stringify({version,installer,installerHash,bytes,checks},null,2));
console.log(JSON.stringify({passed:true,delivery,installerHash,bytes}));
