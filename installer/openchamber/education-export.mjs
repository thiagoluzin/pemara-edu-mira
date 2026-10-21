import {BrowserWindow, dialog, session} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {writeExportBundle} from './export-bundle-files.mjs';

const descriptions={html:'Apresentação HTML animada',json:'Cópia da aula',pdf:'Documento PDF',docx:'Documento Word editável'};
export function validateExport(request) {
  if (!request || !Object.hasOwn(descriptions,request.format) || typeof request.filename!=='string' ||
      path.basename(request.filename)!==request.filename || /[<>:"/\\|?*\x00-\x1f]/.test(request.filename) ||
      request.filename.length>180 || !request.filename.endsWith('.'+request.format)) throw Error('Formato de exportação inválido.');
  const binary=request.format==='docx';
  if (binary ? !(request.data instanceof Uint8Array) : typeof request.data!=='string') throw Error('Conteúdo de exportação inválido.');
  if (!request.data.length || request.data.length>32*1024*1024) throw Error('O arquivo excede o tamanho permitido para exportação.');
}

// Render only an in-memory document, with scripts, external resources and navigation disabled.
async function pdfBytes(html) {
  const isolated=session.fromPartition('pemara-pdf-'+crypto.randomUUID());
  isolated.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('data:')}));
  isolated.setPermissionRequestHandler((_wc,_permission,done)=>done(false));
  const view=new BrowserWindow({show:false,webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false}});
  view.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  view.webContents.on('will-navigate',event=>event.preventDefault());
  try {
    const policy='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src data:">';
    await view.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html.replace(/<head>/i,'<head>'+policy)));
    return await view.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,pageSize:'A4'});
  } finally {view.destroy();isolated.webRequest.onBeforeRequest(null);await isolated.clearStorageData();}
}

export async function saveEducationExport(win, request, defaultDirectory) {
  validateExport(request);
  await fs.mkdir(defaultDirectory,{recursive:true});
  const choice=await dialog.showSaveDialog(win,{
    title:'Salvar como — '+descriptions[request.format],
    defaultPath:path.join(defaultDirectory,request.filename),
    filters:[{name:descriptions[request.format],extensions:[request.format]}],
    properties:['showOverwriteConfirmation','createDirectory'],
  });
  if(choice.canceled || !choice.filePath)return{canceled:true};
  const destination=choice.filePath.toLowerCase().endsWith('.'+request.format)?choice.filePath:choice.filePath+'.'+request.format;
  // The dialog confirms replacement of the exact selected path; never silently overwrite an appended path.
  if(destination!==choice.filePath){try{await fs.access(destination);throw Error('Esse arquivo já existe. Escolha o nome completo com a extensão na janela Salvar como.');}catch(error){if(error.code!=='ENOENT')throw error;}}
  const bytes=request.format==='pdf'?await pdfBytes(request.data):Buffer.from(request.data);
  const temporary=path.join(path.dirname(destination),'.pemara-export-'+crypto.randomUUID()+'.tmp');
  try{await fs.writeFile(temporary,bytes,{flag:'wx'});await fs.rename(temporary,destination);}
  finally{await fs.rm(temporary,{force:true});}
  return{canceled:false,path:destination};
}

export async function saveEducationBundle(win, requests, defaultDirectory) {
  if(!Array.isArray(requests)||requests.length!==3||requests.map(r=>r?.format).sort().join(',')!=='docx,html,pdf')throw Error('Selecione o pacote HTML, PDF e Word.');
  requests.forEach(validateExport);
  await fs.mkdir(defaultDirectory,{recursive:true});
  const choice=await dialog.showOpenDialog(win,{
    title:'Escolher pasta — HTML, PDF e Word',buttonLabel:'Salvar os três arquivos aqui',
    defaultPath:defaultDirectory,properties:['openDirectory','createDirectory'],
  });
  if(choice.canceled||!choice.filePaths?.length)return{canceled:true};
  const directory=choice.filePaths[0];
  const files=[];
  for(const request of requests)files.push({filename:request.filename,bytes:request.format==='pdf'?await pdfBytes(request.data):Buffer.from(request.data)});
  const paths=await writeExportBundle(directory,files);
  return{canceled:false,directory,paths};
}
