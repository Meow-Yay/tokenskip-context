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

// map toolCallId -> {name, args}
const calls = new Map();
for (const r of records) {
  if (r.type === 'tool/call') {
    const id = r.data?.toolCallId ?? r.data?.callId ?? r.data?.id;
    if (id) calls.set(id, { name: r.data?.name ?? r.data?.toolName, args: r.data?.arguments ?? '' });
  }
  const c = r.data?.message?.content;
  if (r.type === 'assistant/message' && Array.isArray(c)) {
    for (const p of c) if (p.type === 'tool-call') calls.set(p.id, { name: p.name, args: p.arguments ?? '' });
  }
}

const items = [];
for (const r of records) {
  if (r.type !== 'tool/result') continue;
  const id = r.data?.message?.toolCallId;
  const call = calls.get(id) ?? { name: '?', args: '' };
  const text = (r.data?.message?.content ?? []).map((p) => p.text ?? '').join('\n');
  const op = r.data?.meta?.operation ?? '';
  items.push({ name: call.name, args: call.args, text, tok: estTok(text), op });
}

console.log('tool/result count:', items.length);
console.log('');
console.log('=== output volume by tool ===');
const byTool = new Map();
for (const it of items) {
  const k = it.name || '?';
  const v = byTool.get(k) ?? { n: 0, tok: 0 };
  v.n++; v.tok += it.tok;
  byTool.set(k, v);
}
for (const [k, v] of [...byTool.entries()].sort((a, b) => b[1].tok - a[1].tok)) {
  console.log(`  ${String(k).padEnd(16)} calls=${String(v.n).padStart(4)}  out=${Math.round(v.tok).toLocaleString().padStart(8)} tok`);
}
console.log('');
console.log('=== top 12 single tool outputs (ingestion targets) ===');
const top = [...items].sort((a, b) => b.tok - a.tok).slice(0, 12);
for (const it of top) {
  let target = '';
  try {
    const a = JSON.parse(it.args);
    target = a.path ?? a.pattern ?? a.command ?? a.url ?? '';
  } catch { target = String(it.args).slice(0, 60); }
  console.log(
    `${String(it.name).padEnd(14)} ${Math.round(it.tok).toLocaleString().padStart(8)} tok  ${String(target).slice(0, 78)}`
  );
}

// how concentrated is the ingestion?
const total = items.reduce((s, it) => s + it.tok, 0);
const sorted = [...items].sort((a, b) => b.tok - a.tok);
let run = 0;
let n80 = 0;
for (const it of sorted) { run += it.tok; n80++; if (run >= total * 0.8) break; }
console.log('');
console.log('=== concentration ===');
console.log(`total tool-output tokens: ${Math.round(total).toLocaleString()}`);
console.log(`top ${n80} of ${items.length} outputs (${((n80 / items.length) * 100).toFixed(0)}%) carry 80% of the volume`);
console.log(`top 10 outputs alone: ${Math.round(sorted.slice(0, 10).reduce((s, i) => s + i.tok, 0)).toLocaleString()} tok = ${((sorted.slice(0, 10).reduce((s, i) => s + i.tok, 0) / total) * 100).toFixed(0)}%`);
