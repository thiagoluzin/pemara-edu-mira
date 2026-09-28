# PEMARA EDU — Plano de construção para o estagiário

Versão 1 • 25/09/2026 • Base conferida: cópia local `pemara_edu_mira-main`.

Requisito confirmado pelo responsável nesta data: instalação na rede interna da escola, sem depender de IP público fixo; acesso individual por professor, biblioteca própria e histórico persistente de tudo que produziu.

Atualização de 26/09/2026: o responsável solicitou painel administrativo com acesso geral ao acervo e histórico de todos os professores, gestão de usuários, permissões, sessões e logins; credencial inicial admin/admin. A especificação atualizada e a sequência E3/E4 estão em [ORDEM_E3_PAINEL_ADMIN_E_PROFESSORES.md](ORDEM_E3_PAINEL_ADMIN_E_PROFESSORES.md). Essa autorização substitui a limitação anterior de leitura administrativa excepcional, sem remover a auditoria das ações nem a privacidade entre professores.

Ordem consolidada de execução após a revisão do painel: [ORDEM_MESTRA_PILOTO_ESCOLA.md](ORDEM_MESTRA_PILOTO_ESCOLA.md). Resultado da revisão independente: [REVISAO_ADMIN_E4_2026-09-26.md](REVISAO_ADMIN_E4_2026-09-26.md). A devolutiva de implementação integral não foi aceita; os blocos da ordem mestra devem ser concluídos e verificados em conjunto.

## Objetivo e definição de pronto

Entregar uma fábrica de aulas em que o professor possa consultar conteúdo curado, compor uma aula fiel ao tema e à série, editar sem perder informação, apresentar e exportar com o mesmo renderer. O conhecimento e as aulas devem sobreviver a reinícios e ser compartilhados por clientes autorizados.

Primeiro piloto: História, 6º ano, Grécia Antiga. Preservar as demonstrações de Sistema Solar, lançamento oblíquo e função quadrática como regressões. Elas não representam cobertura curricular completa. Não abrir Fundamental II inteiro até o piloto cumprir os critérios finais.

## Implantação local na escola e contas dos professores

**Esta é a arquitetura de implantação do MVP, não uma opção futura.** Uma máquina dedicada ou estável dentro da escola hospeda aplicação e PostgreSQL. Os computadores dos professores acessam pelo navegador, na LAN. O banco não fica em pasta compartilhada nem é aberto diretamente aos clientes.

- **Endereço:** não é necessário IP público fixo. Reservar um IP privado para o servidor no DHCP do roteador e configurar um nome no DNS local, quando disponível. Se o roteador não oferecer DNS local, documentar acesso pelo IP privado reservado. Endereço e nome exatos serão definidos na implantação, após inspecionar a rede; não inventar configuração agora.
- **Grupo de trabalho:** pode coexistir com o sistema, mas não gerencia as contas PEMARA, não substitui banco e não é requisito para o acesso web. Não é necessário implantar domínio/Active Directory para o piloto.
- **Limite de acesso:** publicar somente na LAN autorizada, com firewall permitindo a porta da aplicação para a sub-rede escolar. PostgreSQL atende apenas o servidor. Não configurar encaminhamento de portas no roteador ou acesso pela internet nesta entrega.
- **Operação sem internet:** login local, consulta, histórico, edição e composição determinística funcionam sem WAN. Wikidata e APIs de IA exigem internet e devem mostrar indisponibilidade sem interromper o restante do sistema. O navegador ainda precisa alcançar o servidor na LAN; edição offline desconectada do servidor não faz parte do primeiro MVP.
- **Contas locais individuais:** administrador cria/desativa contas de professor. Usar biblioteca consolidada para hash de senha Argon2id e sessões, sem exigir identidade de Google/Microsoft ou outro serviço externo. Nunca armazenar senha em texto puro nem implementar criptografia própria. Reset administrativo auditado, troca de senha, expiração/revogação de sessões e limitação de tentativas.
- **Transporte e sessão:** HTTPS na LAN com certificado confiável nas máquinas da escola; documentar a distribuição de confiança, sem orientar usuários a ignorar alertas do navegador. Cookies HttpOnly, Secure e SameSite, proteção CSRF e política de origem. Proibir tokens/senhas em URLs, logs ou localStorage.
- **Biblioteca particular:** cada professor vê por padrão somente suas aulas, rascunhos, versões e histórico. Autorização por proprietário no servidor em listagem, busca, leitura, edição, duplicação, recuperação e exportação. Conhecimento curricular publicado pode ser compartilhado; aulas particulares não são automaticamente compartilhadas.
- **Administração:** conforme autorização do responsável, o administrador tem acesso geral às aulas e aos históricos de todos os professores, além da gestão de contas, permissões, sessões e registros de login. Acessos e ações administrativos devem ser auditados; professores continuam limitados ao próprio acervo. Desativar conta não apaga seu acervo; transferência requer ação administrativa registrada.
- **Histórico:** guardar criação, geração (inclusive tentativa que falhou), revisão, duplicação, alteração relevante de parâmetros, publicação, exportação, exclusão recuperável e restauração, com ator, horário, versão e estado. Não registrar cada frame de animação nem coletar cliques sem finalidade. Resultados aprovados e revisões anteriores não são sobrescritos.
- **Salvamento:** rascunho com autosave após breve pausa, confirmação do servidor e indicador “Salvo / Salvando / Não salvo”. Ao perder LAN, manter fila local vinculada ao usuário e avisar; ao reconectar, conciliar por versão sem sobrescrever trabalho de outro dispositivo. Se fechar antes do envio, avisar sobre pendência. Buffer local em computador compartilhado deve ter acesso isolado por conta, retenção limitada e não aparecer para o próximo professor.
- **Proteção de dados:** histórico de versões não substitui backup. Proposta inicial: backup diário automático, cópia em outro dispositivo físico, retenção de 30 dias e ensaio de restauração mensal; validar capacidade e política com a escola. Meta provisória de recuperação de desastre: perda máxima de até 24 horas (RPO), retorno em até 4 horas (RTO). Se a escola exigir perda menor, configurar arquivamento WAL e recuperação pontual; não prometer perda zero com apenas backup diário. Operação normal não deve perder nenhuma gravação confirmada pelo banco.
- **Servidor:** inicialização automática após reboot, disco monitorado, logs com rotação e energia protegida por nobreak quando disponível. Estação cliente desligada não interrompe o servidor; máquina que hospeda o sistema precisa permanecer ligada durante uso.

**Prova obrigatória:** professor A cria aula; professor B entra no mesmo computador e não vê nem acessa a aula de A, mesmo usando a URL/ID. A entra em outro computador e recupera suas aulas e versões. Reinício do servidor, indisponibilidade da internet e recuperação de backup são testados separadamente.

Leia antes a [auditoria e suas evidências](AUDITORIA_TECNICA_2026-09-25.md). Os achados A01–A23 abaixo são referências a esse documento. A ordem deste plano é deliberada: corrigir fundamentos e contratos antes de popular tabelas ou construir importação em massa.

## Regras de trabalho

1. Trabalhar em mudanças pequenas, uma etapa por PR/entrega. Recuperar um checkout Git confiável ou criar uma baseline local com autorização do responsável; esta pasta recebida não tem `.git`. Preservar a cópia original e verificar SHA-256 antes de qualquer migração.
2. Não reescrever a aplicação, trocar React/Express ou criar microserviços. Usar PostgreSQL com `pg`, SQL parametrizado e migrations versionadas. Uma aplicação e um banco bastam para o piloto.
3. Não contornar dependências com `--force`/`--legacy-peer-deps`. Não marcar teste como aprovado se ele não executou. Não trocar dependências indiscriminadamente.
4. Não apagar localStorage nem descartar dados existentes durante migração. Produzir exportação, ensaio, relatório de conflitos e restauração comprovada.
5. Conteúdo externo, material do professor e saída de IA entram como dados não confiáveis; não podem atribuir licenças, publicar conteúdo ou gerar status de aprovação por si mesmos.
6. Não usar textos truncados como “correção”. Não apresentar mock, fallback, template ou regra de palavras-chave como IA executada ou revisão pedagógica concluída.
7. Para cada entrega: código, teste relevante, comando reproduzível, saída/evidência, limitações e procedimento de reversão. Aprovação editorial humana é separada de teste técnico.
8. Se faltar recurso, retornar estado explícito de indisponibilidade; nunca substituir Roma, Revolução Industrial ou outra série por Grécia silenciosamente.

## Arquitetura alvo

```text
Knowledge Studio ── API autenticada ── serviços ── repositories ── PostgreSQL
                                              │
Wikidata ── importador ── staging ── revisão ───┘
                                              │
                        Pack Builder ← snapshot de entidades publicadas
                              │
                 Content Pack imutável + manifesto + hash
                              │
                 Composer(pack, opções) → LessonSpec validado
                              │
                      revisões de aula no banco
                              │
             PemaraRenderer + SlideFrame + layouts comuns
                      │                   │
             medição DOM/QA        apresentação e exportação
```

O PostgreSQL é autoridade dos dados editoriais; pack é artefato publicado e versionado; aula guarda o snapshot que foi usado. Editar um nó não modifica uma aula antiga. Uma nova publicação de pack pode alimentar novas aulas. LocalStorage pode guardar preferências ou rascunho explicitamente identificado, nunca um segundo Core independente.

## Contratos a fechar antes da implementação do banco

| Contrato | Decisão para o piloto |
|---|---|
| Validação | Uma biblioteca runtime compartilhada, preferencialmente Zod, para entradas API, pack e LessonSpec; tipos derivados. Validar antes de qualquer processamento/renderização. |
| Identidade | UUID para novas entidades/aulas; preservar IDs legados na migração. Identidade editorial e identidade externa são distintas. Datas UTC ISO; nada de `Date.now()` como única proteção contra colisões. |
| Concorrência | Toda alteração leva `expected_version`; atualização atômica incrementa versão ou retorna 409. Snapshot auditado contém exatamente a versão final gravada. |
| Erros | `{ error: { code, message, fields?, request_id } }`; 400 entrada inválida, 401/403 acesso, 404 ausente, 409 conflito, 422 conteúdo não publicável, 503 dependência indisponível. |
| Revisão editorial | `DRAFT → REVIEW → APPROVED → PUBLISHED`; somente transições permitidas e ator identificado. Novo/importado não nasce publicado. |
| Conteúdo e licenças | Separar referência bibliográfica, origem do texto/asset reutilizado, licença aplicável e evidência de permissão. Licença desconhecida bloqueia publicação/exportação do material reutilizado. |
| Publicação de pack | `{pack_id, version, schema_version, content_hash, published_at, entity_versions, curriculum_refs, source_refs, license_manifest, resources, payload}`. Payload validado e imutável. |
| Geração | Entrada por `pack_id + version`, série, disciplina, método e duração; retornar tema não suportado se não houver pack compatível. Composer recebe pack, sem acessar store/banco diretamente. |
| Revisão da aula | ID da aula distinto do ID do template; proprietário obrigatório, rascunho persistente, versão do pack, hash, versão do renderer e histórico das edições. Duplicar cria outro ID; restauração cria nova revisão sem apagar a anterior. |
| QA visual | `NOT_RUN / PASS / WARNING / FAIL / STALE`, vinculado ao hash da revisão, renderer e viewport. Status editorial e visual separados. Editar invalida o relatório anterior. |
| Modos de geração | Guardar `requested_mode`, `executed_mode` e `fallback_reason`. Não chamar regras locais de inferência de IA. |

Mudanças incompatíveis no LessonSpec exigem versão explícita e migrador para `1.0`. Não alterar o significado da versão existente silenciosamente. Campos opcionais compatíveis podem ser acrescentados com validação e defaults definidos.

## Etapas de execução

### E0 — Baseline e instalação reproduzível

**Prioridade:** P0. **Depende de:** nada. **Resolve:** A01.

**Arquivos:** `package.json`, lockfile escolhido, `tsconfig.json`, `.env.example`; criar README operacional, script de verificação e CI.

- Registrar hashes dos fontes e preservar baseline. Escolher um gerenciador: proposta é npm para este ambiente Windows; migrar o lockfile de forma documentada e manter um único lockfile oficial após validar equivalência.
- Resolver a incompatibilidade esbuild/Vite. Verificar se o esbuild direto é necessário; removê-lo se for redundante ou alinhar versão compatível comprovada. Não presumir que isso é o único erro de compilação.
- Fixar versões do runtime/gerenciador usadas no CI; criar `typecheck`, testes e comando de limpeza compatível com Windows. O atual `lint` só chama TypeScript.
- Garantir build frontend e start de produção: `tsx` está em devDependencies e Vite é importado pelo servidor. Definir build de servidor ou dependências de runtime adequadas; testar instalação de produção sem ferramentas de desenvolvimento.
- `.env.example` com porta, host local, URL do banco e configurações opcionais de IA, sem segredos. Adicionar health/readiness e erros de inicialização claros. Documentar a futura execução como serviço local da escola; só habilitar acesso LAN após autenticação e firewall da E3.

**Aceite:** checkout limpo instala pelo lockfile sem bypass; typecheck e build aprovados; start dev e produção funcionam no runtime documentado. CI repete isso. Se houver erro adicional, anexar log e corrigir antes de E1.

### E1 — Contratos e correções imediatas de integridade

**Prioridade:** P0. **Depende de:** E0. **Resolve:** A04–A08, A18–A20, parte de A15.

**Arquivos:** `src/types/lesson.ts`, `src/schemas/lessonValidator.ts`, `src/maestro/pemaraMaestro.ts`, `src/composer/lessonComposer.ts`, `src/validator/visualValidator.ts`, `src/components/LessonEditor.tsx`, `src/App.tsx`, `src/components/ExportModal.tsx`.

- Introduzir contrato runtime completo e validá-lo antes do visual. Arrays de strings, números finitos, inteiros, enums, limites, IDs únicos e parâmetros por tipo. Rejeitar `wave`, seno e outros recursos ainda não implementados ou implementá-los com testes; para o piloto, restringir o contrato é suficiente.
- Corrigir escolha de tema/série e ID de nova aula. Remover ramo para template inexistente. Usar catálogo explícito de temas suportados na tela de criação.
- Desativar truncamento. Correção deve preservar texto e metadados, dividir quantas vezes necessário, gerar IDs únicos e revalidar todas as partes. Se continuar falhando, informar revisão necessária.
- Proteger índice do editor na troca de aula, resetar estado por identidade de cena e validar dados lidos da biblioteca. Erro deve aparecer ao usuário sem apagar a aula.
- Enquanto não houver DOM QA, rotular resultado como pré-checagem heurística. Não emitir “aprovado pedagogicamente” por passar no schema.
- Fechar os vetores de injeção no exportador legado ou desabilitar esse export até E8. Tratar tanto texto HTML quanto fechamento de `script`; só escapar aspas não basta.
- Retirar afirmações enganosas de IA local/agentes e de material processado. Quiz/simplificação só podem operar com regras realmente suportadas e conteúdo coerente com a disciplina.

**Aceite:** os casos ruins do diagnóstico passam a ser rejeitados/corrigidos; duas novas aulas possuem IDs distintos; Roma não gera Grécia; nenhuma correção perde caracteres; 20 bullets geram partes válidas; troca da última cena de aula longa para aula curta não quebra; conteúdo contendo markup é inerte no export. Quatro demos continuam disponíveis.

### E2 — PostgreSQL, modelo editorial e migrações

**Prioridade:** P0/P1. **Depende de:** E1. **Resolve:** A02, A06, A09, A10, A12, A21.

**Arquivos novos sugeridos:** `server/db/`, `server/repositories/`, `server/services/knowledgeService.ts`, `server/db/migrations/`, `scripts/db/`. Evoluir `src/knowledge/studio/schema.sql`; não manter dois DDLs divergentes.

- Criar pool `pg`, migrations SQL versionadas e tabela de controle de migrações. Manter instância de desenvolvimento local; Docker Compose é opção se o ambiente já o suportar, não requisito para instalar Docker.
- Completar o DDL: `users`, sessões, `lessons` com `owner_id`, `lesson_revisions`, rascunhos, tentativas de geração e histórico de atividades, `content_pack_versions`, associações das versões de entidades, referências externas únicas `(provider, external_id)`, vínculos recurso/nó e currículo/nó, quizzes persistentes ou payload tipado equivalente. Chaves estrangeiras não devem apagar acervo quando uma conta for desativada.
- Permitir múltiplas fontes e evidências por afirmação/entidade quando necessário. Registrar licença de cada conteúdo/asset, URL da licença, atribuição e revisão. Não promover licenças presumidas das sementes.
- Impor unicidade de `(entity_type, entity_id, version)`, pack/versão e vínculos. Fonte de identidade externa pode ter múltiplos registros ligados a um nó canônico; mesma identidade externa não cria dois nós.
- Criar transação para atualização + snapshot e para promoção + vínculo externo + auditoria + staging. Usar optimistic locking e restrições no banco, não só verificação React.
- Publicados e snapshots não são sobrescritos. Versão corrigida vira nova revisão; retirar de catálogo não destrói aulas já produzidas.
- Seed idempotente em banco de desenvolvimento. Conteúdo sem revisão comprovada entra em REVIEW, não como fato verificado. Padronizar disciplinas e séries entre Core, templates e API; demonstrativos de Física devem ter mapeamento curricular explícito.

**Aceite:** migrar banco vazio; reaplicar migrações sem duplicar; reiniciar mantém dados; transação com falha não deixa gravação parcial; duas gravações com mesma versão geram um sucesso e um 409; duas aprovações concorrentes produzem um único nó; snapshot contém a versão final. Dump e restauração em outro banco comprovados.

### E3 — API real e Knowledge Studio conectado

**Prioridade:** P1. **Depende de:** E2. **Resolve:** A02, A10, A16, A21.

**Arquivos:** dividir `server.ts` em inicialização/rotas; criar `server/routes/knowledge.ts`, `src/services/knowledgeApi.ts`; atualizar `KnowledgeStudio.tsx` e retirar o store de produção do browser.

- API paginada e filtrada para nós, relações, currículo, fontes, licenças, recursos, lotes, staging, packs e versões. Criar/editar nó com motivo, versão esperada e ator; implementar revisão e publicação reais.
- Gerenciar vínculos curriculares e recursos; permitir escolher fontes/licenças sem valores indevidamente pré-aprovados. Separar operações editoriais de simples criação.
- UI com carregamento, erro, vazio, conflito e atualização; não declarar sucesso antes da confirmação do servidor. Remover badge PostgreSQL se conexão não estiver saudável.
- Implementar autenticação local e papéis mínimos: professor, editor, revisor/admin; verificar autorização no servidor e propriedade/acesso às aulas. Usar bibliotecas estabelecidas para Argon2id e sessões, sem dependência de login externo. Enquanto autenticação não estiver pronta, manter modo dev restrito a localhost. Depois, liberar somente LAN com HTTPS e firewall documentados.
- Rotas de mutação sem sessão devem falhar; se usar cookie de sessão, implementar proteção CSRF e política de origem. Limitar tamanho de payload e não devolver stack/segredo ao cliente.
- Exportação SQL deve baixar DDL verdadeiro; backup JSON deve incluir todas as entidades e vínculos necessários, com versão do formato.

**Aceite:** dois navegadores autorizados veem o mesmo registro do Core; reload e restart preservam mudanças; usuário sem permissão recebe 403; filtro/paginação funcionam; conflitos não sobrescrevem silenciosamente. Login e operação local funcionam com WAN desligada. `KnowledgeStudio` não usa `KnowledgeStore` em produção nem grava o Core em localStorage.

### E4 — Aulas persistentes e migração de dados legados

**Prioridade:** P1. **Depende de:** E3. **Resolve:** A17 e risco de perda na troca de armazenamento.

**Arquivos:** `src/App.tsx`, `src/components/SavedLessonsList.tsx`, `server/routes/lessons.ts`, `server/services/lessonService.ts`, migradores em `scripts/` e interface de importação.

- CRUD de aulas com versões, duplicação, exclusão recuperável, proprietário e permissões. Implementar “Minhas aulas”, “Rascunhos”, histórico por aula, comparação de versões e restauração como nova revisão. Parametrização em apresentação deve definir se salva edição ou apenas estado temporário; não modificar revisão publicada implicitamente.
- Autosave com estado visível e confirmação durável; requests idempotentes e controle de versão para repetição após falha de rede. Recuperar rascunho ao reabrir; não exibir como salvo algo que só está no browser. Sessão expirada e troca de professor não podem atribuir rascunho pendente à conta errada.
- Exportar dados de cada navegador/origem. O servidor não enxerga localStorage de outra origem. Importação deve ter dry-run, validação, conflitos, IDs legados, vínculo dos registros e relatório de rejeitados.
- Resolver IDs duplicados sem colapsar aulas diferentes; importação identificada por hash/lote e idempotente. Não apagar dados locais antes de backup e comparação aprovados.
- Invalidar QA quando revisão muda; schema antigo deve ter migrador explícito. Rascunho inválido fica recuperável e não é publicado.

**Aceite:** aula criada num navegador aparece em outro para o mesmo professor; outro professor não consegue ler/editar/exportar por ID; editar não altera outra aula de mesmo template; restart mantém revisões; autosave confirmado sobrevive ao fechamento do browser; interrupção antes da confirmação fica indicada e recuperável; repetir importação não duplica; exportar/restaurar conserva contagem, vínculos e conteúdo; ausência do banco apresenta erro, não ativa uma base paralela silenciosa. Repetir os testes em computador compartilhado alternando contas.

### E5 — Pack Builder e Composer alimentados pelo Core

**Prioridade:** P1. **Depende de:** E3 e E4. **Resolve:** A03, A09, A11, A19.

**Arquivos:** criar `server/services/packBuilder.ts`, `server/routes/packs.ts`, contrato compartilhado de pack; refatorar `src/composer/lessonComposer.ts` e `src/knowledge/types.ts`.

- Converter conceitos, relações, recursos, quizzes e objetivos do banco para ContentPack validado. Textos didáticos usados pelo Composer também precisam vir do pack; não basta substituir `CONTENT_PACK_GRECIA_ANTIGA` por uma consulta.
- Selecionar somente versões publicadas, dentro do escopo série/disciplina/tema. Ler snapshot consistente em transação para não misturar edições simultâneas.
- Manifesto de fontes, licenças, arquivos, versões e hash de conteúdo. Hash deve usar serialização canônica ordenada e excluir timestamps voláteis. Persistir artefato antes de disponibilizar a publicação.
- `compose(pack, options)` puro; método e duração devem alterar seleção/ordenação com regras documentadas. Separar identidade e timestamp da aula da composição determinística para testes reproduzíveis.
- Contrato de mapa/comparação compatível com renderer: parametrizar regiões/colunas quando houver outro conteúdo ou restringir explicitamente ao suporte do piloto.
- Manter o pacote hardcoded como fixture de comparação, sem ser fonte paralela em produção. Catálogo lista somente conteúdo publicado disponível.

**Aceite central:** editar Atenas no Studio → revisar/publicar nova versão → publicar pack v2 → gerar nova aula → texto atualizado aparece. Aula e pack v1 permanecem intactos. Recompilar as mesmas versões produz o mesmo hash; recurso faltante/licença pendente bloqueia publicação. Método/duração têm diferenças verificáveis e tema inexistente retorna erro explícito.

### E6 — Wikidata real e staging editorial

**Prioridade:** P1. **Depende de:** E3 e E5. **Resolve:** A06, A11, A12, A22.

**Arquivos:** `server/importers/wikidata.ts`, `server/services/importService.ts`, rotas de importação/staging; adaptar UI.

- Usar cliente HTTP server-side com endpoint permitido, User-Agent adequado, timeout, limites, paginação e retry com backoff limitado para 429/5xx. Não aceitar URL arbitrária que permita consultar rede interna.
- Lote pequeno primeiro: entidades conhecidas de Grécia. Armazenar QID real, URL, versão/revisão quando disponível, consulta, horário, hash e payload bruto de proveniência. Não gerar IDs externos fictícios.
- Distinguir falha parcial, duplicata e conflito; contadores calculados dos resultados persistidos. Lote não conclui se requisição falhou. Log real identificável por request/lote, sem segredos.
- Deduplicação principal por identidade externa; título/slug só sinalizam revisão, não mesclam automaticamente. Reimportar versão nova gera candidato de atualização revisável.
- Validar fatos, relações, idioma, escopo e direitos antes da promoção. Wikidata estruturado é CC0; isso não licencia automaticamente imagens do Commons, texto da Wikipédia ou traduções bibliográficas.
- Retomada simples de lote persistido no PostgreSQL; não introduzir Redis/Kafka para o piloto. Importação longa responde 202 com ID e estado consultável.

**Aceite:** fixtures de sucesso/timeout/429/malformado e um lote real pequeno documentado; repetir o lote não duplica o Core; revisar/aprovar duas vezes é seguro; erro não publica nada; alteração externa vira conflito/revisão; lote interrompido tem estado recuperável. Não carregar milhares de registros nesta etapa.

### E7 — SlideFrame, layouts e QA do DOM real

**Prioridade:** P1. **Depende de:** E1 e E5. **Resolve:** A07, A13, A19, A20, A23.

**Arquivos:** `src/renderer/SlideFrame.tsx`, layouts, componentes existentes, tokens, `PresentationMode.tsx`, `LessonEditor.tsx`; criar rota de renderização para QA e testes Playwright.

- Um frame lógico 1920×1080 escalado proporcionalmente, com zona de controles externa. Aplicar tokens aos elementos reais; definir conversão entre coordenadas CSS medidas e coordenadas lógicas. Não esconder overflow para “passar”.
- Catálogo compartilhado de cenas/layouts suportados. Montagem com identidade estável e reset ao mudar cena; fullscreen acompanha `fullscreenchange`; teclado respeita campos/controles e canvas acompanha resize/DPR.
- Chromium renderiza cada cena com o renderer de produção, espera fontes/assets e estado estável. Animações entram em tempo/seed fixos para captura; não comparar frames aleatórios.
- Medir DOM real (`getBoundingClientRect`, scroll/client sizes, fonte computada, linhas), SVG/textos e áreas relevantes. Whitelist de sobreposições intencionais para não acusar todo descendente como colisão.
- Registrar screenshot e relatório por cena: revisão/hash, renderer, viewport, caixas, falhas e correções. Testar 1920×1080, 1366×768 e 1280×720; editor também em largura estreita. Avaliar legibilidade efetiva depois da escala.
- Correção limitada e sem perda: espaçamento, fonte dentro do mínimo, layout alternativo e divisão. No máximo três ciclos automáticos; revalidar novas cenas. Pendência impede status visual aprovado e liberação final, mas permite rascunho/prévia.
- Vincular o gate ao hash: relatório ausente/antigo não autoriza export final nem apresentação marcada como validada. Gate também no serviço, não só em botão.

**Aceite:** todas as cenas das quatro demos com evidência; casos de texto/título/bullets extremos e recurso ausente falham corretamente; snapshots estáveis; nenhuma falha encoberta por clipping ou scroll. Revisão visual humana separada do resultado automatizado. Corrigir também mapa/quiz/timeline ao alternar cenas consecutivas do mesmo tipo.

### E8 — Exportação fiel e segura

**Prioridade:** P1. **Depende de:** E7. **Resolve:** A08, A14, A21.

**Arquivos:** `src/components/ExportModal.tsx`, entrypoint offline e serviço de exportação; reutilizar renderer/frame, sem segundo conjunto de templates HTML.

- Bundle offline de produção com React, CSS e assets locais. Pode ser arquivo HTML único se viável ou ZIP com `index.html` e recursos; alinhar o nome exibido ao formato realmente entregue. O player não depende de localhost, CDN, chave ou API.
- Incorporar LessonSpec por serialização segura e renderizar texto como texto. Testar `</script>`, markup, aspas e caracteres Unicode; não usar conteúdo externo em `innerHTML`.
- PDF usa a mesma revisão e renderer em modo de impressão: todas as cenas, quebras de página previsíveis, notas do professor opcionais e estados estáticos definidos para simulações. Export JSON mantém referências/versões necessárias.
- Preservar atribuições e licenças no pacote. Recurso inacessível bloqueia ou exige exclusão editorial explícita; não omitir silenciosamente.
- MP4 fica fora do MVP; planejar somente após paridade HTML/PDF comprovada.

**Aceite:** abrir pacote em máquina/perfil limpo com rede bloqueada; mapa, tabela, quiz, resumo, timeline e simulações presentes; nenhuma requisição externa necessária; capturas comparáveis à apresentação; PDF contém todas as cenas; nenhum payload executa script; export usa hash de revisão aprovada.

### E9 — Robustez pedagógica, acessibilidade e operação

**Prioridade:** P1/P2. **Depende de:** E6 e E8. **Resolve:** A16, A18, A22, A23.

- Conferir redação oficial das habilidades BNCC e associação ao conteúdo com referência rastreável; revisão de professor para fatos, questões e adequação à série. Corrigir relações causais invertidas e afirmações sem fonte específica.
- Documentar limites científicos: g=0 não possui tempo de queda finito no cenário ascendente; distinguir horizonte de visualização de tempo físico. Testar parâmetros extremos, altura inicial, unidades, raízes e modelos orbitais didáticos. Fonte/data para dados astronômicos que mudam.
- Navegação por teclado, foco/modal, labels, idioma pt-BR, contraste e movimento reduzido. Apresentação deve funcionar em projetor e manter controles acessíveis.
- Backup automático e restauração ensaiada conforme política local, readiness de banco, logs estruturados e correlação, migração com rollback/restore, build e start de produção documentados. Instalar como serviço na máquina da escola com HTTPS na LAN, IP privado reservado/nome local e firewall restrito; não abrir portas para a internet. Incluir backup do banco, assets e configuração necessária à recuperação, com segredos protegidos separadamente.
- Material do professor: no MVP, aceitar apenas formatos realmente suportados (ex.: TXT); limites e política de retenção explícitos. PDF/DOCX exigem parsers próprios antes de anunciar suporte. Não enviar a provedor externo por consequência silenciosa de fallback.

**Aceite:** checklist editorial assinado; restauração em banco separado; matriz de papéis testada; nenhum erro silencioso de gravação; acessibilidade básica e cenários científicos comprovados; operação documentada para outra pessoa executar.

### E10 — IA e agentes, somente depois do piloto

**Prioridade:** posterior ao MVP. **Depende de:** E9.

- Primeiro endurecer o adaptador Gemini: modelo configurável verificado, entrada/saída validadas, timeout, cancelamento, limite por usuário, orçamento e logs sem conteúdo sensível. Falha não muda tema nem declara sucesso de outro modo.
- IA local só se houver inferência local real e requisitos de máquina documentados. Agentes só se houver chamadas, ferramentas, resultados e auditoria reais, com benefício demonstrado.
- IA pode sugerir planos/edições baseados em conteúdo publicado; não altera Core, licença, estado editorial ou QA por conta própria. Submeter o resultado ao mesmo contrato e gates do modo sem IA.

**Aceite:** saída inválida é bloqueada; falha e fallback ficam visíveis; testes simulam provider e teste real controlado prova o adaptador; custo e retenção conhecidos. Não é condição para o modo sem IA funcionar.

## Sequência e tamanho das entregas

```text
E0 → E1 → E2 → E3 → E4 → E5 → E6
                              └→ E7 → E8
                                  E6 + E8 → E9 → piloto → E10 opcional
```

Para um estagiário, executar sequencialmente; a bifurcação representa dependência técnica, não obrigação de trabalhar em paralelo. Dividir cada etapa grande em PRs menores: contrato, implementação, integração e evidência. Revisão do engenheiro ao final de cada etapa e antes de migrar dados reais.

Estimativa inicial de planejamento, não compromisso: 6–10 semanas para E0–E9 com acompanhamento frequente de engenharia e curadoria; recalcular após E0/E1 conforme familiaridade, disponibilidade e falhas encontradas. IA adicional e cobertura curricular massiva não estão nessa estimativa.

## Matriz mínima de aceite do piloto

| Prova | Resultado obrigatório |
|---|---|
| Instalação limpa + CI | Dependências, typecheck, testes, build e start sem bypass |
| Mesmo professor em dois clientes + restart | Biblioteca e histórico persistentes, sem memória/localStorage como Core |
| Professores A/B e computador compartilhado | Conta B não acessa dados de A por tela, API, ID, export ou rascunho local |
| WAN desligada | Login, biblioteca e composição determinística continuam na LAN |
| Autosave + interrupção de LAN | Salvamento confirmado persiste; pendência é explícita, recuperável e isolada por conta |
| Atualização concorrente | Um sucesso; conflito explícito; auditoria correta |
| Reimportação/aprovação repetida | Sem duplicatas nem publicação parcial |
| Atenas v1 → v2 → aula | Nova aula usa v2; aula antiga conserva v1 |
| Pedido fora do catálogo | Mensagem explícita, sem trocar conteúdo/ano |
| Conteúdo malformado | Rejeitado antes de renderer/visual |
| Correção de overflow | Nenhuma perda de informação; todas as partes revalidadas |
| QA visual | DOM e screenshots de todas as cenas/demos e viewports previstos |
| Offline/PDF | Mesmo conteúdo/renderer, recursos completos, sem rede obrigatória |
| Segurança de conteúdo/acesso | Markup inerte; usuários respeitam papéis/propriedade |
| Backup/restauração | Banco restaurado com contagens, vínculos e hashes conferidos |
| Revisão editorial | BNCC, fatos, fontes, licenças e quizzes conferidos por responsável |

## Primeira ordem de serviço para copiar ao estagiário

> Execute somente E0 e E1 do plano `docs/PLANO_CONSTRUCAO_ESTAGIARIO.md`. Leia a auditoria e reproduza as evidências antes de corrigir. Preserve a baseline e os dados existentes. Resolva instalação sem `--force`/`--legacy-peer-deps`, valide o contrato antes de renderizar, corrija roteamento/IDs, bloqueie recursos não implementados, elimine truncamento e sucesso visual falso, proteja troca de aulas/cenas e feche ou desative temporariamente o export HTML inseguro. Preserve as quatro demonstrações. Entregue em mudanças pequenas, com testes dos defeitos reais, logs de typecheck/build e demonstração no navegador. Não implemente PostgreSQL, carga massiva, novos agentes ou redesign nesta primeira entrega. Liste qualquer bloqueio com evidência; não declare como concluído o que não executou.

## Modelo de prestação de contas de cada entrega

```text
Etapa / PR / commit:
Problema corrigido e comportamento resultante:
Arquivos e contratos alterados:
Migração de dados (ou não aplicável):
Comandos executados e resultados:
Evidências de runtime/screenshots quando aplicável:
Critérios de aceite atendidos / pendentes:
Limitações conhecidas:
Como reverter e como restaurar dados:
```

Situação deste documento: plano pronto para execução. As etapas propostas ainda não foram implementadas nesta auditoria.
