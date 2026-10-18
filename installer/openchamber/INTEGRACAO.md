# Aulas e Atlas no desktop PEMARA

A edição 2.4.0-pemara.4 reúne conversas, gerador, biblioteca e Atlas na mesma janela. O gerador usa o acervo publicado e funciona offline; a IA do chat mantém seu provedor atual e precisa de internet.

Superfícies: Electron Windows recebe navegação nativa e uma vista isolada do PEMARA EDU. Web PEMARA recebe a biblioteca Atlas. Web OpenChamber, VS Code, hosted mobile e Capacitor permanecem sem esta capacidade; nenhum contrato compartilhado é alterado.

O Express do PEMARA roda dentro do processo Electron. PostgreSQL é iniciado por executável próprio, oculto, com dados persistentes fora da instalação. O encerramento aguarda backup e parada do banco antes da saída do Electron. Falha no módulo educativo não apaga dados nem impede usar as conversas.

A vista educativa tem sandbox, nenhuma integração Node e nenhuma ponte privilegiada. Somente a barra local de navegação recebe uma ponte restrita a destinos enumerados, conferida pelo ID do remetente. Downloads pertencem à sessão educativa e usam nomes novos em Documents/PEMARA Aulas/Minhas aulas/Exportadas. Exportações e dados não entram no instalador distribuível.

O importador executa a leitura em um processo Node oculto, usando o runtime incluído na distribuição. O caminho do carregador TypeScript é resolvido pelo módulo, independentemente da pasta de abertura do atalho. O bloqueio de rede e os limites de tempo e memória do leitor continuam ativos.

Originais antes da edição: build/openchamber/2.4.0-pemara.4/originais. O acervo anterior é copiado por snapshot transacional para um banco novo apenas nesta máquina; o banco de origem permanece independente. Instalações novas recebem somente o acervo de conteúdos público.
