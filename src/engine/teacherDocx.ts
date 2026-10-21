import {Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun} from 'docx';
import type {LessonSpec} from '../types/lesson';
import {label,gradeLabel} from '../ui/labels';
import {lessonObjectives,referenceKindLabel} from '../education/lessonContext';

const clean=(text:string)=>text.replace(/\s+/g,' ').trim();
const paragraph=(text:string)=>new Paragraph({text,spacing:{after:120}});

/** Reuse the print renderer for full scene coverage; text and tables remain native Word objects. */
export async function generateTeacherDocx(lesson:LessonSpec, printHtml:string):Promise<Uint8Array> {
  const objectives=lessonObjectives(lesson);
  const dom=new DOMParser().parseFromString(printHtml,'text/html');
  const css=Array.from(dom.querySelectorAll('style')).map(s=>s.textContent).join('\n');
  async function figure(svg:Element):Promise<Paragraph> {
    const copy=svg.cloneNode(true) as Element;
    const box=(copy.getAttribute('viewBox')||'0 0 540 300').split(/[\s,]+/).map(Number);
    const maxHeight=Number(copy.getAttribute('style')?.match(/max-height:\s*(\d+)px/)?.[1]||400);
    const width=540,height=Math.min(maxHeight,Math.max(80,width*(box[3]||300)/(box[2]||540)));
    copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',String(width*2));copy.setAttribute('height',String(height*2));
    copy.removeAttribute('style');
    const style=dom.createElementNS('http://www.w3.org/2000/svg','style');style.textContent=css+'\n*{animation:none!important;transition:none!important}';copy.prepend(style);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));
    try{
      const image=new Image();image.src=url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;
      const context=canvas.getContext('2d');if(!context)throw Error('Não foi possível preparar as figuras do Word.');
      context.fillStyle=svg.closest('.bio-model')?'#020617':svg.closest('[style*="background:#0b1224"]')?'#0b1224':'#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Falha ao converter figura.')),'image/png'));
      return new Paragraph({children:[new ImageRun({type:'png',data:new Uint8Array(await blob.arrayBuffer()),transformation:{width,height}})],spacing:{before:120,after:120}});
    }finally{URL.revokeObjectURL(url);}
  }
  type Block=Paragraph|Table;
  async function blocks(parent:Element):Promise<Block[]> {
    const result:Block[]=[];let inline='';
    const flush=()=>{if(clean(inline))result.push(paragraph(clean(inline)));inline='';};
    for(const node of Array.from(parent.childNodes)){
      if(node.nodeType===3){inline+=node.textContent;continue;}
      if(!(node instanceof Element))continue;
      const tag=node.tagName.toLowerCase();
      if(['style','script','button'].includes(tag))continue;
      if(['span','strong','em','b','i','a','br'].includes(tag)){inline+=(tag==='br'?'\n':node.textContent)+' ';continue;}
      flush();
      if(tag==='svg'){result.push(await figure(node));continue;}
      if(tag==='table'){
        const border={style:BorderStyle.SINGLE,size:4,color:'D9D9D9'};
        result.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border},rows:Array.from(node.querySelectorAll('tr')).map(row=>new TableRow({tableHeader:!!row.querySelector('th'),children:Array.from(row.children).map(cell=>new TableCell({margins:{top:80,bottom:80,left:100,right:100},shading:cell.tagName==='TH'?{fill:'F2F2F2'}:undefined,children:[new Paragraph({spacing:{before:0,after:40,line:240},children:[new TextRun({text:clean(cell.textContent||''),size:20,bold:cell.tagName==='TH'})]})]}))}))}));
        result.push(paragraph(''));continue;
      }
      if(/^h[1-6]$/.test(tag))result.push(new Paragraph({text:clean(node.textContent||''),heading:tag==='h1'||tag==='h2'?HeadingLevel.HEADING_1:HeadingLevel.HEADING_2,keepNext:true,spacing:{before:220,after:140}}));
      else if(tag==='p'||tag==='li')result.push(new Paragraph({text:clean(node.textContent||''),...(tag==='li'?{bullet:{level:0}}:{}),spacing:{after:120}}));
      else result.push(...await blocks(node));
    }
    flush();return result;
  }
  const content:Block[]=[new Paragraph({text:lesson.lesson.title,heading:HeadingLevel.TITLE}),paragraph('Roteiro editável do professor'),paragraph(`${label(lesson.lesson.subject)} • ${gradeLabel(lesson.lesson.grade)} • ${lesson.lesson.duration_minutes} minutos • Versão ${lesson.lesson_version}`),paragraph('Edite os textos, atividades, notas e gabaritos para preparar sua aula. As figuras são estáticas; use a apresentação HTML para as animações.'),new Paragraph({text:'Objetivos da aula',heading:HeadingLevel.HEADING_1}),...(objectives.length?objectives.map(text=>new Paragraph({text,bullet:{level:0}})):[paragraph('Objetivos não informados nesta aula. Revise antes de usar em turma.')])];
  if(lesson.prerequisites?.length)content.push(new Paragraph({text:'Pré-requisitos',heading:HeadingLevel.HEADING_1}),...lesson.prerequisites.map(paragraph));
  if(lesson.references?.length)content.push(new Paragraph({text:'Referências e autoria',heading:HeadingLevel.HEADING_1}),...lesson.references.map(r=>paragraph(`${referenceKindLabel(r.kind)}: ${r.title}${r.url?' — '+r.url:''}${r.locator?' — '+r.locator:''}${r.license?' — '+r.license:''}`)),paragraph('A referência curricular não implica homologação ou alinhamento automático desta aula.'));
  for(const page of Array.from(dom.querySelectorAll('.print-slide-page'))){
    content.push(new Paragraph({text:'',pageBreakBefore:true}));content.push(...await blocks(page));
  }
  const doc=new Document({title:lesson.lesson.title,creator:lesson.lesson.author||'PEMARA EDU',description:'Aula editável para o professor',styles:{default:{document:{run:{font:'Arial',size:22,color:'000000'},paragraph:{spacing:{after:120,line:276}}},title:{run:{font:'Arial',size:36,bold:true,color:'000000'},paragraph:{spacing:{after:200}}},heading1:{run:{font:'Arial',size:28,bold:true,color:'000000'}},heading2:{run:{font:'Arial',size:24,bold:true,color:'000000'}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children:content}]});
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
