# Revisão 4 — correção de maxJsonLength

O log fornecido pelo usuário confirma que Node.js, npm, Python, pip, Git, OpenCode e Desktop passaram nas verificações, mas a gravação final de `installed.json` falhou. O instalador usava o limite padrão de `JavaScriptSerializer`, insuficiente para o inventário do Desktop.

## Correção

- Limite explícito de 67.108.864 caracteres (64 × 1024 × 1024), compartilhado pelo instalador, launcher e desinstalador.
- Serialização concluída antes de tocar no registro anterior.
- Gravação em arquivo temporário no mesmo volume e publicação por troca de arquivo. Um registro anterior é guardado com nome único.
- Nova revisão identificada como `2026.10.18.4-desktop` e arquivo `PEMARA-OpenCode-Desktop-Offline-Windows-r4.exe`. O EXE anterior permanece intacto.
- Os componentes Desktop/Python/Node/Git não mudaram; esta correção é do instalador e launcher.

## Teste de regressão executado

`SerializationRegression.cs` foi compilado junto com o código real de `Installer.cs`, usando um ponto de entrada restrito ao teste de JSON. Não executa a instalação, não abre programas e não altera registro ou atalhos.

1. Inventário construído a partir dos caminhos dos cinco ZIPs x64 reais: **11.560 arquivos; 2.208.243 caracteres de JSON**. Hashes de 64 caracteres são representados por placeholders; a integridade dos pacotes é conferida separadamente no build.
2. O serializador antigo reproduziu o erro `maxJsonLength` com esse inventário.
3. A correção gravou e leu o inventário completo pelo mesmo `Kit.Load` usado no launcher, preservando caminhos com espaços e acentos.
4. Um inventário ampliado para **111.560 arquivos** também passou na gravação e leitura.
5. A troca preservou o hash exato do registro anterior.
6. Uma falha de publicação simulada por bloqueio de arquivo manteve o registro atual intacto.
7. Registros pequenos de versões antigas continuam legíveis.

Evidência: `build/opencode/serialization-regression-r4.txt`. Executar novamente com `powershell -NoProfile -File installer/opencode/test-serialization.ps1`.

## Como recuperar a instalação informada

Feche a janela que mostrou o erro. Execute o instalador **r4** e mantenha a mesma pasta de instalação. Não é necessário desinstalar nem apagar pastas. Ele cria uma versão nova, preserva a tentativa anterior e mantém as aulas/perfil existentes. Ainda são necessários os 4 GB livres verificados pelo assistente, pois ele preserva a versão anterior e extrai uma nova.

O computador do log (`C:\Users\PEMARA TECH`) não foi acessado nesta correção. O teste desta revisão cobre o defeito de serialização e a integridade do pacote. Não é uma afirmação de instalação ponta a ponta executada naquele computador; os limites de plataforma e instalação descritos em `DESKTOP.md` permanecem.

Referência técnica: [JavaScriptSerializer.MaxJsonLength — Microsoft](https://learn.microsoft.com/en-us/dotnet/api/system.web.script.serialization.javascriptserializer.maxjsonlength?view=netframework-4.8.1).
