// Keep playback tied to the animated elements actually present in this frame.
export const LEARNING_MOTION_CLASSES = ['atlas-lab-motion','atlas-draw','atlas-process','atlas-process-flow','phenomenon-motion','semantic-highlight','learning-trace','learning-particle','learning-flow','learning-orbit','bio-molecule','bio-heart','atlas-travel','atlas-cue','atlas-transform','atlas-beat'];
export function hasLearningMotion(markup:string):boolean {
  return [...markup.matchAll(/class="([^"]*)"/g)].some(match=>match[1].split(/\s+/).some(name=>LEARNING_MOTION_CLASSES.includes(name)));
}
