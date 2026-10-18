import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import type {ExtractedMaterial} from '../../src/types/material';
export async function extractInProcess(filename:string,bytes:Buffer,options:Record<string,unknown>,signal?:AbortSignal):Promise<ExtractedMaterial>{
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pemara-extraction-'));
  let diagnostics='';
  try{
    if(signal?.aborted)throw new Error('Importação cancelada.');
    const inputPath=path.join(tmp,'source'),jobPath=path.join(tmp,'job.json'),resultPath=path.join(tmp,'result.json');
    await fs.writeFile(inputPath,bytes,{flag:'wx'});
    await fs.writeFile(jobPath,JSON.stringify({filename,inputPath,options}));
    await new Promise<void>((resolve,reject)=>{
      // Electron's executable starts another desktop instance, not a Node worker.
      // The desktop distribution supplies its bundled Node; standalone keeps Node itself.
      const executable=process.env.PEMARA_NODE_EXECUTABLE||process.execPath;
      const child=spawn(executable,['--max-old-space-size=768','--require',fileURLToPath(new URL('./no-network.cjs',import.meta.url)),'--import',import.meta.resolve('tsx'),fileURLToPath(new URL('./extractionWorker.ts',import.meta.url)),jobPath,resultPath],{windowsHide:true,stdio:['ignore','ignore','pipe']});
      child.stderr.on('data',data=>{if(diagnostics.length<4000)diagnostics+=data.toString().slice(0,4000-diagnostics.length);});
      let problem:Error|undefined;
      const stop=(message:string)=>{
        problem=new Error(message);
        if(process.platform==='win32'&&child.pid)spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
        else child.kill('SIGKILL');
      };
      const abort=()=>stop('Importação cancelada.');
      const timer=setTimeout(()=>stop('Extração excedeu cinco minutos. Selecione menos páginas.'),300000);
      signal?.addEventListener('abort',abort,{once:true});
      if(signal?.aborted)abort();
      const clear=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
      child.on('error',e=>{clear();reject(e);});
      child.on('close',()=>{clear();problem?reject(problem):resolve();});
    });
    const stat=await fs.stat(resultPath).catch(()=>null);
    if(!stat){console.error('[Material worker]',diagnostics);throw new Error('O processo local de extração foi interrompido. Tente um intervalo menor.');}
    if(stat.size>12*1024*1024)throw new Error('Extração excedeu o limite de saída.');
    const result=JSON.parse(await fs.readFile(resultPath,'utf8'));
    if(result.error)throw new Error(result.error);
    return result.material;
  }finally{await fs.rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
}
