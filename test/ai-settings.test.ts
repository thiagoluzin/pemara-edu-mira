import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {AISettingsStore} from '../server/ai/settings';
import {createAISettingsRouter} from '../server/routes/aiSettings';

const input={provider:'ollama',model:'modelo-local',baseUrl:'http://127.0.0.1:11434/v1',apiKey:'',makeDefault:true};
function fixture(){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-ai-settings-'));return {directory,store:new AISettingsStore(directory,{})};}
test('Configuração persiste reinício, criptografa segredo, preserva chave vazia e remove explicitamente',()=>{
 const {directory,store}=fixture();
 try{
  store.save({...input,apiKey:'secret-test-only'});
  assert.ok(!fs.readFileSync(path.join(directory,'settings.enc'),'utf8').includes('secret-test-only'));
  assert.ok(!JSON.stringify(store.describe()).includes('secret-test-only'));
  const restored=new AISettingsStore(directory,{});assert.equal(restored.environment().OLLAMA_API_KEY,'secret-test-only');
  restored.save(input);assert.equal(restored.environment().OLLAMA_API_KEY,'secret-test-only');
  assert.equal(restored.describe().defaultProvider,'ollama');
  restored.save({...input,clearKey:true});assert.equal(restored.environment().OLLAMA_API_KEY,'');
  assert.equal(restored.describe().providers.find(p=>p.id==='ollama')!.configured,true);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Validação não grava URLs inválidas, modelo vazio ou endereço de nuvem sem HTTPS',()=>{
 const {directory,store}=fixture();try{
  for(const invalid of [{...input,model:''},{...input,baseUrl:'file:///tmp/secret'},{...input,baseUrl:'http://user:pass@localhost/v1'},{...input,provider:'openai',baseUrl:'http://external.invalid/v1'}])assert.throws(()=>store.save(invalid));
  assert.equal(fs.existsSync(path.join(directory,'settings.enc')),false);
  store.save(input);fs.writeFileSync(path.join(directory,'settings.enc'),'corrompido');
  assert.throws(()=>store.save(input),/não foram sobrescritos/);
  assert.equal(fs.readFileSync(path.join(directory,'settings.enc'),'utf8'),'corrompido');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Teste chama o modelo selecionado, não salva, não devolve conteúdo nem simula sucesso',async()=>{
 const {directory,store}=fixture();try{
  const result=await store.test(input,async(url,options)=>{assert.equal(String(url),'http://127.0.0.1:11434/v1/chat/completions');assert.equal(JSON.parse(options!.body as string).model,'modelo-local');return Response.json({choices:[{message:{content:'texto privado do modelo'}}]});});
  assert.equal(result.ok,true);assert.ok(!JSON.stringify(result).includes('texto privado'));
  assert.equal(fs.existsSync(path.join(directory,'settings.enc')),false);
  await assert.rejects(store.test(input,async()=>new Response('secret',{status:401})),/HTTP 401/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Rotas protegem leitura e escrita contra professor, visitante e origem externa',async()=>{
 const {directory,store}=fixture();const app=express();app.use(express.json());
 app.use((req,_res,next)=>{if(req.headers['x-test-role'])req.user={role:req.headers['x-test-role']} as any;next();});
 app.use('/settings',createAISettingsRouter(store));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url=`http://127.0.0.1:${(server.address() as any).port}/settings`;
 try{
  for(const method of ['GET','PUT','POST','DELETE'])for(const role of ['','teacher']){
   const result=await fetch(url+(method==='POST'?'/models':method==='DELETE'?'/openai/key':''),{method,headers:{'x-test-role':role}});assert.equal(result.status,role?403:401);
  }
  const bad=await fetch(url,{method:'PUT',headers:{'x-test-role':'admin',origin:'https://other.invalid','Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(bad.status,403);
  const good=await fetch(url,{method:'PUT',headers:{'x-test-role':'admin','Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(good.status,200);assert.equal((await good.json()).defaultProvider,'ollama');
 }finally{await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(directory,{recursive:true,force:true});}
});
