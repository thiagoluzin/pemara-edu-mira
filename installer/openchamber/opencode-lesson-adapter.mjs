import {setTimeout as pause} from 'node:timers/promises';
import { OpenCode, isSessionNotFoundError } from '../../pilotos/openchamber/source/node_modules/@opencode/client/dist/promise/index.js';
import {freeCloudModels,lessonPermissions,waitForLessonReply} from './free-models.mjs';
import {completedChatTurns} from './direct-chat-turns.mjs';

export function createLessonAdapter({ getConnection, directory, makeClient = OpenCode.make }) {
  const observed=new Map();
  async function client() {
    const connection = await getConnection();
    const url = new URL(connection.baseUrl);
    if (url.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(url.hostname)) throw new Error('Abra o runtime local do OpenCode para criar a aula.');
    return makeClient({ ...connection, headers: { ...connection.headers, 'x-opencode-directory': encodeURIComponent(directory.replaceAll('\\','/')) } });
  }
  async function models() {
    const sdk=await client();
    const catalog=await sdk.model.list({},{signal:AbortSignal.timeout(15000)});
    // Lesson selection is independent of a model manually selected in chat.
    return freeCloudModels(catalog.data);
  }
  async function assertFree(model) {
    if(!(await models()).some(item=>item.id===model.split('#')[0]))throw new Error('Este modelo saiu do catálogo gratuito. Procurando outra opção…');
  }
  return {
    models,
    async chatTurns(since,signal) {
      signal=AbortSignal.any([signal,AbortSignal.timeout(20000)]);
      const sdk=await client(),active=await sdk.session.active({signal});
      const turns=[],seen=new Map();let cursor;
      const cursors=new Set();
      do {
        const page=await sdk.session.list({limit:100,order:'desc',...(cursor?{cursor}:{})},{signal});
        for(const info of page.data) {
          if(active[info.id]||info.parentID||info.metadata?.pemaraLessonJobId||info.time.updated<since||observed.get(info.id)===info.time.updated)continue;
          turns.push(...completedChatTurns(await sdk.session.export({sessionID:info.id},{signal}),since));
          seen.set(info.id,info.time.updated);
        }
        cursor=page.cursor?.next;
        if(cursor&&cursors.has(cursor))throw Error('Paginação das conversas não avançou.');
        cursors.add(cursor);
      }while(cursor);
      for(const [id,updated] of seen)observed.set(id,updated);
      return turns;
    },
    async chatNotice(sessionID,key,text,signal) {
      const sdk=await client();
      const exported=await sdk.session.export({sessionID},{signal});
      if(exported.messages.some(m=>m.metadata?.pemaraChatReview===key))return;
      const inbox=await sdk.session.inbox.list({sessionID},{signal});
      if(inbox.some(item=>item.payload?.metadata?.pemaraChatReview===key))return;
      await sdk.session.synthetic({sessionID,text,description:'Revisão pedagógica PEMARA',metadata:{pemaraChatReview:key},resume:false,delivery:'queue'},{signal});
    },
    async model() {
      return (await models())[0]?.id || '';
    },
    async create({ id, jobId,title, model }, signal) {
      const sdk = await client();
      await assertFree(model);
      const slash = model.indexOf('/');
      const [modelID, variant] = model.slice(slash + 1).split('#');
      const selection = { providerID: model.slice(0, slash), id: modelID, ...(variant ? { variant } : {}) };
      const sameModel = current => current?.providerID===selection.providerID && current?.id===selection.id && (current.variant||'default')===(selection.variant||'default');
      if(!id){const list=await sdk.session.list({limit:100,order:'desc'},{signal});id=list.data.find(session=>session.metadata?.pemaraLessonJobId===jobId && sameModel(session.model))?.id||'';}
      if(id){
        try {
          const current=await sdk.session.get({ sessionID: id }, { signal });
          if(sameModel(current.model)){
            await sdk.session.switchAgent({sessionID:id,agent:'build'},{signal});
            await sdk.session.update({sessionID:id,permissions:lessonPermissions},{signal});
            return id;
          }
          // Keep the failed conversation as evidence, but do not carry its
          // unfinished tool calls or answers into the replacement model.
          await sdk.session.interrupt({sessionID:id},{signal:AbortSignal.timeout(5000)}).catch(()=>{});
        }
        catch (error) { if (!isSessionNotFoundError(error)) throw new Error('Não foi possível consultar o OpenCode. Verifique a conexão e retome o pedido.'); }
      }
      // Author the requested document instead of asking a planning agent for
      // implementation. Existing tool permissions remain in effect.
      const created=await sdk.session.create({title,agent:'build',model:selection,location:{directory},permissions:lessonPermissions,metadata:{pemaraLessonJobId:jobId}},{signal});
      return created.id;
    },
    async generate({ sessionID, promptID, prompt }, signal) {
      const sdk = await client();
      const bounded = AbortSignal.any([signal, AbortSignal.timeout(240000)]);
      try {
        const current=await sdk.session.get({sessionID},{signal:bounded});
        await assertFree(current.model.providerID+'/'+current.model.id);
        const before = await sdk.session.export({sessionID},{signal:bounded});
        if (!before.messages.some(m => m.id === promptID || m.type==='user' && m.metadata?.pemaraPromptKey===promptID)) await sdk.session.prompt({sessionID,text:prompt,metadata:{pemaraPromptKey:promptID}},{signal:bounded});
        const reply = await waitForLessonReply(sdk,sessionID,promptID,bounded,pause);
        if (reply?.type==='assistant' && reply.error?.type==='provider.auth') throw new Error('O provedor recusou o acesso a este modelo gratuito. O pedido está guardado; o programa tentará outro disponível.');
        if (!reply || reply.type !== 'assistant' || reply.error || reply.finish === 'error' || reply.finish === 'length' || !reply.time.completed) throw new Error('O modelo não concluiu a aula. A conversa está guardada; verifique a conexão e clique em Retomar.');
        const text = reply.content.filter(p=>p.type==='text').map(p=>p.text).join('\n');
        if (!text || text.length > 120000) throw new Error('A resposta do modelo está vazia ou excedeu o limite. O pedido foi guardado.');
        return {text,model:reply.model.providerID+'/'+reply.model.id};
      } catch (error) {
        if (bounded.aborted) await sdk.session.interrupt({sessionID},{signal:AbortSignal.timeout(5000)}).catch(()=>{});
        if (signal.aborted) throw signal.reason;
        if (bounded.aborted) throw new Error('A IA demorou mais de quatro minutos. O pedido e a conversa estão guardados; clique em Retomar.');
        if (error instanceof Error && /guardad/.test(error.message)) throw error;
        throw new Error('A conexão com o OpenCode foi interrompida. O pedido e a conversa estão guardados; clique em Retomar.');
      }
    },
  };
}
