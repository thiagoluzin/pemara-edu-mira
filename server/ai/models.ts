import {AIError,configuration} from './providers';
export type ModelOption={id:string;name:string};
// Catálogo oficial: https://platform.minimax.io/docs/api-reference/text-openai-api
// Não implica acesso da conta. Planos e disponibilidade são verificados no teste de conexão.
const minimaxCatalog=['MiniMax-M3','MiniMax-M2.7','MiniMax-M2.7-highspeed','MiniMax-M2.5','MiniMax-M2.5-highspeed','MiniMax-M2.1','MiniMax-M2.1-highspeed','MiniMax-M2'];
async function readJSON(response:Response){
 const reader=response.body?.getReader();if(!reader)throw new Error('empty');
 const decoder=new TextDecoder();let size=0,raw='';
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw new Error('too large');raw+=decoder.decode(value,{stream:true});}return JSON.parse(raw+decoder.decode());}finally{await reader.cancel().catch(()=>{});}
}
export async function discoverModels(provider:string,env:Record<string,string|undefined>,transport:typeof fetch=fetch){
 const c=configuration(provider,env);
 if(!('local' in c)&&!c.key)throw new AIError(400,'AI_KEY_REQUIRED','Informe a chave de API antes de consultar os modelos.');
 const headers:Record<string,string>={Accept:'application/json'};
 if(c.protocol==='gemini')headers['x-goog-api-key']=c.key;
 else if(c.protocol==='anthropic'){headers['x-api-key']=c.key;headers['anthropic-version']='2023-06-01';}
 else if(c.key)headers.Authorization='Bearer '+c.key;
 const models=new Map<string,ModelOption>();let token='';let truncated=false;
 const signal=AbortSignal.timeout(20000);
 try{
  for(let page=0;page<10;page++){
   const url=new URL(c.base+'/models');
   if(c.protocol==='gemini'){url.searchParams.set('pageSize','1000');if(token)url.searchParams.set('pageToken',token);}
   if(c.protocol==='anthropic'){url.searchParams.set('limit','1000');if(token)url.searchParams.set('after_id',token);}
   const response=await transport(url,{headers,signal,redirect:'error'});
   if(!response.ok){
    await response.body?.cancel();
    if([404,405].includes(response.status)){
     if(provider==='minimax')return {models:minimaxCatalog.map(id=>({id,name:id})),source:'documentation',note:'Este serviço não forneceu uma lista pela API. Estes modelos constam na documentação da MiniMax; sua chave e seu plano ainda precisam ser testados.',truncated:false};
     throw new AIError(422,'MODEL_LIST_UNAVAILABLE','Este serviço não oferece consulta de modelos neste endereço. Informe o nome manualmente e use Testar conexão.');
    }
    throw new AIError(response.status===429?429:502,'MODEL_LIST_FAILED',[401,403].includes(response.status)?'O serviço recusou a chave ou a permissão de consultar modelos. Confira a chave e o endereço.':`Não foi possível consultar os modelos (HTTP ${response.status}).`);
   }
   const data=await readJSON(response);const items=c.protocol==='gemini'?data.models:data.data;
   if(!Array.isArray(items))throw new Error('invalid model list');
   for(const item of items){
    if(c.protocol==='gemini'&&!item?.supportedGenerationMethods?.includes('generateContent'))continue;
    if(provider==='openrouter'&&item?.architecture?.output_modalities&&!item.architecture.output_modalities.includes('text'))continue;
    const id=c.protocol==='gemini'?item?.name?.replace(/^models\//,''):item?.id;
    if(typeof id!=='string'||!id||id.length>200||/embed|whisper|tts|dall-e|moderation|transcrib|rerank|realtime|audio|image|sora/i.test(id))continue;
    models.set(id,{id,name:typeof (item.displayName||item.display_name||item.name)==='string'?(item.displayName||item.display_name||item.name).slice(0,300):id});
   }
   const next=c.protocol==='gemini'?data.nextPageToken:c.protocol==='anthropic'&&data.has_more?data.last_id:null;
   if(!next)break;
   if(typeof next!=='string'||next===token)throw new Error('invalid cursor');
   token=next;truncated=page===9;
  }
  return {models:[...models.values()].sort((a,b)=>a.id.localeCompare(b.id)),source:'api',truncated,note:'Lista fornecida pelo serviço. A disponibilidade para gerar aulas depende das permissões, créditos e recursos do modelo. Use Testar conexão após escolher.'};
 }catch(e){if(e instanceof AIError)throw e;throw new AIError(502,'MODEL_LIST_CONNECTION','Não foi possível obter uma lista válida de modelos. Confira o endereço e se o serviço está ligado; você também pode informar o nome manualmente.');}
}
