import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCurriculumTopics, resolvePackSlugForInput, isGradeCompatible, type CurriculumTopicEntry } from '../src/catalog/curriculumCatalog';
const entry = (slug:string,subject:any,year:string,title:string,keywords:string[]):CurriculumTopicEntry => ({id:slug,slug,subject,subjectLabel:'',gradeLevel:year,gradeNum:Number(year.replace('EF','')),title,keywords,bnccSkill:'',isPublished:true,statusLabel:'Publicado'});
const catalog=[entry('animals7','science','7EF','Diversidade dos seres vivos',['animais','animal','biodiversidade']),entry('systems6','science','6EF','Organização dos sistemas',['corpo','animal']),entry('fractions6','math','6EF','Números racionais',['frações']),entry('equations7','math','7EF','Equações do primeiro grau',['equação']),entry('poetry67','portuguese','67EF','Leitura de poemas',['poesia']),{...entry('draft','science','8EF','Animais em revisão',['animais']),isPublished:false}];
test('Busca qualquer assunto em outros anos sem permitir geração no ano incompatível',()=>{
 assert.deepEqual(searchCurriculumTopics('science','animais',catalog).map(e=>e.slug),['systems6','animals7']);
 assert.equal(resolvePackSlugForInput('science','6EF','Diversidade dos seres vivos',catalog),null);
 assert.equal(resolvePackSlugForInput('science','7EF','Diversidade dos seres vivos',catalog),'animals7');
 assert.equal(searchCurriculumTopics('math','equação',catalog)[0]?.gradeLevel,'7EF');
 assert.equal(searchCurriculumTopics('math','fração',catalog)[0]?.slug,'fractions6');
 assert.equal(searchCurriculumTopics('portuguese','poesia',catalog)[0]?.gradeLevel,'67EF');
 assert.equal(isGradeCompatible('7EF','67EF'),true);
 assert.equal(searchCurriculumTopics('history','animais',catalog).length,0);
 assert.equal(searchCurriculumTopics('science','assunto inexistente',catalog).length,0);
 assert.equal(searchCurriculumTopics('science',' ',catalog).length,0);
});
