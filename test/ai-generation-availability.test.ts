import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listProviders} from '../server/ai/providers';
import {aiGenerationProblem} from '../src/services/aiGenerationAvailability';

test('Sem modelo local e sem serviço completo bloqueia IA e oferece alternativa sem IA',()=>{
 for(const env of [{},{OPENAI_API_KEY:'only-key'},{OPENAI_MODEL:'only-model'},{OLLAMA_BASE_URL:'http://127.0.0.1:11434/v1'}]){
  const problem=aiGenerationProblem(listProviders(env).providers,'openai');
  assert.match(problem!,/Nenhuma IA está configurada/);assert.match(problem!,/sem IA agora/);
 }
});
test('Modelo local dispensa chave; nuvem exige modelo e chave; seleção inválida não é aceita',()=>{
 const local=listProviders({OLLAMA_MODEL:'qwen3:8b'}).providers;
 assert.equal(aiGenerationProblem(local,'ollama'),null);
 assert.match(aiGenerationProblem(local,'openai')!,/Selecione/);
 const cloud=listProviders({OPENAI_MODEL:'modelo',OPENAI_API_KEY:'test-only'}).providers;
 assert.equal(aiGenerationProblem(cloud,'openai'),null);
 assert.match(aiGenerationProblem(cloud,'openai','Falha de rede')!,/consultar/);
});
