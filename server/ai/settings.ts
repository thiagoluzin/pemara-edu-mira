import {discoverModels} from './models';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {AIError,PROVIDERS,listProviders,generateText} from './providers';
type Env=Record<string,string|undefined>;
type Values=Record<string,string>;

// Fora da pasta pública. Segredos só são descriptografados no servidor.
export class AISettingsStore {
 constructor(private directory=process.env.PEMARA_AI_CONFIG_DIR||path.join(os.homedir(),'.pemara','ai',createHash('sha256').update(process.cwd()).digest('hex').slice(0,16)),private base:Env=process.env){}
 private read():Values {
  const file=path.join(this.directory,'settings.enc');
  if(!fs.existsSync(file))return {};
  try{
   const data=JSON.parse(fs.readFileSync(file,'utf8'));
   const key=fs.readFileSync(path.join(this.directory,'key'));
   const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(data.iv,'base64'));
   decipher.setAuthTag(Buffer.from(data.tag,'base64'));
   return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.content,'base64')),decipher.final()]).toString('utf8'));
  }catch{throw new AIError(503,'AI_SETTINGS_READ','Não foi possível ler as configurações de IA salvas. Os dados não foram sobrescritos.');}
 }
 environment():Env{return {...this.base,...this.read()};}
 describe(){
  const env=this.environment();const status=listProviders(env);
  return {...status,providers:status.providers.map(p=>{const preset=PROVIDERS.find(v=>v.id===p.id)!;const prefix=p.id.toUpperCase();return {...p,baseUrl:env[prefix+'_BASE_URL']||preset.base,local:'local' in preset,hasKey:!!env[prefix+'_API_KEY']};})};
 }
 private update(input:any,requireModel=true):Values {
  const preset=PROVIDERS.find(p=>p.id===input?.provider);
  if(!preset)throw new AIError(400,'INVALID_SETTINGS','Escolha um provedor válido.');
  if(requireModel&&(typeof input.model!=='string'||!input.model.trim()||input.model.length>200))throw new AIError(400,'INVALID_SETTINGS','Informe o nome do modelo (até 200 caracteres).');
  if(input.apiKey!==undefined&&(typeof input.apiKey!=='string'||input.apiKey.length>8192||/[\r\n]/.test(input.apiKey)))throw new AIError(400,'INVALID_SETTINGS','Chave de API inválida.');
  if(typeof input.baseUrl!=='string'||input.baseUrl.length>2000)throw new AIError(400,'INVALID_SETTINGS','Informe o endereço do serviço.');
  let url:URL;try{url=new URL(input.baseUrl);}catch{throw new AIError(400,'INVALID_SETTINGS','Endereço inválido. Use http:// ou https://.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new AIError(400,'INVALID_SETTINGS','Use um endereço HTTP(S) sem senha, parâmetros ou fragmento.');
  if(!('local' in preset)&&url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new AIError(400,'INVALID_SETTINGS','Serviços na nuvem devem usar HTTPS. Para uma IA na rede interna, escolha Serviço compatível com OpenAI.');
  const prefix=preset.id.toUpperCase();const next=this.read();
  if(requireModel)next[prefix+'_MODEL']=input.model.trim();next[prefix+'_BASE_URL']=input.baseUrl.replace(/\/+$/,'');
  if(input.clearKey===true)next[prefix+'_API_KEY']='';
  else if(input.apiKey?.trim())next[prefix+'_API_KEY']=input.apiKey.trim();
  if(input.makeDefault===true)next.AI_PROVIDER=preset.id;
  return next;
 }
 save(input:unknown){return this.write(this.update(input));}
 private write(values:Values){
  fs.mkdirSync(this.directory,{recursive:true,mode:0o700});
  const keyFile=path.join(this.directory,'key');
  if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});
  const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',fs.readFileSync(keyFile),iv);
  const content=Buffer.concat([cipher.update(JSON.stringify(values),'utf8'),cipher.final()]);
  const temporary=path.join(this.directory,'settings.tmp');
  fs.writeFileSync(temporary,JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),content:content.toString('base64')}),{mode:0o600});
  fs.renameSync(temporary,path.join(this.directory,'settings.enc'));
  return this.describe();
 }
 async models(input:any,transport:typeof fetch=fetch){const values=this.update(input,false);return discoverModels(input.provider,{...this.base,...values},transport);}
 removeKey(provider:string){
  if(!PROVIDERS.some(p=>p.id===provider))throw new AIError(400,'INVALID_SETTINGS','Provedor inválido.');
  const values=this.read();values[provider.toUpperCase()+'_API_KEY']='';return this.write(values);
 }
 async test(input:any,transport:typeof fetch=fetch){
  const env={...this.base,...this.update(input),AI_TIMEOUT_MS:'20000'};
  const result=await generateText('Responda apenas: conexão funcionando.',input.provider,env,transport);
  return {ok:true,provider:result.provider,model:result.model,message:'Conexão confirmada: o modelo respondeu ao teste.'};
 }
}
export const aiSettings=new AISettingsStore();
