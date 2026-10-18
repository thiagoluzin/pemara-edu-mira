import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {crc32} from 'node:zlib';
import {ATLAS,chooseAnimation,isAtlasKind} from '../src/animations/atlas.ts';
import {atlasSvg} from '../src/animations/atlasSvg.ts';
import {extractOfflineMaterial,manualMaterial,MaterialReadError} from '../server/materials/offlineReader.ts';
import {mergeMaterialScenes} from '../src/composer/materialScenes.ts';
import {extractInProcess} from '../server/materials/extractionProcess';
const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'fixtures');
const read=(s:string)=>fs.readFile(path.join(dir,s));

function officeZip(entries:Record<string,string>):Buffer{
 const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const [name,text] of Object.entries(entries)){
  const filename=Buffer.from(name),content=Buffer.from(text),header=Buffer.alloc(30),directory=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc32(content),14);header.writeUInt32LE(content.length,18);header.writeUInt32LE(content.length,22);header.writeUInt16LE(filename.length,26);
  directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt32LE(crc32(content),16);directory.writeUInt32LE(content.length,20);directory.writeUInt32LE(content.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
  local.push(header,filename,content);central.push(directory,filename);offset+=header.length+filename.length+content.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,directory,end]);
}

test('PPTX respeita ordem da apresentação e relacionamento de notas, não o nome dos arquivos',async()=>{
 const slide=(text:string)=>`<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`;
 const zip=officeZip({'ppt/presentation.xml':'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="2" r:id="r2"/><p:sldId id="1" r:id="r1"/></p:sldIdLst></p:presentation>',
  'ppt/_rels/presentation.xml.rels':'<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>',
  'ppt/slides/slide1.xml':slide('Segundo na apresentação'),'ppt/slides/slide2.xml':slide('Primeiro na apresentação'),
  'ppt/slides/_rels/slide2.xml.rels':"<Relationships><Relationship Id='note' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide' Target='../notesSlides/notesSlide7.xml'/></Relationships>",
  'ppt/notesSlides/notesSlide7.xml':slide('Nota do primeiro slide')});
 const r=await extractOfflineMaterial('reordenada.pptx',zip);
 assert.deepEqual(r.sections.map(s=>[s.sourceLabel,s.text]),[['Slide 1','Primeiro na apresentação'],['Notas do slide 1','Nota do primeiro slide'],['Slide 2','Segundo na apresentação']]);
});

test('Office corrompido e entidades externas são rejeitados; cancelamento encerra a extração',async()=>{
 const xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Texto correto</w:t></w:r></w:p></w:document>';
 const zip=officeZip({'word/document.xml':xml});zip[zip.indexOf('Texto correto')]=65;
 await assert.rejects(()=>extractOfflineMaterial('corrompido.docx',zip),/Integridade/);
 await assert.rejects(()=>extractOfflineMaterial('entidade.docx',officeZip({'word/document.xml':'<!DOCTYPE x [<!ENTITY x SYSTEM "https://example.invalid">]>'+xml})),/externas/);
 const pdf=await read('apostila.pdf'),abort=new AbortController(),timer=setTimeout(()=>abort.abort(),100);
 try{await assert.rejects(()=>extractInProcess('cancelado.pdf',pdf,{},abort.signal),/cancelada/);}finally{clearTimeout(timer);}
});

test('26 motores sem internet: variações sem valores inválidos nem HTML executável',()=>{
 assert.equal(ATLAS.length,26);
 for(const p of ATLAS){
   assert.ok(p.caption.length>45&&p.variants.length>=2,p.id);
   assert.ok(isAtlasKind(p.id));
   for(let v=0;v<p.variants.length;v++){
     const html=atlasSvg(p.id,v,v);
     assert.ok(html.includes('<svg')&&html.includes('</svg>'),p.id);
     assert.ok(!/NaN|undefined|<script|onerror=|javascript:/i.test(html),p.id);
   }
 }
});
test('Disciplinas não recebem animações de assuntos alheios',()=>{
 assert.equal(chooseAnimation('science','Sistema digestório')?.id,'digestive');
 assert.equal(chooseAnimation('math','Sistema digestório'),null);
 assert.equal(chooseAnimation('history','Fontes históricas')?.id,'sources');
 assert.equal(chooseAnimation('math','Plano cartesiano')?.id,'coordinates');
 assert.equal(chooseAnimation('portuguese','Tese e argumentos')?.id,'argument');
 assert.equal(chooseAnimation('science','Oceano e atmosfera'),null);
});
test('Importação Word extrai texto inclusive em tabela e conserva origem',async()=>{
 const r=await extractOfflineMaterial('apostila.docx',await read('apostila.docx'));
 assert.equal(r.format,'docx');assert.ok(r.text.includes('fotossíntese'));assert.ok(r.text.includes('Exemplo em tabela'));
 assert.ok(r.sections.some(s=>s.sourceLabel==='Parágrafo 3'));
});
test('Importação PowerPoint identifica cada slide e notas',async()=>{
 const r=await extractOfflineMaterial('aula.pptx',await read('aula.pptx'));
 assert.ok(r.sections.some(s=>s.sourceLabel==='Slide 2'));
 assert.ok(r.sections.some(s=>s.sourceLabel==='Notas do slide 2'));
});
test('TXT, escrita manual e validação de extensão',async()=>{
 const r=await extractOfflineMaterial('planejamento.txt',await read('planejamento.txt'));
 assert.ok(r.text.includes('filtração')); assert.equal(r.sections.length,3);
 assert.equal(manualMaterial('Aula escrita pelo professor.').format,'manual');
 await assert.rejects(()=>extractOfflineMaterial('malware.exe',Buffer.from('x')),(e:any)=>e instanceof MaterialReadError&&e.code==='UNSUPPORTED_FORMAT');
});
test('PDF pesquisável preserva número de página sem ferramenta externa',async()=>{
 const r=await extractOfflineMaterial('apostila.pdf',await read('apostila.pdf'));
 assert.ok(r.text.includes('Sistema digestorio'));
 assert.ok(r.sections.some(s=>s.sourceLabel==='Página 2'));
});
test('Trechos literais do professor entram após abertura, conservando a fonte',()=>{
 const lesson:any={schema_version:'1.0',lesson_version:1,renderer_version:'0.3.0',lesson:{topic:'fotossíntese',title:'Fotossíntese'},objectives:['Examinar'],scenes:[{id:'opening',title:'Introdução',type:'title'},{id:'end',title:'Síntese',type:'summary',takeaways:['Resumo']}]};
 const r=mergeMaterialScenes(lesson,'【Apostila.pdf · Página 4】\nFotossíntese e luz solar.\n\n【Texto do professor】\nO experimento deve ser explicado.');
 assert.ok(r.included>=1);
 assert.equal(r.lesson.scenes[1].source_citation,'Apostila.pdf · Página 4');
  assert.equal(r.lesson.scenes[1].type,'text');
  if(r.lesson.scenes[1].type!=='text')throw new Error('Cena de texto esperada');
  assert.equal(r.lesson.scenes[1].content[0],'Fotossíntese e luz solar.');
 assert.equal(lesson.scenes.length,2,'original não pode ser alterado');
});
