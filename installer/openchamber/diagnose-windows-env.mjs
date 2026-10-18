// Maintenance-only A/B test. No files or security settings are changed.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const exe = path.join(process.env.LOCALAPPDATA, 'Programs/PEMARA OpenChamber/PEMARA OpenChamber.exe');
const log = fs.openSync('G:/PEMARA_EDU/build/openchamber/2.4.0-pemara.1/diagnose-env.log', 'a');
const child = spawn(exe, ['--inspect-brk=9342', '--remote-debugging-port=9341'], { windowsHide: true, detached: true, stdio: ['ignore',log,log] });
child.unref();
let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch('http://127.0.0.1:9342/json/list')).json(); if (targets.length) break; } catch {}
  await new Promise(r => setTimeout(r, 500));
}
if (!targets?.length) throw new Error('Inspector não abriu');
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((resolve,reject) => { ws.onopen=resolve; ws.onerror=reject; });
let seq=0;
const pending=new Map();
ws.onmessage=event=>{const data=JSON.parse(event.data); if(data.id) { const request=pending.get(data.id); pending.delete(data.id); if(data.error) request.reject(data.error); else request.resolve(data.result); }};
function call(method,params={}) { return new Promise((resolve,reject)=>{const id=++seq; pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params}));}); }
console.log(await call('Runtime.evaluate', { expression: "process.env = new Proxy(process.env, { set(target, key, value) { if (/^(USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)) return true; target[key] = value; return true; } }); 'Windows paths preserved'" }));
await call('Runtime.runIfWaitingForDebugger');
ws.close();
console.log({ pid: child.pid, protectedWindowsPaths: true });
await new Promise(r => setTimeout(r, 10000));
console.log({ exitCode: child.exitCode });
