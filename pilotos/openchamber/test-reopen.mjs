import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {root,demo,profile,launch} from './launch.mjs';
import {connect} from './probe.mjs';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const file=demo+'/plano-da-aula.md';
const report={startedAt:new Date().toISOString(),profile,checks:{},limitations:['A conversa é uma fixture importada, identificada na tela; não é teste de geração de IA.']};
let current=await connect();
try {
  const id=(await fs.readFile(root+'/evidencias/session-id.txt','utf8')).trim();
  const before=await current.client.session.export({sessionID:id});
  const bytes=await fs.readFile(file);
  assert.match(bytes.toString(),/PEMARA-ARQUIVO-20261018/);
  const apiOrigin=await current.page.evaluate(()=>new URL(window.__OPENCHAMBER_API_BASE_URL__).origin);
  await current.page.screenshot({path:root+'/evidencias/reabertura-antes.png'});
  await current.page.getByRole('button',{name:'Fechar janela',exact:true}).click();
  for(let i=0;i<80;i++) {
    const alive=await Promise.all([9337,Number(new URL(apiOrigin).port)].map(async port=>{
      try {await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(600)});return true;}catch{return false;}
    }));
    if(alive.every(value=>!value)){report.checks.fullShutdown=true;break;}
    await pause(500);
  }
  assert.equal(report.checks.fullShutdown,true,'The desktop and backend must actually stop');
  console.log('PASS: desktop and backend stopped');
  await current.browser.close();
  const child=launch(true);
  report.reopenedPid=child.pid;
  for(let i=0;i<90;i++) {
    try {const r=await fetch('http://127.0.0.1:9337/json/version',{signal:AbortSignal.timeout(600)});if(r.ok)break;}catch{}
    await pause(500);
  }
  current=await connect();
  await current.page.getByText(/PEMARA-PERSISTENCIA-20261018/).waitFor({timeout:30000});
  const after=await current.client.session.export({sessionID:id});
  assert.deepEqual(after.messages,before.messages);
  report.checks.messagesIdentical=true;
  report.messageCount=after.messages.length;
  report.sessionId=id;
  assert.equal(hash(await fs.readFile(file)),hash(bytes));
  report.checks.fileBytesIdentical=true;
  report.fileSha256=hash(bytes);
  await current.page.locator('.cm-content').filter({hasText:'PEMARA-ARQUIVO-20261018'}).waitFor({timeout:20000});
  report.checks.savedFileVisible=true;
  await current.page.locator('.cm-content').filter({hasText:'Rascunho preservado: continuar a aula de evaporação.'}).waitFor({timeout:15000});
  report.checks.unsentDraftRestored=true;
  assert.equal(await current.page.getByRole('button',{name:'Terminal',exact:true}).count(),0);
  await current.page.keyboard.press('Control+j');
  assert.equal(await current.page.locator('.xterm').count(),0);
  report.checks.noInteractiveTerminal=true;
  const project=await current.page.getByRole('button',{name:'Aula de demonstracao',exact:true}).boundingBox();
  const material=await current.page.getByRole('button',{name:'Materiais do professor',exact:true}).boundingBox();
  const tree=await current.page.getByRole('region',{name:'Arquivos',exact:true}).boundingBox();
  assert.ok(project&&material&&tree&&project.x<320&&material.x<320&&tree.x<320);
  report.checks.projectsAndFilesOnLeft=true;
  await current.page.screenshot({path:root+'/evidencias/reabertura-depois.png'});
  await fs.writeFile(root+'/evidencias/conversa-depois.json',JSON.stringify(after,null,2));
  report.finishedAt=new Date().toISOString();
  report.passed=true;
  console.log(JSON.stringify(report,null,2));
} catch(error) {
  report.passed=false;report.error=String(error);console.error(error);process.exitCode=1;
} finally {
  await fs.writeFile(root+'/evidencias/reabertura.json',JSON.stringify(report,null,2));
  await current.browser.close().catch(()=>{});
}
