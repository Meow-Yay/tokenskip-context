// Translates the measured 20.5% content reduction into its effect on the token bill.
// All inputs are harness-measured, not assumed.

const REQUESTS = 178;
const TOTAL_INPUT = 19_070_000;   // measured, acp_cache grand ledger
const TOTAL_CACHED = 17_970_000;
const TOTAL_OUTPUT = 179_400;
const CONTENT_REDUCTION = 0.205;  // measured on the real transcript (bench.mjs)

// Fixed per-request overhead, measured from request/header + system/message records
const F_HEADER = 24_294;   // tool schemas + provider config, re-sent every request
const F_SYSTEM = 4_190;    // system prompt text
const F = F_HEADER + F_SYSTEM;

const fmt = (n) => Math.round(n).toLocaleString();
const pct = (n, d) => ((n / d) * 100).toFixed(1) + '%';

const fixedTotal = F * REQUESTS;
const variableTotal = TOTAL_INPUT - fixedTotal;
const variableAfter = variableTotal * (1 - CONTENT_REDUCTION);
const totalAfter = fixedTotal + variableAfter;
const saved = TOTAL_INPUT - totalAfter;

console.log('=== inputs (measured) ===');
console.log('requests                       :', REQUESTS);
console.log('total input tokens             :', fmt(TOTAL_INPUT));
console.log('  of which cached              :', fmt(TOTAL_CACHED), '(' + pct(TOTAL_CACHED, TOTAL_INPUT) + ')');
console.log('output tokens                  :', fmt(TOTAL_OUTPUT));
console.log('');
console.log('=== fixed overhead per request (measured from records) ===');
console.log('  request/header (tools+config):', fmt(F_HEADER));
console.log('  system prompt                :', fmt(F_SYSTEM));
console.log('  F = fixed per request        :', fmt(F));
console.log('  F x requests                 :', fmt(fixedTotal), '=', pct(fixedTotal, TOTAL_INPUT), 'of the bill — untouchable by any retention rule');
console.log('');
console.log('=== variable (conversation) part ===');
console.log('  variable total               :', fmt(variableTotal), '=', pct(variableTotal, TOTAL_INPUT));
console.log('  avg content per request      :', fmt(variableTotal / REQUESTS));
console.log('');
console.log('=== apply the measured ' + (CONTENT_REDUCTION * 100).toFixed(1) + '% content reduction ===');
console.log('  variable after               :', fmt(variableAfter));
console.log('  bill after                   :', fmt(totalAfter));
console.log('');
console.log('  SAVED                        :', fmt(saved), 'tokens =', pct(saved, TOTAL_INPUT), 'of the bill');
console.log('  (vs', (CONTENT_REDUCTION * 100).toFixed(1) + '% off raw content — the gap is the fixed overhead)');
console.log('');
console.log('=== sanity: does the model reproduce observed inputs? ===');
console.log('  avg input per request        :', fmt(TOTAL_INPUT / REQUESTS), '(observed last request: 88.3K, peak: 161.1K)');
console.log('  implied avg content          :', fmt(variableTotal / REQUESTS), '-> peak content ~132.6K, final ~59.8K: consistent with the observed curve');
