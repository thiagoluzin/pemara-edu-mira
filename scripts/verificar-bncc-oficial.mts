import fs from 'node:fs';

const codes = [
  'EF08LI05', 'EF08LI12',
  'EF09LI01', 'EF09LI14',
  'EF89EF14', 'EF89EF16', 'EF89EF19',
  'EF06LP05', 'EF06LP06',
  'EF07LP05', 'EF07LP12',
  'EF08LP01', 'EF08LP02',
  'EF09LP01', 'EF09LP03',
  'EF69LP06', 'EF69LP07',
  'EF07ER01', 'EF07ER02',
  'EF08ER01', 'EF08ER02',
  'EF09ER01', 'EF09ER02'
];

const raw = JSON.parse(fs.readFileSync('server/curriculum/raw/bncc-ensino-fundamental-oficial.json', 'utf8'));
const map = new Map<string, { componente: string; anos: number[]; texto: string }>(raw.habilidades.map((h: any) => [h.codigo, h]));

for (const c of codes) {
  const h = map.get(c);
  if (!h) {
    console.error('MISSING CODE IN OFFICIAL JSON:', c);
  } else {
    console.log(`OK: ${c} (${h.componente}, anos: ${h.anos}) -> "${h.texto.slice(0, 60)}..."`);
  }
}
