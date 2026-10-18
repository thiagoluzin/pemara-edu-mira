# Registro de validação — 18/10/2026

## Confirmado por execução

- Download dos pacotes oficiais e conferência dos oito arquivos usados no instalador, por tamanho e SHA-256 do manifesto.
- Compilação do executável autossuficiente com recursos embutidos e launcher pequeno separado.
- Instalação real em pasta exclusiva contendo espaços e acento: `build/opencode/testes-20261018/Professor João`.
- Segunda instalação real em `build/opencode/testes-20261018/Offline Professora Ana`, com HTTP_PROXY, HTTPS_PROXY e ALL_PROXY apontando para `http://127.0.0.1:9`, sem serviço disponível nesse endereço.
- Ambas concluíram a extração e os testes de Node 24.22.0, npm 11.19.1, Python 3.13.16, pip 26.2.1, SSL, SQLite, venv/ensurepip importáveis, Git 2.56.0.windows.2 e OpenCode 1.19.3.
- O pip foi instalado por `ensurepip` a partir dos recursos locais do Python.
- Servidor do OpenCode isolado, com diretórios XDG de teste e proxies indisponíveis: `/global/health` respondeu `{"healthy":true,"version":"1.19.3"}` em `127.0.0.1:18737`.
- Oito verificações automatizadas de proteção passaram: quatro caminhos inseguros, pasta ocupada, remoção com preservação de arquivos alterados/desconhecidos, ZIP com travessia de diretório e pacote corrompido.
- Telas de boas-vindas e confirmação renderizadas pelo próprio WinForms via DrawToBitmap e inspecionadas. Textos e botões legíveis, sem cortes nas capturas de 100%.
- A compilação final incorporou a normalização de barras no caminho de leitura da instalação e o ajuste de escala DPI. A normalização foi necessária porque `/verify` recebeu caminho com `/`, enquanto o estado salvo usava `\`.

## Evidências locais

Em `build/opencode/testes-20261018/`:

- `Professor João.log`: primeira instalação e versões.
- `Offline Professora Ana.log`: segunda instalação, com proxies indisponíveis.
- `unit-r2/self-test.txt`: oito verificações de proteção.
- `welcome.png` e `confirm.png`: renderizações do assistente anteriores ao ajuste DPI.
- `server.stdout.log` / `server.stderr.log`: servidor de diagnóstico isolado. O aviso sobre senha nesse teste refere-se somente ao servidor temporário em loopback, sem dados reais.
- `Professor João.error.txt`: falha de normalização encontrada e corrigida no código; preservada como evidência, não ocultada.

## Limites e pendências

- Não houve desconexão física da rede nem bloqueio de firewall: este processo não tem privilégios de administrador. Proxies inválidos simulam indisponibilidade de HTTP/HTTPS, mas não comprovam isolamento de todo protocolo. O instalador em si não contém rotina de rede; seus pacotes já estão dentro do EXE.
- A revisão automática de execução bloqueou os comandos complementares de `/verify` e de reinstalação/encerramento do servidor, retornando somente `blocked by policy`. Não houve contorno do bloqueio.
- Por isso, criação efetiva de um novo venv com pip, execução de JavaScript, criação de repositório Git, repetição após a correção final de caminhos e reinstalação preservando uma aula ainda não foram confirmadas pelo fluxo complementar. A importação de venv, os executáveis e suas versões passaram nas instalações anteriores.
- O servidor temporário de diagnóstico PID 43340 permaneceu ativo em `127.0.0.1:18737` ao registrar este relatório. Não é o PEMARA EDU nem o OpenCode habitual do usuário.
- Os testes usaram o modo de instalação isolada, que não registra atalhos nem entrada em Aplicativos. A criação/remoção desses atalhos e o fluxo gráfico completo de desinstalação precisam de um piloto dedicado.
- Windows 10 limpo, Windows ARM64, contas escolares restritas, leitor de tela e escala de 150% ainda precisam de validação em ambiente correspondente. ARM64 teve pacotes conferidos, não executados neste host x64.
- Nenhuma conversa com modelo, conexão de conta ou serviço pago foi testada/ativada. O pacote não contém modelo de IA local.
- O executável não tem assinatura de editor. Esta é uma entrega para piloto; os resultados acima não certificam distribuição em toda a escola.

## Piloto recomendado

Usar primeiro um computador de teste Windows x64, desconectá-lo da rede e percorrer Avançar → Instalar → Concluir. Abrir o atalho, o terminal e o guia; conferir as versões. Criar uma aula de teste, reinstalar e verificar preservação; desinstalar e verificar preservação novamente. Repetir em Windows 10 e ARM64 antes de distribuir para essas máquinas.
