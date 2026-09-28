# PEMARA EDU — Fábrica de Aulas

Código aberto sob a [licença MIT](LICENSE).

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
