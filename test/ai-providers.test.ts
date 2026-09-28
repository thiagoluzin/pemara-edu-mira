import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIError, PROVIDERS, generateText, listProviders } from '../server/ai/providers';
import { PemaraMaestro } from '../src/maestro/pemaraMaestro';

test('IA é opcional: sem configuração não chama rede e não expõe segredos', async () => {
  assert.ok(listProviders({}).providers.every(p => !p.configured));
  await assert.rejects(generateText('x', undefined, {}, async () => { throw new Error('rede não deve ser chamada'); }), (e: AIError) => e.code === 'AI_NOT_CONFIGURED');
  const catalog = JSON.stringify(listProviders({ OPENAI_API_KEY: 'secret-value', OPENAI_MODEL: 'modelo', OPENAI_BASE_URL: 'https://private.invalid/v1' }));
  assert.ok(!catalog.includes('secret-value'));
  assert.ok(!catalog.includes('private.invalid'));
});

for (const preset of PROVIDERS) {
  test(`Contrato de transporte ${preset.id}: chave, URL, modelo e resposta`, async () => {
    const prefix = preset.id.toUpperCase();
    const local = 'local' in preset;
    const env = { [`${prefix}_MODEL`]: 'modelo-teste', [`${prefix}_API_KEY`]: local ? '' : 'test-secret', [`${prefix}_BASE_URL`]: 'http://127.0.0.1:9999/v1' };
    let calls = 0;
    const result = await generateText('prompt de teste', preset.id, env, async (url, init) => {
      calls++;
      const headers = init!.headers as Record<string, string>;
      const body = JSON.parse(init!.body as string);
      assert.equal(init!.redirect, 'error');
      assert.ok(init!.signal);
      assert.ok(!String(url).includes('test-secret'));
      if (preset.protocol === 'gemini') {
        assert.equal(headers['x-goog-api-key'], 'test-secret');
        assert.match(String(url), /models\/modelo-teste:generateContent$/);
        assert.equal(body.contents[0].parts[0].text, 'prompt de teste');
        return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
      }
      assert.equal(body.model, 'modelo-teste');
      assert.equal(body.messages[0].content, 'prompt de teste');
      if (preset.protocol === 'anthropic') {
        assert.equal(headers['x-api-key'], 'test-secret');
        assert.equal(headers['anthropic-version'], '2023-06-01');
        assert.match(String(url), /\/messages$/);
        return Response.json({ content: [{ type: 'text', text: '{"ok":true}' }] });
      }
      assert.match(String(url), /\/chat\/completions$/);
      assert.equal(headers.Authorization, local ? undefined : 'Bearer test-secret');
      return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
    });
    assert.equal(calls, 1);
    assert.equal(result.provider, preset.id);
    assert.equal(result.text, '{"ok":true}');
  });
}

test('Erros de provedor são explícitos e não vazam conteúdo da resposta', async () => {
  const env = { OLLAMA_MODEL: 'teste' };
  await assert.rejects(generateText('p', 'unknown', env), (e: AIError) => e.status === 400);
  await assert.rejects(generateText('p', 'openai', env), (e: AIError) => e.status === 503);
  await assert.rejects(generateText('p', 'ollama', env, async () => new Response('segredo remoto', { status: 429 })), (e: AIError) => e.status === 429 && !e.message.includes('segredo'));
  await assert.rejects(generateText('p', 'ollama', env, async () => Response.json({ choices: [] })), (e: AIError) => e.code === 'AI_EMPTY_RESPONSE');
  await assert.rejects(generateText('p', 'ollama', env, async () => { throw new Error('secret network details'); }), (e: AIError) => e.code === 'AI_CONNECTION_ERROR' && !e.message.includes('secret'));
  await assert.rejects(generateText('p', 'ollama', { ...env, OLLAMA_BASE_URL: 'file:///tmp/model' }), (e: AIError) => e.code === 'AI_CONFIGURATION');
  await assert.rejects(generateText('p', 'ollama', env, async () => new Response('x'.repeat(2_000_001))), (e: AIError) => e.code === 'AI_RESPONSE_TOO_LARGE');
});

test('Falha da IA não é disfarçada como geração determinística', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: 'Provedor indisponível' }, { status: 503 });
  try {
    await assert.rejects(PemaraMaestro.generateLesson({ subject: 'history', grade: '6EF', topic: 'Grécia Antiga', duration_minutes: 45, didactic_style: 'visual', generation_mode: 'MODE_C_API', ai_provider: 'ollama' }), /Provedor indisponível/);
  } finally { globalThis.fetch = originalFetch; }
});

 test('DeepSeek, Qwen e GLM têm cadastro próprio, sem depender de endpoint genérico',()=>{
  const expected={deepseek:'https://api.deepseek.com/v1',qwen:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',glm:'https://api.z.ai/api/paas/v4'};
  for(const [id,base] of Object.entries(expected)){
   const preset=PROVIDERS.find(p=>p.id===id);assert.ok(preset);assert.equal(preset.base,base);
   const prefix=id.toUpperCase();const configured=listProviders({[prefix+'_MODEL']:'model',[prefix+'_API_KEY']:'test-only'}).providers.find(p=>p.id===id);
   assert.equal(configured?.configured,true);
  }
 });
