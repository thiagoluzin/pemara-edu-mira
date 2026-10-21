import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {build} from 'vite';
import {launchHeadlessChrome} from './helpers/cdpBrowser';

test('Oito correções no Chrome: prévia, cancelamento, autoria, revisão e Word legado com figuras', {timeout:180000}, async()=>{
 const evidence=path.resolve('evidencias/correcoes-oito-falhas-20261019');
 const out=path.join(evidence,'browser-dist');
 await build({build:{outDir:out,emptyOutDir:false,rolldownOptions:{input:path.resolve('test/fixtures/eight-fixes.html')}}});
 const app=express();app.use(express.static(out));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const port=(server.address() as any).port;
 const browser=await launchHeadlessChrome(9512);
 const pause=()=>new Promise(r=>setTimeout(r,100));
 const click=async(text:string)=>{assert.equal(await browser.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)return false;b.click();return true;})()`),true,`Botão ausente: ${text}`);await pause();};
 const fill=async(label:string,value:string)=>{await browser.typeText(`[aria-label="${label}"]`,value);await pause();};
 const snapshot=()=>browser.evaluate('JSON.stringify(window.auditLesson)');
 try{
  await browser.setViewport(1440,1000);await browser.navigate(`http://127.0.0.1:${port}/test/fixtures/eight-fixes.html`);
  for(let n=0;n<50&&!await browser.evaluate('!!window.auditLesson');n++)await pause();
  const before=await snapshot();assert.ok(before);
  await browser.typeText('input[placeholder^="Ex."]','Traduza toda a aula');await click('Aplicar');
  assert.equal(await snapshot(),before);assert.match(await browser.evaluate('document.body.innerText'),/Pedido não aplicado/);
  await browser.typeText('input[placeholder^="Ex."]','Troque o título para Frações na prática');await click('Aplicar');
  assert.equal(await snapshot(),before);await click('Cancelar prévia');assert.equal(await snapshot(),before);
  await click('Aplicar');await click('Aplicar comando revisado');
  assert.equal(await browser.evaluate('window.auditLesson.lesson.title'),'Frações na prática');
  const afterTitle=await snapshot();
  await click('ADICIONAR EXEMPLOS');await fill('Exemplo','Duas partes de quatro equivalem a uma parte de duas do mesmo inteiro.');await click('Conferir prévia');
  assert.equal(await snapshot(),afterTitle);await click('Cancelar');assert.equal(await snapshot(),afterTitle);
  await click('REVISAR TEXTO');await click('Conferir prévia');
  assert.match(await browser.evaluate('document.querySelector("[role=alert]").textContent'),/Nenhuma alteração/);
  await fill('Parágrafo 1 revisado','Uma de duas partes iguais corresponde a duas de quatro partes iguais do mesmo inteiro.');
  await click('Conferir prévia');assert.equal(await snapshot(),afterTitle);await click('Aplicar alteração revisada');
  assert.match(await browser.evaluate('window.auditLesson.scenes[1].content[0]'),/Uma de duas/);
  // The command and quick action share the same authorship dialog.
  await browser.typeText('input[placeholder^="Ex."]','Adicione uma pergunta');await click('Aplicar');
  await fill('Enunciado','Qual fração equivale a um meio?');
  await fill('Alternativa A','Um terço');await fill('Alternativa B','Dois quartos');await fill('Alternativa C','Três quartos');
  await fill('Justificativa','B: multiplicar numerador e denominador por dois conserva a fração. A é menor e C é maior que um meio.');
  await click('Conferir prévia');assert.match(await browser.evaluate('document.querySelector("[role=alert]").textContent'),/Selecione a alternativa correta/);
  await browser.evaluate(`(()=>{const el=document.querySelector('[aria-label="Gabarito"]');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause();
  const beforeQuiz=await snapshot();await click('Conferir prévia');assert.equal(await snapshot(),beforeQuiz);
  await browser.screenshot(path.join(evidence,'previa-questao.png'));await click('Aplicar alteração revisada');
  assert.equal(await browser.evaluate('window.auditLesson.scenes.at(-1).correct_index'),1);
  assert.equal(await browser.evaluate('window.auditLesson.scenes.length'),3);
  // A pending preview must never overwrite a newer lesson loaded by the parent.
  await browser.typeText('input[placeholder^="Ex."]','Troque o título para Prévia antiga');await click('Aplicar');
  await browser.evaluate(`window.auditReplace({...window.auditLesson,lesson:{...window.auditLesson.lesson,title:'Outra aula carregada'}})`);await pause();
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="Prévia do comando"]')`),false);
  assert.equal(await browser.evaluate('JSON.stringify(window.auditOriginal)'),before);
  const exported=await browser.evaluate('window.auditExport()');
  assert.equal(exported.preserved,true);assert.ok(exported.docx.length>15000);assert.match(exported.html,/Pré-requisitos/);assert.match(exported.standalone,/example.org\/fracoes/);
  fs.writeFileSync(path.join(evidence,'legado-com-figuras.docx'),Buffer.from(exported.docx,'base64'));
  fs.writeFileSync(path.join(evidence,'legado-professor.html'),exported.html);
  fs.writeFileSync(path.join(evidence,'browser-verificacao.json'),JSON.stringify({passed:true,originalPreserved:true,previewCancel:true,stalePreviewRemoved:true,explicitAnswerIndex:1,legacyWordBytes:Buffer.from(exported.docx,'base64').length},null,2));
 }finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
});
