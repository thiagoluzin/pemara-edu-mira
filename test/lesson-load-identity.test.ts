import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lessonsApi} from '../src/services/lessonsApi';

test('Reabrir primeira versão usa o ID persistido para autosave e publicação, inclusive com rascunho antigo',async()=>{
  const originalFetch=globalThis.fetch;
  const data={lesson:{id:'lesson-persisted'},currentVersion:1,
    currentSpec:{lesson:{id:'composer-temporary',title:'Aula preservada'},scenes:[{id:'original'}]},
    draft:{draft_spec_json:{lesson:{id:'composer-temporary',title:'Edição preservada'},scenes:[{id:'edited'}]},base_version:1}};
  globalThis.fetch=async()=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  try {
    const loaded=await lessonsApi.getLesson('lesson-persisted');
    assert.equal(loaded.currentSpec.lesson.id,'lesson-persisted');
    assert.equal(loaded.draft!.draft_spec_json.lesson.id,'lesson-persisted');
    assert.equal(loaded.draft!.draft_spec_json.lesson.title,'Edição preservada');
    assert.deepEqual(loaded.draft!.draft_spec_json.scenes,[{id:'edited'}]);
    assert.equal(data.currentSpec.lesson.id,'composer-temporary');
  } finally {globalThis.fetch=originalFetch;}
});
