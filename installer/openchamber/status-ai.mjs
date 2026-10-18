import { connect } from './test-installed.mjs';
const { browser, client } = await connect();
try {
  const active = await client.session.active();
  const list = await client.session.list({ limit: 5, order: 'desc' });
  const summaries = [];
  for (const session of list.data) {
    const exported = await client.session.export({ sessionID: session.id });
    const last = exported.messages.at(-1);
    summaries.push({ id: session.id, title: session.title, model: session.model, tokens: session.tokens, cost: session.cost, active: active[session.id], messages: exported.messages.length, last: last ? { type: last.type, fields: Object.keys(last), content: JSON.stringify(last.content ?? null).slice(0,900) } : null });
  }
  console.log(JSON.stringify(summaries, null, 2));
} finally { await browser.close(); }
