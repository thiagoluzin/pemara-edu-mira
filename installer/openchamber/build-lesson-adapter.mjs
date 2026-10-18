import path from 'node:path';
const result = await Bun.build({ entrypoints: [path.resolve('installer/openchamber/opencode-lesson-adapter.mjs')], outdir:path.resolve('build/openchamber/2.4.0-pemara.6/bundle'), target:'node', format:'esm', naming:'[name].mjs', minify:false, sourcemap:'none' });
if(!result.success)throw new AggregateError(result.logs,'Falha ao compilar a integração OpenCode.');
