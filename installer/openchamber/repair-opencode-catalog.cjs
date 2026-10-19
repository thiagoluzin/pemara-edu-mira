// Maintenance-only repair. Run with PEMARA EDU and its OpenCode process closed.
// Rebuild only when the sole unreadable table contains the disposable catalogue.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const database=path.resolve(process.argv[2]);
const evidence=path.resolve(process.argv[3]);fs.mkdirSync(evidence,{recursive:true});
const candidate=path.join(evidence,'rebuilt.db');assert.ok(!fs.existsSync(candidate),'Candidate already exists');
const original=new DatabaseSync(database,{readOnly:true});
assert.deepEqual(original.prepare('SELECT key FROM kv INDEXED BY sqlite_autoindex_kv_1').all().map(r=>r.key),['models-dev:catalog']);
assert.throws(()=>original.prepare('SELECT * FROM kv').all(),/malformed/);
const schema=original.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all();
const tables=schema.filter(s=>s.type==='table');
const rows=new Map();const quote=s=>'"'+s.replaceAll('"','""')+'"';
for(const table of tables)if(table.name!=='kv')rows.set(table.name,original.prepare('SELECT * FROM '+quote(table.name)).all());
const repaired=new DatabaseSync(candidate);repaired.exec('PRAGMA foreign_keys=OFF; BEGIN;');
try {
 for(const table of tables)repaired.exec(table.sql);
 for(const [table,records] of rows){if(!records.length)continue;const columns=Object.keys(records[0]);const insert=repaired.prepare('INSERT INTO '+quote(table)+' ('+columns.map(quote).join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')');for(const record of records)insert.run(...columns.map(c=>record[c]));}
 for(const item of schema.filter(s=>s.type!=='table'))repaired.exec(item.sql);
 repaired.exec('COMMIT;');
 for(const [table,records] of rows)assert.deepEqual(repaired.prepare('SELECT * FROM '+quote(table)).all(),records,table);
 assert.deepEqual(repaired.prepare('PRAGMA integrity_check').all().map(r=>r.integrity_check),['ok']);
 const priorReferences=original.prepare('PRAGMA foreign_key_check').all();
 assert.deepEqual(repaired.prepare('PRAGMA foreign_key_check').all(),priorReferences,'Repair must not introduce new reference inconsistencies');
 fs.writeFileSync(path.join(evidence,'repair-verification.json'),JSON.stringify({passed:true,onlyOmittedKey:'models-dev:catalog',preExistingReferenceIssues:priorReferences.length,preservedTables:[...rows].map(([name,r])=>({name,rows:r.length}))},null,2));
} finally {repaired.close();original.close();}
// Preserve the original DB plus WAL/SHM together before replacing it.
const preserved=database+'.catalog-backup-'+Date.now();
for(const suffix of ['','-wal','-shm'])if(fs.existsSync(database+suffix)){
 fs.copyFileSync(database+suffix,path.join(evidence,'original-live.db'+suffix));
 assert.ok(fs.readFileSync(database+suffix).equals(fs.readFileSync(path.join(evidence,'original-live.db'+suffix))));
 fs.renameSync(database+suffix,preserved+suffix);
}
fs.copyFileSync(candidate,database);
console.log('Catalogue database rebuilt; all readable tables verified identical; originals preserved.');
