# PEMARA EDU — um computador por professor

## Preparar e abrir

Esta edição foi implementada para Windows x64, com Node.js 24 e navegador Chromium.
No computador de desenvolvimento, as dependências e a compilação já estão preparadas.
Em outro computador, instale Node.js 24 e execute `PREPARAR PEMARA OFFLINE.bat`
com internet uma vez. Isso instala as versões do lockfile, o PostgreSQL embarcado,
PDF.js, Tesseract e os idiomas português/inglês, compila e verifica a instalação.
Não há instalador autossuficiente para computadores novos nesta etapa.

Abra `INICIAR PEMARA OFFLINE.bat`. A aplicação e o banco ficam restritos a
`127.0.0.1`, nas portas 3001 e 55433. Se estiverem ocupadas, o início informa o
problema e preserva os processos existentes. Configuração local em
`.local-teacher/config.json`; nunca publique esse arquivo nem copie uma instalação
com dados pessoais para outros professores.

O programa abre diretamente: **não há cadastro, login ou senha** nessa edição.
Cada computador tem banco, originais, rascunhos e histórico próprios. Na atualização,
o acervo já existente é preservado. O acesso ao computador é controlado pelo Windows.
O modo offline desativa geração por IA, testes de provedores e consultas à Wikidata.
O acervo distribuído continua sujeito à revisão pedagógica; a carga técnica não
registra aprovação do professor. Não existe sincronização entre computadores.

## Preparar uma aula

1. Entre em **Nova Aula** e escolha disciplina, ano e tema do acervo local.
2. Em **Materiais do professor**, adicione arquivos ou escreva seu texto.
3. Confira os trechos extraídos e selecione os que usará. Nada é selecionado
   automaticamente. Em **Usar meu material como roteiro**, a aula terá apenas
   a capa e os trechos escolhidos. **Acrescentar ao acervo por etapa** mantém as
   páginas do acervo. Confira abertura, desenvolvimento e avaliação; use as setas
   para ordenar os trechos dentro de cada etapa. A avaliação fica no encerramento.
4. Marque a conferência de leitura, fontes e pertinência. Use **Gerar sem IA**.
5. Na cena de texto, use **Modelo visual** para escolher um modelo do Atlas da
   disciplina, manter a escolha automática ou usar quadro de texto.
6. As alterações são guardadas como rascunho. Use **Salvar Versão** para registrar
   uma versão no histórico. Apresente ou exporte HTML autossuficiente/PDF.
7. No editor, **Título da aula** renomeia também a capa. **Subir/Descer** muda
   a ordem das páginas. Confira o tempo para discussão: a duração é uma escolha
   do professor, não uma estimativa automática. “Estrutura verificada” não é
   aprovação pedagógica.

A importação conserva o original no banco, com SHA-256 e download de conferência.
As cenas conservam nome do arquivo, página/slide/parágrafo e identificador de origem.
Os trechos são inseridos literalmente, na ordem exibida por etapa; os limites
não eliminam trechos silenciosamente. No modo com IA da edição geral, os materiais
continuam sendo mesclados localmente e não integram o pedido ao provedor.

## Limites desta etapa

- Formatos integrados: PDF, DOCX, PPTX, TXT e MD. DOC/PPT antigos devem ser salvos
  como DOCX/PPTX antes da importação. A edição offline não executa LibreOffice externo.
- Até dez arquivos por lote e 40 MB por arquivo; um processamento por vez, com
  cancelamento e limite de cinco minutos.
- Por importação de PDF: até 100 páginas e 12 tentativas de OCR. Informe outro
  intervalo para continuar. Arquivos protegidos precisam ser desbloqueados pelo autor.
- Até 700 mil caracteres extraídos por documento, com aviso de leitura parcial;
  seleção até 120 mil caracteres e até 24 cenas (padrão oito). Reduza a seleção
  quando exceder o orçamento de cenas. O original permanece inteiro.
- A biblioteca oferece os 200 materiais mais recentes. Materiais antigos permanecem
  preservados no banco/backup; paginação e organização por pastas ficam para evolução.
- Importação textual: não reconstrói diagramação, imagens, equações nem apresentações
  inteiras. OCR pode errar acentos, números e fórmulas e precisa de conferência.
- Os 26 modelos do Atlas não significam cobertura integral da BNCC. A escolha por
  palavras do assunto é uma sugestão, não uma interpretação semântica do material.
  As habilidades curriculares e a validade pedagógica continuam sob revisão docente.

## Encerrar, copiar e restaurar

Use `PARAR PEMARA OFFLINE.bat` e espere o encerramento. O banco permanece em
`.local-teacher/postgres`; backups JSON completos são criados em
`.local-teacher/backups`, incluindo arquivos originais, aulas, versões e contas.
O encerramento registra falha de backup em `server-error.log` se houver problema.
Confira a existência do novo arquivo antes de desligar ou remover a mídia.

Copie regularmente um backup para uma segunda mídia guardada pela escola ou pelo
professor. O arquivo contém dados privados e não é criptografado. Não compartilhe
o backup completo como material didático: para isso, exporte somente a aula.
Backups acumulam espaço; não são apagados automaticamente. Monitore o armazenamento.

Para recuperar, com o PEMARA encerrado, execute na pasta do projeto:

```powershell
node --import tsx scripts/demo-local.ts --teacher --restore "D:\Backup\backup.json" --confirm
```

Esse comando inicia o banco, preserva uma cópia anterior em `antes-restauracao-*`,
confere o envelope e restaura transacionalmente antes de abrir o servidor.
Ele substitui o conteúdo do banco local pelo backup; as sessões antigas são encerradas.
Acesse `http://127.0.0.1:3001`; o acervo restaurado abre sem login.
Não edite o JSON. Um hash divergente é motivo para usar outra cópia íntegra.
Se o computador falhar, prepare uma instalação nova e restaure a cópia da segunda mídia.

A pasta `.local-demo` da demonstração é independente. Para voltar ao código original,
use a referência Git `b146de7bf13486ae527d002c7873138c0d1ebd14` em outra pasta;
preserve o banco atual e não inicie uma versão antiga sobre ele.

## Validação e piloto escolar

Execute `npm run typecheck`, `npm test` e `npm run offline:check`.
A suíte utiliza bancos descartáveis, Chrome real, documentos sintéticos e processos
de extração com acesso à rede bloqueado. O teste do professor percorre primeiro
acesso, revisão, importação, Atlas, salvamento, reinício e restauração. O HTML
exportado também é exercitado sem recursos externos. Evidências locais em
`docs/evidencias/offline-atlas` e `evidencias/relatorio_auditoria_visual.json`.

Antes de ampliar o uso, faça um piloto em dois ou três computadores representativos:
uma aula real de cada professor, rede desconectada, projetor, importação das apostilas
reais e restauração em uma instalação de teste. Registre legibilidade, tempo de
preparo, falhas de OCR, compatibilidade do conteúdo e segurança da cópia de backup.
Os testes técnicos não substituem essa validação em sala nem a aprovação dos materiais.
