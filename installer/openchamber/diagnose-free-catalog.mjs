import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {OpenCode} from '../../pilotos/openchamber/source/node_modules/@opencode/client/dist/promise/index.js';
import {freeCloudModels} from './free-models.mjs';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron}=require('playwright');
const app=await _electron.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Programs/PEMARA OpenChamber/PEMARA EDU.exe'),timeout:90000});
try {
 let page;for(let i=0;i<120;i++){page=app.context().pages().find(p=>p.url().startsWith('openchamber-ui://app/'));if(page)break;await new Promise(r=>setTimeout(r,500));}
 await page.getByRole('button',{name:'Abrir menu do OpenChamber',exact:true}).waitFor({timeout:60000});
 const connection=await page.evaluate(()=>({baseUrl:window.__OPENCHAMBER_API_BASE_URL__,headers:window.__OPENCHAMBER_RUNTIME_HEADERS__}));
 const sdk=OpenCode.make({...connection,headers:{...connection.headers,'x-opencode-directory':encodeURIComponent(path.join(process.env.USERPROFILE,'Documents/PEMARA Aulas/Minhas aulas').replaceAll('\\','/'))}});
 let response=await sdk.model.list({},{signal:AbortSignal.timeout(20000)});
 for(let attempt=0;attempt<3 && response.data.length===0;attempt++){await new Promise(r=>setTimeout(r,3000));response=await sdk.model.list({},{signal:AbortSignal.timeout(20000)});}
 const models=response.data.filter(m=>m.providerID==='opencode').map(m=>({id:m.id,name:m.name,enabled:m.enabled,status:m.status,cost:m.cost,limit:m.limit,capabilities:m.capabilities}));
 const report={total:response.data.length,providers:[...new Set(response.data.map(m=>m.providerID))],models,eligible:freeCloudModels(response.data)};
 fs.writeFileSync('build/openchamber/catalog-fix-20261019/catalog.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} catch(error){console.log(JSON.stringify({name:error.name,message:error.message}));process.exitCode=1;}
finally {const closed=app.waitForEvent('close',{timeout:120000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;}
