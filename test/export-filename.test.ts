import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lessonExportFilename} from '../src/engine/exportFilename';
test('Windows export names are bounded, safe, and keep the type and revision',()=>{
  const filename=lessonExportFilename('Como a roupa seca? <>:"/\\|* '+ 'orientações '.repeat(200),'html');
  assert.ok(filename.length<100);assert.doesNotMatch(filename,/[<>:"/\\|?*\x00-\x1f]/);assert.match(filename,/\.html$/);
  assert.equal(lessonExportFilename('Água','json',2),'pemara-aula-água-v2.json');
});
