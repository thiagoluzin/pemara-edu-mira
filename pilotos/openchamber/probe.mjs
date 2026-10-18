import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {OpenCode} from './source/node_modules/@opencode/client/dist/promise/index.js';
import {root,demo} from './launch.mjs';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
export async function connect() {
  const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
  const page=browser.contexts()[0].pages()[0];
  await page.getByRole('button',{name:'Abrir menu do OpenChamber',exact:true}).waitFor({timeout:45000});
  const connection=await page.evaluate(()=>({baseUrl:window.__OPENCHAMBER_API_BASE_URL__,headers:window.__OPENCHAMBER_RUNTIME_HEADERS__}));
  const client=OpenCode.make({...connection,headers:{...connection.headers,'x-opencode-directory':encodeURIComponent(demo.replaceAll('\\','/'))}});
  return {browser,page,client};
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  const {browser,client}=await connect();
  try {
    const id=(await fs.readFile(root+'/evidencias/session-id.txt','utf8')).trim();
    await client.session.update({sessionID:id,title:'Aula de evaporação - teste de reabertura'});
    const exported=await client.session.export({sessionID:id});
    await fs.writeFile(root+'/evidencias/conversa-antes.json',JSON.stringify(exported,null,2));
    console.log('Ready',id,exported.messages.length);
  } finally {await browser.close();}
}
