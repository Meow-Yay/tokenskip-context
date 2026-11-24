import fs from 'node:fs';

/**
 * Measures what the tokenskip-context skill's retention rules would remove from a
 * real agent transcript.
 *
 * Token estimate: ASCII ~4 chars/token, CJK ~1 char/token. Both sides use the same
 * estimator, so the RATIO is robust even though absolute values are approximate.
 */
function estTok(s) {
  let cjk = 0;
  let other = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c >= 0x3000 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef)) cjk++;
    else other++;
  }
  return cjk + other / 4;
}

// --- the skill's force-token patterns: a line survives if it matches any of these
const KEEP_PATTERNS = [
  /[\w./\\-]+\.\w{1,6}:\d+/,                                   // path:line
  /\b(?:error|Error|ERROR|exception|Exception|Traceback|panic|FAILED|failed|refused|denied)\b/,
  /^\s*at\s+.+:\d+:\d+/,                                        // stack frame
  /\b(?:def|class|function|const|let|var|async|public|private|static|export)\b\s*[\w$]*\s*\(/,
  /\b(?:chose|because|instead|rather than|therefore|hence|decided)\b/i,
  /(?:因为|所以|改为|决定|而不是|因此|原因)/,
  /\bexit code\b|\bexitCode\b/,
  /^\s*[-*]\s+\[[ x]\]/,
];
const keepLine = (l) => KEEP_PATTERNS.some((re) => re.test(l));

function keepForceTokens(text, ratio) {
  const lines = text.split('\n');
  const kept = lines.filter(keepLine);
  // ratio = fraction of non-matching lines the skill still keeps (context glue)
  const glued = lines.filter((l) => !keepLine(l)).slice(0, Math.ceil(lines.length * ratio));
  return [...kept, ...glued].join('\n');
}

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter((l) => l.trim());
const records = lines.map((l) => JSON.parse(l));

const cat = {};
const add = (k, before, after) => {
  cat[k] = cat[k] || { before: 0, after: 0 };
  cat[k].before += before;
  cat[k].after += after;
};

// track duplicate file reads
const readSeen = new Map();

for (const r of records) {
  const t = r.type;

  if (t === 'assistant/message') {
    const content = r.data?.message?.content ?? [];
    for (const part of content) {
      if (part.type === 'text') {
        const s = part.text ?? '';
        add('assistant narration', estTok(s), estTok(keepForceTokens(s, 0.15)));
      } else if (part.type === 'tool-call') {
        const s = part.arguments ?? '';
        add('assistant tool-call args (deliverable writes)', estTok(s), estTok(s));
      }
    }
    continue;
  }

  if (t === 'tool/result') {
    const content = r.data?.message?.content ?? [];
    const meta = r.data?.meta;
    const op = meta?.operation ?? 'output';
    for (const part of content) {
      const s = part.text ?? '';
      if (op === 'read') {
        const count = (readSeen.get(s.slice(0, 200)) || 0) + 1;
        readSeen.set(s.slice(0, 200), count);
        if (count > 1) {
          add('tool output: duplicate read', estTok(s), 0);
        } else {
          add('tool output: file read', estTok(s), estTok(keepForceTokens(s, 0.2)));
        }
      } else {
        add('tool output: command/file-op', estTok(s), estTok(keepForceTokens(s, 0.2)));
      }
    }
    if (meta) {
      const s = JSON.stringify(meta);
      add('tool meta/diffs (harness bookkeeping)', estTok(s), estTok(s));
    }
    continue;
  }

  if (t === 'tool/call') {
    const s = JSON.stringify(r.data ?? '');
    add('tool/call bookkeeping', estTok(s), estTok(s));
    continue;
  }

  if (t === 'user/message') {
    const s = JSON.stringify(r.data?.content ?? '');
    add('user intent (never trimmed)', estTok(s), estTok(s));
    continue;
  }

  if (t === 'system/message' || t === 'request/header' || t === 'request/context') {
    add('system prompt + tool schemas', estTok(JSON.stringify(r)), estTok(JSON.stringify(r)));
    continue;
  }

  add('harness bookkeeping (other)', estTok(JSON.stringify(r)), estTok(JSON.stringify(r)));
}

let before = 0;
let after = 0;
for (const v of Object.values(cat)) { before += v.before; after += v.after; }

console.log('=== tokens by category (estimated) ===');
console.log('category'.padEnd(52) + 'before'.padStart(11) + 'after'.padStart(11) + 'saved'.padStart(10) + '  drop%');
const rows = Object.entries(cat).sort((a, b) => b[1].before - a[1].before);
for (const [k, v] of rows) {
  const drop = v.before > 0 ? ((1 - v.after / v.before) * 100).toFixed(1) : '0.0';
  console.log(
    k.padEnd(52) +
    Math.round(v.before).toLocaleString().padStart(11) +
    Math.round(v.after).toLocaleString().padStart(11) +
    Math.round(v.before - v.after).toLocaleString().padStart(10) +
    '  ' + drop.padStart(5) + '%'
  );
}
console.log('-'.repeat(94));
console.log(
  'TOTAL'.padEnd(52) +
  Math.round(before).toLocaleString().padStart(11) +
  Math.round(after).toLocaleString().padStart(11) +
  Math.round(before - after).toLocaleString().padStart(10) +
  '  ' + ((1 - after / before) * 100).toFixed(1).padStart(5) + '%'
);

// addressable vs not
const NOT_ADDR = new Set([
  'assistant tool-call args (deliverable writes)',
  'tool meta/diffs (harness bookkeeping)',
  'tool/call bookkeeping',
  'user intent (never trimmed)',
  'system prompt + tool schemas',
  'harness bookkeeping (other)',
]);
let addrB = 0, addrA = 0, nonB = 0;
for (const [k, v] of Object.entries(cat)) {
  if (NOT_ADDR.has(k)) nonB += v.before;
  else { addrB += v.before; addrA += v.after; }
}
console.log('');
console.log('=== addressable surface ===');
console.log('  addressable (narration + tool output):', Math.round(addrB).toLocaleString(), 'tok =', ((addrB / before) * 100).toFixed(1) + '% of transcript');
console.log('  after skill rules:', Math.round(addrA).toLocaleString(), 'tok  →', ((1 - addrA / addrB) * 100).toFixed(1) + '% removed from that surface');
console.log('  not addressable (writes, schemas, user, bookkeeping):', Math.round(nonB).toLocaleString(), 'tok =', ((nonB / before) * 100).toFixed(1) + '%');
console.log('');
console.log('  whole-transcript reduction:', ((1 - after / before) * 100).toFixed(1) + '%');
