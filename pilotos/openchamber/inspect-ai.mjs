import {connect} from './probe.mjs';
const {browser,client}=await connect();
try {
  const result=await client.session.list({limit:10,order:'desc'});
  console.log(JSON.stringify(await client.session.active(),null,2));
  const exp=await client.session.export({sessionID:result.data[0].id});
  console.log(JSON.stringify(exp.messages.filter(m=>m.type==='assistant').map(m=>({id:m.id,model:m.model,time:m.time,content:m.content.map(c=>({type:c.type,keys:Object.keys(c),tool:c.tool,state:c.state,status:c.status,textLength:c.text?.length}))})),null,2));
  const response=await fetch('https://opencode.ai/inference/openai/v1/models',{signal:AbortSignal.timeout(10000)}).catch(e=>({status:e.message}));
  console.log('endpoint',response.status);
  for await (const event of client.session.log({sessionID:result.data[0].id,after:0,follow:false})) {
    if(event.type==='session.retry.scheduled') console.log(JSON.stringify({attempt:event.data.attempt,error:event.data.error}));
  }
} finally {await browser.close();}
