import {connect} from './probe.mjs';
const {browser,client}=await connect();
try {
  let count=0;
  for await(const event of client.event.subscribe({signal:AbortSignal.timeout(20000)})) {
    if(!event.type?.startsWith('session.')) continue;
    count++;
    console.log(JSON.stringify({type:event.type,created:event.created,attempt:event.data?.attempt,error:event.data?.error}));
    if(count>15)break;
  }
} catch(error) {console.log(error.name);}
finally {await browser.close();}
