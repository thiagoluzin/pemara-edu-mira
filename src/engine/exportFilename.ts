/** Keep Windows file components and the complete export path reasonably short. */
export function lessonExportFilename(title:string,extension:'html'|'json'|'pdf'|'docx',version?:number):string {
  const name=Array.from(title.normalize('NFC').trim().toLowerCase().replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/\s+/g,'-')).slice(0,70).join('').replace(/[-. ]+$/,'')||'aula';
  const kind={html:'apresentacao',json:'aula',pdf:'alunos',docx:'professor'}[extension];
  return `pemara-${kind}-${name}${version===undefined?'':`-v${version}`}.${extension}`;
}

export function lessonPrintFilename(title:string):string {
  return lessonExportFilename(title,'html').replace(/^pemara-apresentacao-/, 'pemara-impressao-');
}
