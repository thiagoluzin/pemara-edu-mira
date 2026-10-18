# Recuperação de conversa, versão 2.4.0-pemara.3

Validado em 18/10/2026 no Windows 11 Pro x64. O aplicativo instalado foi atualizado e aberto pelo atalho normal ao final.

## Correção

O motor retornava uma lista vazia de sessões em execução, mas havia uma mensagem antiga de assistente sem horário de término. A interface usava essa mensagem histórica como sinal de atividade e mantinha o botão Parar geração indefinidamente.

Agora a consulta bem-sucedida do estado atual tem prioridade. A conversa parada libera o envio e mostra a orientação para continuar na mesma conversa. O fragmento salvo permanece no histórico. Uma falha de consulta não é interpretada como confirmação de que a IA parou. Reconectar não reenvia pedidos automaticamente.

Alterações em `useSessionActivity.ts`, `SessionErrorNotice.tsx`, `sessionErrorNoticeState.ts`, traduções e documentação do módulo. O motor, modelo de IA, esquema do banco, IDs de mensagens e arquivos das aulas não foram substituídos.

## Testes executados

| Caso | Resultado |
|---|---|
| Conversa real que estava presa | Indicador removido e envio liberado, com aviso de resposta interrompida. |
| Queda da conexão da interface | Rede do Chromium desligada por automação; 15 requisições falharam com Internet disconnected. Rascunho, 19 registros anteriores e 5 arquivos preservados após reconectar. |
| Queda antes de confirmar o envio | Pedido não chegou ao motor e o texto voltou para o campo de mensagem. Nenhum reenvio automático. |
| Retomada com o pedido já aceito | Atividade confirmada no motor antes de cortar a conexão da interface. Após reconectar, resposta real da IA visível na mesma conversa. |
| Fechar e reabrir após a retomada | Nova resposta, histórico e rascunho encontrados novamente. |
| Fechar durante geração ativa | Motor confirmado em execução, janela e backend encerrados. Ao reabrir, histórico e novo pedido preservados, sem indicador preso. |
| Continuar depois desse fechamento | Outra resposta real recebida na mesma conversa. Os 6 registros existentes antes de fechar continuaram presentes entre os 9 registros finais dessa conversa. |
| Arquivos | Os 5 arquivos anteriores continuaram com o mesmo SHA-256 ao final de todos os testes. |
| Atalhos | Área de Trabalho e menu Iniciar corretos; abertura normal sem porta de depuração. |
| Testes de regressão | 38 passaram, 720 verificações. Incluem snapshot vazio, consulta não confirmada, busy/retry/idle, invalidação, estabilidade em atualização repetida e traduções. |
| Compilação e análise | Build da interface, pacote Windows, checagem de tipos da UI e lint passaram. Lint manteve um aviso já existente em HtmlRenderFrame.tsx, fora desta alteração. |

O motor acrescentou `time.completed` a um registro histórico incompleto ao retomar. A validação inicialmente exigia igualdade desse metadado também. Ela foi ajustada para permitir apenas esse acréscimo legítimo e repetida contra a captura original, sem reenviar o pedido. IDs e conteúdo permaneceram iguais. As verificações anteriores também foram guardadas. A espera pela montagem do histórico após abrir a janela foi incluída antes da conferência visual.

Evidências principais: `recuperacao-testes.json`, `fechar-durante-geracao.json`, `preservacao-fragmentos.json`, `preservacao-arquivos-final.json`, `atalhos.json` e capturas de tela. As capturas completas e os registros de mensagens ficam no projeto, em `build/openchamber/2.4.0-pemara.3/evidencias`.

## Limites da verificação de rede

**Foi simulada a perda da rede da interface Chromium, inclusive durante uma geração real. O motor de IA manteve sua conexão independente com o provedor.** Não foi desligado o adaptador de rede do Windows.

A revisão automática bloqueou o comando de um teste com proxy temporário que cortaria somente a conexão externa do motor. O retorno informou bloqueio por política, sem motivo mais específico. Esse caminho não foi contornado. Portanto, esta entrega não afirma ter validado uma interrupção real entre o motor e o provedor de IA.

O fechamento durante geração ativa e a retomada após reiniciar foram testados no executável instalado. Windows 10 permanece alvo do pacote, sem teste em uma máquina Windows 10 nesta sessão. O instalador permanece sem assinatura digital e foi aplicado em modo silencioso; o percurso completo de cliques do assistente não foi revalidado.

## Preservação

Backup do perfil, aulas, fontes do instalador e arquivos-fonte alterados em `build/openchamber/2.4.0-pemara.3/originais`, criado antes das alterações. Os originais das fontes alteradas têm manifesto SHA-256. O instalador 2.4.0-pemara.2 continua na pasta de entrega anterior. O manifesto antigo de 190 arquivos do PEMARA EDU passou sem alterações.

## Gerador de aulas

O pacote inclui a criação de aulas HTML por conversa com a IA e uma aula de exemplo. **O gerador visual de aulas e o Atlas do PEMARA EDU ainda não estão embutidos no OpenChamber.** Eles continuam no projeto separado. Criar pela IA exige internet; HTML autossuficiente salvo pode funcionar offline.

## Instalador entregue

`PEMARA-OpenChamber-2.4.0-pemara.3-Windows-x64-Instalar.exe`

297.963.771 bytes. SHA-256:

`7CED3C9FE378869A2DFD0446D5B4AD6DEFFBD2318BC3D3C38FD5C505B32E7B64`

Reprodução: gerar a UI com `VITE_PEMARA_PILOT=1` para `build/openchamber/2.4.0-pemara.3/web-dist`; executar `build.mjs --recovery --dir`, depois `build.mjs --recovery --prepackaged build/openchamber/2.4.0-pemara.3/dist/win-unpacked`. Usar os caches de dependências e o bundle principal já preservados da edição anterior. Esses comandos são de manutenção; o professor utiliza o instalador e o aplicativo.
