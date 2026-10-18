import { expect, spyOn, test } from 'bun:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { OpenCode } from '@opencode/client';
import { opencodeClient } from '@/lib/opencode/client';
import type { Message } from '@/lib/opencode/model';
import { SyncProvider, useDirectoryStore } from '@/sync/sync-context';
import { installHookTestDom } from '../components/session/sidebar/test-utils/testDom';
import { useSessionActivity } from './useSessionActivity';

test('idle snapshot releases an interrupted reply without deleting history, and new live work resumes', async () => {
  const dom = installHookTestDom();
  const originalSurface = window.__OPENCHAMBER_SURFACE__;
  window.__OPENCHAMBER_SURFACE__ = 'desktop';
  const spies = [
    spyOn(opencodeClient, 'getFilesystemHomeInfo').mockResolvedValue({ home: '/home' }),
    spyOn(opencodeClient, 'getFilesystemHome').mockResolvedValue('/home'),
    spyOn(opencodeClient, 'getConfig').mockResolvedValue({}),
    spyOn(opencodeClient, 'listProjects').mockResolvedValue([]),
    spyOn(opencodeClient, 'getLocation').mockResolvedValue({ directory: '/lesson', project: { id: 'p', directory: '/lesson', canonical: '/lesson' } }),
  ];
  const sdk = OpenCode.make({ baseUrl: 'https://sync.test', fetch: async request => {
    const route = new URL(request instanceof Request ? request.url : request.toString()).pathname;
    if (route.endsWith('/event')) return new Response(new ReadableStream(), { headers: { 'content-type': 'text/event-stream' } });
    return new Response(JSON.stringify(route.endsWith('/session/active') ? {} : { data: [] }), { headers: { 'content-type': 'application/json' } });
  } });
  let store: ReturnType<typeof useDirectoryStore> | undefined;
  let working = false;
  let renders = 0;
  function Probe() {
    store = useDirectoryStore('/lesson', { bootstrap: false });
    working = useSessionActivity('s', '/lesson').isWorking;
    renders++;
    return null;
  }
  const root = createRoot(dom.container);
  const message: Message = { id: 'a', sessionID: 's', role: 'assistant', time: { created: 1 }, agent: 'build', modelID: 'model', providerID: 'provider', cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } };
  try {
    await act(async () => root.render(<SyncProvider sdk={sdk} directory=""><Probe /></SyncProvider>));
    if (!store) throw new Error('Probe did not mount');
    const messages = { s: [message] };
    await act(async () => store!.setState({ message: messages, session_status: {}, sessionStatusReady: false }));
    expect(working).toBe(true);
    // A failed snapshot leaves readiness false and must not invent idle.
    await act(async () => store!.setState({ status: 'partial' }));
    expect(working).toBe(true);
    await act(async () => store!.setState({ sessionStatusReady: true }));
    expect(working).toBe(false);
    expect(store.getState().message).toBe(messages);
    const settledRenders = renders;
    await act(async () => store!.setState({ sessionStatusReady: true, session_status: {} }));
    expect(renders).toBe(settledRenders);
    await act(async () => store!.setState({ session_status: { s: { type: 'busy' } } }));
    expect(working).toBe(true);
    await act(async () => store!.setState({ session_status: { s: { type: 'retry', attempt: 1, next: 100, message: 'retry' } } }));
    expect(working).toBe(true);
    await act(async () => store!.setState({ session_status: { s: { type: 'idle' } } }));
    expect(working).toBe(false);
    // A scoped invalidation must not reuse the old snapshot's authority.
    await act(async () => store!.setState({ session_status: {}, sessionStatusInvalidated: { s: true } }));
    expect(working).toBe(true);
    await act(async () => store!.setState({ sessionStatusInvalidated: {} }));
    expect(working).toBe(false);
  } finally {
    await act(async () => root.unmount());
    for (const spy of spies) spy.mockRestore();
    window.__OPENCHAMBER_SURFACE__ = originalSurface;
    dom.restore();
  }
});
