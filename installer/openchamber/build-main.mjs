import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const source = path.join(root, 'pilotos/openchamber/source/packages/electron');
const outdir = path.join(root, 'build/openchamber/2.4.0-pemara.1/bundle');
const result = await Bun.build({
  entrypoints: ['entry.mjs', 'main.mjs', 'early-startup.mjs'].map(f => path.join(source, f)),
  outdir, target: 'node', format: 'esm', minify: false, sourcemap: 'none', naming: '[name].mjs',
  external: ['electron', '@openchamber/web', '@openchamber/web/*', 'bun-pty', 'node-pty', './main.mjs', './early-startup.mjs'],
  define: { __OPENCHAMBER_UPDATER_E2E_BUILD__: 'false' },
  plugins: [{ name: 'pemara-distribution', setup(build) {
    build.onLoad({ filter: /(?:entry|early-startup|updater-capability)\.mjs$/ }, ({ path: filename }) => {
      let contents = fs.readFileSync(filename, 'utf8');
      if (path.basename(filename) === 'entry.mjs') contents = contents.replace("app.setName('OpenChamber')", "app.setName('PEMARA OpenChamber')");
      if (path.basename(filename) === 'early-startup.mjs') contents = contents.replaceAll('dev.openchamber.desktop', 'br.com.pemara.openchamber').replace("DEEP_LINK_PROTOCOL = 'openchamber'", "DEEP_LINK_PROTOCOL = 'pemara-openchamber'").replace('const loadWindowsEnv = () => {', 'const loadWindowsEnv = () => {\n  return { PATH: process.env.PATH };');
      if (path.basename(filename) === 'updater-capability.mjs') {
        const anchor = "  if (platform !== 'linux' || !packaged) return;";
        if (!contents.includes(anchor)) throw new Error('Updater guard anchor changed');
        contents = contents.replace(anchor, "  throw new Error('Atualize esta edição pelo instalador PEMARA.');\n" + anchor);
      }
      return { contents, loader: 'js' };
    });
  }}],
});
if (!result.success) throw new AggregateError(result.logs, 'Falha ao compilar');
const entry = path.join(outdir, 'entry.mjs');
fs.writeFileSync(entry, "import './pemara-bootstrap.mjs';\n" + fs.readFileSync(entry, 'utf8'));
fs.copyFileSync(path.join(here, 'bootstrap.mjs'), path.join(outdir, 'pemara-bootstrap.mjs'));
console.log(`Módulos derivados: ${outdir}`);
