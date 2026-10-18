# PEMARA EDU — integração OpenCode e Atlas

Versão: 2.4.0-pemara.5 · 18/10/2026.

O desktop reúne conversas e projetos, criação de aulas pela IA do OpenCode, biblioteca, Atlas e exportação HTML. O botão principal é **Criar aula com IA**. O pedido é persistido antes da execução; o modelo devolve uma estrutura validada, e o aplicativo salva a aula na biblioteca. Não existe substituição silenciosa por geração sem IA nesse fluxo.

## Resultado da IA real

O pedido real sobre evaporação e condensação chegou ao runtime OpenCode e ao modelo `opencode/deepseek-v4.1-flash-free`. O provedor recusou o acesso com **HTTP 403 / provider.auth**. Não foi criada uma aula real por esse teste. O proprietário escolheu configurar o modelo depois e receber a integração com a falha indicada.

O pedido e a conversa foram conservados. A mensagem do pedido de teste foi complementada com o diagnóstico 403 já observado; a versão anterior do registro foi copiada para os originais. Não houve nova chamada nem troca de modelo para contornar a recusa. Em uso futuro, o adaptador identifica recusa de autenticação/plano e orienta configurar um modelo disponível e usar **Retomar**.

O teste automatizado com resposta controlada comprova o fluxo técnico de validação e salvamento, não a qualidade ou disponibilidade de um modelo real.

## Verificações executadas

- TypeScript e compilação de produção aprovados.
- PostgreSQL descartável: autenticação, isolamento de professores, pedido idempotente, falha seguida de retomada na mesma conversa, validação da aula, salvamento sem duplicação e encerramento durante geração seguido de retomada.
- Aplicativo empacotado: nome PEMARA EDU, botão com IA, mensagem 403, Retomar, formulário sem transbordamento horizontal em janela de 900 × 700, fechamento e reabertura com pedido e texto conservados.
- Atlas de respiração: geometria em movimento e pausa estável, dentro do aplicativo.
- Exportação pela interface de uma aula existente; HTML aberto, fechado e reaberto em navegador com rede desabilitada, com movimento e pausa verificados.
- Biblioteca e rascunho existentes iguais após reiniciar. Conversas acessíveis sem terminal.
- Instalação final com código de saída 0; o mesmo teste de interface passou no executável instalado. Atalhos PEMARA EDU conferidos na Área de Trabalho e no menu Iniciar. Ícone do mascote conferido por extração do executável. Nome PEMARA EDU verificado também no HTML exportado.
- Preservação comparada ao backup anterior: 33 aulas, 48 revisões, 6 rascunhos, 4 materiais, 26 mensagens anteriores, 2 conversas anteriores e 13 arquivos do professor. A conversa adicional da geração recusada também existe no banco.

As verificações de rede do conteúdo bloqueiam requisições externas na página do aplicativo e usam contexto de navegador offline para o HTML. Não equivalem a desconectar fisicamente o Windows inteiro. A interrupção da geração foi testada de forma controlada; a tentativa real foi recusada pelo provedor.

## Distribuição e preservação

O executável, a janela e o atalho usam **PEMARA EDU**. O ícone foi derivado do mascote original PEMARA Tech, preservado; o prompt e a procedência estão em [brand/README.md](brand/README.md). Foram mantidos Electron e NSIS, sem adicionar outro framework de desktop.

O identificador de instalação e os diretórios de perfil mantêm os nomes internos antigos para continuidade dos dados. As versões anteriores dos instaladores permanecem preservadas. Não se incluem contas, chaves ou conversas pessoais no instalador nem no GitHub.

O pacote contém as ferramentas locais. Gerar por um provedor remoto requer internet e acesso ao modelo; aulas salvas, Atlas e HTML funcionam offline. Windows 10/11 x64 são os destinos, mas o teste real desta entrega foi no Windows 11 x64. O executável não tem assinatura comercial. O assistente foi testado por instalação automatizada; não se declara validação manual de cada página do assistente.

O código, as receitas, o patch do OpenChamber e as referências das dependências fazem parte do backup Git. Dados do professor e pacotes binários ficam fora dele. Consulte [BUILD-PEMARA-EDU.md](BUILD-PEMARA-EDU.md), [INTEGRACAO-IA.md](INTEGRACAO-IA.md) e [referências](../../THIRD_PARTY_NOTICES.md).

Evidências locais: `build/openchamber/2.4.0-pemara.5/evidencias/`. A pasta de entrega inclui cópias dos resultados finais e SHA-256 do instalador.

Instalador final: `PEMARA-EDU-2.4.0-pemara.5-Windows-x64-Instalar.exe`, 413.201.588 bytes. SHA-256: `20283848f5a2828b30bdae32734f5b997f760bc6ce9cc81be5387a5361a64aca`.
