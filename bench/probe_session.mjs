import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const SESS = process.argv[2];
const buf = fs.readFileSync(SESS);
const raw = zlib.zstdDecompressSync(buf).toString('utf8');
const lines = raw.split('\n').filter((l) => l.trim());

console.log('decompressed bytes:', raw.length);
console.log('lines:', lines.length);

const records = [];
let bad = 0;
for (const l of lines) {
  try { records.push(JSON.parse(l)); } catch { bad++; }
}
console.log('parsed:', records.length, 'unparsable:', bad);
console.log('');
console.log('=== top-level key shapes (first 5 records) ===');
for (const r of records.slice(0, 5)) {
  console.log(Object.keys(r).join(', '), '| type=', r.type, '| role=', r.role);
}
console.log('');
console.log('=== key frequency across all records ===');
const keyCount = new Map();
for (const r of records) for (const k of Object.keys(r)) keyCount.set(k, (keyCount.get(k) || 0) + 1);
for (const [k, v] of [...keyCount.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
console.log('');
console.log('=== type/value frequency ===');
const typeCount = new Map();
for (const r of records) {
  const t = r.type ?? r.role ?? r.kind ?? '?';
  typeCount.set(t, (typeCount.get(t) || 0) + 1);
}
for (const [k, v] of [...typeCount.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
console.log('');
console.log('=== sample record (largest) ===');
const withLen = records.map((r) => ({ r, len: JSON.stringify(r).length })).sort((a, b) => b.len - a.len);
console.log('largest record bytes:', withLen[0].len);
console.log(JSON.stringify(withLen[0].r).slice(0, 2500));
