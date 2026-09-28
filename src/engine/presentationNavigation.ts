import type {LessonMeta, Scene} from '../types/lesson';
import {createLearningPlan, isLearningScene} from './learningVisual';
import {BIOLOGY_STEPS} from './biologyModel';

export interface PresentationStep { value:number; onChange:(step:number)=>void }
export function sceneStepCount(scene:Scene, lesson?:LessonMeta):number {
  if(isLearningScene(scene)) return createLearningPlan(scene,lesson).steps.length;
  if(scene.type==='biology_model') return BIOLOGY_STEPS[scene.params.model].length;
  return 1;
}
export function movePresentation(counts:number[], cursor:{page:number;step:number}, direction:1|-1) {
  const {page,step}=cursor;
  if(direction===1) {
    if(step<counts[page]-1) return {page,step:step+1};
    if(page<counts.length-1) return {page:page+1,step:0};
  } else {
    if(step>0) return {page,step:step-1};
    if(page>0) return {page:page-1,step:counts[page-1]-1};
  }
  return cursor;
}
