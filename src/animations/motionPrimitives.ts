import {PROCESS_CSS} from './processPrimitives';
import {PHENOMENON_MOTION_CSS} from './phenomenonMotion';
// Shared SVG/CSS motion: every animation is controlled by the lesson playback state.
export function travel(path:string,color='#fbbf24',seconds=5,radius=7,delay=0){
 return `<circle data-motion-role="particula-percurso" class="atlas-travel" r="${radius}" fill="${color}" stroke="#071529" stroke-width="2" style="offset-path:path('${path}');animation-duration:${seconds}s;animation-delay:${delay}s"/>`;
}
export function readingCue(x:number,y:number,width:number,height:number,delay=0){
 return `<rect class="atlas-cue" x="${x}" y="${y}" width="${width}" height="${height}" rx="9" fill="none" stroke="#fbbf24" stroke-width="5" style="animation-delay:${delay}s"/>`;
}
export const ATLAS_MOTION_CSS=PHENOMENON_MOTION_CSS+PROCESS_CSS+`
.atlas-travel{offset-rotate:0deg;animation:atlas-travel 5s linear infinite;animation-play-state:paused}
@keyframes atlas-travel{from{offset-distance:0%}to{offset-distance:100%}}
.atlas-cue{animation:atlas-cue 4s ease-in-out infinite;animation-play-state:paused}
@keyframes atlas-cue{0%{stroke-opacity:.3;stroke-dashoffset:0}50%{stroke-opacity:1}100%{stroke-opacity:.3;stroke-dashoffset:-80}}
.atlas-transform{animation:atlas-transform 6s linear infinite;animation-play-state:paused;transform-box:view-box;transform-origin:310px 230px}
@keyframes atlas-transform{0%{transform:translate(0,0) rotate(0deg)}70%,100%{transform:translate(var(--tx,0px),0) rotate(var(--rotation,0deg))}}
.atlas-beat{animation:atlas-beat 4s linear infinite;animation-play-state:paused}
@keyframes atlas-beat{0%,20%{fill:#fbbf24;stroke-width:7}25%,100%{fill:#102238;stroke-width:3}}
.atlas-subbeat{animation-name:atlas-subbeat}
@keyframes atlas-subbeat{0%,8%{fill:#fbbf24;stroke-width:5}10%,100%{fill:#102238;stroke-width:2}}
.learning-canvas[data-running=true] .atlas-travel,.learning-canvas[data-running=true] .atlas-cue,.learning-canvas[data-running=true] .atlas-transform,.learning-canvas[data-running=true] .atlas-beat{animation-play-state:running}
`;
