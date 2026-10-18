import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {root,source,demo} from './launch.mjs';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const {OpenCode}=await import(pathToFileURL(source+'/node_modules/@opencode/client/dist/promise/index.js'));
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
try {
  const page=browser.contexts()[0].pages()[0];
  await page.getByRole('button',{name:'Adicionar projeto',exact:true}).waitFor({timeout:45000});
  const connection=await page.evaluate(()=>({baseUrl:window.__OPENCHAMBER_API_BASE_URL__,headers:window.__OPENCHAMBER_RUNTIME_HEADERS__}));
  const client=OpenCode.make({...connection,headers:{...connection.headers,'x-opencode-directory':encodeURIComponent(demo.replaceAll('\\','/'))}});
  const template=await client.session.create({title:'Preparação do teste de persistência',location:{directory:demo}});
  const info={...template,id:template.id.slice(0,-6)+randomBytes(3).toString('hex'),title:'Conversa preservada - teste local'};
  if(info.location.directory.replaceAll('\\','/').toLowerCase()!==demo.replaceAll('\\','/').toLowerCase()) throw new Error('Session directory isolation failed');
  console.log('Session created',info.id);
  const created=Date.now();
  const user={id:`msg_${created.toString(16)}abcdef012345678901`,type:'user',time:{created},text:'CONVERSA DE TESTE: preservar este registro ao fechar e reabrir o piloto.'};
  const assistant={id:`msg_${(created+1).toString(16)}abcdef012345678902`,type:'assistant',time:{created:created+1,completed:created+2},agent:info.agent||'build',model:info.model||{providerID:'opencode',id:'big-pickle'},finish:'stop',content:[{type:'text',text:'Registro de teste importado para verificar a persistência. Este texto não foi gerado por um modelo de IA. Marcador: PEMARA-PERSISTENCIA-20261018.'}]};
  const result=await client.session.import({info,messages:[user,assistant],location:{directory:demo.replaceAll('\\','/')}});
  const exported=await client.session.export({sessionID:result.id});
  if(exported.info.location.directory.replaceAll('\\','/').toLowerCase()!==demo.replaceAll('\\','/').toLowerCase()) throw new Error('Imported session directory mismatch');
  await client.session.remove({sessionID:template.id});
  await fs.writeFile(root+'/evidencias/conversa-antes.json',JSON.stringify(exported,null,2));
  await fs.writeFile(root+'/evidencias/session-id.txt',result.id);
  console.log('Imported test messages',exported.messages.length);
} finally {await browser.close();}
