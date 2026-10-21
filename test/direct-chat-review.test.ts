import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DirectChatReview,captureChatDocuments,type ChatTurn,type ChatReviewBridge} from '../server/ai/directChatReview';
import {completedChatTurns} from '../installer/openchamber/direct-chat-turns.mjs';

function fixture() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pemara-chat-review-'));
  const now=Date.now();
  const turn: ChatTurn={sessionID:'ses_chat',promptID:'msg_user',replyID:'msg_reply',directory,created:now,completed:now+1000,title:'Aula de frações',request:'Crie uma aula de frações para o 6º ano.',context:'',answer:'Aula de frações: 1/2 representa uma de duas partes iguais.',files:[]};
  const calls:{sessionID:string;prompt:string}[]=[],notices:string[]=[];let fail='';
  const bridge:ChatReviewBridge={chatTurns:async()=>[turn],chatNotice:async(_id,_key,text)=>{notices.push(text);},models:async()=>[{id:'opencode/free',name:'Gratuito'}],model:async()=> 'opencode/free',create:async({jobId})=>jobId,
    generate:async({sessionID,prompt})=>{calls.push({sessionID,prompt});if(fail&&sessionID.endsWith(fail))throw Error('Conexão interrompida.');return {model:'opencode/free',text:JSON.stringify(sessionID.startsWith('chat-classify-')?{is_lesson:true,subject:'math',grade:'6EF',title:'Frações'}:{verdict:'no_issue_found',findings:[]})};}};
  return {directory,turn,calls,notices,bridge,fail:(id:string)=>{fail=id;},monitor:()=>new DirectChatReview(bridge,path.join(directory,'state'),now-1)};
}
test('aula no chat recebe cinco pareceres independentes e não repete ao consultar ou reabrir',async()=>{
  const f=fixture();fs.writeFileSync(path.join(f.directory,'aula.html'),'<html><body>Uma metade: 1/2.</body></html>');f.turn.files=['aula.html'];
  f.turn.files.push(path.join(f.directory,'aula.html'));
  const m=f.monitor();await m.tick();
  assert.equal(m.list().jobs[0].status,'completed');assert.equal(m.list().jobs[0].team!.reviews.length,5);
  assert.equal(m.list().jobs[0].documents.length,1);
  assert.equal(f.calls.length,6);assert.equal(new Set(f.calls.map(c=>c.sessionID)).size,6);
  assert.ok(f.calls.slice(1).every(c=>c.prompt.includes('Uma metade: 1/2.')));
  assert.equal(f.notices.length,1);await m.tick();await m.stop();
  const reopen=f.monitor();await reopen.tick();assert.equal(f.calls.length,6);assert.equal(f.notices.length,1);await reopen.stop();
  assert.equal(fs.readFileSync(path.join(f.directory,'aula.html'),'utf8'),'<html><body>Uma metade: 1/2.</body></html>');
});
test('falha parcial preserva a cópia original e retoma apenas os pareceres pendentes',async()=>{
  const f=fixture();f.fail('review-assessment');const m=f.monitor();await m.tick();
  const first=m.list().jobs[0];assert.equal(first.status,'failed');assert.equal(first.team!.reviews.length,2);
  f.turn.answer='Texto alterado após a captura';f.fail('');m.retry(first.id);await m.tick();
  assert.equal(m.list().jobs[0].team!.reviews.length,5);assert.equal(f.calls.filter(c=>c.sessionID.endsWith('review-didactics')).length,1);
  assert.ok(f.calls.filter(c=>c.sessionID.startsWith('chat-review-')).every(c=>!c.prompt.includes('Texto alterado após')));await m.stop();
});
test('conversa comum não aciona professores e não retém outra cópia do texto',async()=>{
  const f=fixture();f.bridge.generate=async()=>({text:'{"is_lesson":false}',model:'opencode/free'});
  const m=f.monitor();await m.tick();assert.deepEqual(m.list().jobs,[]);assert.equal(f.notices.length,0);
  const file=fs.readdirSync(path.join(f.directory,'state')).find(n=>/^[a-f0-9]{64}/.test(n))!;
  const receipt=JSON.parse(fs.readFileSync(path.join(f.directory,'state',file),'utf8'));assert.equal(receipt.turn.answer,'');await m.stop();
});
test('escopo de arquivos impede leitura externa, diretórios reservados e versões posteriores',()=>{
  const f=fixture();fs.mkdirSync(path.join(f.directory,'.private'));fs.writeFileSync(path.join(f.directory,'.private','secret.json'),'private');
  fs.writeFileSync(path.join(f.directory,'changed.html'),'new');fs.utimesSync(path.join(f.directory,'changed.html'),new Date(),new Date(f.turn.completed+6000));
  const r=captureChatDocuments({...f.turn,files:['../outside.md','.private/secret.json','changed.html']});assert.equal(r.documents.length,0);assert.equal(r.warnings.length,3);
});
test('arquivo indisponível nunca resulta em cinco pareceres sobre conteúdo incompleto',async()=>{
  const f=fixture();f.turn.files=['ausente.html'];const m=f.monitor();await m.tick();
  assert.equal(m.list().jobs[0].status,'failed');assert.equal(f.calls.length,1);assert.equal(f.notices.length,0);await m.stop();
});
test('aulas anteriores à ativação não são processadas e verificações concorrentes são únicas',async()=>{
  const f=fixture();const old=new DirectChatReview(f.bridge,path.join(f.directory,'old'),f.turn.created+1);await old.tick();assert.equal(f.calls.length,0);await old.stop();
  const m=f.monitor();await Promise.all([m.tick(),m.tick(),m.tick()]);assert.equal(f.calls.length,6);await m.stop();
});
test('OpenCode: ignora chamadas intermediárias, erros e sessões dos próprios agentes',()=>{
  const info={id:'ses_1',location:{directory:'G:/projeto'},title:'Aula'};
  const user={type:'user',id:'msg_u',time:{created:100},text:'Faça uma aula'};
  const reply={type:'assistant',id:'msg_a',time:{created:110,completed:120},finish:'tool-calls',content:[{type:'text',text:'Criando…'}]};
  assert.deepEqual(completedChatTurns({info,messages:[user,reply]},90),[]);
  const final={...reply,id:'msg_final',finish:'stop',content:[{type:'text',text:'[Aula](aula.html)'}]};
  const [turn]=completedChatTurns({info,messages:[user,reply,final]},90);assert.equal(turn.replyID,'msg_final');assert.deepEqual(turn.files,['aula.html']);
  assert.deepEqual(completedChatTurns({info:{...info,metadata:{pemaraLessonJobId:'review'}},messages:[user,final]},90),[]);
  assert.deepEqual(completedChatTurns({info,messages:[user,{...final,error:{type:'provider.auth'}}]},90),[]);
});
