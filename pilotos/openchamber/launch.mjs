import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

export const root = path.dirname(fileURLToPath(import.meta.url));
export const source = path.join(root, 'source');
export const profile = path.resolve(root, '../../..', 'PEMARA_OpenChamber_Dados', 'perfil');
export const data = path.join(profile, '.config', 'openchamber');
const require = createRequire(path.join(source, 'packages/electron/package.json'));
const json = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, JSON.stringify(value, null, 2), { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
};
const forward = (p) => p.replaceAll('\\', '/');
// Keep examples outside the PEMARA Git root so OpenCode cannot adopt its parent repository.
export const projectsRoot = path.resolve(root, '../../..', 'PEMARA_OpenChamber_Projetos');
export const demo = path.join(projectsRoot, 'Aula de demonstracao');
const second = path.join(projectsRoot, 'Materiais do professor');

export function prepare() {
  for (const dir of [demo, second, data, path.join(root, 'evidencias'), path.join(profile, 'AppData/Roaming'), path.join(profile, 'AppData/Local'), path.join(profile, 'chromium')]) fs.mkdirSync(dir, { recursive: true });
  const example = path.join(demo, 'plano-da-aula.md');
  if (!fs.existsSync(example)) fs.writeFileSync(example, '# Minha aula\n\nObjetivo: observar a evaporação da água.\n\nEste arquivo pertence ao piloto.\n');
  const note = path.join(second, 'LEIA-ME.txt');
  if (!fs.existsSync(note)) fs.writeFileSync(note, 'Pasta de demonstração para cadastrar materiais. Seus arquivos originais permanecem onde estão.\n');
  const projects = [demo, second].map((p) => ({ id: `path_${Buffer.from(forward(p)).toString('base64url')}`, path: forward(p), label: path.basename(p), addedAt: Date.now() }));
  json(path.join(data, 'settings.json'), {
    projects, activeProjectId: projects[0].id, lastDirectory: forward(demo),
    locale: 'pt-BR', useSystemTheme: false, themeId: 'pemara-dark', themeVariant: 'dark',
    darkThemeId: 'pemara-dark', lightThemeId: 'pemara-light',
    sidebarViewMode: 'projects', sidebarProjectDisplayMode: 'all',
    fileTreeSide: 'left', contextEditorTreeVisible: false,
    desktopLocalPort: 4817, desktopMinimizeToTrayEnabled: false,
    autoDeleteEnabled: false, mergedWorktreeCleanupEnabled: false,
    draftStartersVisible: false, workStatusPanelEnabled: false,
    desktopAutoUpdateEnabled: false,
  });
  for (const variant of ['dark', 'light']) {
    const dark = variant === 'dark';
    const palette = JSON.parse(fs.readFileSync(path.join(source, `packages/ui/src/lib/theme/themes/flexoki-${variant}.json`), 'utf8'));
    palette.metadata = { id: `pemara-${variant}`, name: 'PEMARA', variant, description: 'Tema neutro do piloto PEMARA', version: '1.0.0' };
    Object.assign(palette.colors.surface, { background: dark ? '#212121' : '#ffffff', foreground: dark ? '#ececec' : '#202020', muted: dark ? '#171717' : '#f5f5f5', mutedForeground: dark ? '#b4b4b4' : '#636363', elevated: dark ? '#303030' : '#f0f0f0', subtle: dark ? '#272727' : '#fafafa' });
    Object.assign(palette.colors.primary, { base: dark ? '#ececec' : '#202020', foreground: dark ? '#202020' : '#ffffff', hover: dark ? '#ffffff' : '#363636', active: dark ? '#d4d4d4' : '#111111', muted: '#80808040' });
    palette.colors.syntax.base.background = dark ? '#202020' : '#fafafa';
    json(path.join(data, 'themes', `pemara-${variant}.json`), palette);
  }
}

export function isolatedEnv(debug = false) {
  // Only OS/runtime environment is inherited. No provider keys or production configuration.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|pathext|systemroot|windir|systemdrive|comspec|temp|tmp|processor_architecture|number_of_processors|programfiles|programfiles\(x86\)|commonprogramfiles)$/i.test(key)));
  Object.assign(env, {
    HOME: profile, USERPROFILE: profile,
    APPDATA: path.join(profile, 'AppData/Roaming'), LOCALAPPDATA: path.join(profile, 'AppData/Local'),
    XDG_CONFIG_HOME: path.join(profile, '.config'), XDG_DATA_HOME: path.join(profile, '.local/share'),
    XDG_STATE_HOME: path.join(profile, '.local/state'), XDG_CACHE_HOME: path.join(profile, '.cache'),
    OPENCHAMBER_DATA_DIR: data, OPENCHAMBER_DESKTOP_USER_DATA_DIR: path.join(profile, 'chromium'),
    OPENCHAMBER_ELECTRON_DEV: '1', OPENCHAMBER_ELECTRON_USE_BUNDLED_UI: '1',
    OPENCHAMBER_BUNDLED_OPENCODE_CLI_DIR: path.join(source, 'packages/electron/resources/opencode-cli'),
    OPENCHAMBER_RELAY_HOST: 'off', OPENCODE_DISABLE_AUTOUPDATE: 'true', NODE_ENV: 'production',
  });
  if (debug) env.OPENCHAMBER_ELECTRON_REMOTE_DEBUGGING_PORT = '9337';
  return env;
}

export function launch(debug = false) {
  prepare();
  const log = fs.openSync(path.join(root, 'evidencias', 'desktop.log'), 'a');
  const child = spawn(require('electron'), [path.join(source, 'packages/electron/entry.mjs')], {
    cwd: demo, env: isolatedEnv(debug), windowsHide: true, detached: true, stdio: ['ignore', log, log],
  });
  child.on('error', (error) => fs.appendFileSync(path.join(root, 'evidencias', 'launch-error.log'), `${error.stack}\n`));
  child.unref();
  fs.closeSync(log);
  return child;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) launch(process.argv.includes('--test'));
