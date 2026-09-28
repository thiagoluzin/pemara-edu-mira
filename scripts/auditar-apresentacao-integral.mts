import fs from 'node:fs';
import {readCompleteCatalog,makePayload} from '../server/curriculum/completeCatalog';
import {LessonComposer} from '../src/composer/lessonComposer';
import {createLearningPlan,isLearningScene} from '../src/engine/learningVisual';
import {generateStandaloneHtml} from '../src/components/ExportModal';

const report={checkedAt:new Date().toISOString(),topics:0,scenes:0,learningScenes:0,afterPage7:0,subjects:{} as Record<string,number>,models:{} as Record<string,number>,lessons:[] as any[]};
fs.mkdirSync('docs/evidencias/apresentacao-integral',{recursive:true});
const exported=new Set<string>();
for(const pack of readCompleteCatalog()){
  const lesson=LessonComposer.compose({discipline:pack.subjectCode,grade:`${pack.gradeLevel}EF`,topic:pack.title,duration:45,teaching_method:'complete'},makePayload(pack,'1.0.0'));
  report.topics++;report.subjects[pack.subjectCode]=(report.subjects[pack.subjectCode]||0)+1;
  const scenes=lesson.scenes.map((s,index)=>{
    report.scenes++;
    if(!isLearningScene(s))return {page:index+1,type:s.type};
    const plan=createLearningPlan(s,lesson.lesson);report.learningScenes++;if(index>=7)report.afterPage7++;
    report.models[plan.kind]=(report.models[plan.kind]||0)+1;
    return {page:index+1,type:s.type,mode:plan.mode,visual:plan.kind,steps:plan.steps.length};
  });
  report.lessons.push({slug:pack.slug,subject:pack.subjectCode,scenes});
  if(!exported.has(pack.subjectCode)||pack.slug.includes('celulas-e-niveis')||pack.slug.includes('fracoes-decimais-estimativas')){
    exported.add(pack.subjectCode);
    fs.writeFileSync(`docs/evidencias/apresentacao-integral/${pack.slug}.html`,generateStandaloneHtml(lesson));
  }
}
fs.writeFileSync('docs/evidencias/apresentacao-integral-auditoria.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,lessons:undefined},null,2));
