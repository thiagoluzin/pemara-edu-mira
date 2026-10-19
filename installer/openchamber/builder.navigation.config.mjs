import path from 'node:path';
import previous from './builder.education.config.mjs';
// Maintenance installer from the tested .6 runtime; keep identity and profile.
// Use --prepackaged with an isolated application folder containing the fix.
export default {
  ...previous,
  directories: { ...previous.directories, output: path.resolve('build/openchamber/navigation-fix-20261019/dist') },
  win: { ...previous.win, artifactName: 'PEMARA-EDU-2.4.0-pemara.6-Correcao-Navegacao-Windows-x64.${ext}' },
};
