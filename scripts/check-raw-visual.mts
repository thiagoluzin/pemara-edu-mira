import fs from 'node:fs';import {validateLessonSpec} from '../src/schemas/lessonValidator';import {visualLessonIssues} from '../server/ai/visualLesson';
const raw=fs.readFileSync('docs/evidencias/teste-ia-generico/resposta-visual-v2.txt','utf8');
try{const p=JSON.parse(raw);console.log(JSON.stringify({scenes:p.scenes.length,schema:validateLessonSpec(p),quality:visualLessonIssues(p,45,'complete')}));}catch(e){console.log(String(e));const match=String(e).match(/position (\d+)/);if(match){const n=Number(match[1]);console.log(JSON.stringify(raw.slice(n-110,n+130)));}}
