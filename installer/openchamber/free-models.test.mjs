import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freeCloudModels,waitForLessonReply} from './free-models.mjs';
const model=(id,patch={})=>({id,providerID:'opencode',name:id,enabled:true,status:'active',cost:[{input:0,output:0,cache:{read:0,write:0}}],capabilities:{output:['text']},limit:{output:8192},...patch});
test('live free catalogue excludes paid, unknown prices, local, disabled and retired models',()=>{
 const list=[model('new'),model('preferred'),model('paid',{cost:[{input:0,output:1,cache:{read:0,write:0}}]}),model('unknown',{cost:[]}),model('disabled',{enabled:false}),model('retired',{status:'deprecated'}),model('local',{providerID:'ollama'})];
 assert.deepEqual(freeCloudModels(list,'opencode/preferred').map(x=>x.id),['opencode/preferred','opencode/new']);
 assert.deepEqual(freeCloudModels([model('replacement')]).map(x=>x.id),['opencode/replacement']);
});
test('waits through queued work and an incomplete answer, and ignores older replies',async()=>{
 let reads=0;const old={id:'old',type:'assistant',time:{completed:1}};const request={id:'native-id',type:'user',metadata:{pemaraPromptKey:'prompt'}};const reply={id:'reply',type:'assistant',time:{completed:2},content:[{type:'text',text:'JSON'}]};
 const sdk={session:{export:async()=>({messages:++reads===1?[old]:reads===2?[old,request]:reads===3?[old,request,{...reply,time:{}}]:[old,request,reply]})}};
 assert.equal(await waitForLessonReply(sdk,'session','prompt',new AbortController().signal,async()=>{}),reply);assert.equal(reads,4);
});
test('abort stops queued polling and never advances to another model',async()=>{
 const controller=new AbortController();let reads=0;const sdk={session:{export:async()=>{reads++;return{messages:[]};}}};
 await assert.rejects(waitForLessonReply(sdk,'session','prompt',controller.signal,async()=>controller.abort()),{name:'AbortError'});assert.equal(reads,1);
});
