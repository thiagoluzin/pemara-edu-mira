import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function run(exe, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-4000); });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Banco local: ${path.basename(exe)} falhou (${code}). ${error}`)));
  });
}
async function freePort(port = 0) {
  const socket = net.createServer();
  return new Promise((resolve, reject) => {
    socket.once('error', () => reject(new Error(`A porta local ${port} está ocupada. Feche a outra instância e tente novamente.`)));
    socket.listen(port, '127.0.0.1', () => { const selected = socket.address().port; socket.close(() => resolve(selected)); });
  });
}

export async function startEducation({ root, dataDir, openCodeBridge }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const configFile = path.join(dataDir, 'config.json');
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({ appPort: await freePort(), password: crypto.randomBytes(32).toString('hex') }), { flag: 'wx' });
  }
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  await freePort(config.appPort);
  const dbPort = await freePort();
  const database = 'pemara_teacher_utf8';
  const pgDir = path.join(dataDir, 'postgres');
  const bin = path.join(root, 'node_modules/@embedded-postgres/windows-x64/native/bin');
  const pgctl = path.join(bin, 'pg_ctl.exe');
  const log = path.join(dataDir, 'postgres.log');
  let started = false, pool, server, stopAI;
  let stopping;
  async function stop() {
    if (stopping) return stopping;
    stopping = (async () => {
      let backupSaved = false;
      if (stopAI) await stopAI();
      if (server) { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
      try {
        if (pool) {
          const { exportDatabase } = await import(pathToFileURL(path.join(root, 'server/db/backup.ts')).href);
          const backup = await exportDatabase(pool);
          fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
          fs.writeFileSync(path.join(dataDir, 'backups', `backup-${Date.now()}.json`), JSON.stringify(backup), { flag: 'wx' });
          backupSaved = true;
        }
      } finally {
        if (pool) await pool.end();
        if (started && fs.existsSync(path.join(pgDir, 'postmaster.pid'))) await run(pgctl, ['stop', '-D', pgDir, '-m', 'fast', '-w', '-t', '120']);
        fs.writeFileSync(path.join(dataDir, 'last-shutdown.json'), JSON.stringify({ at: new Date().toISOString(), backupSaved }));
      }
    })();
    return stopping;
  }
  try {
    if (!fs.existsSync(path.join(pgDir, 'PG_VERSION'))) {
      const pw = path.join(dataDir, '.init-password');
      fs.writeFileSync(pw, config.password, { flag: 'wx' });
      try { await run(path.join(bin, 'initdb.exe'), ['-D', pgDir, '-U', 'postgres', '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', `--pwfile=${pw}`]); }
      finally { fs.unlinkSync(pw); }
    }
    started = true;
    await run(pgctl, ['start', '-D', pgDir, '-l', log, '-o', `-p ${dbPort} -h 127.0.0.1`, '-w', '-t', '120']);
    const { register } = await import(pathToFileURL(path.join(root, 'node_modules/tsx/dist/esm/api/index.mjs')).href);
    register();
    if (openCodeBridge) {
      const jobs = await import(pathToFileURL(path.join(root,'server/ai/openCodeJobs.ts')).href);
      jobs.configureOpenCodeLessons(openCodeBridge,path.join(dataDir,'ai-jobs'));
      stopAI = jobs.stopOpenCodeLessons;
    }
    const { default: pg } = await import(pathToFileURL(path.join(root, 'node_modules/pg/lib/index.js')).href);
    const admin = new pg.Client({ host: '127.0.0.1', port: dbPort, user: 'postgres', password: config.password, database: 'postgres' });
    await admin.connect();
    try { if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) await admin.query(`CREATE DATABASE ${database} ENCODING 'UTF8' TEMPLATE template0`); }
    finally { await admin.end(); }
    Object.assign(process.env, {
      DATABASE_URL: `postgresql://postgres:${config.password}@127.0.0.1:${dbPort}/${database}`,
      NODE_ENV: 'production', TEST_MODE: 'desktop-education', PEMARA_SINGLE_TEACHER: 'true', PEMARA_OFFLINE: 'true',
      PEMARA_RESOURCE_ROOT: root, PEMARA_AI_CONFIG_DIR: path.join(dataDir, 'ai'),
      ...(process.versions.electron ? { PEMARA_NODE_EXECUTABLE: path.resolve(root, '../tools/node/node.exe') } : {}),
      HOST: '127.0.0.1', PORT: String(config.appPort), SEED_DEMO_USERS: 'false', USE_TEST_MEMORY_DB: 'false',
    });
    const { initDb } = await import(pathToFileURL(path.join(root, 'server/db/pool.ts')).href);
    pool = initDb();
    const { runMigrations } = await import(pathToFileURL(path.join(root, 'server/db/migrator.ts')).href);
    await runMigrations(pool);
    const importFile = path.join(dataDir, 'import-once.json');
    const importedFile = path.join(dataDir, 'import-completed.json');
    if (fs.existsSync(importFile) && !fs.existsSync(importedFile)) {
      const existing = await pool.query('SELECT COUNT(*)::int AS count FROM users');
      if (existing.rows[0].count !== 0) throw new Error('O acervo de destino já contém dados. A importação foi interrompida para preservá-los.');
      const { importDatabase } = await import(pathToFileURL(path.join(root, 'server/db/backup.ts')).href);
      const contents = fs.readFileSync(importFile);
      await importDatabase(pool, JSON.parse(contents.toString('utf8')), { confirmDestructiveRestore: true });
      fs.writeFileSync(importedFile, JSON.stringify({ at: new Date().toISOString(), sha256: crypto.createHash('sha256').update(contents).digest('hex') }), { flag: 'wx' });
    }
    const { seedInitialUsers } = await import(pathToFileURL(path.join(root, 'server/db/seeds/users.ts')).href);
    const { seedInitialKnowledge } = await import(pathToFileURL(path.join(root, 'server/db/seeds/knowledge.ts')).href);
    await seedInitialUsers(pool); await seedInitialKnowledge(pool);
    const { readCompleteCatalog, publishCompleteCatalog } = await import(pathToFileURL(path.join(root, 'server/curriculum/completeCatalog.ts')).href);
    await publishCompleteCatalog(pool, readCompleteCatalog(path.join(root, 'server/curriculum/complete')), { onlyMissing: true, bundledBootstrap: true });
    const { startServer } = await import(pathToFileURL(path.join(root, 'server.ts')).href);
    server = await startServer();
    if (!server.listening) await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const url = `http://127.0.0.1:${config.appPort}`;
    fs.writeFileSync(path.join(dataDir, 'running.json'), JSON.stringify({ pid: process.pid, url, dbPort }));
    return { url, stop };
  } catch (error) { await stop().catch(() => {}); throw error; }
}
