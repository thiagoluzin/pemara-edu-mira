import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
const teacher=process.argv.includes('--teacher');
const dataDir = teacher&&process.env.PEMARA_TEACHER_DATA_DIR?path.resolve(process.env.PEMARA_TEACHER_DATA_DIR):path.join(root,teacher?'.local-teacher':'.local-demo');
const restoreArg=process.argv.indexOf('--restore');
const restoreFile=restoreArg<0?undefined:process.argv[restoreArg+1];
if(restoreArg>=0&&(!teacher||!restoreFile||restoreFile.startsWith('--')||!process.argv.includes('--confirm')))throw new Error('Restauração: use --teacher --restore caminho.json --confirm. Será criada uma cópia do banco anterior.');
const database=teacher?'pemara_teacher_utf8':'pemara_demo_utf8';
if(teacher){process.env.PEMARA_SINGLE_TEACHER='true';process.env.PEMARA_OFFLINE='true';}
fs.mkdirSync(dataDir, { recursive: true });
const configPath = path.join(dataDir, 'config.json');
const dbDir = path.join(dataDir, 'postgres');
const statePath = path.join(dataDir, 'running.json');
const stopPath = path.join(dataDir, 'stop.request');
if (!fs.existsSync(configPath)) {
  if (fs.existsSync(dbDir)) throw new Error('Banco existente sem configuração. Preserve os dados e recupere config.json.');
  fs.writeFileSync(configPath, JSON.stringify({ dbPort: teacher?55433:55432, appPort: teacher?3001:3000, password: crypto.randomBytes(32).toString('hex') }, null, 2), { flag: 'wx' });
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
for (const port of [config.dbPort, config.appPort]) {
  const socket = net.createServer();
  await new Promise<void>((resolve, reject) => {
    socket.once('error', () => reject(new Error(`Porta ${port} ocupada. Não encerre processos alheios; verifique se a demonstração já está aberta.`)));
    socket.listen(port, '127.0.0.1', () => socket.close(() => resolve()));
  });
}
// Remove only a stale request before startup. Once /ready responds, a newly
// written stop request must survive until the shutdown watcher consumes it.
if (fs.existsSync(stopPath)) fs.unlinkSync(stopPath);
process.env.DATABASE_URL = `postgresql://postgres:${config.password}@127.0.0.1:${config.dbPort}/${database}`;
process.env.NODE_ENV = 'production';
process.env.HOST = '127.0.0.1';
process.env.PORT = String(config.appPort);
process.env.HTTPS = 'false';
// Prevent server.ts from auto-starting on import; startServer is called explicitly below.
process.env.TEST_MODE = 'local-demo';
process.env.SEED_DEMO_USERS = teacher?'false':'true';
process.env.USE_TEST_MEMORY_DB = 'false';
const postgres = new EmbeddedPostgres({ databaseDir: dbDir, port: config.dbPort, user: 'postgres', password: config.password, authMethod: 'scram-sha-256', persistent: true, postgresFlags: ['-c', 'listen_addresses=127.0.0.1'], onLog: () => {}, onError: () => {} });
let dbStarted = false;
let pool: import('pg').Pool | undefined;
let server: import('node:http').Server | undefined;
let timer: NodeJS.Timeout | undefined;
let shutdownPromise: Promise<void> | undefined;
function shutdown() {
  return shutdownPromise ??= performShutdown();
}
async function performShutdown() {
  if (timer) clearInterval(timer);
  if (server) await new Promise<void>(r => server!.close(() => r()));
  let backupSaved=false,backupPath:string|undefined;
  if (pool) {
    try {
      const { exportDatabase } = await import('../server/db/backup');
      const backup = await exportDatabase(pool);
      const backupDir = path.join(dataDir, 'backups');
      fs.mkdirSync(backupDir, { recursive: true });
      backupPath=path.join(backupDir, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(backup),{flag:'wx'});
      backupSaved=true;
      console.log('Backup local concluído.');
    } catch { console.error('Backup não concluído. Os arquivos do banco foram preservados.'); }
    await pool.end();
  }
  if (dbStarted) await postgres.stop();
  fs.writeFileSync(path.join(dataDir,'last-shutdown.json'),JSON.stringify({at:new Date().toISOString(),backupSaved,backupPath}));
  for (const file of [statePath, stopPath]) if (fs.existsSync(file)) fs.unlinkSync(file);
  console.log('PEMARA encerrado; banco preservado.');
}
try {
  if (!fs.existsSync(path.join(dbDir, 'PG_VERSION'))) await postgres.initialise();
  await postgres.start();
  dbStarted = true;
  const client = postgres.getPgClient('postgres');
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1",[database]);
    if (!exists.rowCount) await client.query(`CREATE DATABASE ${database} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
  } finally { await client.end(); }
  const { getPool } = await import('../server/db/pool');
  const { runMigrations } = await import('../server/db/migrator');
  const { seedInitialUsers } = await import('../server/db/seeds/users');
  const { seedInitialKnowledge } = await import('../server/db/seeds/knowledge');
  const { LessonRepository } = await import('../server/repositories/lessonRepository');
  const templates = await import('../src/templates/deterministicTemplates');
  pool = getPool();
  await runMigrations(pool);
  if(restoreFile){
    const {exportDatabase,importDatabase}=await import('../server/db/backup');
    const before=await exportDatabase(pool);
    fs.mkdirSync(path.join(dataDir,'backups'),{recursive:true});
    fs.writeFileSync(path.join(dataDir,'backups',`antes-restauracao-${Date.now()}.json`),JSON.stringify(before),{flag:'wx'});
    const envelope=JSON.parse(fs.readFileSync(path.resolve(restoreFile),'utf8'));
    await importDatabase(pool,envelope,{confirmDestructiveRestore:true});
    await runMigrations(pool);
    await pool.query('DELETE FROM sessions');
    console.log('Backup restaurado; banco anterior preservado.');
  }
  await seedInitialUsers(pool);
  await seedInitialKnowledge(pool);
  // Novos bancos recebem o acervo distribuído. Reinícios preservam alterações e arquivamentos do professor.
  if (fs.existsSync(path.join(root, 'server/curriculum/complete/manifest.json'))) {
    const { readCompleteCatalog, publishCompleteCatalog } = await import('../server/curriculum/completeCatalog');
    await publishCompleteCatalog(pool, readCompleteCatalog(), {onlyMissing:true,bundledBootstrap:teacher});
    if(teacher&&process.argv.includes('--repair-mixtures')){
      const catalog=readCompleteCatalog();
      const pack=catalog.find(p=>p.subjectCode==='science'&&p.title==='Misturas, transformações e separação');
      if(!pack)throw new Error('Tema de misturas não encontrado para correção.');
      const result=await publishCompleteCatalog(pool,catalog,{onlySlugs:[pack.slug],bundledBootstrap:true});
      console.log(`Correção de misturas: ${result.published} versão publicada; versões e aulas anteriores preservadas.`);
    }
  }

  const repo = new LessonRepository(pool);
  const demoLessons = [templates.TEMPLATE_GREECE_6EF, templates.TEMPLATE_SOLAR_SYSTEM, templates.TEMPLATE_PROJECTILE_MOTION, templates.TEMPLATE_MATH_FUNCTION];
  // Bootstrap once only: restarting never overwrites or recreates a deleted demo lesson.
  const seededPath = path.join(dataDir, 'demo-seeded.json');
  if (!teacher && !fs.existsSync(seededPath)) {
    for (const username of ['admin', 'prof.helena']) {
      const user = (await pool.query('SELECT id FROM users WHERE username = $1', [username])).rows[0];
      for (let i = 0; i < demoLessons.length; i++) {
        const id = `demo-${username.replace('.', '-')}-${i + 1}`;
        if (await repo.getLessonById(id)) continue;
        const spec = structuredClone(demoLessons[i]);
        spec.lesson.id = id;
        await repo.createLesson({ id, ownerId: user.id, title: spec.lesson.title, subjectCode: spec.lesson.subject, gradeLevel: spec.lesson.grade, topic: spec.lesson.topic, spec });
      }
    }
    fs.writeFileSync(seededPath, JSON.stringify({ seededAt: new Date().toISOString(), lessons: 8 }));
  }
  const { startServer } = await import('../server');
  server = await startServer();
  fs.writeFileSync(statePath, JSON.stringify({ pid: process.pid, url: `http://127.0.0.1:${config.appPort}`, database }));
  timer = setInterval(() => { if (fs.existsSync(stopPath)) void shutdown().then(() => process.exit(0)); }, 1000);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void shutdown().then(() => process.exit(0)); });
  console.log(`${teacher?'PEMARA OFFLINE PRONTO':'DEMONSTRAÇÃO PRONTA'}: http://127.0.0.1:${config.appPort}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao iniciar demonstração.');
  await shutdown();
  process.exit(1);
}
