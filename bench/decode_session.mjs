import fs from 'node:fs';
import zlib from 'node:zlib';

const SESS = process.argv[2];
const buf = fs.readFileSync(SESS);

// zstd frame magic, little-endian
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const offsets = [];
let i = 0;
while (true) {
  const at = buf.indexOf(MAGIC, i);
  if (at === -1) break;
  offsets.push(at);
  i = at + 4;
}
console.log('frame candidates:', offsets.length);

let out = '';
let ok = 0;
let fail = 0;
for (let k = 0; k < offsets.length; k++) {
  const start = offsets[k];
  const end = k + 1 < offsets.length ? offsets[k + 1] : buf.length;
  try {
    out += zlib.zstdDecompressSync(buf.subarray(start, end)).toString('utf8');
    ok++;
  } catch (e) {
    fail++;
    if (fail <= 3) console.log(`  frame ${k} @${start} (${end - start}B) failed: ${String(e.message).slice(0, 90)}`);
  }
}
console.log('frames ok:', ok, 'failed:', fail);
console.log('total decompressed chars:', out.length);

const lines = out.split('\n').filter((l) => l.trim());
console.log('lines:', lines.length);
const records = [];
let bad = 0;
for (const l of lines) {
  try { records.push(JSON.parse(l)); } catch { bad++; }
}
console.log('parsed:', records.length, 'unparsable:', bad);

const outFile = process.argv[3];
if (outFile) {
  fs.writeFileSync(outFile, out, 'utf8');
  console.log('wrote:', outFile);
}

console.log('');
console.log('=== type frequency ===');
const tc = new Map();
for (const r of records) {
  const t = r.type ?? r.role ?? '?';
  tc.set(t, (tc.get(t) || 0) + 1);
}
for (const [k, v] of [...tc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${k}: ${v}`);

console.log('');
console.log('=== keys on a non-session record ===');
const non = records.find((r) => r.type !== 'session');
if (non) console.log(JSON.stringify(non).slice(0, 1200));
