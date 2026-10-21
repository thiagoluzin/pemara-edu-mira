# PEMARA EDU — Fábrica de Aulas

Código aberto sob a [licença MIT](LICENSE).

### Revisão automática no chat — 2.4.0-pemara.18

Pedidos de aula feitos em **Conversas e projetos** também recebem revisão
automática após a resposta do OpenCode. **Revisões do chat** mostra andamento,
falhas que podem ser retomadas e cinco pareceres independentes: Conteúdo e Faixa
Etária, Didática, Avaliação, Fontes e Inclusão. O aplicativo identifica aulas com
os modelos gratuitos do OpenCode; não exige o formulário Criar aula nem o Atlas.

A revisão usa a resposta e uma cópia dos documentos HTML/Markdown/TXT/JSON
indicados na conversa, dentro da pasta do projeto. Os originais não são alterados.
Arquivos inacessíveis, posteriores à resposta ou acima do limite ficam com falha
explícita, sem alegação de revisão completa. Os pareceres são textuais: não testam
animações nem equivalem à aprovação docente. Conversas anteriores à ativação não
são reprocessadas. Os registros ficam no perfil local, fora do Git e do instalador.

### Aplicativo para o professor — PEMARA EDU

A edição desktop reúne conversas e projetos, criação de aulas com a IA do
OpenCode, biblioteca pessoal e Atlas na mesma janela. O professor usa o
instalador Windows e o atalho **PEMARA EDU**, sem terminal.

Em **Criar aula**, descreva o tema e selecione materiais opcionais. O pedido
é guardado, enviado a um modelo gratuito na nuvem do OpenCode e transformado em uma
aula editável após a validação da estrutura. Falhas mantêm o pedido e a conversa
para retomada explícita; não há troca silenciosa para geração sem IA.

O programa consulta o catálogo atual, aceita somente preços explicitamente
zerados e tenta outro modelo quando houver falha. Não exige IA local, download
de pesos ou GPU no notebook. Gerar exige internet e disponibilidade do provedor.
A biblioteca, as animações e os HTMLs exportados podem ser usados sem internet.

Desde a edição **2.4.0-pemara.11**, **Exportar HTML, PDF e Word juntos** permite
escolher uma pasta e salvar os três arquivos com uma confirmação: HTML animado
offline, PDF dos alunos sem gabarito e DOCX do professor com texto, tabelas,
notas e respostas editáveis. As opções individuais continuam disponíveis.
Figuras no PDF/Word são estáticas.
O JSON continua disponível como backup importável. Editar o Word não altera a
aula salva no PEMARA nem a apresentação HTML; exporte novamente após editar no aplicativo.

- [Guia do professor](installer/openchamber/AULAS-PROFESSORES.txt)
- [Arquitetura da integração](installer/openchamber/INTEGRACAO-IA.md)
- [Compilação do desktop](installer/openchamber/BUILD-PEMARA-EDU.md)
- [Instalador limpo .8: IA real, testes e preservação](installer/openchamber/RELATORIO-PEMARA-EDU-8.txt)
- [Instalador limpo .9: Salvar como, HTML, PDF e Word](installer/openchamber/RELATORIO-PEMARA-EDU-9.txt)
- [Referências e licenças](THIRD_PARTY_NOTICES.md)

O backup neste repositório inclui fontes e alterações locais. Instaladores,
conversas, bancos, credenciais e materiais pessoais ficam fora do Git.

### Professores especialistas e revisão por agentes

O código atual contém 12 perfis docentes, selecionados pela disciplina, com
habilidades próprias de História, Matemática, Ciências, Geografia, Português,
Inglês, Arte, Educação Física, Ensino Religioso, Física, Química e Biologia.
As habilidades comuns orientam objetivos, sequência didática e uso de evidências.

Em **Criar aula**, a opção **Solicitar revisão por agentes** acrescenta quatro
pareceres: Didática, Avaliação, Fontes e Inclusão. Cada revisor usa uma conversa
própria no OpenCode. A aula gerada e cada parecer concluído são guardados antes
da etapa seguinte; **Retomar** continua sem regenerar a aula nem repetir os
pareceres salvos. Os apontamentos aparecem no editor e acompanham a aula salva.
Nenhum parecer equivale à aprovação docente ou a alinhamento automático à BNCC.

Essa implementação integra a entrega **2.4.0-pemara.8 — Teste Limpo**, de
19/10/2026, com atalho **PEMARA EDU Teste Limpo** e perfil separado. A instalação
e a reabertura foram verificadas com zero aulas, pesquisas e chats; a instalação
anterior e seus dados foram preservados. Reinstalar a edição limpa preserva os
dados que forem criados nela; não apaga automaticamente nenhum perfil.
A validação inclui geração real com `opencode/beam-free`, quatro revisores em
conversas independentes, edição versionada, apresentação offline, quiz e
exportação HTML/JSON/impressão. Foram corrigidos o número da versão no JSON
persistido e o nome excessivamente longo do arquivo de impressão. Os testes
com respostas controladas continuam cobrindo falhas e retomadas; nenhum teste
substitui revisão pedagógica do conteúdo pelo professor.

### Edição web local preservada

A edição web anterior permanece disponível com os comandos abaixo e seu
modo de composição sem IA. Ela não é o fluxo principal do novo desktop.

### Um computador por professor — edição offline

Neste computador, abra **INICIAR PEMARA OFFLINE.bat** e comece a trabalhar.
Não há cadastro, login ou senha. A instalação usa banco próprio, preserva o
acervo existente e não requer chave de IA.

O importador guarda os originais e permite revisar trechos de PDF (incluindo OCR
local em português/inglês), DOCX, PPTX, TXT e Markdown. O Atlas oferece 26 modelos
com seleção automática por assunto ou escolha do professor; fontes e modelos
acompanham a aula salva e sua exportação HTML/PDF.

Use **PARAR PEMARA OFFLINE.bat** para encerrar com backup. Em outro computador,
prepare as dependências uma vez com **PREPARAR PEMARA OFFLINE.bat** e internet;
depois o uso é local. Leia o [guia de uso e recuperação](COMO%20USAR%20OFFLINE.md).

### Demonstração local no Windows

Instale Node.js 24, execute `npm ci` e abra `INICIAR DEMONSTRACAO.bat`.
Consulte [COMO DEMONSTRAR.md](COMO%20DEMONSTRAR.md) para os detalhes da demonstração.
O código e as migrações estão neste repositório; contas, chaves de API, aulas salvas,
bancos e backups locais não são publicados. Configure suas próprias credenciais.

### Licenças dos conteúdos

A licença MIT cobre o código original. Dependências e conteúdos de terceiros
mantêm seus próprios termos: a base cartográfica Natural Earth é de domínio
público (ver `src/data/MAP_SOURCES.md`); referências e transcrições curriculares
da BNCC são atribuídas ao MEC nos dados de origem. A licença MIT não relicencia
documentos de terceiros. Os metadados de fonte e licença do acervo são preservados.

Sistema de autoria, curadoria curricular e apresentação de aulas interativas para a Educação Básica (foco inicial: História 6º ano, com regressões em Física e Matemática).

---

## 🚀 Requisitos de Sistema

- **Node.js**: `v24.x` (LTS recomendada)
- **npm**: `v11.x`
- **Ambiente de Implantação**: Rede local da escola (LAN), máquina dedicada ou servidor estável. Não requer IP público fixo.
- **Banco de Dados**: PostgreSQL 16+ (implementação a partir de E2).

---

## 📦 Instalação Reproduzível

O projeto adota o **npm** com `package-lock.json` como gerenciador oficial e determinístico.
**Proibido o uso de `--force` ou `--legacy-peer-deps`.**

```bash
# Instalação limpa baseada no lockfile oficial
npm ci

# Ou em ambiente de desenvolvimento local
npm install
```

---

## 🛠️ Scripts Operacionais

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor full-stack (Express + Vite HMR) na porta 3000 |
| `npm run build` | Compila os assets do frontend React para produção (`dist/`) |
| `npm run start` | Inicia o servidor em modo produção (atende `dist/` estático) |
| `npm run typecheck` | Executa a verificação estrita de tipos TypeScript (`tsc --noEmit`) |
| `npm test` | Executa a suíte de testes automatizados com Node test runner via `tsx` |
| `npm run clean` | Remove artefatos de compilação (`dist/`) de forma multiplataforma (Windows/Linux) |

---

## 🌐 Configuração de Rede e Segurança (Escola)

1. **Configuração Local (.env):**
   Copie `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
2. **Endereço e Acesso:**
   - Durante desenvolvimento, o servidor responde em `127.0.0.1:3000`.
   - Na escola, o servidor receberá um IP privado fixado via DHCP do roteador.
   - O acesso na LAN deve ser restrito pelo firewall da máquina servidora.
   - **Nunca abrir portas para a internet** nem configurar DMZ/port forwarding no roteador.
3. **Health Check & Readiness:**
   - `GET /health` — Status de saúde operacional do processo.
   - `GET /ready` — Status de prontidão do servidor.

---

## 🧪 Estrutura de Testes e Aceite

Para verificar a conformidade com as metas do plano de construção (`docs/PLANO_CONSTRUCAO_ESTAGIARIO.md`):

```bash
# Executar verificação completa
npm run typecheck
npm run build
npm test
```

Os testes de navegador usam telas fixas, com HMR e observação de arquivos
desativados pelo executor de testes. Isso evita percorrer perfis, evidências e
outros projetos durante a validação. O teste E8 do banco de demonstração é
marcado como ignorado quando esse banco não está configurado; a cobertura
curricular em PostgreSQL descartável é verificada por
`test/full-curriculum-publication.test.ts`.
