/**
 * Script de verificação de integridade e comparação com a baseline da auditoria.
 * Executar com: npx tsx scripts/verify-baseline.ts
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ManifestEntry {
  path: string;
  sha256: string;
}

const manifestPath = path.resolve('docs', 'evidencias', 'manifesto-fontes-2026-09-25.json');
if (!fs.existsSync(manifestPath)) {
  console.error('Manifesto de baseline não encontrado em:', manifestPath);
  process.exit(1);
}

const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let matches = 0;
let modified = 0;
let missing = 0;

console.log('--- VERIFICAÇÃO DE INTEGRIDADE CONTRA BASELINE 2026-09-25 ---');

for (const entry of manifest) {
  const normPath = entry.path.replace(/\\/g, '/');
  const fullPath = path.resolve(normPath);

  if (!fs.existsSync(fullPath)) {
    console.log(`[AUSENTE]   ${normPath}`);
    missing++;
    continue;
  }

  const content = fs.readFileSync(fullPath);
  // Calculate SHA-256 in hex uppercase
  const hash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();

  if (hash === entry.sha256.toUpperCase()) {
    matches++;
  } else {
    console.log(`[MODIFICADO] ${normPath}`);
    modified++;
  }
}

console.log('------------------------------------------------------------');
console.log(`Total catalogado: ${manifest.length} | Idênticos: ${matches} | Modificados: ${modified} | Ausentes: ${missing}`);
