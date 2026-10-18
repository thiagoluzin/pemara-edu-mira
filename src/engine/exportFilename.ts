/** Keep Windows file components and the complete export path reasonably short. */
export function lessonExportFilename(title:string,extension:'html'|'json',version?:number):string {
  const name=Array.from(title.normalize('NFC').trim().toLowerCase().replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/\s+/g,'-')).slice(0,70).join('').replace(/[-. ]+$/,'')||'aula';
  return `pemara-${extension==='html'?'apresentacao':'aula'}-${name}${version===undefined?'':`-v${version}`}.${extension}`;
}
