import fs from 'node:fs';

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter((l) => l.trim());
const records = lines.map((l) => JSON.parse(l));

const byType = (t) => records.filter((r) => r.type === t);

console.log('=== compaction/start (first, trimmed) ===');
console.log(JSON.stringify(byType('compaction/start')[0], null, 1).slice(0, 1500));
console.log('');
console.log('=== compaction/end (first, trimmed) ===');
console.log(JSON.stringify(byType('compaction/end')[0], null, 1).slice(0, 1500));
console.log('');
console.log('=== compaction/prune (first, trimmed) ===');
console.log(JSON.stringify(byType('compaction/prune')[0], null, 1).slice(0, 1200));
console.log('');
console.log('=== tool/result: largest 1, keys + head ===');
const tr = byType('tool/result').map((r) => ({ r, n: JSON.stringify(r).length })).sort((a, b) => b.n - a.n);
console.log('bytes:', tr[0].n, '| keys:', Object.keys(tr[0].r).join(','));
console.log(JSON.stringify(tr[0].r).slice(0, 1200));
console.log('');
console.log('=== assistant/message: largest 1 ===');
const am = byType('assistant/message').map((r) => ({ r, n: JSON.stringify(r).length })).sort((a, b) => b.n - a.n);
console.log('bytes:', am[0].n, '| keys:', Object.keys(am[0].r).join(','));
console.log(JSON.stringify(am[0].r).slice(0, 900));
console.log('');
console.log('=== user/message: first ===');
console.log(JSON.stringify(byType('user/message')[0]).slice(0, 600));
console.log('');
console.log('=== size by type (total JSON bytes) ===');
const agg = new Map();
for (const r of records) {
  const t = r.type ?? '?';
  agg.set(t, (agg.get(t) || 0) + JSON.stringify(r).length);
}
let tot = 0;
for (const [, v] of agg) tot += v;
for (const [k, v] of [...agg.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(k).padEnd(42)} ${String(v).padStart(10)}  ${((v / tot) * 100).toFixed(1)}%`);
}
console.log('  TOTAL', tot);
