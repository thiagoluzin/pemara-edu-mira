# Piloto PEMARA OpenChamber

Base preservada: OpenChamber v2.4.0, commit 6a10ee19a12a1542cad01eee5add14e030ba4ac4, MIT.
As cópias dos arquivos alterados ficam em originais/. O repositório principal e os instaladores existentes não são modificados.

## Escopo das interfaces

- Electron Windows: perfil separado, interface em português, tema neutro, projetos e arquivos à esquerda, terminal interativo oculto e abertura bloqueada no estado da interface.
- Web: as mesmas alterações somente quando compilado com VITE_PEMARA_PILOT=1.
- VS Code: não distribuído pelo piloto; compilação normal mantém o comportamento original.
- Mobile hospedado: não distribuído; compilação normal mantém o comportamento original.
- Capacitor: não distribuído; compilação normal mantém o comportamento original.

O motor mantém suas ferramentas de execução para trabalhar nos projetos. A retirada do terminal é uma decisão de interface, não uma barreira de segurança para as ferramentas do agente.

O piloto usa diretórios próprios para dados do OpenCode, configurações do OpenChamber e perfil Chromium. Não importa credenciais nem históricos existentes. As pastas cadastradas continuam no local original.

TypeSafe: skill consultada e índice vivo lido. Persistência e navegação são operações determinísticas; nenhuma API semântica é adicionada.

## Implementação e reprodução

O painel esquerdo combina a lista existente de projetos/conversas com SidebarFilesTree. O editor abre à direita, com sua árvore duplicada inicialmente oculta. O ajuste de largura não recolhe automaticamente os projetos no piloto. O terminal foi removido do registro visível e da paleta de comandos, com guarda adicional nas ações de abertura do estado da interface.

Perfil definitivo: `G:\PEMARA_OpenChamber_Dados\perfil`. Projetos de demonstração: `G:\PEMARA_OpenChamber_Projetos`. Ambos ficam fora do repositório PEMARA para evitar que o motor adote o Git do projeto pai.

Para recompilar a interface, dentro de `source`, defina `VITE_PEMARA_PILOT=1` no ambiente do processo e execute `node packages/electron/scripts/build-web-assets.mjs`. As dependências já estão instaladas. `launch.mjs` utiliza os recursos compilados e o OpenCode CLI preparado em `packages/electron/resources/opencode-cli`; não compila ao abrir. O modo `--test` abre depuração local na porta 9337, ausente na abertura normal pelo VBS.

Validação final: `build-ui-r3.log`, `typecheck-final.log`, `lint-final.log` e `evidencias/reabertura.json`. O teste de reabertura usa o aplicativo Electron real e o servidor local real; a conversa é uma fixture importada pela API oficial, sem chamada a modelo de IA. O teste compara mensagens integralmente e bytes do arquivo por SHA-256; também verifica estado visível, rascunho, posição dos painéis e ausência de terminal interativo.

Base upstream: https://github.com/openchamber/openchamber/tree/v2.4.0 . As alterações locais não foram publicadas.

## Validação com geração real de IA — 2026-10-18

Configuração feita pelo seletor de modelos da interface; `lastSelectedModel` passa a `opencode/deepseek-v4.1-flash-free`. O modelo não exige chave para o acesso gratuito observado neste teste. O perfil permanece isolado e nenhuma credencial de produção foi copiada. Nenhuma mudança adicional no código upstream foi necessária.

Sessão real: `ses_eb04e7d58ffeWKyEfRpbVV6G69`, título `Evaporação da água - 5º ano`. O GLM entrou em repetidas reconexões; o Big Pickle criou o plano inicial, mas a continuação atingiu tempo limite de resposta. O DeepSeek gerou os HTMLs, corrigiu o plano e aplicou a revisão pedagógica e da animação. Os registros dessas tentativas foram preservados. O teste não certifica disponibilidade dos provedores gratuitos.

Scripts reproduzíveis: `test-ai-lesson.mjs` (Chrome local com contexto offline), `test-ai-reopen.mjs` (Electron, perfil e backend reais) e `verify-ai-preservation.mjs` (mensagens/conversas anteriores e bytes dos arquivos). O teste de reabertura exige a sessão concluída e o piloto iniciado em modo de teste; usa as APIs oficiais somente para leitura da conversa, além da interface real para fechar, abrir e conferir os arquivos. Os pedidos de criação e revisão foram enviados pela interface, sem injeção de uma conversa pronta.

Os arquivos `ia-conversa-antes.json` e `ia-conversa-depois.json` contêm a conversa real exportada. `ia-reabertura.json` registra hashes e resultado. `ia-no-programa.json` e a imagem correspondente registram a execução da aula na prévia HTML do próprio OpenChamber. O HTML externo foi testado sem rede; isso não representa inferência de IA offline.
