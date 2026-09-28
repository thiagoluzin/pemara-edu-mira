import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
const key=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',"$s=Get-Content -LiteralPath $env:PEMARA_TYPESAFE_SECRET -Raw | ConvertTo-SecureString; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}"],{env:{...process.env,PEMARA_TYPESAFE_SECRET:path.join(os.homedir(),'.codex/secrets/typesafe-api-key.dpapi')},encoding:'utf8',windowsHide:true}).trim();
const lesson=JSON.parse(fs.readFileSync('docs/evidencias/teste-ia-generico/aula-melhorada.json','utf8'));
const state={scenes:lesson.scenes};
const questions=Object.fromEntries(lesson.scenes.filter((s:any)=>s.visual).flatMap((s:any)=>[
 [s.id+'_alignment',{type:'noul',instructions:`For scene ${s.id} in state.scenes, do any visual node labels contradict, fail to be explained by, or point to a materially different topic than their assigned content/takeaways[step]? Judge semantic alignment, not layout attractiveness.`}],
 [s.id+'_relation',{type:'noul',instructions:`For scene ${s.id} in state.scenes, does its visual assert an unsupported causal cycle, hierarchy, or directed relationship rather than faithfully explaining its supplied text? A sequence of activity instructions is not a hierarchy.`}]
]));
const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:'jev-1.13.0',state,questions}),signal:AbortSignal.timeout(60000)});
if(!response.ok)throw Error('TypeSafe HTTP '+response.status);
const result=await response.json();fs.writeFileSync('docs/evidencias/teste-ia-generico/revisao-jev-visual-v2.json',JSON.stringify(result,null,2));console.log(JSON.stringify({model:result.model,answers:result.answers},null,2));
