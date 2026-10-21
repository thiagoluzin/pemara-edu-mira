// Prices and availability come from the live OpenCode catalogue, never a name suffix.
export function freeCloudModels(models, preferred = '') {
  const preferredID = preferred.split('#')[0];
  return models.filter(model => model.providerID === 'opencode' && model.enabled && model.status !== 'deprecated'
    && model.capabilities.output.includes('text') && model.limit.output >= 8192 && model.cost.length > 0
    && model.cost.every(cost => [cost.input,cost.output,cost.cache.read,cost.cache.write].every(value => value === 0)))
    .map(model => ({id:model.providerID+'/'+model.id,name:model.name}))
    .sort((a,b) => Number(b.id === preferredID)-Number(a.id === preferredID) || a.name.localeCompare(b.name));
}

export const lessonPermissions = ['bash','edit','write','external_directory'].map(action => ({action,resource:'*',effect:'deny'}));

export async function waitForLessonReply(sdk, sessionID, promptID, signal, pause) {
  while (true) {
    signal.throwIfAborted();
    const exported = await sdk.session.export({sessionID},{signal});
    const index = exported.messages.findIndex(message => message.id === promptID || message.type==='user' && message.metadata?.pemaraPromptKey===promptID);
    const reply = index < 0 ? undefined : exported.messages.slice(index+1).findLast(message => message.type === 'assistant');
    // A completed tool-call message ends only that model step. OpenCode may
    // still be executing tools or composing the actual answer for this prompt.
    if (reply?.error || (reply?.time.completed && reply.finish !== 'tool-calls')) return reply;
    // prompt() acknowledges queued work; wait() may see idle before it starts.
    await pause(400,undefined,{signal});
  }
}
