# Build PEMARA EDU

This distribution uses the existing Electron runtime and NSIS assisted installer. There is no new compiler or framework. The teacher installs and opens PEMARA EDU; commands here are for maintainers.

## Restore upstream source

Clone `https://github.com/openchamber/openchamber.git` into `pilotos/openchamber/source` and check out `6a10ee19a12a1542cad01eee5add14e030ba4ac4`. Apply `installer/openchamber/upstream/openchamber-pemara.patch` from that checkout, then copy `upstream/useSessionActivity.test.tsx` to `packages/ui/src/hooks/useSessionActivity.test.tsx`. Install from its Bun lockfile. The patch preserves the previous local UI and connection-recovery changes; this turn did not modify upstream source.

The PEMARA web runtime uses the root `package-lock.json` (`npm ci`). Tool archives are pinned in `installer/opencode/desktop-packages.json`, verified by SHA256, and staged through the existing download/preparation scripts. Personal profiles and credentials must never enter staging.

## Build order

1. Prepare the portable tools with `installer/openchamber/prepare.ps1`. Its examples and themes now come from the checked-in `assets` directory.
2. Build/stage the upstream web UI with the upstream scripts and preserve the recovery variant in `build/openchamber/2.4.0-pemara.3/web-dist`. Stage the CLI and ripgrep according to the upstream Electron README. These are existing prerequisites, not downloads performed on a teacher's PC.
3. `bun installer/openchamber/build-main.mjs` creates the baseline native bundle.
4. `node installer/openchamber/prepare-education.mjs` stages the education runtime and its installed dependencies.
5. `bun installer/openchamber/build-lesson-adapter.mjs` bundles the existing official OpenCode SDK into the native adapter.
6. `node installer/openchamber/build-icon.mjs` packages the supplied PNG into Windows icon sizes.
7. `node node_modules/vite/bin/vite.js build --outDir build/openchamber/2.4.0-pemara.6/education/dist`
8. `node installer/openchamber/build.mjs --education --dir`
9. After testing: `node installer/openchamber/build.mjs --education --prepackaged build/openchamber/2.4.0-pemara.6/dist/win-unpacked`

Output: `build/openchamber/2.4.0-pemara.6/dist/PEMARA-EDU-2.4.0-pemara.6-Windows-x64-Instalar.exe`.

The app ID and profile directory remain stable to retain previous teacher data. Product name, executable, shortcut and Windows icon use PEMARA EDU. Windows 10 is a target; actual validation was on Windows 11 x64. A signed release and a Windows 10 machine test remain separate deployment work.

Validation: TypeScript, `test/opencode-lessons.test.ts`, packaged UI, actual provider response, preservation and reopening. A controlled-response test is not evidence of successful real provider generation.
