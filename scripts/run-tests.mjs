import { spawnSync } from 'node:child_process';

// Browser regressions exercise fixed fixtures. Watching generated evidence,
// profiles and third-party checkouts delays loading without helping these tests.
const targets = process.argv.slice(2);
const result = spawnSync(process.execPath, [
  '--import', 'tsx', '--test', '--test-concurrency=2',
  ...(targets.length ? targets : ['test/**/*.test.ts']),
], {
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, DISABLE_HMR: 'true' },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
