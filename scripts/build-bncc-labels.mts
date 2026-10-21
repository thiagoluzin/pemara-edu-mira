import fs from 'node:fs';
import {getOfficialBnccSkills} from './compilar-acervo-bncc';
const official=new Map(getOfficialBnccSkills().map(s=>[s.code,s.description]));
const files=['src/catalog/pilotCatalog.ts','src/catalog/curriculumCatalog.ts','src/knowledge/packs/history6Greece.ts'];
const codes=[...new Set(files.flatMap(file=>[...fs.readFileSync(file,'utf8').matchAll(/(?:bncc(?:Skill|_skill):\s*'|bnccLabel\(')(EF\d{2}[A-Z]{2}\d{2})/g)].map(m=>m[1])))].sort();
const data=Object.fromEntries(codes.map(code=>{const text=official.get(code);if(!text)throw Error('Código ausente: '+code);return [code,text];}));
const filename='src/catalog/bnccLabels.json',text=JSON.stringify(data,null,2)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync(filename,'utf8')!==text)throw Error('Descritores BNCC precisam ser atualizados a partir da fonte oficial.');}
else fs.writeFileSync(filename,text);
console.log(`${codes.length} descritores conferidos com a fonte oficial local.`);
