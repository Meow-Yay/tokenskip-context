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

for (const t of ['request/header', 'system/message', 'request/context']) {
  const rs = records.filter((r) => r.type === t);
  console.log(`=== ${t} — ${rs.length} record(s) ===`);
  for (const r of rs) {
    const keys = Object.keys(r.data ?? {});
    console.log(`  seq=${r.seq} jsonBytes=${JSON.stringify(r).length} estTok=${Math.round(estTok(JSON.stringify(r)))} keys=[${keys.join(',')}]`);
  }
  if (rs[0]) {
    console.log('  --- head of first ---');
    console.log('  ' + JSON.stringify(rs[0]).slice(0, 700).replace(/\n/g, ' '));
  }
  console.log('');
}

// does request/header carry the system prompt text?
const rh = records.filter((r) => r.type === 'request/header');
if (rh.length) {
  const d = rh[0].data ?? {};
  for (const [k, v] of Object.entries(d)) {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    console.log(`  field ${k}: ${typeof v} len=${s ? s.length : 0}`);
  }
}
