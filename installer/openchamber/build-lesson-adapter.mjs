import path from 'node:path';
import {stage} from './release.mjs';
const result = await Bun.build({ entrypoints: [path.resolve('installer/openchamber/opencode-lesson-adapter.mjs')], outdir:path.join(stage,'bundle'), target:'node', format:'esm', naming:'[name].mjs', minify:false, sourcemap:'none' });
if(!result.success)throw new AggregateError(result.logs,'Falha ao compilar a integração OpenCode.');
