export type ExportFormat='html'|'json'|'pdf'|'docx';
export type ExportRequest={format:ExportFormat;filename:string;data:string|Uint8Array};
declare global {
  interface Window {pemaraExports?:{save:(request:ExportRequest)=>Promise<{canceled:boolean;path?:string}>;saveBundle?:(requests:ExportRequest[])=>Promise<{canceled:boolean;directory?:string;paths?:string[]}>};}
}
export async function saveExportBundle(requests:ExportRequest[]):Promise<string> {
  if(!window.pemaraExports?.saveBundle)throw Error('Abra o PEMARA EDU atualizado para salvar os três formatos juntos.');
  const result=await window.pemaraExports.saveBundle(requests);
  return result.canceled?'Exportação cancelada.':`3 arquivos salvos em ${result.directory}`;
}
export async function saveExport(request:ExportRequest):Promise<string> {
  if(window.pemaraExports){
    const result=await window.pemaraExports.save(request);
    return result.canceled?'Exportação cancelada.':`Salvo em ${result.path}`;
  }
  if(request.format==='pdf'){
    const popup=window.open('','_blank');
    if(!popup)throw Error('Permita a janela de impressão para salvar o PDF.');
    popup.document.write(request.data as string);popup.document.close();
    popup.onload=()=>popup.print();
    return 'Na janela de impressão, escolha Salvar como PDF.';
  }
  const types={html:'text/html;charset=utf-8',json:'application/json',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
  const data=typeof request.data==='string'?request.data:new Uint8Array(request.data).buffer;
  const url=URL.createObjectURL(new Blob([data],{type:types[request.format]}));
  const link=document.createElement('a');link.href=url;link.download=request.filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  return 'Arquivo enviado aos downloads do navegador.';
}
