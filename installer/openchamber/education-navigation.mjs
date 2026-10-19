// One navigation at a time. A newer click supersedes queued requests, never
// cancels Chromium's initial document load or destroys the teacher's editor.
export function createEducationNavigation({ ready, load, route, show, chat, alive, failed }) {
  let sequence = 0;
  let tail = Promise.resolve();
  let loaded = false;
  return area => {
    const request = ++sequence;
    if (area === 'chat') { if (alive()) chat(); return Promise.resolve(); }
    const operation = tail.then(async () => {
      if (request !== sequence || !alive()) return;
      try {
        const { url } = await ready();
        if (request !== sequence || !alive()) return;
        if (!loaded) { await load(url + '/' + area); loaded = true; }
        else await route('/' + area);
        if (request === sequence && alive()) show();
      } catch (error) {
        if (request !== sequence || !alive()) return;
        await failed(error);
        throw error;
      }
    });
    tail = operation.catch(() => {});
    return operation;
  };
}
