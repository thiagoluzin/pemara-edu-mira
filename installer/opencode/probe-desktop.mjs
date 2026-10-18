import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {_electron}=require('playwright');
const desktop=path.resolve(process.argv[2]||'build/opencode/MISSING');
await fs.access(path.join(desktop,'PEMARA-adaptation.json'));
const root=path.resolve(process.argv[3]||'build/opencode/desktop-probe-isolated');await fs.mkdir(root,{recursive:true});
const env={...process.env,APPDATA:path.join(root,'roaming'),LOCALAPPDATA:path.join(root,'local'),OPENCODE_DISABLE_AUTOUPDATE:'true',OPENCODE_DISABLE_MODELS_FETCH:'true',HTTP_PROXY:'http://127.0.0.1:9',HTTPS_PROXY:'http://127.0.0.1:9',NO_PROXY:'127.0.0.1,localhost'};
env.PEMARA_DESKTOP_DATA=path.join(root,'desktop');env.PEMARA_DISABLE_UPDATER='1';env.PEMARA_AULAS_DIR=path.join(root,'aulas');env.OPENCODE_SIDECAR_V2='0';
await fs.mkdir(env.PEMARA_DESKTOP_DATA,{recursive:true});await fs.mkdir(env.PEMARA_AULAS_DIR,{recursive:true});
for(const kind of ['CONFIG','DATA','STATE','CACHE'])env[`XDG_${kind}_HOME`]=path.join(root,kind.toLowerCase());
await fs.mkdir(env.APPDATA,{recursive:true});await fs.mkdir(env.LOCALAPPDATA,{recursive:true});
const app=await _electron.launch({executablePath:path.join(desktop,'OpenCode.exe'),env,args:['--lang=pt-BR'],timeout:60000});
try {
 await app.evaluate(({session})=>{globalThis.pemaraBlocked=[];session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{const u=new URL(details.url);const local=!['http:','https:','ws:','wss:'].includes(u.protocol)||['127.0.0.1','localhost','[::1]'].includes(u.hostname);if(!local)globalThis.pemaraBlocked.push(u.origin);callback({cancel:!local});});});
 const info=await app.evaluate(({app})=>({userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),version:app.getVersion()}));
 if(info.userData!==env.PEMARA_DESKTOP_DATA)throw Error('Desktop profile isolation failed');console.log(info);
 const w=await app.firstWindow();w.on('pageerror',e=>console.log('PAGE ERROR',e.message));await w.waitForLoadState('domcontentloaded');
 const editor=w.locator('[contenteditable="true"]').first();await editor.waitFor({state:'visible',timeout:45000});
 await editor.fill('Planeje uma aula sobre evaporação para o 5º ano. Rascunho de teste; não enviar.');
 if(!(await editor.innerText()).includes('evaporação'))throw Error('GUI input failed');
 const body=await w.locator('body').innerText();console.log(body.slice(0,2000));
 await w.screenshot({path:path.join(root,'desktop.png')});const blocked=await app.evaluate(()=>globalThis.pemaraBlocked);
 await fs.writeFile(path.join(root,'result.json'),JSON.stringify({info,desktop,profileIsolated:true,guiEditable:true,terminalRequired:false,promptSent:false,blockedExternalOrigins:blocked,body},null,2));console.log('External requests blocked',blocked);
} finally {await app.close();}
