// Keep OpenCode wire details at the desktop boundary. Never inspect reasoning.
export function completedChatTurns(exported, since) {
  const {info,messages}=exported;
  if(info.parentID||info.metadata?.pemaraLessonJobId||info.metadata?.pemaraChatReview)return [];
  const turns=[];
  for(let start=0;start<messages.length;start++) {
    const user=messages[start];
    if(user.type!=='user'||user.time.created<since||user.metadata?.pemaraChatReview)continue;
    let end=start+1;while(end<messages.length&&messages[end].type!=='user')end++;
    const steps=messages.slice(start+1,end).filter(m=>m.type==='assistant');
    const reply=steps.at(-1);
    if(!reply?.time.completed||reply.error||reply.finish!=='stop')continue;
    const answer=reply.content.filter(p=>p.type==='text').map(p=>p.text).join('\n');
    const files=[];
    for(const step of steps) {
      files.push(...(step.snapshot?.files||[]));
      for(const part of step.content)if(part.type==='tool'&&part.state.status==='completed'&&['write','edit'].includes(part.name)) {
        const file=part.state.input.filePath||part.state.input.path;
        if(typeof file==='string')files.push(file);
      }
    }
    // Links in the delivered answer are candidate artifacts, never instructions.
    for(const match of answer.matchAll(/\]\(([^\n)]+\.(?:html?|md|txt|json))\)/gi)) {
      let file=match[1];if(/^[a-z]+:\/\//i.test(file))continue;
      try {file=decodeURIComponent(file);}catch{continue;}
      files.push(file);
    }
    if(!answer.trim()&&!files.length)continue;
    turns.push({sessionID:info.id,promptID:user.id,replyID:reply.id,directory:info.location.directory,
      created:user.time.created,completed:reply.time.completed,title:info.title||'Aula no chat',
      request:user.text,context:messages.slice(0,start).filter(m=>m.type==='user').slice(-4).map(m=>m.text).join('\n').slice(-12000),
      answer,files:[...new Set(files)]});
  }
  return turns;
}
