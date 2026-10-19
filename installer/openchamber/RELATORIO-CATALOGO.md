# Recuperação do catálogo gratuito — 19/10/2026

O endpoint de modelos retornava uma lista vazia. O log do OpenCode apontava `database disk image is malformed` ao consultar `kv`, impedindo o carregamento do plugin `opencode.models.dev`. A falha era local; não há evidência de que a conexão com a internet tenha causado a corrupção.

Uma cópia do banco, WAL e SHM foi preservada em `build/openchamber/catalog-fix-20261019`. A leitura pelo índice confirmou que a tabela danificada continha somente a chave `models-dev:catalog`. Todas as demais tabelas eram legíveis.

O reparo criou um banco separado, preservando o esquema e comparando todos os registros legíveis antes da substituição. Somente a cópia descartável do catálogo foi omitida. O arquivo original foi também renomeado e mantido ao lado do banco ativo. O OpenCode baixou novamente o catálogo e passou a retornar dez modelos gratuitos elegíveis.

`PRAGMA integrity_check` passou após o reparo e após reiniciar o programa. Quatro referências órfãs de `instruction_entry` já existiam no banco original; foram preservadas, não apagadas nem atribuídas a este reparo. As conversas antigas ausentes deste banco não foram restauradas automaticamente.

O teste em `test-catalog-recovery.mjs` abre o executável instalado duas vezes, verifica o botão de criação habilitado, a ausência do aviso e a descrição persistida. Com `--generate`, cria um pedido de teste separado pelo mesmo serviço integrado, confirma que uma aula com Atlas foi salva e verifica que os registros das conversas preexistentes continuam idênticos. Não altera o texto guardado no formulário.

Resultado confirmado: geração real concluída por `opencode/beam-free`, pedido `37d10fe9-994e-4b47-b516-38116863d7ed`, aula com oito cenas incluindo `separation`. O segundo ciclo de abertura passou com integridade SQLite e registros preexistentes preservados. Este teste comprova a geração e persistência; não substitui a revisão pedagógica da nova aula.

O reparador é uma ferramenta de manutenção, não uma rotina automática de inicialização. Exige o programa e o processo OpenCode encerrados e recusa casos diferentes do catálogo danificado identificado. Não distribuir bancos, descrições ou backups pessoais junto do instalador. A correção deste computador está nos dados do perfil; reinstalar o programa sozinho não repara um perfil corrompido.

Evidências privadas: `repair-final/repair-verification.json`, `catalog.json`, `recovery-test.json`, capturas `catalog-restored-*.png` e cópias do banco no diretório de evidências acima.
