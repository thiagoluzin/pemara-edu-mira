# PEMARA EDU — instalador para professores

Entrega atual: **2.4.0-pemara.8 — Teste Limpo**. Instala em paralelo, com atalho e perfil próprios, sem importar aulas, pesquisas ou chats anteriores. Inclui os professores especialistas e revisores. Consulte [compilação e reprodução](BUILD-PEMARA-EDU.md), [integração IA](INTEGRACAO-IA.md), [guia do professor](AULAS-PROFESSORES.txt) e [validação da versão 8 com IA real](RELATORIO-PEMARA-EDU-8.txt). As versões anteriores e os dados do proprietário permanecem preservados. Gerar aulas exige internet e disponibilidade de modelos gratuitos; não exige IA local. Reinstalar a edição limpa preserva seus próprios dados.

As seções abaixo registram a construção das versões anteriores; preserve os nomes e caminhos históricos para compatibilidade e recuperação.

Distribuição independente do piloto, Windows 10/11 x64. O assistente NSIS instala por usuário, sem terminal e sem baixar dependências. A IA gratuita pré-selecionada usa internet; não há modelo de IA local nem credenciais pessoais no pacote. Aulas HTML autossuficientes funcionam offline.

## Superfícies e preservação

| Superfície | Decisão |
|---|---|
| Electron Windows | Bootstrap exclusivo do pacote, ferramentas portáteis, perfil separado e atualização pelo instalador PEMARA. |
| Web | Usa a interface já compilada do piloto; nenhuma mudança no servidor ou contrato de API. |
| VS Code | Sem alteração; não distribuído. |
| Mobile hospedado | Sem alteração; não distribuído. |
| Capacitor | Sem alteração; não distribuído. |

Fontes do piloto e instalador OpenCode anterior são somente entradas de leitura. Os artefatos derivados ficam em build/openchamber. O perfil novo fica em %LOCALAPPDATA%/PEMARAOpenChamber/perfil; as aulas em Documentos/PEMARA Aulas. A desinstalação remove o aplicativo, não esses dados. Configurações existentes nunca são sobrescritas pelo bootstrap.

Modelo inicial: opencode/deepseek-v4.1-flash-free. A disponibilidade gratuita depende do provedor. Não se copiam chaves, contas, bancos de conversas ou perfis Chromium do autor. Exemplo distribuído: aula de evaporação revisada, apenas os três documentos da aula.

TypeSafe: skill e documentação viva consultadas; o empacotamento é determinístico e não exige API semântica. Foram aplicadas as orientações desktop-shell e openchamber-change-discipline do projeto. Alterações no processo principal ocorrem apenas na compilação isolada; o piloto permanece intacto.

## Reprodução

1. Execute prepare.ps1 para verificar SHA-256 e extrair ferramentas do cache existente.
2. Execute build-main.mjs com Bun para produzir os módulos derivados.
3. Execute build.mjs com Node, inicialmente --dir, depois sem argumentos para gerar o instalador NSIS.

Esses comandos são exclusivos da manutenção. O professor usa o instalador e os atalhos.

Versão entregue: 2.4.0-pemara.2. Saída final: build/openchamber/2.4.0-pemara.1/dist-final. O nome da pasta de estágio foi mantido para preservar os candidatos anteriores. Para reutilizar um aplicativo já empacotado, build.mjs aceita --prepackaged seguido da pasta win-unpacked; alterações no bootstrap exigem recompilar essa pasta primeiro.

O instalador acrescenta leitura/execução para o SID S-1-15-2-2 somente à pasta instalada. Isso corrige a falha de inicialização do processo gráfico observada neste Windows com permissões AppContainer herdadas. Não altera permissões das aulas/perfil, não desativa o sandbox da GPU e não acrescenta flags de depuração aos atalhos. A política do renderer permanece a do upstream: contextIsolation:true, nodeIntegration:false e sandbox:false.

Resultados e limites de validação: RELATORIO-VALIDACAO.md. A edição é um piloto sem assinatura digital; Windows 10 ainda precisa de validação em uma máquina desse sistema.
