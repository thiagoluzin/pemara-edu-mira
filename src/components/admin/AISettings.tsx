import React,{useEffect,useState,useRef} from 'react';
type Provider={id:string;name:string;model:string;baseUrl:string;configured:boolean;local:boolean;hasKey:boolean};
type Settings={defaultProvider:string|null;providers:Provider[]};
export function AISettings(){
 const [settings,setSettings]=useState<Settings|null>(null);
 const [provider,setProvider]=useState('ollama');const [model,setModel]=useState('');const [baseUrl,setBaseUrl]=useState('');
 const [apiKey,setApiKey]=useState('');const [clearKey,setClearKey]=useState(false);const [makeDefault,setMakeDefault]=useState(true);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const [picker,setPicker]=useState(false);const [models,setModels]=useState<{id:string;name:string}[]>([]);const [modelNote,setModelNote]=useState('');const [modelError,setModelError]=useState('');const [modelSearch,setModelSearch]=useState('');const modelDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(picker)modelDialog.current?.showModal();else modelDialog.current?.close();},[picker]);
 const selected=settings?.providers.find(p=>p.id===provider);
 const fill=(data:Settings,id:string)=>{const p=data.providers.find(p=>p.id===id)!;setProvider(id);setModel(p.model);setBaseUrl(p.baseUrl);setApiKey('');setClearKey(false);setMakeDefault(data.defaultProvider===id||!data.defaultProvider);setMessage('');setError('');setModels([]);setPicker(false);};
 useEffect(()=>{const controller=new AbortController();fetch('/api/ai/settings',{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);setSettings(data);fill(data,data.defaultProvider||'ollama');}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[]);
 const submit=async(test:boolean)=>{
  setBusy(true);setError('');setMessage('');
  try{
   const res=await fetch('/api/ai/settings'+(test?'/test':''),{method:test?'POST':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,model,baseUrl,apiKey,clearKey,makeDefault})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível concluir a operação.');
   if(test)setMessage(data.message+' Salve para usar esta configuração nas aulas.');
   else {setSettings(data);setApiKey('');setClearKey(false);setMessage('Configurações salvas. Já podem ser usadas em Nova Aula → Com inteligência artificial.');}
  }catch(e){setError(e instanceof Error?e.message:'Falha de conexão com o sistema.');}finally{setBusy(false);}
 };
 const chooseModels=async()=>{
  setPicker(true);setBusy(true);setModels([]);setModelSearch('');setModelError('');setModelNote('');
  try{
   const res=await fetch('/api/ai/settings/models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,baseUrl,apiKey,clearKey:false})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível consultar os modelos.');
   setModels(data.models);setModelNote(data.note+(data.truncated?' A lista atingiu o limite de consulta. Você também pode informar o nome manualmente.':''));
  }catch(e){setModelError(e instanceof Error?e.message:'Falha na consulta de modelos.');}finally{setBusy(false);}
 };
 const removeKey=async()=>{
  setBusy(true);setError('');setMessage('');
  try{const res=await fetch('/api/ai/settings/'+provider+'/key',{method:'DELETE'});const data=await res.json();if(!res.ok)throw Error(data.error);setSettings(data);setApiKey('');setClearKey(false);setModels([]);setMessage('Chave removida. Este serviço não usará mais a chave salva.');}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível remover a chave.');}finally{setBusy(false);}
 };
 const input='w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white';
 return <section className="max-w-4xl mx-auto space-y-6 text-slate-100">
  <header><h1 className="text-2xl font-bold">Configurações de IA</h1><p className="text-slate-300 mt-2">Conecte o Mira a uma IA no computador ou a um serviço com chave de API. Estas configurações são compartilhadas com os professores; somente administradores podem alterá-las.</p></header>
  {error&&<p role="alert" className="rounded-xl bg-red-950 border border-red-500 p-4">{error}</p>}
  {message&&<p role="status" className="rounded-xl bg-emerald-950 border border-emerald-500 p-4">{message}</p>}
  {!settings&&!error&&<p>Carregando configurações…</p>}
  {settings&&<form onSubmit={e=>{e.preventDefault();void submit(false);}} className="rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-5">
   <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
    <label className="block">Serviço de inteligência artificial<select className={input+' mt-2'} value={provider} onChange={e=>fill(settings,e.target.value)}>{settings.providers.map(p=><option key={p.id} value={p.id}>{p.id==='compatible'?'Serviço compatível com OpenAI':p.name}{p.configured?' — configurado':''}{settings.defaultProvider===p.id?' — padrão':''}</option>)}</select></label>
    {selected?.local&&<div className="rounded-xl bg-cyan-950/60 p-4 text-sm space-y-2"><p><strong>IA local:</strong> abra o Ollama ou LM Studio, disponibilize um modelo e mantenha o servidor de IA ligado.</p><p>No LM Studio, ative o servidor local. O endereço deve terminar em <code>/v1</code>. Em Ollama, use o nome completo do modelo instalado, como <code>qwen3:8b</code>.</p><p>O endereço 127.0.0.1 aponta para o computador que executa o Pemara. Se a IA estiver em outro computador da escola, informe o endereço desse computador.</p></div>}
    {provider==='qwen'&&<p className="rounded-xl bg-cyan-950/60 p-4 text-sm">Qwen usa a chave do Alibaba Cloud Model Studio (DashScope). O endereço sugerido é internacional. Se sua chave for de outra região, use o endereço correspondente dessa região.</p>}
    {provider==='glm'&&<p className="rounded-xl bg-cyan-950/60 p-4 text-sm">GLM usa a chave da Z.ai. O endereço sugerido é da API geral. Chaves de planos de programação ou da plataforma chinesa podem exigir outro endereço e ter restrições de uso; confira no painel do seu serviço.</p>}
    <label className="block">Endereço do serviço<input className={input+' mt-2'} type="url" required value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:11434/v1"/></label>
    <label className="block">Chave de API {selected?.local?'(opcional para IA local)':''}<input className={input+' mt-2'} type="password" autoComplete="new-password" value={apiKey} onChange={e=>{setApiKey(e.target.value);setModels([]);}} placeholder={selected?.hasKey?'Chave já salva. Deixe vazio para manter.':'Cole a chave do serviço aqui'}/></label>
    <p className="text-sm text-slate-400">A chave fica armazenada no servidor, criptografada, e não é exibida aos professores. Ollama e LM Studio normalmente funcionam sem chave.</p>
    <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>void chooseModels()} className="rounded-xl bg-cyan-700 px-5 py-3 font-bold">Conectar e escolher modelo</button>{selected?.hasKey&&<button type="button" onClick={()=>void removeKey()} className="rounded-xl border border-red-400 px-5 py-3 text-red-200">Remover chave de API</button>}</div>
    <p className="text-sm text-slate-400">Depois de colar a chave, clique em Conectar e escolher modelo. A consulta não salva a chave; confirme sua escolha em Salvar configurações. Para IA local, consulte sem chave.</p>
    <label className="block">Nome do modelo<input className={input+' mt-2'} required maxLength={200} value={model} onChange={e=>setModel(e.target.value)} placeholder={provider==='ollama'?'Ex.: qwen3:8b':provider==='lmstudio'?'Nome do modelo carregado no LM Studio':'Nome do modelo informado pelo serviço'}/></label>
    <p className="text-sm text-slate-400">Você também pode informar o nome manualmente se o serviço não fornecer uma lista.</p>
    <label className="flex gap-2"><input type="checkbox" checked={makeDefault} onChange={e=>setMakeDefault(e.target.checked)}/>Usar este serviço como padrão nas novas aulas</label>
    <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>void submit(true)} className="rounded-xl border border-indigo-400 px-5 py-3">Testar conexão</button><button type="submit" className="rounded-xl bg-indigo-600 px-5 py-3 font-bold">Salvar configurações</button></div>
   </fieldset>
   {busy&&<p role="status">Aguarde… O teste pode levar até 20 segundos.</p>}
   <p className="text-sm text-slate-400">Testar conexão envia uma mensagem curta ao modelo selecionado. Serviços pagos podem cobrar pelo teste. Salvar não realiza o teste automaticamente.</p>
  </form>}
  <dialog ref={modelDialog} onCancel={()=>setPicker(false)} onClose={()=>setPicker(false)} aria-labelledby="model-picker-title" className="m-auto w-[min(44rem,95vw)] max-h-[85vh] rounded-2xl border border-slate-600 bg-slate-900 text-white p-6 backdrop:bg-black/70">
   <div className="flex justify-between gap-4 mb-4"><h2 id="model-picker-title" className="text-xl font-bold">Escolha o modelo — {selected?.name}</h2><button type="button" onClick={()=>setPicker(false)} className="rounded-lg border border-slate-500 px-3 py-1">Fechar</button></div>
   {busy&&<p role="status">Consultando os modelos do serviço…</p>}
   {modelError&&<p role="alert" className="text-red-300 mb-3">{modelError}</p>}
   {modelNote&&<p className="text-sm text-slate-300 mb-3">{modelNote}</p>}
   {!busy&&!modelError&&!models.length&&<p>Nenhum modelo de texto foi encontrado. Confira o servidor ou informe o nome manualmente.</p>}
   {!!models.length&&<><label className="block mb-3">Buscar modelo<input className={input} value={modelSearch} onChange={e=>setModelSearch(e.target.value)} placeholder="Digite parte do nome"/></label><div className="space-y-2 max-h-[45vh] overflow-y-auto">{models.filter(m=>(m.id+' '+m.name).toLowerCase().includes(modelSearch.toLowerCase())).map(m=><button type="button" key={m.id} className="block w-full text-left rounded-xl border border-slate-600 p-3 hover:bg-indigo-800" onClick={()=>{setModel(m.id);setPicker(false);setMessage('Modelo escolhido: '+m.id+'. Salve as configurações para usá-lo nas aulas.');}}><strong>{m.name}</strong><span className="block text-xs text-slate-300">{m.id}</span></button>)}</div></>}
   <button type="button" onClick={()=>setPicker(false)} className="mt-4 underline">Informar o modelo manualmente</button>
  </dialog>
  <p>Depois de salvar, abra <a href="/create" className="text-cyan-300 underline">Nova Aula</a>, escolha a criação com inteligência artificial e selecione o serviço.</p>
 </section>;
}
