import { app, WebContentsView, ipcMain, dialog, shell, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startEducation } from './education-service.mjs';
import { educationDataDir, educationExportsDir } from './pemara-bootstrap.mjs';
import { createLessonAdapter } from './opencode-lesson-adapter.mjs';
import { createEducationNavigation } from './education-navigation.mjs';
import { saveEducationExport, saveEducationBundle } from './education-export.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = educationDataDir;
const exportsDir = educationExportsDir;
let servicePromise;
let stopping;
const states = new Map();
for(const [channel,save] of [['pemara:education:export',saveEducationExport],['pemara:education:export-bundle',saveEducationBundle]])ipcMain.handle(channel, async (event, request) => {
  const state=[...states.values()].find(s=>s.edu.webContents===event.sender);
  if(!state || !state.loaded || event.senderFrame!==state.edu.webContents.mainFrame || !/^http:\/\/127\.0\.0\.1:\d+\//.test(event.sender.getURL())) throw Error('Exportação não autorizada.');
  if(state.exporting)throw Error('Conclua a exportação em andamento.');
  state.exporting=true;
  try{return await save(state.win,request,exportsDir);}finally{state.exporting=false;}
});
export async function confirmEducationQuit() {
  for (const state of states.values()) {
    if (!state.loaded || state.edu.webContents.isDestroyed()) continue;
    let status;
    const deadline = Date.now() + 30000;
    do {
      status = await state.edu.webContents.executeJavaScript('document.documentElement.dataset.pemaraSaveState');
      if (!['unsaved', 'saving'].includes(status)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    if (['unsaved', 'saving', 'error', 'conflict'].includes(status)) {
      const choice = await dialog.showMessageBox(state.win, { type: 'warning', title: 'Aula ainda não salva', message: 'Há alterações que ainda não foram salvas no acervo.', detail: 'Volte à aula para concluir o salvamento ou resolver o conflito.', buttons: ['Voltar à aula', 'Fechar sem salvar alterações'], defaultId: 0, cancelId: 0 });
      if (choice.response === 0) { state.edu.setVisible(true); state.edu.webContents.focus(); return false; }
    }
  }
  return true;
}
function service() {
  servicePromise ??= startEducation({ root: path.join(process.resourcesPath, 'education'), dataDir, openCodeBridge: createLessonAdapter({
    directory: path.dirname(exportsDir), settingsFile: path.join(process.env.OPENCHAMBER_DATA_DIR,'settings.json'),
    getConnection: async () => {
      const state = [...states.values()].find(s=>!s.win.isDestroyed()&&s.win.webContents.getURL().startsWith('openchamber-ui://app/'));
      if (!state) throw new Error('Abra a janela local do OpenChamber.');
      return state.win.webContents.executeJavaScript('({baseUrl:window.__OPENCHAMBER_API_BASE_URL__,headers:window.__OPENCHAMBER_RUNTIME_HEADERS__})');
    },
  }) }).catch(error => { servicePromise = undefined; throw error; });
  return servicePromise;
}
export async function stopEducation() {
  if (stopping) return stopping;
  stopping = (async () => {
    if (servicePromise) await session.fromPartition('persist:pemara-education').flushStorageData();
    for (const state of states.values()) {
      if (!state.edu.webContents.isDestroyed()) await state.edu.webContents.session.flushStorageData();
    }
    if (servicePromise) await (await servicePromise).stop();
  })();
  return stopping;
}

ipcMain.handle('pemara:education:navigate', async (event, area) => {
  const state = states.get(event.sender.id);
  if (!state || event.senderFrame !== state.nav.webContents.mainFrame || !['chat','create','library','atlas','chat-reviews','exports'].includes(area)) throw new Error('Navegação não autorizada.');
  if (area === 'exports') { fs.mkdirSync(exportsDir, { recursive: true }); const error = await shell.openPath(exportsDir); if (error) throw new Error(error); return; }
  return state.navigate(area);
});

app.on('browser-window-created', (_event, win) => {
  win.setTitle('PEMARA EDU');
  win.setMinimumSize(800,600);
  const icon = path.join(process.resourcesPath,'pemara/brand/pemara-edu.png');
  if (fs.existsSync(icon)) win.setIcon(icon);
  win.on('page-title-updated',event=>{event.preventDefault();win.setTitle('PEMARA EDU');});
  let attached = false;
  win.webContents.on('did-finish-load', async () => {
    if (!win.webContents.getURL().startsWith('openchamber-ui://app')) return;
    await win.webContents.insertCSS('#root{margin-left:176px!important;width:calc(100% - 176px)!important}');
    if (attached) return;
    attached = true;
    const nav = new WebContentsView({ webPreferences: { preload: path.join(here, 'education-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    const eduSession = session.fromPartition('persist:pemara-education');
    const edu = new WebContentsView({ webPreferences: { preload: path.join(here,'education-export-preload.cjs'), session: eduSession, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: true } });
    const state = { nav, edu, win, loaded: false };
    state.navigate = createEducationNavigation({
      ready: service,
      alive: () => !win.isDestroyed() && !edu.webContents.isDestroyed(),
      load: async url => { await edu.webContents.loadURL(url); state.loaded = true; },
      route: route => edu.webContents.executeJavaScript(`history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'));`),
      show: () => { edu.setVisible(true); edu.webContents.focus(); },
      chat: () => { edu.setVisible(false); win.webContents.focus(); },
      failed: error => dialog.showMessageBox(win, { type: 'error', title: 'Aulas e Atlas', message: 'Não foi possível abrir o acervo local.', detail: error.message + '\nTente clicar novamente na área desejada. Os arquivos e as conversas permanecem salvos.' }),
    });
    states.set(nav.webContents.id, state);
    win.contentView.addChildView(edu); win.contentView.addChildView(nav);
    edu.setVisible(false);
    const layout = () => {
      if (win.isDestroyed()) return;
      const [width, height] = win.getContentSize();
      nav.setBounds({ x: 0, y: 40, width: 176, height: Math.max(0, height - 40) });
      edu.setBounds({ x: 176, y: 40, width: Math.max(0, width - 176), height: Math.max(0, height - 40) });
    };
    win.on('resize', layout); layout();
    let closeAccepted = false, closePending = false;
    win.on('close', event => {
      if (closeAccepted || !state.loaded) return;
      event.preventDefault();
      if (closePending) return;
      closePending = true;
      void confirmEducationQuit().then(accepted => { closePending = false; if (accepted && !win.isDestroyed()) { closeAccepted = true; win.close(); } }).catch(() => { closePending = false; });
    });
    nav.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    nav.webContents.on('will-navigate', event => event.preventDefault());
    edu.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    edu.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== new URL(edu.webContents.getURL()).origin) event.preventDefault();
    });
    eduSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    const download = (_event, item, contents) => {
      if (contents !== edu.webContents) return;
      fs.mkdirSync(exportsDir, { recursive: true });
      const filename = path.basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      item.setSaveDialogOptions({title:'Salvar como',defaultPath:path.join(exportsDir,filename)});
      item.once('done', (_event, status) => {
        if (win.isDestroyed() || status==='cancelled') return;
        void dialog.showMessageBox(win, { type: status === 'completed' ? 'info' : 'error', title: 'Exportar aula', message: status === 'completed' ? 'Aula exportada.' : 'A exportação não terminou. Tente novamente.', detail: status === 'completed' ? item.getSavePath() : 'A aula continua salva na biblioteca.', buttons: ['OK'] });
      });
    };
    eduSession.on('will-download', download);
    win.on('closed', () => {
      states.delete(nav.webContents.id); eduSession.removeListener('will-download', download);
      if (!nav.webContents.isDestroyed()) nav.webContents.close();
      if (!edu.webContents.isDestroyed()) edu.webContents.close();
    });
    await nav.webContents.loadURL(pathToFileURL(path.join(here, 'education-nav.html')).href);
    // Start observing direct chat even when the teacher never opens Criar aula.
    let reviewTimer;
    win.once('closed',()=>clearInterval(reviewTimer));
    void service().then(runtime=>{
      if(win.isDestroyed())return;
      reviewTimer=setInterval(()=>{
        if(nav.webContents.isDestroyed())return;
        const status=runtime.reviewStatus(),jobs=status?.jobs||[];
        const pending=jobs.some(j=>['queued','classifying','reviewing'].includes(j.status));
        const failed=jobs.some(j=>j.status==='failed');
        const text=status?.error?'Revisão do chat: conexão indisponível.':pending?'Revisão de aula em andamento. Veja Revisões do chat.':failed?'Há revisões pendentes. Abra Revisões do chat.':jobs.length?'Pareceres disponíveis em Revisões do chat.':'Revisão automática de aulas do chat ativa.';
        void nav.webContents.executeJavaScript(`document.getElementById('status').textContent=${JSON.stringify(text)}`).catch(()=>{});
      },3000);
    }).catch(()=>{
      if(!nav.webContents.isDestroyed())void nav.webContents.executeJavaScript("document.getElementById('status').textContent='Revisão do chat indisponível. Abra Revisões do chat para tentar novamente.'");
    });
  });
});
