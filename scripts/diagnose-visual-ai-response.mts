import fs from 'node:fs';import {aiSettings} from '../server/ai/settings';import {generateText} from '../server/ai/providers';import {buildVisualLessonPrompt,visualLessonIssues} from '../server/ai/visualLesson';import {validateLessonSpec} from '../src/schemas/lessonValidator';
const input={subject:'geography',grade:'8EF',topic:'Globalização e a Divisão Internacional do Trabalho',duration_minutes:45,didactic_style:'complete'};
const r=await generateText(buildVisualLessonPrompt(input),undefined,{...aiSettings.environment(),AI_TIMEOUT_MS:'120000',AI_JSON_OUTPUT:'true'});
fs.writeFileSync('docs/evidencias/teste-ia-generico/resposta-visual-v2.txt',r.text);
console.log(JSON.stringify({provider:r.provider,model:r.model,length:r.text.length,start:r.text.slice(0,100),end:r.text.slice(-140)}));
try{const p=JSON.parse(r.text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));console.log(JSON.stringify({schema:validateLessonSpec(p),quality:visualLessonIssues(p,45,'complete')}));fs.writeFileSync('docs/evidencias/teste-ia-generico/aula-visual-v2.json',JSON.stringify(p,null,2));}catch(e){console.log(e instanceof Error?e.message:'Erro JSON');}
