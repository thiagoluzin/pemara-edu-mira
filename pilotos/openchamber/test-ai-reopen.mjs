import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {root,demo,launch} from './launch.mjs';
import {connect} from './probe.mjs';
const id='ses_eb04e7d58ffeWKyEfRpbVV6G69';
const directory=demo+'/aula-evaporacao-ia';
const filenames=['plano-professor.md','aula.html','atividade-aluno.html'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report={startedAt:new Date().toISOString(),sessionId:id,checks:{},files:{},passed:false};
let current=await connect();
try {
  const active=await current.client.session.active();
  assert.ok(!active[id],'Generation must finish before closing');
  const before=await current.client.session.export({sessionID:id});
  assert.ok(before.messages.some(m=>m.type==='assistant'&&m.content?.length));
  const tools=before.messages.filter(m=>m.type==='assistant').flatMap(m=>m.content||[]).filter(part=>part.type==='tool');
  report.agentTools=[...new Set(tools.map(tool=>tool.name))];
  assert.ok(!report.agentTools.some(name=>/bash|shell|terminal/i.test(name)));
  report.checks.agentUsedFileToolsWithoutTerminal=true;
  for(const name of filenames) report.files[name]=hash(await fs.readFile(directory+'/'+name));
  await fs.writeFile(root+'/evidencias/ia-conversa-antes.json',JSON.stringify(before,null,2));
  await current.page.locator('.cm-content').first().fill('Próxima aula: comparar evaporação e condensação.');
  await pause(1000);
  await current.page.screenshot({path:root+'/evidencias/ia-antes-fechar.png'});
  const origin=await current.page.evaluate(()=>new URL(window.__OPENCHAMBER_API_BASE_URL__).origin);
  await current.page.getByRole('button',{name:'Fechar janela',exact:true}).click();
  for(let i=0;i<80;i++) {
    const alive=await Promise.all([origin,'http://127.0.0.1:9337'].map(async url=>{
      try{await fetch(url+'/health',{signal:AbortSignal.timeout(500)});return true;}catch{return false;}
    }));
    if(alive.every(x=>!x)){report.checks.fullShutdown=true;break;}
    await pause(500);
  }
  assert.ok(report.checks.fullShutdown);
  await current.browser.close().catch(()=>{});
  launch(true);
  for(let i=0;i<90;i++) {
    try{const response=await fetch('http://127.0.0.1:9337/json/version',{signal:AbortSignal.timeout(500)});if(response.ok)break;}catch{}
    await pause(500);
  }
  current=await connect();
  await current.page.locator('.cm-content').filter({hasText:'Próxima aula: comparar evaporação e condensação.'}).waitFor({timeout:30000});
  report.checks.draftRestored=true;
  const after=await current.client.session.export({sessionID:id});
  assert.deepEqual(after.messages,before.messages);
  report.checks.conversationIdentical=true;
  report.messageCount=after.messages.length;
  for(const name of filenames) assert.equal(hash(await fs.readFile(directory+'/'+name)),report.files[name]);
  report.checks.allThreeFilesIdentical=true;
  const info=await current.client.session.get({sessionID:id});
  report.model=info.model;report.tokens=info.tokens;report.cost=info.cost;report.title=info.title;
  assert.ok(info.tokens.output>0,'Must be actual model generation');
  await current.page.getByText(info.title,{exact:true}).first().waitFor({timeout:20000});
  report.checks.realConversationVisible=true;
  const tree=current.page.getByRole('region',{name:'Arquivos',exact:true});
  for(const name of filenames) await tree.getByText(name,{exact:true}).waitFor({timeout:10000});
  report.checks.allThreeFilesVisibleInProgram=true;
  await current.page.keyboard.press('Control+j');
  assert.equal(await current.page.locator('.xterm').count(),0);
  report.checks.noInteractiveTerminal=true;
  await current.page.screenshot({path:root+'/evidencias/ia-depois-reabrir.png'});
  await fs.writeFile(root+'/evidencias/ia-conversa-depois.json',JSON.stringify(after,null,2));
  report.passed=true;
} catch(error) {report.error=String(error);process.exitCode=1;}
finally {
  report.finishedAt=new Date().toISOString();
  await fs.writeFile(root+'/evidencias/ia-reabertura.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await current.browser.close().catch(()=>{});
}
