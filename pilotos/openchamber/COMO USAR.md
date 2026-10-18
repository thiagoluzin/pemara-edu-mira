# PEMARA OpenChamber — piloto local

Abra **PEMARA OpenChamber - Piloto** na Área de Trabalho, ou dê dois cliques em `ABRIR PILOTO.vbs` nesta pasta. O professor não precisa abrir terminal nem executar comandos.

Os projetos e suas conversas ficam à esquerda. A seção **Arquivos**, abaixo, mostra os arquivos do projeto ativo. Clique em um arquivo para abri-lo no editor. Use **Adicionar projeto** para cadastrar uma pasta existente: ela continua no seu local original.

O piloto agora abre a conversa real **Evaporação da água - 5º ano**, criada com IA pela interface. A conversa importada do primeiro teste continua preservada, com sua identificação original. O texto no campo de mensagem é um rascunho não enviado.

## Criar uma aula com IA

Clique em **Nova sessão**, escolha o projeto e escreva o que deseja criar. O modelo selecionado é **DeepSeek V4.1 Flash Free**, do provedor OpenCode. Não foi necessário cadastrar uma chave para este teste. Envie a mensagem e acompanhe os arquivos na seção **Arquivos**. Se a lista não atualizar automaticamente, use o botão **Atualizar** dessa seção.

A criação por essa IA usa internet. A disponibilidade gratuita é definida pelo provedor e pode mudar. Nesta sessão, o aplicativo registrou custo zero. Houve reconexões e um tempo limite com outros modelos gratuitos; o DeepSeek concluiu a geração e a revisão. Isso não garante disponibilidade contínua do serviço.

Para experimentar a aula pronta, abra a pasta `aula-evaporacao-ia` do projeto **Aula de demonstracao** e clique em `aula.html`. A prévia interativa funciona dentro do programa. Também é possível abrir o mesmo arquivo por duplo clique no Explorador, sem internet. Os outros arquivos são `plano-professor.md` e `atividade-aluno.html`, com cinco questões para imprimir.

## Onde ficam os dados

- Projetos de demonstração: `G:\PEMARA_OpenChamber_Projetos`.
- Conversas, configurações e estado da janela: `G:\PEMARA_OpenChamber_Dados\perfil`.
- Banco de conversas: `perfil\.local\share\opencode\opencode.db`, dentro da pasta de dados acima. Para backup, feche o programa e copie a pasta de perfil inteira, além das pastas dos projetos.
- Código do piloto e cópias dos fontes originais: esta pasta, em `source` e `originais`.
- O perfil exploratório anterior, em `pilotos\openchamber\perfil`, também foi preservado.

O PEMARA, o instalador existente e os perfis anteriores continuam separados. Históricos e credenciais antigos não foram migrados para o piloto.

## O que foi verificado

O teste editou e salvou um arquivo pela interface, fechou a janela, aguardou a parada do processo e do servidor local e abriu novamente. Foram conferidos os dois projetos, as duas mensagens da conversa, o conteúdo exato do arquivo, o editor reaberto e o rascunho não enviado. O terminal interativo não apareceu, inclusive pelo atalho Ctrl+J.

Resultados e imagens estão em `evidencias/reabertura.json`, `reabertura-antes.png` e `reabertura-depois.png`. A comparação de 190 arquivos existentes do PEMARA, instalador e exportações não encontrou alterações: `evidencias/preservacao.json`. Compilação, verificação de tipos, lint dos seis arquivos alterados e sete testes do registro de interfaces passaram.

O teste posterior com IA real está em `evidencias/ia-reabertura.json`: 68 registros de conversa e os três arquivos permaneceram idênticos após encerrar o aplicativo e seu servidor local e reabrir. A árvore de arquivos, a conversa e o rascunho ficaram visíveis. O agente usou ferramentas de arquivos, sem terminal.

`evidencias/ia-aula-testes.json` registra a aula aberta no Chrome com a rede do contexto desativada: seis etapas, 50 minutos, notas, quiz, movimento observado por mudança de pixels, pausa, reinício, navegação e apenas um ciclo de animação. Não houve erros JavaScript nem solicitações de recursos remotos. `evidencias/ia-no-programa.json` registra o teste adicional de slides, notas, quiz e simulação na prévia do próprio OpenChamber.

Backup anterior à configuração de IA: `originais/antes-ia-20261018`. A comparação confirmou quatro conversas anteriores, oito mensagens e dois arquivos de demonstração preservados (`evidencias/ia-preservacao.json`). As primeiras versões do material gerado também estão guardadas em `originais/ia-primeira-geracao` e `originais/ia-html-inicial`.

## Limites deste piloto

Este é um piloto para o computador atual, com Node.js já instalado e dependências locais preparadas. Ainda não é um instalador redistribuível para Windows 10/11. A faixa amarela superior identifica a execução de desenvolvimento do OpenChamber.

A persistência local e a aula HTML sem rede foram testadas. A IA configurada é online; não foi instalado nem validado um modelo local para gerar novas aulas offline. Nenhuma chave existente foi copiada automaticamente. As ferramentas de execução do agente continuam disponíveis internamente, embora o professor não precise usar um terminal.

Referência do provedor: https://opencode.ai/v2/docs/console/models/ . Referência conceitual consultada na revisão da evaporação: https://www.usgs.gov/water-science-school/science/evaporation-and-water-cycle .
