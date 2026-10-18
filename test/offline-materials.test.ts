import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import express from 'express';
import {createCanvas} from '@napi-rs/canvas';
import {ATLAS} from '../src/animations/atlas';
import {TRANSFORMATION_BASE,transformedTriangle} from '../src/animations/atlasSvg';
import {createLearningPlan,learningDiagram} from '../src/engine/learningVisual';
import {mergeSelectedMaterials,splitMaterialText,mergeMaterialScenes} from '../src/composer/materialScenes';
import {extractInProcess} from '../server/materials/extractionProcess';
import {createMaterialsRouter} from '../server/routes/materials';
import {createDisposablePostgres} from './helpers/realPostgresHarness';
import {runMigrations,getAvailableMigrations} from '../server/db/migrator';
import {UserRepository} from '../server/repositories/userRepository';
import {exportDatabase,importDatabase} from '../server/db/backup';
import {TEMPLATE_SOLAR_SYSTEM} from '../src/templates/deterministicTemplates';
import {generateStandaloneHtml,renderAllScenesForPrint} from '../src/components/ExportModal';
import type {MaterialSelection} from '../src/types/material';

test('Atlas: todos os perfis chegam ao fluxo integrado nas disciplinas declaradas',()=>{
  let count=0;
  for(const p of ATLAS)for(const subject of p.subjects){
    const scene:any={id:'atlas',type:'text',title:p.keywords[0],content:[p.keywords[0]]};
    const plan=createLearningPlan(scene,{subject:subject as any});assert.equal(plan.kind,p.id,`${p.id}/${subject}`);
    for(let variant=0;variant<p.variants.length;variant++)assert.ok(learningDiagram(plan,0,variant).includes('<svg'));
    count++;
  }
  assert.equal(count,46);
  const scene:any={id:'custom',type:'text',title:'Tema livre',content:['Explicação'],atlas_model:'coordinates'};
  assert.equal(createLearningPlan(scene,{subject:'math'}).kind,'coordinates');
  assert.equal(createLearningPlan({...scene,atlas_model:'none'},{subject:'math'}).kind,'concepts');
});
test('Geometria: isometrias preservam medidas e reflexão coincide com x=310',()=>{
  const distances=(points:readonly (readonly number[])[])=>points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%3][0],p[1]-points[(i+1)%3][1]));
  const original=distances(TRANSFORMATION_BASE);
  for(let v=0;v<3;v++)distances(transformedTriangle(v)).forEach((d,i)=>assert.ok(Math.abs(d-original[i])<1e-9));
  transformedTriangle(2).forEach(([x,y],i)=>{assert.equal((x+TRANSFORMATION_BASE[i][0])/2,310);assert.equal(y,TRANSFORMATION_BASE[i][1]);});
});
test('Composição: origem e texto completos, limite explícito, exportação com fonte',()=>{
  const text='Primeiro parágrafo.\n\nSegundo parágrafo com espaços  preservados. '+('Água e energia. '.repeat(40));
  assert.equal(splitMaterialText(text).join(''),text);
  const selection:MaterialSelection={materialId:'a',filename:'apostila.pdf',sourceUnit:'pagina',sourceIndex:4,sourceLabel:'Página 4',text};
  const result=mergeSelectedMaterials(TEMPLATE_SOLAR_SYSTEM,[selection],{maxScenes:8,position:'before-summary'});
  const scenes=result.lesson.scenes.filter(s=>s.material_source);
  assert.equal(scenes.map(s=>s.type==='text'?s.content.join(''):'').join(''),text);
  assert.ok(scenes.every(s=>s.source_citation==='apostila.pdf · Página 4'));
  assert.throws(()=>mergeSelectedMaterials(TEMPLATE_SOLAR_SYSTEM,[selection],{maxScenes:1,position:'after-opening'}),/precisam/);
  assert.ok(generateStandaloneHtml(result.lesson).includes('apostila.pdf'));
  assert.ok(renderAllScenesForPrint(result.lesson).includes('Fonte: apostila.pdf'));
  const legacy=mergeMaterialScenes(TEMPLATE_SOLAR_SYSTEM,'【Livro.pdf · Página 2】\nUm parágrafo.\n\nOutro parágrafo.');
  assert.ok(legacy.lesson.scenes.filter(s=>s.material_source).every(s=>s.source_citation==='Livro.pdf · Página 2'));
});

function scannedPdf():Buffer{
  const canvas=createCanvas(1200,500),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,500);ctx.fillStyle='black';ctx.font='48px Arial';ctx.fillText('Escola: fotossíntese e energia solar.',40,110);ctx.fillText('Atividade número 42 para a turma.',40,210);
  const jpeg=canvas.toBuffer('image/jpeg');
  const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 250] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>'),Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1200 /Height 500 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,Buffer.from('\nendstream')])];
  const draw='q 600 0 0 250 0 0 cm /Im1 Do Q';objects.push(Buffer.from(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
  let pdf=Buffer.from('%PDF-1.4\n'),offsets=[0];
  objects.forEach((o,i)=>{offsets.push(pdf.length);pdf=Buffer.concat([pdf,Buffer.from(`${i+1} 0 obj\n`),o,Buffer.from('\nendobj\n')]);});
  const xref=pdf.length;return Buffer.concat([pdf,Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)]);
}
test('PDF textual, intervalo e OCR em português funcionam em processo com rede bloqueada',async()=>{
  const bytes=await fs.readFile('test/fixtures/apostila.pdf');
  const text=await extractInProcess('aula.pdf',bytes,{pageStart:2,pageEnd:2});
  assert.deepEqual(text.sections.map(s=>s.sourceIndex),[2]);
  const scan=await extractInProcess('digitalizado.pdf',scannedPdf(),{});
  assert.equal(scan.ocrUsed,true,scan.warnings.join(' '));assert.match(scan.text,/fotoss[ií]ntese/i);assert.match(scan.text,/42/);
});
test('API: autenticação, isolamento, original intacto, reinício do router e backup/restauração',async()=>{
  const db=await createDisposablePostgres('pemara-materials-'),pool=db.createPool();let server:ReturnType<ReturnType<typeof express>['listen']>|undefined;
  try{
    await runMigrations(pool);
    for(const migration of getAvailableMigrations())await pool.query('UPDATE schema_migrations SET checksum=$1 WHERE version=$2',[migration.windowsChecksum,migration.version]);
    assert.equal((await runMigrations(pool)).appliedCount,0,'Banco Windows anterior aceita apenas mudança de fim de linha');
    const users=new UserRepository(pool);
    const owner=await users.create({username:'owner',name:'Professor',email:'owner@example.invalid',password_hash:'test',role:'teacher'});
    const other=await users.create({username:'other',name:'Outro',email:'other@example.invalid',password_hash:'test',role:'teacher'});
    const app=express();app.use((req,_res,next)=>{const id=req.headers['x-test-user'];if(id===owner.id)req.user=owner as any;else if(id===other.id)req.user=other as any;next();});app.use('/api/materials',createMaterialsRouter(pool));
    server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));const url=`http://127.0.0.1:${(server.address() as any).port}/api/materials`;
    assert.equal((await fetch(url)).status,401);
    const bytes=Buffer.from('Fotossíntese e luz solar.\n\nA água participa do processo.');
    const headers={'x-test-user':owner.id,'Content-Type':'application/octet-stream','X-Filename':encodeURIComponent('Aula própria.txt')};
    const response=await fetch(url+'/extract',{method:'POST',headers,body:bytes});assert.equal(response.status,200,await response.clone().text());
    const {material}=await response.json();assert.equal(material.sha256,createHash('sha256').update(bytes).digest('hex'));
    assert.equal((await fetch(`${url}/${material.id}`,{headers:{'x-test-user':other.id}})).status,404);
    const download=await fetch(`${url}/${material.id}/original`,{headers:{'x-test-user':owner.id}});assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
    const badOrigin=await fetch(url+'/extract',{method:'POST',headers:{...headers,Origin:'https://unrelated.invalid'},body:bytes});assert.equal(badOrigin.status,403);
    const backup=await exportDatabase(pool);assert.equal(backup.table_counts.teacher_materials,1);
    await pool.query('DELETE FROM teacher_materials');await importDatabase(pool,backup,{confirmDestructiveRestore:true});
    const restored=await fetch(`${url}/${material.id}/original`,{headers:{'x-test-user':owner.id}});assert.deepEqual(Buffer.from(await restored.arrayBuffer()),bytes);
    // A fresh router has no in-memory material dependency.
    const second=express();second.use((req,_res,next)=>{req.user=owner as any;next();});second.use('/api/materials',createMaterialsRouter(pool));
    await new Promise<void>(r=>server!.close(()=>r()));server=second.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));
    const listed=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/materials`);assert.equal((await listed.json()).materials[0].id,material.id);
  }finally{if(server)await new Promise<void>(r=>server!.close(()=>r()));await db.cleanup();}
});
