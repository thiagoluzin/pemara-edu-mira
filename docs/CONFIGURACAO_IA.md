# IA opcional e múltiplos provedores

O PEMARA funciona sem chave de API nos modos determinísticos. Gemini não é requisito de instalação nem de uso. O Modo C permite selecionar um provedor habilitado no servidor; nenhum segredo é enviado ao navegador.

## Configuração

Copie os campos desejados de `.env.example` para o `.env` do servidor e reinicie a aplicação. Use o ID em `AI_PROVIDER` para definir a seleção padrão. Cada provedor usa `<ID_EM_MAIUSCULAS>_MODEL`, `<ID_EM_MAIUSCULAS>_API_KEY` e, opcionalmente, `<ID_EM_MAIUSCULAS>_BASE_URL`. Informe o identificador de modelo disponibilizado pela sua conta/instalação; o sistema não fixa um modelo nem garante acesso a modelos pagos.

Exemplo local, sem chave:

```dotenv
AI_PROVIDER=ollama
OLLAMA_MODEL=nome-do-modelo-instalado
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
```

Ollama/LM Studio precisam estar instalados e servindo um modelo. A ausência de chave não instala modelos nem garante capacidade do computador. O endereço local se refere à máquina do servidor PEMARA.

Exemplo na nuvem:

```dotenv
AI_PROVIDER=openai
OPENAI_MODEL=identificador-do-modelo-da-sua-conta
OPENAI_API_KEY=sua-chave-no-servidor
```

Há presets para OpenAI, Google Gemini, Anthropic Claude, DeepSeek, Groq, Mistral, OpenRouter, xAI, Together AI, Fireworks AI, Cerebras, Perplexity, SambaNova, Hugging Face Router e NVIDIA NIM. Ollama e LM Studio usam endpoints locais e chave opcional. Cada preset deve ser validado com o modelo e conta escolhidos; suporte ao protocolo não comprova disponibilidade comercial ou qualidade pedagógica.

Para outros serviços que implementam Chat Completions, incluindo vLLM, llama.cpp ou um gateway LiteLLM:

```dotenv
AI_PROVIDER=compatible
COMPATIBLE_MODEL=identificador-do-modelo
COMPATIBLE_BASE_URL=http://127.0.0.1:8000/v1
COMPATIBLE_API_KEY=
```

A URL base não inclui `/chat/completions`. Chave é opcional neste adaptador porque alguns servidores não exigem autenticação; serviços remotos normalmente exigem. Use HTTPS para provedores remotos. Não coloque credenciais na URL, no frontend ou em variáveis `VITE_*`. URLs/chaves não são aceitas do professor pelo endpoint de geração. A configuração do servidor é responsabilidade administrativa.

“Todos os provedores” não constitui uma lista finita de APIs interoperáveis. Serviços com autenticação/protocolo próprios, como AWS Bedrock ou integrações empresariais específicas, precisam de adaptador próprio ou gateway compatível. Esta implementação cobre três protocolos e 18 opções, com extensão por endpoint compatível, sem alegar integração nativa universal.

## Comportamento e limites

- `/api/ai/providers`: exige login; expõe nome, modelo e estado de configuração, sem chaves ou URL privada. Configurado não significa conexão testada.
- `/api/ai/generate-lesson`: exige login; envia tema/parâmetros ao provedor selecionado; valida JSON e schema de aula antes de retornar. Não salva aula automaticamente.
- `/api/gemini/generate-lesson`: alias legado para o mesmo fluxo; não força Google nem usa uma chave obrigatória.
- Nenhum provedor é chamado nos modos locais determinísticos. Não há tentativa automática de outro provedor quando o escolhido falha.
- Timeout configurável por `AI_TIMEOUT_MS` (1–120 segundos), limite de resposta de 2 MB e erros sem corpo remoto/segredos. Sem retentativa automática que possa duplicar cobrança.
- Falha de IA aparece como erro. O professor pode escolher explicitamente modo determinístico. Material anexado não foi incluído no envio desta implementação; apenas parâmetros já usados anteriormente são enviados.
- Chaves de APIs na nuvem podem gerar custos; assinatura de chat não implica crédito API. Nenhuma conta paga foi chamada durante os testes desta entrega.

Referência do contrato OpenAI Chat Completions consultada: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create . Presets compatíveis usam o mesmo formato básico; Gemini e Anthropic têm adaptadores próprios.

## Verificação

`npx tsx --test test/ai-providers.test.ts`: testa configuração sem chave, transporte das 18 opções com respostas simuladas, extração de texto, segredos fora do catálogo, chave opcional local, limite de resposta, falhas e ausência de substituição silenciosa. É teste de contrato, não homologação live de cada fornecedor. Validação real requer o serviço/modelo configurado pelo administrador.
