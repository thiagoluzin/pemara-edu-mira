import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasLesson } from '../src/components/AtlasLibrary';
import { ATLAS } from '../src/animations/atlas';
import { validateLessonSpec } from '../src/schemas/lessonValidator';
test('every Atlas library choice creates an independent, valid editable lesson', () => {
  for (const id of [...ATLAS.map(model => model.id), 'movement']) {
    const first = atlasLesson(id), second = atlasLesson(id);
    assert.notEqual(first.lesson.id, second.lesson.id);
    const result = validateLessonSpec(first);
    assert.equal(result.isValid, true, id + ': ' + result.errors.join('; '));
    assert.equal(first.scenes[1].type, 'text');
    first.scenes[1].title = 'Changed by teacher';
    assert.notEqual(second.scenes[1].title, first.scenes[1].title);
  }
});
