/** Provider configuration is server-only. Only administrators can change it through the protected settings API. */
export const PROVIDERS = [
  { id: 'openai', name: 'OpenAI / GPT', base: 'https://api.openai.com/v1', protocol: 'openai' },
  { id: 'gemini', name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', protocol: 'gemini' },
  { id: 'anthropic', name: 'Anthropic Claude', base: 'https://api.anthropic.com/v1', protocol: 'anthropic' },
  { id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com/v1', protocol: 'openai' },
  { id: 'qwen', name: 'Alibaba Cloud / Qwen', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', protocol: 'openai' },
  { id: 'glm', name: 'Z.ai / GLM', base: 'https://api.z.ai/api/paas/v4', protocol: 'openai' },
  { id: 'groq', name: 'Groq', base: 'https://api.groq.com/openai/v1', protocol: 'openai' },
  { id: 'mistral', name: 'Mistral', base: 'https://api.mistral.ai/v1', protocol: 'openai' },
  { id: 'openrouter', name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', protocol: 'openai' },
  { id: 'xai', name: 'xAI / Grok', base: 'https://api.x.ai/v1', protocol: 'openai' },
  { id: 'together', name: 'Together AI', base: 'https://api.together.xyz/v1', protocol: 'openai' },
  { id: 'fireworks', name: 'Fireworks AI', base: 'https://api.fireworks.ai/inference/v1', protocol: 'openai' },
  { id: 'cerebras', name: 'Cerebras', base: 'https://api.cerebras.ai/v1', protocol: 'openai' },
  { id: 'perplexity', name: 'Perplexity', base: 'https://api.perplexity.ai', protocol: 'openai' },
  { id: 'sambanova', name: 'SambaNova', base: 'https://api.sambanova.ai/v1', protocol: 'openai' },
  { id: 'huggingface', name: 'Hugging Face Router', base: 'https://router.huggingface.co/v1', protocol: 'openai' },
  { id: 'nvidia', name: 'NVIDIA NIM', base: 'https://integrate.api.nvidia.com/v1', protocol: 'openai' },
  { id: 'minimax', name: 'MiniMax', base: 'https://api.minimax.io/v1', protocol: 'openai' },
  { id: 'moonshot', name: 'Moonshot AI / Kimi', base: 'https://api.moonshot.ai/v1', protocol: 'openai' },
  { id: 'ollama', name: 'Ollama (local)', base: 'http://127.0.0.1:11434/v1', protocol: 'openai', local: true },
  { id: 'lmstudio', name: 'LM Studio (local)', base: 'http://127.0.0.1:1234/v1', protocol: 'openai', local: true },
  { id: 'compatible', name: 'Endpoint compatível com OpenAI', base: '', protocol: 'openai', local: true },
] as const;

type Env = Record<string, string | undefined>;
export class AIError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function configuration(id: string, env: Env) {
  const preset = PROVIDERS.find(p => p.id === id);
  if (!preset) throw new AIError(400, 'UNKNOWN_PROVIDER', 'Provedor de IA desconhecido.');
  const prefix = id.toUpperCase();
  const model = env[`${prefix}_MODEL`]?.trim() || '';
  const key = env[`${prefix}_API_KEY`]?.trim() || '';
  const base = (env[`${prefix}_BASE_URL`]?.trim() || preset.base).replace(/\/+$/, '');
  const configured = !!model && !!base && (('local' in preset && preset.local) || !!key);
  return { ...preset, model, key, base, configured };
}

export function listProviders(env: Env = process.env) {
  return {
    defaultProvider: env.AI_PROVIDER?.trim() || null,
    providers: PROVIDERS.map(p => {
      const c = configuration(p.id, env);
      return { id: p.id, name: p.name, model: c.model, configured: c.configured };
    }),
  };
}

export async function generateText(prompt: string, requested?: string, env: Env = process.env, transport: typeof fetch = fetch) {
  const id = requested || env.AI_PROVIDER?.trim();
  if (!id) throw new AIError(503, 'AI_NOT_CONFIGURED', 'IA opcional não configurada. Use o modo determinístico sem chave de API.');
  const c = configuration(id, env);
  if (!c.configured) throw new AIError(503, 'AI_NOT_CONFIGURED', 'Configure o modelo e, quando exigida pelo provedor, a chave de API no servidor.');
  let base: URL;
  try { base = new URL(c.base); } catch { throw new AIError(503, 'AI_CONFIGURATION', 'URL do provedor inválida na configuração do servidor.'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new AIError(503, 'AI_CONFIGURATION', 'Use uma URL HTTP(S) sem credenciais ou parâmetros.');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url = `${c.base}/chat/completions`;
  let body: unknown = { model: c.model, messages: [{ role: 'user', content: prompt }] };
  if (c.protocol === 'gemini') {
    url = `${c.base}/models/${encodeURIComponent(c.model)}:generateContent`;
    headers['x-goog-api-key'] = c.key;
    body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } };
  } else if (c.protocol === 'anthropic') {
    url = `${c.base}/messages`;
    headers['x-api-key'] = c.key;
    headers['anthropic-version'] = '2023-06-01';
    body = { model: c.model, max_tokens: 8192, messages: [{ role: 'user', content: prompt }] };
  } else if (c.key) {
    headers.Authorization = `Bearer ${c.key}`;
  }
  if(c.id==='minimax')body={...(body as Record<string,unknown>),reasoning_split:true};
  if(c.id==='deepseek'&&env.AI_JSON_OUTPUT==='true')body={...(body as Record<string,unknown>),response_format:{type:'json_object'},max_tokens:12000,thinking:{type:'disabled'}};
  const timeout = Math.min(120000, Math.max(1000, Number(env.AI_TIMEOUT_MS) || 60000));
  try {
    const response = await transport(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout), redirect: 'error' });
    if (!response.ok) {
      throw new AIError(response.status === 429 ? 429 : 502, 'AI_UPSTREAM_ERROR', `O provedor de IA retornou HTTP ${response.status}. Nenhuma aula foi gerada.`);
    }
    // Limit both declared and streamed size; upstream errors/content never enter logs.
    const reader = response.body?.getReader();
    if (!reader) throw new AIError(502, 'AI_EMPTY_RESPONSE', 'Resposta vazia do provedor.');
    const decoder = new TextDecoder();
    let raw = '', bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) { await reader.cancel(); throw new AIError(502, 'AI_RESPONSE_TOO_LARGE', 'Resposta de IA excedeu o limite permitido.'); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const data = JSON.parse(raw);
    if(data.choices?.[0]?.finish_reason==='length')throw new AIError(502,'AI_TRUNCATED','A resposta da IA foi interrompida pelo limite de saída. Nenhuma aula foi salva.');
    const text = c.protocol === 'gemini'
      ? data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('')
      : c.protocol === 'anthropic'
        ? data.content?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
        : data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new AIError(502, 'AI_EMPTY_RESPONSE', 'O modelo não retornou texto utilizável.');
    return { text, provider: c.id, model: c.model };
  } catch (err) {
    if (err instanceof AIError) throw err;
    if(err instanceof Error&&['TimeoutError','AbortError'].includes(err.name))throw new AIError(504,'AI_TIMEOUT','A IA excedeu o tempo limite para gerar a aula completa. Tente novamente; nenhuma aula foi salva.');
    throw new AIError(502, 'AI_CONNECTION_ERROR', 'Não foi possível concluir a resposta da IA. Verifique a conexão, o modelo e a configuração do servidor.');
  }
}
