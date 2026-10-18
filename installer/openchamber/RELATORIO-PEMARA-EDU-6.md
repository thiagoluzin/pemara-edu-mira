# PEMARA EDU 2.4.0-pemara.6 — IA gratuita na nuvem

18/10/2026. Esta versão usa o OpenCode como motor de IA e o OpenChamber como interface desktop. O professor instala, abre PEMARA EDU e usa Criar aula com IA. Não há modelo local, pesos de IA, exigência de GPU ou escolha manual de modelo para gerar aulas. A geração precisa de internet; biblioteca, Atlas e HTML exportado funcionam offline.

## Geração real e revisão

O botão da interface enviou tema, duração e um TXT importado e revisado ao modelo **opencode/beam-free**. A resposta completa chegou e foi salva em aproximadamente **23 segundos**, com preço registrado pelo OpenCode igual a zero. Aula: **Como a roupa molhada seca? Evaporação e condensação**, Ciências, 6º ano, 30 minutos, nove cenas. Pedido: `7534182d-a04c-4b66-936c-b042a972434d`.

A revisão pedagógica encontrou na versão 1 a expressão incorreta “vapor visível”. Foi salva uma versão 2 pela API do próprio aplicativo, corrigindo para bolhas de vapor no líquido e gotículas condensadas na névoa. A versão original permanece no histórico. A revisão de conteúdo continua necessária: a indicação de estrutura verificada não certifica correção científica ou adequação à turma. A sequência inclui previsão inicial, explicações, comparação com ebulição, Atlas, experiência segura com panos, quiz com feedback e síntese. Os tempos sugeridos somam 30 minutos.

## Correções

- Catálogo vivo do OpenCode: somente modelos habilitados, de texto, com saída suficiente e preços explicitamente zero em todos os níveis de entrada, saída e cache. Modelos locais, pagos e de preço desconhecido são excluídos. A preferência manual do chat não impõe um modelo ao gerador.
- Falha ou resposta inválida avança automaticamente para outro gratuito. Tentativas ficam registradas na mesma conversa. A troca ocorreu no teste real após demora do primeiro modelo; testes com falhas controladas também confirmaram a sequência e o isolamento de professores. Limites: quatro minutos por resposta, duas tentativas de estrutura por modelo e doze minutos por execução. Ao esgotar, o pedido permanece disponível para Retomar.
- IDs nativos do OpenCode e correlação por metadados substituem identificadores fabricados. O adaptador espera a resposta correspondente terminar, mesmo se o runtime ainda estiver ocioso quando a chamada for aceita. Usa o agente oficial de planejamento e restringe shell, escrita e acesso externo apenas na conversa dedicada.
- Migração 008 amplia o tema para TEXT, preservando as orientações aceitas pelo formulário. Uma resposta validada é guardada antes da escrita na biblioteca; falha local retoma o salvamento da mesma resposta, sem nova geração.
- O Atlas explicitamente escolhido tem prioridade sobre os metadados de diagrama da IA, preservando explicações e originais. Teste de regressão cobre os 26 identificadores nesse caso; a animação de evaporação foi exercitada na aula real.
- O catálogo enviado à IA inclui variantes e controles reais de evaporação. O normalizador aceita o formato exato `{id: string}`, mantendo a rejeição a modelos desconhecidos e disciplinas incompatíveis.
- Nomes de exportação usam o título, são limitados e removem caracteres inválidos no Windows. O teste real revelou e corrigiu a falha causada por usar orientações longas como nome do arquivo.

## Evidências

Aplicativo empacotado: criação real com material importado, salvamento, exportação pela interface, percurso até a síntese, abertura de notas do professor, geometria em movimento e pausa estável no Atlas com rede do navegador desabilitada. Fechar e reabrir manteve a aula e o acervo. O HTML foi aberto, animado, pausado, fechado e reaberto em Chrome offline. A simulação de rede é do contexto do navegador, não a desconexão física de todo o Windows.

O instalador final foi aplicado sobre a instalação existente, com código de saída zero. No executável instalado, a mesma aula passou novamente por notas, sequência até a síntese, movimento/pausa offline, exportação e reabertura do aplicativo e do HTML, sem outra geração de IA. Atalhos da Área de Trabalho e do menu Iniciar foram conferidos. Seis recursos de código/build instalados corresponderam aos empacotados por SHA-256. O teste confirma esta atualização no Windows 11, não uma instalação limpa em todos os notebooks.

Oito testes de regressão de jobs, visuais e nomes de arquivo, três testes de catálogo/espera/cancelamento, TypeScript e build de produção passaram. Falha de armazenamento seguida de retomada sem nova chamada de IA, inclusive sem conexão com o catálogo, foi testada em PostgreSQL descartável. Um pedido novo também foi preservado quando a consulta ao catálogo falhou. O scanner Pemara passou sem erros; cinco avisos históricos de BOM em scripts PowerShell de manutenção foram mantidos e registrados.

Comparação com os backups anteriores preservou **33 aulas, 48 revisões, seis rascunhos, quatro materiais, 46 mensagens anteriores, quatro conversas anteriores e 18 arquivos do professor**. Os dois pedidos antigos permaneceram iguais. Os testes acrescentaram pedidos, materiais e uma aula novos; nada do acervo anterior foi substituído.

Evidências locais: `build/openchamber/2.4.0-pemara.6/evidencias/`, em especial `packaged-aula-real.json`, `installed-aula-real.json`, `preservation-final.json` e os testes finais. As tentativas interrompidas e o candidato anterior foram conservados e não são a entrega final.

## Implantação

Windows 10 e 11 x64 são os destinos; o teste efetivo desta máquina é Windows 11 x64. Windows 10 ainda exige validação em máquina própria. O pacote mantém o identificador de instalação e os diretórios de dados anteriores. Não inclui perfis, conversas, materiais pessoais ou credenciais do autor. As versões anteriores dos instaladores continuam preservadas. A disponibilidade futura do serviço gratuito depende do provedor; o programa não migra automaticamente para serviços pagos.

Instalador: `PEMARA-EDU-2.4.0-pemara.6-Windows-x64-Instalar.exe`, 413.447.637 bytes. SHA-256: `1aedb417251dc13bbd67bae636d41acc152568f717b0ee314777a537b88931a8`. Pasta de entrega: `ENTREGAS/PEMARA-EDU-2.4.0-pemara.6`.

Fontes e receitas ficam no GitHub; executáveis, bancos e dados pessoais ficam fora do Git. Consulte [compilação](BUILD-PEMARA-EDU.md), [integração](INTEGRACAO-IA.md), [guia](AULAS-PROFESSORES.txt) e [licenças](../../THIRD_PARTY_NOTICES.md). Referências técnicas: [OpenCode](https://github.com/anomalyco/opencode/tree/v2.0.32), [OpenChamber](https://github.com/openchamber/openchamber). O relatório da versão 5 permanece como registro histórico da recusa 403.
