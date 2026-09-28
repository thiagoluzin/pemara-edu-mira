# Demonstração na sua máquina

## Abrir

1. Dê dois cliques em **INICIAR DEMONSTRACAO.bat** nesta pasta.
2. Abra **http://127.0.0.1:3000** no navegador.
3. Entre com usuário **admin** e senha inicial **admin**.

A inicialização usa PostgreSQL real, persistente e exclusivo desta demonstração; não depende de Docker, chave Gemini, IP fixo ou rede da escola. A aplicação e o banco escutam apenas no computador local. O primeiro início pode levar alguns segundos.

## O que apresentar

- **Minhas Aulas:** Grécia Antiga, Sistema Solar, Lançamento Oblíquo e Função Quadrática já salvos.
- **Nova Aula → Modo A → Gerar:** geração local sem IA nem chave. Use os temas suportados do piloto.
- **Apresentar:** navegação entre slides; em Física, abra a simulação de trajetória.
- **Salvar Versão / Histórico:** versões das alterações de aula.
- **Painel Admin:** usuários de demonstração e acervo geral. O banco inicial recebe quatro aulas do admin e quatro da professora Helena, para mostrar separação de acervos.

Conta de professor de demonstração: `prof.helena` / `helena123`. São dados fictícios. Contas existentes e senhas alteradas não são redefinidas ao reiniciar. As aulas iniciais são incluídas uma única vez, sem sobrescrever edições nem recriar aulas excluídas.

A demonstração já foi testada com geração pelo navegador, biblioteca, reinício e apresentação de Física. A aula criada no teste foi mantida: o admin tem cinco aulas, incluindo duas de Grécia, para comprovar a geração.

## Encerrar e preservar

Use **PARAR DEMONSTRACAO.bat** e aguarde o desaparecimento de `.local-demo/running.json`. O encerramento gera backup e para o PostgreSQL preservando seus dados. Depois, pode iniciar novamente pelo primeiro atalho.

- Banco: `.local-demo/postgres` (database `pemara_demo_utf8`, porta 55432).
- Configuração e senha interna do banco: `.local-demo/config.json` — não compartilhar.
- Backups: `.local-demo/backups` — contêm dados e hashes de credenciais, guarde em local protegido.
- Logs: `.local-demo/server.log` e `.local-demo/server-error.log`.
- Evidência do ensaio: `docs/evidencias/demo-local-2026-09-26.json`.

Não apague `.local-demo`, não a substitua ao atualizar o código e não copie o diretório do banco enquanto ele está rodando. Os backups locais ajudam na recuperação, mas não protegem contra perda do disco; copie os arquivos de backup para outra unidade quando necessário.

## Limites desta preparação

“Banco completo” aqui significa banco real com todas as migrations do sistema, contas, fontes, licenças, currículo disponível, aulas e armazenamento de revisões. O acervo didático é o do piloto, não um catálogo completo de todas as matérias e séries.

IA permanece opcional; provedores/modelos/chaves são configurados no `.env` conforme `docs/CONFIGURACAO_IA.md`. Sem configuração, use modo A. A instalação escolar/LAN fica para uma etapa posterior ao teste e apresentação local.

O iniciador reaproveita o build existente. Após atualizações estáveis do código, execute `npm run typecheck` e `npm run build`, encerre e reinicie a demonstração. Não trate trabalho ainda em andamento no Knowledge Studio como parte homologada desta apresentação.
