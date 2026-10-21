import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLessonAdapter} from './opencode-lesson-adapter.mjs';
const model=id=>({id,providerID:'opencode',name:id,enabled:true,status:'active',cost:[{input:0,output:0,cache:{read:0,write:0}}],capabilities:{output:['text']},limit:{output:8192}});
function setup(current){
 const calls=[];
 const sdk={model:{list:async()=>({data:[model('old'),model('replacement')]})},session:{
  list:async()=>({data:[{id:'older',metadata:{pemaraLessonJobId:'job'},model:{providerID:'opencode',id:'old'}}]}),
  get:async()=>({model:current}),switchAgent:async input=>{assert.equal(input.agent,'build');calls.push('agent');},update:async()=>calls.push('permissions'),
  switchModel:async()=>{throw Error('Do not carry the previous model conversation');},
  interrupt:async()=>calls.push('interrupt'),create:async data=>{calls.push(data);return{id:'new'};}
 }};
 return{calls,adapter:createLessonAdapter({getConnection:async()=>({baseUrl:'http://127.0.0.1:9999'}),directory:'C:/lessons',makeClient:()=>sdk})};
}
test('replacement model gets a fresh session; failed conversation is preserved and interrupted',async()=>{
 const {adapter,calls}=setup({providerID:'opencode',id:'old'});
 assert.equal(await adapter.create({id:'old-session',jobId:'job',title:'Aula',model:'opencode/replacement'},new AbortController().signal),'new');
 assert.equal(calls[0],'interrupt');assert.equal(calls[1].model.id,'replacement');assert.equal(calls[1].metadata.pemaraLessonJobId,'job');assert.equal(calls[1].agent,'build');assert.ok(calls[1].permissions.every(rule=>rule.effect==='deny'));
});
test('same model resumes its session and default variant does not force a new one',async()=>{
 const {adapter,calls}=setup({providerID:'opencode',id:'replacement',variant:'default'});
 assert.equal(await adapter.create({id:'saved-session',jobId:'job',title:'Aula',model:'opencode/replacement'},new AbortController().signal),'saved-session');
 assert.deepEqual(calls,['agent','permissions']);
});
test('recovery by job id never reuses a different model session',async()=>{
 const {adapter,calls}=setup({providerID:'opencode',id:'old'});
 assert.equal(await adapter.create({id:'',jobId:'job',title:'Aula',model:'opencode/replacement'},new AbortController().signal),'new');
 assert.equal(calls.length,1);assert.equal(calls[0].model.id,'replacement');
});
