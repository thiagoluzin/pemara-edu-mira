import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=path.resolve('evidencias/export-v9-20261019');fs.mkdirSync(out,{recursive:true});
const spec=JSON.parse(fs.readFileSync('evidencias/real-e2e-20261019/aula-real.json'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();await page.route('http://pemara.test/**',route=>route.fulfill(route.request().url().endsWith('module.js')?{contentType:'text/javascript',body:fs.readFileSync(path.join(out,'export-module.js'))}:{contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await page.goto('http://pemara.test/');
 const result=await page.evaluate(async spec=>{
  const {generateTeacherDocx,generatePrintDocumentHtml}=await import('/module.js');
  const teacher=generatePrintDocumentHtml(spec,{includeTeacherNotes:true});
  return{docx:Array.from(await generateTeacherDocx(spec,teacher)),student:generatePrintDocumentHtml(spec,{includeTeacherNotes:false})};
 },spec);
 fs.writeFileSync(path.join(out,'preflight-professor.docx'),Buffer.from(result.docx));
 fs.writeFileSync(path.join(out,'preflight-alunos.html'),result.student);
 const coverage=await page.evaluate(async()=>{
  const module=await import('/module.js');
  const originals=[module.TEMPLATE_GREECE_6EF,module.TEMPLATE_PROJECTILE_MOTION,module.TEMPLATE_SOLAR_SYSTEM,module.TEMPLATE_MATH_FUNCTION];
  const types=new Map(originals.flatMap(lesson=>lesson.scenes).map(scene=>[scene.type,scene]));
  types.set('biology_model',{id:'biology-export',type:'biology_model',title:'Modelo celular',params:{model:'cell_structure',cell_type:'animal'},teacher_notes:'Identificar estruturas da célula.'});
  types.set('timeline',{id:'timeline-export',type:'timeline',title:'Linha do tempo',params:{events:[{year:'2020',title:'Primeira observação',description:'Registrar o início.'},{year:'2021',title:'Comparação',description:'Comparar os resultados.'}]}});
  const lesson={...originals[0],lesson:{...originals[0].lesson,title:'Cobertura de todos os tipos de cena'},scenes:[...types.values()]};
  const data=await module.generateTeacherDocx(lesson,module.generatePrintDocumentHtml(lesson,{includeTeacherNotes:true}));
  return{types:[...types.keys()],docx:Array.from(data)};
 });
 assert.equal(coverage.types.length,11);fs.writeFileSync(path.join(out,'preflight-todos-tipos.docx'),Buffer.from(coverage.docx));fs.writeFileSync(path.join(out,'scene-coverage.json'),JSON.stringify({passed:true,types:coverage.types},null,2));
 assert.ok(!result.student.includes(spec.scenes[0].teacher_notes));
 const pdfPage=await browser.newPage();await pdfPage.setContent(result.student);await pdfPage.pdf({path:path.join(out,'preflight-alunos.pdf'),printBackground:true,preferCSSPageSize:true});
 console.log(JSON.stringify({passed:true,bytes:result.docx.length,scenes:spec.scenes.length}));
}finally{await browser.close();}
