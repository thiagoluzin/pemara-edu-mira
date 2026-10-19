# Correção da abertura de Aulas e Atlas — 19/10/2026

Cliques durante a primeira abertura chamavam `webContents.loadURL` várias vezes no mesmo documento. Cada chamada cancelava a anterior; o programa apresentava `ERR_ABORTED (-3)` como falha do acervo. O problema foi reproduzido no executável instalado com cinco solicitações simultâneas: quatro avisos de erro e uma abertura concluída.

A navegação agora executa um carregamento por vez, descarta pedidos ultrapassados e mantém a última área solicitada. Voltar às conversas durante a abertura não faz a área educacional reaparecer. Falhas reais continuam visíveis e permitem tentar novamente sem reiniciar. A inicialização do serviço não conserva indefinidamente uma promessa rejeitada. O indicador do menu também respeita o último clique.

## Verificação

- Cinco testes de regressão: cliques rápidos; clique durante carregamento; retorno ao chat; falha real seguida de nova tentativa; janela fechada durante inicialização.
- Executável instalado: cinco solicitações simultâneas sem aviso; navegação por Atlas, Criar aula e Minhas aulas; fechar e abrir novamente. Duas execuções com as mesmas 34 aulas disponíveis.
- Instalador de manutenção executado com saída 0. Após reinstalar, o teste acima passou novamente em dois ciclos. A conversa atual permaneceu idêntica e os 18 arquivos originais dos professores mantiveram seus SHA256.
- Não houve geração de IA nem alteração de conteúdo nesta correção.
- Arquivo original `app.asar` preservado em `build/openchamber/navigation-fix-20261019/app-original.asar`. A atualização local preserva os bytes e as entradas dos demais arquivos; recibo em `patch-receipt.json`.
- Evidências antes/depois e capturas em `build/openchamber/navigation-fix-20261019`. Windows 11 testado; Windows 10 não foi testado neste atendimento.

## Limite da conferência histórica

A comparação com o backup antigo de 18/10 detectou diferença: quatro conversas e 46 mensagens daquele backup não correspondem ao banco atual, que contém uma conversa e quatro mensagens. Esta auditoria não determina quando nem por que ocorreu essa diferença. Não foi feita restauração automática. O backup antigo foi mantido e uma cópia consistente do banco atual foi salva em `conversations-current.db`. O banco atual permaneceu idêntico após mais dois ciclos de abertura e encerramento (`conversations-preserved.json`). Portanto, não declarar que todo o histórico antigo está presente no banco atual.

## Instalador de manutenção

Mantém a identidade e a versão-base 2.4.0-pemara.6, com nome de arquivo `PEMARA-EDU-2.4.0-pemara.6-Correcao-Navegacao-Windows-x64.exe`. Os instaladores anteriores permanecem preservados. O pacote reutiliza o runtime validado e recebe somente a correção de navegação; não inclui o perfil pessoal.

Para reproduzir o empacotamento normal, executar `prepare-education.mjs --bundle-only`, recompilar o adaptador pelo procedimento existente e empacotar com `build.mjs --education --dir` em um staging preservado. O helper `education-navigation.mjs` agora integra o manifesto de cópia. Para o instalador de manutenção, usar `build.mjs --navigation --prepackaged <pasta-do-programa-corrigido>`; essa opção usa saída separada e não sobrescreve o instalador original.
