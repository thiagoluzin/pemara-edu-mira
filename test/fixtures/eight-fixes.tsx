import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LessonEditor} from '../../src/components/LessonEditor';
import {TEMPLATE_SOLAR_SYSTEM} from '../../src/templates/deterministicTemplates';
import {generatePrintDocumentHtml,generateStandaloneHtml} from '../../src/components/ExportModal';
import {generateTeacherDocx} from '../../src/engine/teacherDocx';
import '../../src/index.css';
const original=structuredClone(TEMPLATE_SOLAR_SYSTEM);
original.lesson={...original.lesson,id:'isolated-eight-fixes',title:'Frações equivalentes',subject:'math',bncc_skill:''};
original.objectives=['Reconhecer frações equivalentes.'];
original.prerequisites=['Reconhecer numerador e denominador.'];
original.references=[{title:'Material docente de teste',url:'https://example.org/fracoes',kind:'authorship',locator:'Página 1'}];
original.scenes=[{id:'cover',type:'title',title:'Frações equivalentes',subtitle:'Comparando partes do mesmo inteiro'},
 {id:'text',type:'text',title:'Um meio e dois quartos',content:['Um meio e dois quartos representam a mesma parte de um inteiro.'],teacher_notes:'Use partes iguais do mesmo inteiro.'}];
function Fixture(){
 const [lesson,setLesson]=useState(original);
 Object.assign(window,{auditLesson:lesson,auditOriginal:original,auditReplace:setLesson,auditExport:async()=>{
   const legacy=structuredClone(TEMPLATE_SOLAR_SYSTEM);delete (legacy as any).objectives;
   legacy.prerequisites=original.prerequisites;legacy.references=original.references;
   const before=JSON.stringify(legacy),html=generatePrintDocumentHtml(legacy,{includeTeacherNotes:true});
   const bytes=await generateTeacherDocx(legacy,html);
   let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
   return {docx:btoa(binary),html,standalone:generateStandaloneHtml(legacy),preserved:JSON.stringify(legacy)===before};
 }});
 return <main className="p-6"><LessonEditor lesson={lesson} onUpdateLesson={setLesson} onStartPresentation={()=>{}} onOpenExportModal={()=>{}} onOpenMaestroLogs={()=>{}}/></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
