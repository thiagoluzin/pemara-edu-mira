# OpenCode para aulas — instalador offline

**Revisão atual: OpenCode Desktop, sem terminal para o professor. Consulte [DESKTOP.md](DESKTOP.md). O conteúdo abaixo registra a entrega anterior e foi mantido como histórico.**

Pacote independente do PEMARA, com assistente gráfico em português, instalação por usuário, atalhos e desinstalador. O professor recebe **um único EXE** e não precisa instalar Node.js, Python, Git ou usar npm para instalar o OpenCode.

## Entrega

- Executável: `../../build/opencode/dist/PEMARA-OpenCode-Offline-Windows.exe`.
- Tamanho: 333.681.152 bytes (318,22 MiB).
- SHA-256: consultar `../../build/opencode/dist/SHA256SUMS.txt`.
- Destino: Windows 10/11 de 64 bits, Intel/AMD e ARM64. Windows de 32 bits é recusado.
- Estado: candidato para piloto. Execução testada no host Windows x64, build 26200. Windows 10 limpo e ARM64 ainda precisam de testes em máquinas próprias.
- EXE sem assinatura de editor. O Windows pode exibir aviso de editor desconhecido. Não há alteração nem desativação de SmartScreen/antivírus.

## Componentes incluídos

| Componente | Versão | Uso |
| --- | --- | --- |
| OpenCode, edição de terminal | 1.19.3 | Criar e editar aulas com um provedor de IA |
| Python completo | 3.13.16 | Executar Python, criar ambientes virtuais |
| pip | 26.2.1 | Instalado pelo ensurepip já incluído no Python |
| Node.js LTS | 24.22.0 | Executar JavaScript |
| npm | 11.19.1 | Incluído no Node.js |
| MinGit | 2.56.0.windows.2 | Controle de versões e ferramentas Git |

Os ZIPs oficiais de ambas as arquiteturas ficam embutidos no EXE. Na instalação, somente a arquitetura detectada é extraída e cada pacote é conferido por SHA-256 e tamanho antes de ser utilizado. Não há código de download no instalador.

`packages.json` registra também os instaladores Desktop oficiais pesquisados e baixados na preparação. **Eles não integram o EXE**: o filtro explícito em `build.ps1` inclui somente os quatro pacotes acima por arquitetura. O OpenCode Desktop previamente existente não é alterado.

## Fluxo do professor

1. Abrir o EXE, avançar, conferir a pasta e clicar em Instalar.
2. Aguardar extração, preparação offline do pip e verificação dos executáveis.
3. Abrir o atalho **OpenCode para aulas**.
4. Escolher Abrir OpenCode, Minhas aulas, Guia ou Terminal de ferramentas.

As aulas ficam em `Documentos\OpenCode - Aulas`. O programa é instalado em `%LOCALAPPDATA%\Programs\PemaraOpenCode`; o usuário pode escolher outra pasta vazia. Configurações e histórico ficam separados em `%LOCALAPPDATA%\PemaraOpenCodeData`. O PATH é configurado somente nos processos abertos pelo atalho. Nenhuma instalação global de Python, Node.js, Git ou OpenCode é substituída.

O launcher desativa atualização automática e consulta automática ao catálogo de modelos. O OpenCode é aberto com `--pure` e `--hostname 127.0.0.1`. Não inicia uma API pública. Não há ativação automática de provedor, compra, cartão nem modelo de IA incluído.

**Instalar offline não significa conversar com IA offline.** Um provedor online precisa de conexão; um modelo local exigirá outra etapa, dimensionada pelo hardware. Bibliotecas opcionais solicitadas por futuros projetos não fazem parte deste conjunto de dependências básicas.

## Preservação e remoção

- Uma pasta ocupada sem o marcador de propriedade do pacote é recusada.
- ZIPs com caminhos externos e diretórios redirecionados são recusados.
- Cada reinstalação cria uma versão separada. O estado anterior é preservado.
- A desinstalação remove apenas os arquivos registrados cujo hash permanece igual. Arquivos modificados, aulas, configurações e versões anteriores ficam preservados.
- Pastas vazias, registros e o pequeno auxiliar temporário do desinstalador podem permanecer. Não há limpeza recursiva de pastas de terceiros.

## Reproduzir a compilação

Na máquina de preparação, com Windows e o compilador C# do .NET Framework:

```powershell
& .\installer\opencode\build.ps1 -Download
```

O parâmetro `-Download` permite buscar apenas pacotes ausentes, nas URLs fixadas no manifesto. O build recusa hashes/tamanhos divergentes. Sem esse parâmetro, a compilação usa exclusivamente o cache existente. A preparação precisa de internet somente se faltarem pacotes; o professor não executa esse script.

`prepare-manifest.mjs` é uma ferramenta de manutenção: consulta os metadados oficiais de versões fixadas e atualiza o manifesto. Não deve ser executada automaticamente no computador do professor. O instalador usa WinForms e as bibliotecas do .NET Framework do Windows, sem exigir SDK, PowerShell remoto, npm global ou pip online.

## Fontes e licenças

- OpenCode: https://github.com/anomalyco/opencode/releases/tag/v1.19.3 — licença MIT incluída em `OpenCode-LICENSE.txt` e na instalação.
- Python: https://www.python.org/ftp/python/3.13.16/windows-3.13.16.json — licença preservada no runtime.
- Node.js: https://nodejs.org/dist/v24.22.0/SHASUMS256.txt — licenças preservadas no ZIP.
- Git: https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.2 — licenças e avisos preservados; fontes correspondentes disponíveis no projeto upstream.

Ver `TESTES.md` para evidência e limites da validação desta entrega.
