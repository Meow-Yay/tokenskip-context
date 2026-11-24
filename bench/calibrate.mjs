import fs from 'node:fs';

function estTok(s) {
  let cjk = 0, other = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c >= 0x3000 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef)) cjk++;
    else other++;
  }
  return cjk + other / 4;
}

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter((l) => l.trim());
const records = lines.map((l) => JSON.parse(l));
const bySeq = new Map();
for (const r of records) if (r.seq != null) bySeq.set(r.seq, r);

// pull the model-visible text out of a record
function visibleText(r) {
  const parts = [];
  const m = r?.data?.message;
  if (m) {
    const content = m.content;
    if (Array.isArray(content)) {
      for (const p of content) {
        if (typeof p === 'string') parts.push(p);
        else if (p.type === 'text') parts.push(p.text ?? '');
        else if (p.type === 'tool-call') parts.push(p.arguments ?? '');
        else parts.push(JSON.stringify(p));
      }
    } else if (typeof content === 'string') parts.push(content);
  }
  if (Array.isArray(r?.data?.content)) {
    for (const p of r.data.content) parts.push(p.type === 'text' ? (p.text ?? '') : JSON.stringify(p));
  }
  return parts.join('\n');
}

const prunes = records.filter((r) => r.type === 'compaction/prune');
console.log('compaction/prune samples:', prunes.length);
console.log('');
console.log('seq   real    est(visible)  ratio    est(fullJSON)  ratio');
let sumReal = 0, sumVis = 0, sumFull = 0, n = 0;
for (const p of prunes) {
  const real = p.data?.shadowedTokenCount;
  const seqs = p.data?.shadowedSeqs ?? [];
  if (!real || !seqs.length) continue;
  let vis = 0, full = 0;
  for (const s of seqs) {
    const rec = bySeq.get(s);
    if (!rec) continue;
    vis += estTok(visibleText(rec));
    full += estTok(JSON.stringify(rec));
  }
  if (!vis && !full) continue;
  n++;
  sumReal += real; sumVis += vis; sumFull += full;
  console.log(
    String(seqs.join(',')).padEnd(6) +
    String(real).padStart(6) +
    String(Math.round(vis)).padStart(14) +
    ((vis / real).toFixed(2) + 'x').padStart(9) +
    String(Math.round(full)).padStart(15) +
    ((full / real).toFixed(2) + 'x').padStart(8)
  );
}
console.log('');
console.log('--- aggregate over', n, 'samples ---');
console.log('real (harness-measured):', sumReal.toLocaleString());
console.log('est(visible)           :', Math.round(sumVis).toLocaleString(), '=', (sumVis / sumReal).toFixed(3) + 'x real');
console.log('est(fullJSON)          :', Math.round(sumFull).toLocaleString(), '=', (sumFull / sumReal).toFixed(3) + 'x real');
