import fs from 'node:fs';
import { OpenCode, isSessionNotFoundError } from '../../pilotos/openchamber/source/node_modules/@opencode/client/dist/promise/index.js';

export function createLessonAdapter({ getConnection, settingsFile, directory }) {
  async function client() {
    const connection = await getConnection();
    const url = new URL(connection.baseUrl);
    if (url.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(url.hostname)) throw new Error('Abra o runtime local do OpenCode para criar a aula.');
    return OpenCode.make({ ...connection, headers: { ...connection.headers, 'x-opencode-directory': encodeURIComponent(directory.replaceAll('\\','/')) } });
  }
  return {
    async model() {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      const selected = settings.lastSelectedModel;
      if (typeof selected !== 'string' || !/^[^/]+\/.+/.test(selected) || selected.startsWith('openchamber/')) throw new Error('Escolha um modelo na área Conversas e projetos antes de criar a aula.');
      return selected;
    },
    async create({ id, title, model }, signal) {
      const sdk = await client();
      const slash = model.indexOf('/');
      const [modelID, variant] = model.slice(slash + 1).split('#');
      const selection = { providerID: model.slice(0, slash), id: modelID, ...(variant ? { variant } : {}) };
      try { const current=await sdk.session.get({ sessionID: id }, { signal }); if(JSON.stringify(current.model)!==JSON.stringify(selection))await sdk.session.switchModel({sessionID:id,model:selection},{signal}); return; }
      catch (error) { if (!isSessionNotFoundError(error)) throw new Error('Não foi possível consultar o OpenCode. Verifique a conexão e retome o pedido.'); }
      await sdk.session.create({ id, title, model: selection, location: { directory }, permissions: [{action:'*',resource:'*',effect:'deny'}] }, { signal });
    },
    async generate({ sessionID, promptID, prompt }, signal) {
      const sdk = await client();
      const bounded = AbortSignal.any([signal, AbortSignal.timeout(240000)]);
      try {
        const before = await sdk.session.export({sessionID},{signal:bounded});
        if (!before.messages.some(m => m.id === promptID)) await sdk.session.prompt({sessionID,id:promptID,text:prompt},{signal:bounded});
        await sdk.session.wait({sessionID},{signal:bounded});
        const result = await sdk.session.export({sessionID},{signal:bounded});
        const requestIndex = result.messages.findIndex(m=>m.id===promptID);
        const reply = result.messages.slice(requestIndex + 1).findLast(m=>m.type==='assistant');
        if (reply?.type==='assistant' && reply.error?.type==='provider.auth') throw new Error('O provedor recusou o acesso ao modelo (autenticação ou limite do plano). Escolha um modelo disponível no OpenCode e retome. O pedido está guardado.');
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
