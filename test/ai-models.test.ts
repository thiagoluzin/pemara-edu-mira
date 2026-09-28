import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {discoverModels} from '../server/ai/models';
import {AISettingsStore} from '../server/ai/settings';
import {PROVIDERS} from '../server/ai/providers';

test('Lista dos provedores compatíveis: autenticação no cabeçalho, sem incluir chave na URL',async()=>{
 for(const p of PROVIDERS.filter(p=>p.protocol==='openai')){
  const result=await discoverModels(p.id,{[p.id.toUpperCase()+'_API_KEY']:'test-secret',[p.id.toUpperCase()+'_BASE_URL']:'http://127.0.0.1:1234/v1'},async(url,init)=>{
   assert.match(String(url),/\/v1\/models$/);assert.ok(!String(url).includes('test-secret'));assert.equal((init?.headers as any).Authorization,'Bearer test-secret');assert.equal(init?.redirect,'error');
   return Response.json({data:[{id:'chat-model'},{id:'embedding-only'},{id:'chat-model'},null]});
  });assert.deepEqual(result.models,[{id:'chat-model',name:'chat-model'}]);
 }
});
test('Gemini pagina e filtra modelos sem geração de texto; Claude pagina e usa sua autenticação',async()=>{
 let calls=0;
 const g=await discoverModels('gemini',{GEMINI_API_KEY:'key'},async(url,init)=>{
  assert.equal((init?.headers as any)['x-goog-api-key'],'key');calls++;
  if(calls===1)return Response.json({models:[{name:'models/gemini-chat',displayName:'Gemini',supportedGenerationMethods:['generateContent']},{name:'models/embed',supportedGenerationMethods:['embedContent']}],nextPageToken:'two'});
  assert.equal(new URL(url.toString()).searchParams.get('pageToken'),'two');return Response.json({models:[{name:'models/gemini-next',supportedGenerationMethods:['generateContent']}]});
 });assert.equal(g.models.length,2);assert.equal(calls,2);
 calls=0;const a=await discoverModels('anthropic',{ANTHROPIC_API_KEY:'key'},async(url,init)=>{
  assert.equal((init?.headers as any)['x-api-key'],'key');assert.equal((init?.headers as any)['anthropic-version'],'2023-06-01');calls++;
  if(calls===1)return Response.json({data:[{id:'claude-one',display_name:'Claude'}],has_more:true,last_id:'claude-one'});
  assert.equal(new URL(url.toString()).searchParams.get('after_id'),'claude-one');return Response.json({data:[{id:'claude-two'}],has_more:false});
 });assert.equal(a.models.length,2);
});
test('Erros de chave não viram catálogo; MiniMax sem endpoint identifica catálogo documentado',async()=>{
 await assert.rejects(discoverModels('minimax',{}),/chave/);
 await assert.rejects(discoverModels('minimax',{MINIMAX_API_KEY:'key'},async()=>new Response('segredo',{status:401})),/recusou/);
 const result=await discoverModels('minimax',{MINIMAX_API_KEY:'key'},async()=>new Response('',{status:404}));assert.equal(result.source,'documentation');assert.match(result.note,/ainda precisam ser testados/);
 await assert.rejects(discoverModels('ollama',{},async()=>new Response('',{status:404})),/manualmente/);
 await assert.rejects(discoverModels('ollama',{},async()=>new Response('x'.repeat(2_000_001))),/lista válida/);
});
test('Consultar antes de escolher modelo não salva chave; remoção direta persiste e sobrepõe variável de ambiente',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-models-'));try{
  const store=new AISettingsStore(dir,{OPENAI_API_KEY:'environment-secret',OPENAI_MODEL:'model'});
  const result=await store.models({provider:'openai',baseUrl:'https://api.openai.com/v1',apiKey:'new-secret'},async(_url,init)=>{assert.equal((init?.headers as any).Authorization,'Bearer new-secret');return Response.json({data:[{id:'gpt-test'}]});});
  assert.equal(result.models[0].id,'gpt-test');assert.equal(fs.existsSync(path.join(dir,'settings.enc')),false);
  const removed=store.removeKey('openai');assert.equal(removed.providers.find(p=>p.id==='openai')!.hasKey,false);
  assert.equal(new AISettingsStore(dir,{OPENAI_API_KEY:'environment-secret'}).environment().OPENAI_API_KEY,'');
  assert.ok(!JSON.stringify(removed).includes('secret'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
