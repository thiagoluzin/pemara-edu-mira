import fs from 'node:fs/promises';
import {extractOfflineMaterial,MaterialReadError} from './offlineReader';
const [jobPath,resultPath]=process.argv.slice(2);
try{
  const job=JSON.parse(await fs.readFile(jobPath,'utf8'));
  const material=await extractOfflineMaterial(job.filename,await fs.readFile(job.inputPath),job.options);
  await fs.writeFile(resultPath,JSON.stringify({material}));
}catch(error){
  await fs.writeFile(resultPath,JSON.stringify({error:error instanceof Error?error.message:'Falha na extração.',code:error instanceof MaterialReadError?error.code:'EXTRACTION_FAILED'}));
  process.exitCode=1;
}
