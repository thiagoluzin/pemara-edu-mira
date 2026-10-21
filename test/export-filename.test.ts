import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lessonExportFilename,lessonPrintFilename} from '../src/engine/exportFilename';
test('Windows export names are bounded, safe, and keep the type and revision',()=>{
  const filename=lessonExportFilename('Como a roupa seca? <>:"/\\|* '+ 'orientações '.repeat(200),'html');
  assert.ok(filename.length<100);assert.doesNotMatch(filename,/[<>:"/\\|?*\x00-\x1f]/);assert.match(filename,/\.html$/);
  assert.equal(lessonExportFilename('Água','json',2),'pemara-aula-água-v2.json');
  assert.equal(lessonExportFilename('Água','pdf',3),'pemara-alunos-água-v3.pdf');
  assert.equal(lessonExportFilename('Água','docx',3),'pemara-professor-água-v3.docx');
});

test('Print fallback uses a bounded Windows-safe name even for a long brief or title',()=>{
  const filename=lessonPrintFilename('Como a roupa molhada seca? '+ 'evaporação: condensação/ '.repeat(30));
  assert.ok(filename.length<100);assert.doesNotMatch(filename,/[<>:"/\\|?*\x00-\x1f]/);
  assert.match(filename,/^pemara-impressao-.+\.html$/);
  assert.equal(lessonPrintFilename('Água'),'pemara-impressao-água.html');
});
