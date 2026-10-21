import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Never replace an existing export. A repeated bundle gets the same numeric
// suffix on all three files. Roll back only files created by this operation.
export async function writeExportBundle(directory, files, io=fs) {
  if(!Array.isArray(files)||files.length!==3||files.some(f=>!f.filename||path.basename(f.filename)!==f.filename||/[<>:"/\\|?*\x00-\x1f]/.test(f.filename))||new Set(files.map(f=>f.filename.toLowerCase())).size!==3)throw Error('Pacote de exportação inválido.');
  const root=path.resolve(directory);
  if(!(await io.stat(root)).isDirectory())throw Error('Escolha uma pasta para salvar os arquivos.');
  let destinations;
  for(let suffix=1;suffix<=1000;suffix++){
    const candidates=files.map(f=>{const ext=path.extname(f.filename);return path.join(root,suffix===1?f.filename:path.basename(f.filename,ext)+' - '+suffix+ext);});
    let occupied=false;
    for(const candidate of candidates){try{await io.lstat(candidate);occupied=true;}catch(error){if(error.code!=='ENOENT')throw error;}}
    if(!occupied){destinations=candidates;break;}
  }
  if(!destinations)throw Error('Há muitas cópias dessa aula nesta pasta. Escolha outra pasta.');
  const temporary=[],created=[];
  try{
    for(const file of files){const temp=path.join(root,'.pemara-export-'+crypto.randomUUID()+'.tmp');const handle=await io.open(temp,'wx');temporary.push(temp);try{await handle.writeFile(file.bytes);}finally{await handle.close();}}
    for(let i=0;i<files.length;i++){await io.copyFile(temporary[i],destinations[i],constants.COPYFILE_EXCL);created.push(destinations[i]);}
    return destinations;
  }catch(error){
    await Promise.all(created.map(file=>io.rm(file,{force:true})));
    throw error;
  }finally{await Promise.all(temporary.map(file=>io.rm(file,{force:true})));}
}
