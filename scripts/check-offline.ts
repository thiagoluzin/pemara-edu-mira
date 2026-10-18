import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {extractInProcess} from '../server/materials/extractionProcess';
const require=createRequire(import.meta.url);
const dependencies=['pdfjs-dist','@napi-rs/canvas','tesseract.js','tesseract.js-core','@tesseract.js-data/por','@tesseract.js-data/eng','embedded-postgres'];
let failed=false;
for(const dependency of dependencies){try{require.resolve(dependency);console.log(`OK: ${dependency}`);}catch{failed=true;console.error(`AUSENTE: ${dependency}`);}}
for(const lang of ['por','eng']){
  try{const root=path.dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));if(!fs.existsSync(path.join(root,'4.0.0_best_int',`${lang}.traineddata.gz`)))throw new Error();console.log(`OK: idioma OCR ${lang}`);}
  catch{failed=true;console.error(`AUSENTE: idioma OCR ${lang}`);}
}
if(!failed){const r=await extractInProcess('verificacao.txt',Buffer.from('Verificação offline do computador do professor.'),{});console.log(`OK: extração isolada, rede bloqueada, ${r.sections.length} trecho.`);}
if(failed)process.exitCode=1;
