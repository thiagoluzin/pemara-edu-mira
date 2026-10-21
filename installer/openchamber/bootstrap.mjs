import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { connectWindowsUserFolders } from './known-folder-links.mjs';

// Runs before upstream early-startup imports. Never imports an existing personal profile.
const localAppData = process.env.LOCALAPPDATA;
if (!localAppData || !path.isAbsolute(localAppData)) throw new Error('Não foi possível localizar os dados locais do Windows.');
const distributionFile = path.join(process.resourcesPath, 'pemara/distribution.json');
const cleanTest = fs.existsSync(distributionFile) && JSON.parse(fs.readFileSync(distributionFile, 'utf8')).edition === 'clean-test';
const profileRoot = path.join(localAppData, cleanTest ? 'PEMARAEduTesteLimpo' : 'PEMARAOpenChamber');
const profile = path.join(profileRoot, 'perfil');
const projectsRoot = path.join(app.getPath('documents'), cleanTest ? 'PEMARA Aulas - Teste Limpo' : 'PEMARA Aulas');
export const educationDataDir = path.join(profileRoot, 'aulas');
export const educationExportsDir = path.join(projectsRoot, 'Minhas aulas', 'Exportadas');
const materials = path.join(projectsRoot, 'Minhas aulas');
const data = path.join(profile, '.config', 'openchamber');
const resources = process.resourcesPath;
const tools = path.join(resources, 'tools');
const forward = value => value.replaceAll('\\', '/');
function writeOnce(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, value, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
for (const dir of [materials, data, path.join(profile, 'AppData/Roaming'), path.join(profile, 'AppData/Local'), path.join(profile, 'chromium')]) fs.mkdirSync(dir, { recursive: true });
// Capture the OS folders before changing USERPROFILE for the private AI runtime.
if(process.platform==='win32') {
  const folders=connectWindowsUserFolders(profile,name=>app.getPath(name));
  fs.writeFileSync(path.join(profile,'windows-folders.json'),JSON.stringify(folders,null,2));
}
writeOnce(path.join(materials, 'LEIA-ME.txt'), 'Crie aqui suas aulas pelo chat. Seus arquivos permanecem nesta pasta depois de fechar ou desinstalar o aplicativo.\r\nA IA precisa de internet. As aulas HTML podem ser abertas offline.\r\n');
const projects = [materials].map(p => ({ id: `path_${Buffer.from(forward(p)).toString('base64url')}`, path: forward(p), label: path.basename(p), addedAt: Date.now() }));
writeOnce(path.join(data, 'settings.json'), JSON.stringify({
  projects, activeProjectId: projects[0].id, lastDirectory: forward(materials),
  locale: 'pt-BR', useSystemTheme: false, themeId: 'pemara-dark', themeVariant: 'dark',
  darkThemeId: 'pemara-dark', lightThemeId: 'pemara-light',
  sidebarViewMode: 'projects', sidebarProjectDisplayMode: 'all', fileTreeSide: 'left', contextEditorTreeVisible: false,
  desktopMinimizeToTrayEnabled: false, autoDeleteEnabled: false, mergedWorktreeCleanupEnabled: false,
  draftStartersVisible: false, workStatusPanelEnabled: false, desktopAutoUpdateEnabled: false,
  lastSelectedModel: 'opencode/deepseek-v4.1-flash-free',
}, null, 2));
for (const variant of ['dark', 'light']) writeOnce(path.join(data, 'themes', `pemara-${variant}.json`), fs.readFileSync(path.join(resources, 'pemara', `pemara-${variant}.json`)));

// Electron creates internal crash-handler variables before this module loads.
// Preserve OS/Electron state while removing inherited credentials and overrides.
for (const key of Object.keys(process.env)) {
  if (/^(OPENCODE|OPENCHAMBER|XDG)_/i.test(key) || /(?:^|_)(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS?)(?:_|$)/i.test(key) || /^(NODE_OPTIONS|NODE_PATH|PYTHONPATH|PYTHONHOME|ELECTRON_RUN_AS_NODE)$/i.test(key)) delete process.env[key];
}
Object.assign(process.env, {
  HOME: profile, USERPROFILE: profile,
  APPDATA: path.join(profile, 'AppData/Roaming'), LOCALAPPDATA: path.join(profile, 'AppData/Local'),
  XDG_CONFIG_HOME: path.join(profile, '.config'), XDG_DATA_HOME: path.join(profile, '.local/share'),
  XDG_STATE_HOME: path.join(profile, '.local/state'), XDG_CACHE_HOME: path.join(profile, '.cache'),
  OPENCHAMBER_DATA_DIR: data, OPENCHAMBER_DESKTOP_USER_DATA_DIR: path.join(profile, 'chromium'),
  OPENCHAMBER_ELECTRON_USE_BUNDLED_UI: '1', OPENCHAMBER_RELAY_HOST: 'off',
  OPENCHAMBER_BUNDLED_OPENCODE_CLI_DIR: path.join(resources, 'opencode-cli'),
  OPENCODE_DISABLE_AUTOUPDATE: 'true', PEMARA_DESKTOP_DISTRIBUTION: '1', NODE_ENV: 'production',
  GIT_CONFIG_NOSYSTEM: '1', PYTHONUTF8: '1',
});
const pathKey = Object.keys(process.env).find(k => k.toLowerCase() === 'path') || 'PATH';
process.env[pathKey] = [path.join(tools, 'node'), path.join(tools, 'python'), path.join(tools, 'python', 'Scripts'), path.join(tools, 'git', 'cmd'), path.join(tools, 'git', 'usr', 'bin'), path.join(process.env.SystemRoot || process.env.SYSTEMROOT, 'System32'), process.env.SystemRoot || process.env.SYSTEMROOT, path.join(process.env.SystemRoot || process.env.SYSTEMROOT, 'System32/WindowsPowerShell/v1.0')].join(path.delimiter);
process.chdir(materials);
