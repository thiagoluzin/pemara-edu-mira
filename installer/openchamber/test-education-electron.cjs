const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
app.whenReady().then(async () => {
  const stage = path.resolve(__dirname, '../../build/openchamber/2.4.0-pemara.4');
  let service;
  try {
    const { startEducation } = await import(pathToFileURL(path.join(__dirname, 'education-service.mjs')).href);
    service = await startEducation({ root: path.join(stage, 'education'), dataDir: path.join(stage, 'test-fresh-data') });
    const ready = await (await fetch(service.url + '/ready')).json();
    if (!ready.ready) throw new Error('Database not ready in Electron');
    fs.writeFileSync(path.join(stage,'evidencias/electron-service.json'),JSON.stringify({passed:true,electron:process.versions.electron,node:process.versions.node}));
    await service.stop(); app.exit(0);
  } catch(error) { console.error(error); if(service)await service.stop(); app.exit(1); }
});
