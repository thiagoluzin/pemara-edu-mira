# PEMARA OpenChamber 2.4.0-pemara.4 — Gerador e Atlas

A versão reúne conversas e projetos, criação de aulas, biblioteca pessoal e Atlas na mesma janela, com navegação à esquerda. O professor abre pelo atalho e usa os botões; não precisa de terminal nem criar uma conta local.

## O que está integrado

- Gerador visual com o acervo local, importação de materiais e edição de aulas.
- Atlas com 27 opções de modelo, prévia interativa e botão para criar uma aula editável.
- Rascunho automático, histórico de versões e biblioteca persistente.
- Exportação de apresentação HTML independente, guardada em Documentos / PEMARA Aulas / Minhas aulas / Exportadas, também acessível pela área de projetos.
- Ao fechar, o aplicativo espera o salvamento pendente. Se houver erro ou conflito, oferece voltar à aula.

O gerador do acervo, o Atlas e os HTMLs exportados funcionam sem internet. A IA da conversa continua usando o provedor já configurado e precisa de internet. Pedidos livres feitos no chat geram arquivos; o gerador visual trabalha com o acervo local e com os materiais selecionados pelo professor. A integração não converte automaticamente uma resposta do chat em aula estruturada.

## Preservação

Os fontes anteriores, o perfil, os arquivos e o banco anterior foram copiados para `build/openchamber/2.4.0-pemara.4/originais`, com manifesto de hashes. O banco educativo anterior foi importado uma única vez para um banco independente do desktop. Não existe sincronização automática com a instalação web anterior.

A verificação compara o conteúdo original de 25 aulas, 36 revisões, 3 rascunhos, 2 materiais, 26 mensagens, 2 conversas e 5 arquivos. As aulas de teste são acrescentadas, sem substituir as anteriores. Dados pessoais, conversas, snapshots e credenciais locais não fazem parte do instalador distribuível.

## Validação

O roteiro de ponta a ponta usa o executável real por automação de interface: importa TXT, seleciona os trechos e confirma a revisão, gera aula, altera o título, publica uma revisão e exporta. Depois abre o Atlas, verifica mudança da geometria e pausa da respiração, cria outra aula e exporta. Edita uma nota do professor, fecha imediatamente e abre novamente, conferindo a nota, a aula, a biblioteca e a conversa anterior.

Os dois HTMLs são abertos em Chrome com o contexto offline, fechados e reabertos. A apresentação de respiração tem movimento e pausa verificados pela geometria do SVG. No aplicativo, o teste bloqueia requisições HTTP externas da tela educativa e permite a comunicação local. Não desliga a rede do Windows inteiro. A confirmação nativa da exportação é registrada e dispensada automaticamente somente no teste.

Também passam: TypeScript sem erros, validação das 27 opções do Atlas, bootstrap com preservação, serviço com banco novo e os 5 testes de materiais offline, incluindo PDF, OCR em português, isolamento, original e backup/restauração. As demais animações mantêm os motores anteriores; esta integração não representa uma nova auditoria visual de cada uma delas.

Durante o teste instalado foi detectado e corrigido o processo de importação: o leitor agora usa o Node incluído no pacote, com o carregador resolvido por caminho absoluto, em vez de tentar abrir outra instância do desktop. As evidências da falha e da correção foram mantidas.

## Limites da entrega

Windows 11 x64 foi testado nesta máquina. Windows 10 x64 é alvo do pacote, mas não foi testado em uma máquina Windows 10. A instalação foi exercitada pelo modo silencioso do instalador; os cliques do assistente não foram automatizados. O instalador não tem assinatura comercial.

Os resultados finais estão nos arquivos `education-ui.json`, `preservation-final.json` e `installation.json` incluídos com esta entrega. O SHA256 identifica o instalador efetivamente entregue. O guia `AULAS-PROFESSORES.txt` explica o uso.
