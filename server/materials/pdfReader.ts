import path from 'node:path';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import {createWorker, type Worker} from 'tesseract.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {MaterialSection} from '../../src/types/material';
const require=createRequire(import.meta.url);
const pdfRoot=path.dirname(require.resolve('pdfjs-dist/package.json'));
export interface PdfOptions {pageStart?:number;pageEnd?:number;maxPdfPages?:number;maxOcrPages?:number}

/** Fonts, CMaps, WASM and languages come exclusively from the installed packages. */
export async function readPdf(bytes:Buffer,options:PdfOptions={}){
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:false,
    cMapUrl:path.join(pdfRoot,'cmaps').replaceAll('\\','/')+'/',cMapPacked:true,
    standardFontDataUrl:path.join(pdfRoot,'standard_fonts').replaceAll('\\','/')+'/',
    wasmUrl:path.join(pdfRoot,'wasm').replaceAll('\\','/')+'/',verbosity:0});
  let ocr:Worker|undefined;
  let languageDir:string|undefined;
  try{
    const pdf=await loading.promise;
    const start=options.pageStart??1,requestedEnd=options.pageEnd??pdf.numPages;
    if(!Number.isInteger(start)||start<1||start>pdf.numPages||!Number.isInteger(requestedEnd)||requestedEnd<start)throw new Error('Intervalo de páginas inválido para este PDF.');
    const end=Math.min(pdf.numPages,requestedEnd,start+(options.maxPdfPages??100)-1);
    const warnings:string[]=[],sections:MaterialSection[]=[];
    if(end<Math.min(pdf.numPages,requestedEnd))warnings.push(`Extração limitada às páginas ${start} a ${end}. Importe outro intervalo para continuar.`);
    let attempts=0,ocrUsed=false,missing=0,chars=0,truncated=end<Math.min(pdf.numPages,requestedEnd);
    for(let number=start;number<=end;number++){
      const page=await pdf.getPage(number);
      try{
        const content=await page.getTextContent();
        let text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim();
        if(text.length<25){
          if(attempts<(options.maxOcrPages??12)){
            attempts++;
            try{
              if(!ocr){
                languageDir=await fs.mkdtemp(path.join(os.tmpdir(),'pemara-ocr-'));
                await Promise.all(['por','eng'].map(async code=>{
                  const dir=path.dirname(require.resolve(`@tesseract.js-data/${code}/package.json`));
                  await fs.copyFile(path.join(dir,'4.0.0_best_int',`${code}.traineddata.gz`),path.join(languageDir!,`${code}.traineddata.gz`));
                }));
                ocr=await createWorker('por+eng',1,{cacheMethod:'none',gzip:true,langPath:languageDir,logger:()=>{},errorHandler:()=>{}});
              }
              const natural=page.getViewport({scale:1});
              const viewport=page.getViewport({scale:Math.min(2.5,2000/Math.max(natural.width,natural.height))});
              const factory=pdf.canvasFactory as {create:(w:number,h:number)=>{canvas:any;context:any};destroy:(surface:unknown)=>void};
              const surface=factory.create(Math.ceil(viewport.width),Math.ceil(viewport.height));
              try{
                await page.render({canvasContext:surface.context,viewport,canvas:surface.canvas}).promise;
                const result=await ocr.recognize(surface.canvas.toBuffer('image/png'));
                if(result.data.text.trim().length>text.length)text=result.data.text.trim();
                ocrUsed=true;
              }finally{factory.destroy(surface);}
            }catch{warnings.push(`Página ${number}: OCR não concluído. Confira o original.`);}
          }else{missing++;}
        }
        if(text){sections.push({sourceUnit:'pagina',sourceIndex:number,sourceLabel:`Página ${number}`,text});chars+=text.length;}
        else warnings.push(`Página ${number}: nenhum texto recuperado.`);
        if(chars>=700000){truncated=true;warnings.push('Limite de texto atingido. Importe um intervalo menor.');break;}
      }finally{page.cleanup();}
    }
    if(missing)warnings.push(`Limite de 12 tentativas de OCR atingido; ${missing} páginas precisam de nova importação por intervalo.`);
    return {sections,ocrUsed,warnings,truncated:truncated||missing>0};
  }finally{if(ocr)await ocr.terminate();await loading.destroy();if(languageDir)await fs.rm(languageDir,{recursive:true,force:true});}
}
