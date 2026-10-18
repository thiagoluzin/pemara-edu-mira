# OpenCode Desktop offline — revisão 2026.10.18.3

**Correção atual: revisão 2026.10.18.4. Consulte [CORRECAO-JSON-R4.md](CORRECAO-JSON-R4.md) para o erro de maxJsonLength e a recuperação sem desinstalar. O restante deste registro documenta a revisão Desktop original.**

Esta revisão substitui a abertura por terminal pela janela do OpenCode Desktop. `README.md` e `TESTES.md` descrevem a entrega anterior, preservada no histórico; este documento descreve a revisão Desktop.

## Fluxo implementado

O professor abre o EXE, avança, instala e escolhe **Abrir OpenCode**. O atalho da Área de Trabalho abre diretamente o Desktop. O menu Iniciar também oferece **Guia e minhas aulas**. Nenhum botão de terminal aparece no assistente ou no painel do professor.

Python/pip, Node.js/npm, Git, OpenCode CLI e OpenCode Desktop são instalados em uma pasta própria. O CLI é uma ferramenta de apoio, não a interface do professor. O ambiente é transmitido aos processos do Desktop sem mudar o PATH global. Os pacotes de Intel/AMD e ARM64 são incluídos dentro do EXE; só a arquitetura correspondente é instalada.

O diretório de aulas padrão é `Documentos\OpenCode - Aulas`. Configurações, cache, histórico e sessão do Desktop ficam em `%LOCALAPPDATA%\PemaraOpenCodeData`. O perfil é separado de outras instalações. Atualizações automáticas ficam desativadas.

Instalação e abertura da janela são locais. Conversar com IA online ainda depende de conexão e de um provedor. Nenhum modelo local, contratação ou credencial está incluído. Bibliotecas opcionais de futuros projetos não estão pré-instaladas.

## Adaptação transparente do Desktop

Base oficial: OpenCode Desktop 1.19.3. Identificação do pacote adaptado: **1.19.3-pemara.2**, não uma versão oficial upstream.

O script `prepare-desktop.mjs` confere os SHA-256 oficiais, extrai o aplicativo do instalador NSIS e adapta somente `out/main/index.js` no ASAR:

1. Usa `PEMARA_DESKTOP_DATA` para o perfil.
2. Usa uma pasta de sessão dentro do perfil separado.
3. Respeita `PEMARA_DISABLE_UPDATER=1`.
4. Usa a pasta de aulas como diretório inicial.
5. Usa a pasta de aulas como projeto inicial do primeiro uso.

Cada substituição exige exatamente uma ocorrência; divergências upstream interrompem a preparação. `PEMARA-adaptation.json` acompanha o aplicativo, com origem e hashes do ASAR original e adaptado. Os EXEs oficiais, ASARs originais e a entrega anterior permanecem no diretório de preparação. O executável Electron não foi alterado.

## Preservação e incidente da sondagem

- O instalador anterior está em `build/opencode/originais-antes-desktop-20261018/`, com hash `353f2856347cbf68aa9e945033555d3377ab9fc2a4b5d6bbb01eed55b8323cdc`.
- Fontes anteriores foram copiadas para a subpasta `source` nesse mesmo backup.
- O OpenCode Desktop 1.18.3 anteriormente instalado não foi substituído. Seu executável continua com hash `c0e06bbdbc5bf954c0ada2bee8ad19557155f5dd25dd5e43aec53c9d2b046563`.
- A sondagem inicial do Desktop oficial revelou que mudar APPDATA não basta: o Electron redefine `userData` usando a pasta padrão do Windows. Essa primeira abertura acessou o perfil existente e atualizou arquivos de estado/cache. Foi fechada, e uma cópia do perfil **após a sondagem** foi guardada. Não se afirma que esse perfil ficou byte a byte intocado desde o início nem que o backup antecede essa sondagem.
- As sondagens posteriores usam a adaptação explícita e perfis novos, separados. Não houve envio de prompt, exclusão de aulas nem substituição da instalação existente.
- Após os testes da adaptação, os 85 arquivos do perfil existente foram comparados com a cópia feita após a primeira sondagem: zero alterações e zero arquivos ausentes. Essa comparação confirma o isolamento posterior; não desfaz nem oculta a primeira sondagem.

## Testes desta revisão

Confirmados:

- Compilação do assistente e do launcher.
- Conferência dos hashes oficiais de origem e dos pacotes derivados de ambas as arquiteturas.
- Abertura real do Desktop x64 adaptado em perfil novo; caminhos `userData` e `sessionData` conferidos pelo processo Electron.
- Interface em português chegando à tela **Nova sessão**.
- Requisições HTTP/HTTPS externas do Electron bloqueadas por `webRequest`; comunicação local liberada. HTTP_PROXY e HTTPS_PROXY do processo apontam para um endereço indisponível. A tentativa de telemetria foi bloqueada.
- O script `probe-desktop.mjs` verifica a presença do editor, digita um rascunho sem enviá-lo e salva imagem/resultado. Evidência final: `build/opencode/desktop-final-ui-test/`.
- A verificação somente de leitura `verify-distribution.mjs` confere os hashes dos dez pacotes dentro do EXE, presença do launcher/guia/licença e preservação do instalador original.

Limites:

- A revisão automática bloqueou a execução do novo instalador em modo de teste (`/test-install` e `/self-test`), retornando apenas `blocked by policy`. Não houve contorno. **A instalação ponta a ponta desta revisão, os atalhos e a desinstalação ainda não foram confirmados por execução.**
- A abertura do Desktop foi testada a partir dos arquivos preparados que compõem o pacote, não de uma instalação concluída pelo novo EXE.
- Não houve desconexão física de toda a máquina. O bloqueio de rede do teste cobre HTTP/HTTPS do Electron e proxies dos processos, não constitui isolamento de todos os protocolos do Windows.
- Windows 10 limpo, Windows ARM64 e leitor de tela ainda precisam de piloto. Os pacotes ARM64 foram conferidos, mas não executados neste host x64.
- EXE sem assinatura de editor. O pacote permanece candidato a piloto, sem homologação para distribuição geral.

## Reprodução pelo mantenedor

```powershell
npm install --prefix build/opencode/maintainer-tools --no-audit --no-fund @electron/asar@4.3.1
node installer/opencode/prepare-desktop.mjs
powershell -NoProfile -File installer/opencode/build.ps1
node installer/opencode/verify-distribution.mjs
```

Também é necessário 7-Zip na máquina de preparação. O professor não precisa dessas ferramentas de empacotamento. A preparação recusa sobrescrever um pacote derivado existente: uma nova revisão deve ter outro nome, preservando o anterior.

O build final fica em `build/opencode/dist-desktop/`, com guia, manifesto e `SHA256SUMS.txt`. A versão anterior fica em `build/opencode/dist/`.
