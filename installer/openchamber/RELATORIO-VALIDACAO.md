# PEMARA OpenChamber para professores — piloto 2.4.0-pemara.2

Data: 18/10/2026. Instalador Windows x64, com assistente em português, por usuário, atalhos na Área de Trabalho e no menu Iniciar. O professor instala e conversa pela interface gráfica. Os projetos, arquivos e conversas ficam em disco, separados do aplicativo.

## Entrega

Arquivo: `PEMARA-OpenChamber-2.4.0-pemara.2-Windows-x64-Instalar.exe`

Tamanho: 297.963.053 bytes. SHA-256: `66C1FBE22F2E4331F6F9CFE88FCE5FF47F0654BDF62A63CCB91CC7E38E509280`.

Inclui OpenChamber 2.4.0 adaptado, Electron 43.7.0, OpenCode 2.0.32, Node.js 24.22.0/npm 11.19.1, Python 3.13.16/pip 26.2.1, Git 2.56.0.windows.2 e ripgrep 15.0.0. Dependências já estão no pacote; a instalação não precisa baixá-las. Bibliotecas adicionais solicitadas futuramente pela IA não estão automaticamente incluídas.

IA inicial: `opencode/deepseek-v4.1-flash-free`, sem chave pessoal distribuída. A geração testada informou custo zero. Disponibilidade e gratuidade são controladas pelo provedor. **A IA precisa de internet; nenhum modelo local está incluído.** O exemplo HTML e o HTML criado no teste funcionaram com a rede bloqueada no navegador.

## Verificações executadas

Ambiente: Windows 11 Pro x64, build 26200. Os registros técnicos estão em `build/openchamber/2.4.0-pemara.1/evidencias`, no projeto de desenvolvimento; uma seleção acompanha esta entrega.

| Verificação | Resultado e evidência |
|---|---|
| Bootstrap e preservação de configurações | Teste automatizado passou: cria apenas o que falta, mantém configurações/arquivos existentes e retira credenciais herdadas do ambiente de execução. `bootstrap-tests.log`. |
| Ferramentas empacotadas | Executáveis da instalação, com PATH de desenvolvimento removido; Node/npm, Python/pip, SSL, SQLite, venv, ensurepip, Git, OpenCode e ripgrep passaram. `ferramentas-instaladas-r2.json`. |
| Aula real pela IA | Criou `teste-professor.html` pela conversa e revisou a explicação científica de evaporação. Respostas reais do modelo, ferramentas read/write/edit/glob, sem terminal. `html-gerado-testes.json`. |
| HTML dentro do programa e offline | Notas, alternativas, feedback e reinício de respostas funcionaram no preview e no navegador offline; nenhum recurso remoto nem erro de script observado. `html-gerado-testes.json`. |
| Aula incluída de exemplo | Seis slides/50 minutos, notas do professor, quiz, movimento real da simulação, pausa efetiva, reinício, temperatura/vento e atividade impressa testados offline. `ia-aula-testes.json`. |
| Fechar e abrir | Janela e backend encerrados; ao abrir, 2 conversas, 18 mensagens, 5 arquivos e rascunho preservados. Mensagens comparadas integralmente e arquivos por SHA-256. `reabertura-instalado.json`. |
| Desinstalar e reinstalar | Backup integral antes da operação. Banco de conversas, configurações e 5 arquivos idênticos depois. Instalador final retornou 0. `desinstalacao-reinstalacao.json`. |
| Abrir após reinstalação | Comparação com a captura anterior à desinstalação: mesmas 2 conversas/18 mensagens/5 arquivos e rascunho. `instalador-final-testes.json`. |
| Atalhos reais | Área de Trabalho e menu Iniciar apontam para o executável instalado, sem argumentos especiais. Janela aberta pelo atalho, sem porta de depuração nem desativação global/GPU do sandbox. `atalhos.json`. |
| Originais | 190 arquivos do manifesto anterior sem alteração; 4 conversas/8 mensagens e 2 arquivos do baseline anterior do piloto preservados. `preservacao.json` e `ia-preservacao.json`. A comparação de conversas cobre esse baseline, não constitui auditoria de todos os dados históricos do computador. |

O teste de reinstalação inicialmente parou na verificação de ACL por tentar traduzir uma identidade Windows não resolvida, depois de instalar e comparar os arquivos. A verificação foi corrigida para consultar SIDs diretamente e repetida contra o backup anterior, antes de abrir o aplicativo; passou.

## Correção de abertura no Windows

O primeiro candidato falhou ao iniciar o processo gráfico após instalação no disco C:. O executável idêntico funcionava na pasta de estágio. A pasta instalada herdava permissões AppContainer que causavam a falha. Foi acrescentada leitura/execução para `S-1-15-2-2` **apenas à pasta do aplicativo**, sem permissões de escrita, sem modificar aulas/perfil nem desativar o sandbox da GPU. A reinstalação final confirmou a regra e a abertura.

Referências primárias do problema: [Electron #51761](https://github.com/electron/electron/issues/51761) e [Electron #52098](https://github.com/electron/electron/issues/52098). O renderer mantém a política original do OpenChamber (`contextIsolation:true`, `nodeIntegration:false`, `sandbox:false`); esta entrega não é uma auditoria completa de segurança do upstream.

## Limites conhecidos

- **Windows 10 é alvo do pacote, mas não foi testado em máquina/VM Windows 10.** A validação executada foi no Windows 11 indicado acima.
- Instalador **sem assinatura digital de editor**; o Windows pode mostrar aviso de reputação.
- A tela inicial do assistente foi inspecionada por acessibilidade. A automação nativa de clique/captura falhou neste ambiente. Instalar/desinstalar foram exercitados com o mesmo EXE em modo silencioso `/S`; não se afirma que todos os cliques do assistente foram validados.
- Uma conversa interrompida na queda de conexão permaneceu com indicador visual de processamento, embora não houvesse geração ativa no backend. Foi preservada; uma nova conversa gerou e revisou a aula normalmente. Esse estado visual do upstream ainda requer correção antes de distribuição ampla.
- HTML criado por IA exige revisão pedagógica. O conteúdo gerado no teste precisou de uma revisão sobre evaporação versus ebulição, aplicada e testada.

Conclusão: instalador funcional para **piloto acompanhado**, com criação de aula e persistência comprovadas no Windows 11. Os pontos acima impedem tratar esta edição como homologação geral para todas as escolas.

## Preservação e manutenção

Fontes do piloto, instalador OpenCode anterior e projetos originais não foram substituídos. Candidatos rejeitados e logs permanecem no estágio de desenvolvimento. Backup antes da reinstalação: `build/openchamber/2.4.0-pemara.1/originais-antes-reinstalar-20261018-145758`.

Aulas novas: `Documentos/PEMARA Aulas`. Conversas/configurações: `%LOCALAPPDATA%/PEMARAOpenChamber/perfil`. Feche o aplicativo e copie ambas as pastas para fazer backup. Desinstalar mantém essas pastas. Os exemplos só são copiados se ainda não existirem.

As alterações reproduzíveis do pacote estão em `installer/openchamber`. A skill TypeSafe e a documentação viva foram consultadas; este empacotamento não exige chamada de API semântica. Não foram enviados dados à TypeSafe nem distribuídas credenciais pessoais.
