import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import net from 'node:net';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {register} from 'tsx/esm/api';
import {OpenCode} from '../../pilotos/openchamber/source/node_modules/@opencode/client/dist/promise/index.js';
import {createLessonAdapter} from './opencode-lesson-adapter.mjs';
import {lessonPermissions,waitForLessonReply} from './free-models.mjs';
import {setTimeout as pause} from 'node:timers/promises';
register();
const {DirectChatReview}=await import('../../server/ai/directChatReview.ts');
const out=path.resolve('evidencias/revisao-chat-20261021/real-'+Date.now());fs.mkdirSync(out,{recursive:true});
const directory=path.join(out,'projeto');fs.mkdirSync(directory);
const profile=path.join(out,'perfil');fs.mkdirSync(profile);
const env={...process.env};
for(const key of Object.keys(env))if(/^(OPENCODE|OPENCHAMBER|XDG)_/i.test(key)||/(?:^|_)(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS?)(?:_|$)/i.test(key))delete env[key];
Object.assign(env,{HOME:profile,USERPROFILE:profile,XDG_CONFIG_HOME:path.join(profile,'config'),XDG_DATA_HOME:path.join(profile,'data'),XDG_STATE_HOME:path.join(profile,'state'),XDG_CACHE_HOME:path.join(profile,'cache'),OPENCODE_DISABLE_AUTOUPDATE:'true'});
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const exe=path.join(process.env.LOCALAPPDATA,'Programs/PEMARA OpenChamber/resources/opencode-cli/opencode.exe');
const password=randomBytes(32).toString('hex');env.OPENCODE_SERVER_PASSWORD=password;
const proc=spawn(exe,['serve','--hostname','127.0.0.1','--port',String(port)],{cwd:directory,env,windowsHide:true,stdio:'ignore'});
const connection={baseUrl:`http://127.0.0.1:${port}`,headers:{Authorization:'Basic '+Buffer.from('opencode:'+password).toString('base64')}};
const getConnection=async()=>connection;
const sdk=OpenCode.make({...connection,headers:{...connection.headers,'x-opencode-directory':encodeURIComponent(directory.replaceAll('\\','/'))}});
const bridge=createLessonAdapter({getConnection,directory});
const fileMode=process.argv.includes('--file');
let monitor;const report={passed:false,out,checks:{},startedAt:new Date().toISOString()};
try {
  let ready=false;for(let n=0;n<90;n++){try{await sdk.server.info({signal:AbortSignal.timeout(2000)});ready=true;break;}catch{await pause(500);}}
  assert.ok(ready,'Isolated OpenCode did not start');
  const models=await bridge.models();assert.ok(models.length,'No verified free model');report.availableModels=models;
  const model=models[0].id,[providerID,...parts]=model.split('/');
  monitor=new DirectChatReview(bridge,path.join(out,'reviews'));
  const permissions=fileMode?lessonPermissions.map(p=>['write','edit'].includes(p.action)?{...p,effect:'allow'}:p):lessonPermissions;
  const session=await sdk.session.create({title:'Teste real: aula diretamente no chat',agent:'build',location:{directory},model:{providerID,id:parts.join('/')},permissions});
  const sent=await sdk.session.prompt({sessionID:session.id,text:'Crie uma aula curta de Matemática para o 6º ano sobre frações equivalentes, com objetivo, explicação, um exemplo, uma atividade e gabarito. Máximo 350 palavras. '+(fileMode?`Use a ferramenta write para salvar o HTML completo em ${path.join(directory,'aula.html').replaceAll('\\','/')}. Sem bibliotecas externas, sem terminal. Ao concluir, responda com o link [Aula](aula.html).`:'Entregue o conteúdo pronto na resposta em Markdown. Não use ferramentas e não faça perguntas.')});
  const reply=await waitForLessonReply(sdk,session.id,sent.id,AbortSignal.timeout(240000),pause);
  assert.equal(reply.finish,'stop');report.sessionID=session.id;report.sourceReplyID=reply.id;
  await sdk.session.wait({sessionID:session.id},{signal:AbortSignal.timeout(10000)});
  await monitor.tick();
  const result=monitor.list();fs.writeFileSync(path.join(out,'reviews-result.json'),JSON.stringify(result,null,2));
  assert.equal(result.jobs.length,1,JSON.stringify(result));assert.equal(result.jobs[0].status,'completed',result.jobs[0].message);
  assert.equal(result.jobs[0].team.reviews.length,5);
  if(fileMode){assert.ok(fs.existsSync(path.join(directory,'aula.html')));assert.equal(result.jobs[0].documents.length,1);report.checks.actualHtmlFileCaptured=true;}
  assert.equal(new Set(result.jobs[0].team.reviews.map(r=>r.agent_id)).size,5);
  report.checks.realChatAndFiveIndependentReviews=true;
  const before=JSON.stringify(result.jobs);await monitor.tick();assert.equal(JSON.stringify(monitor.list().jobs),before);report.checks.noDuplicate=true;
  await monitor.stop();monitor=new DirectChatReview(createLessonAdapter({getConnection,directory}),path.join(out,'reviews'));
  await monitor.tick();assert.equal(monitor.list().jobs[0].status,'completed');report.checks.reopenPreservesReviews=true;
  const exported=await sdk.session.export({sessionID:session.id});
  const inbox=await sdk.session.inbox.list({sessionID:session.id});
  assert.equal(exported.messages.filter(m=>m.type==='synthetic'&&m.metadata?.pemaraChatReview).length+inbox.filter(item=>item.payload?.metadata?.pemaraChatReview).length,1);report.checks.receiptInOriginalChatOrInbox=true;
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally {if(monitor)await monitor.stop();proc.kill();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
