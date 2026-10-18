# Referências e atribuições — PEMARA EDU

PEMARA EDU é o nome desta distribuição e do sistema de autoria de aulas. A identificação comercial não altera a autoria das tecnologias que ela utiliza.

- [OpenChamber](https://github.com/openchamber/openchamber): interface de conversas e projetos e shell desktop. Base utilizada: commit `6a10ee19a12a1542cad01eee5add14e030ba4ac4`. Licença e alterações locais em `installer/openchamber/`.
- [OpenCode](https://github.com/anomalyco/opencode): execução dos modelos e persistência das conversas. A integração usa o cliente oficial `@opencode/client` 2.0.32 já presente na base OpenChamber. Os modelos mantêm suas próprias condições de acesso e cobrança.
- [Electron](https://www.electronjs.org/): aplicativo desktop.
- [electron-builder / NSIS](https://www.electron.build/nsis.html): empacotamento e assistente de instalação Windows.
- [Node.js](https://nodejs.org/), [Python](https://www.python.org/), [Git](https://git-scm.com/) e [PostgreSQL](https://www.postgresql.org/): componentes da distribuição, com suas respectivas licenças.
- React, Vite, TypeScript, PDF.js, Tesseract.js e demais bibliotecas: versões registradas no `package-lock.json` e nas receitas de dependências do instalador.
- BNCC / Ministério da Educação e Natural Earth: fontes curriculares e cartográficas identificadas nos dados e em `src/data/MAP_SOURCES.md`.

A licença MIT do repositório cobre o código original distribuído sob ela. Documentos importados pelo professor, marcas, logotipos e conteúdos de terceiros mantêm seus direitos próprios. A marca e o mascote PEMARA Tech identificam o proprietário do projeto.

O código é guardado no GitHub. Conversas pessoais, materiais importados, bancos, segredos, backups locais e diretórios de execução estão excluídos desse backup público. Os pacotes binários são entregues separadamente.
