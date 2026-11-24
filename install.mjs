#!/usr/bin/env node
/**
 * install.mjs — install or remove the `tokenskip-context` skill.
 *
 * Portable: the bundle is the directory this file lives in, so the whole folder
 * can be copied anywhere and installed from there.
 *
 *   node install.mjs              install (or refresh) the skill
 *   node install.mjs --status     report only, change nothing
 *   node install.mjs --uninstall  remove the bundle and its catalog entry
 *   node install.mjs --help       this text
 *
 * Target plugin root defaults to <DSH_HOME>/plugins/dsh-codex-skills and can be
 * overridden with DSH_CODEX_SKILLS_PLUGIN — that is also what the test suite does.
 *
 * Why catalog.json is edited directly: the dsh-codex-skills plugin lists skills
 * from a generated catalog.json and its watcher reloads on change, so one surgical
 * edit makes the skill discoverable without a restart. Rebuilding the whole skills
 * tree would wipe skills that were installed from other sources.
 *
 * The catalog's `modelInvocable` flag is derived from agents/openai.yaml
 * (policy.allow_implicit_invocation), so the "opt-in only" switch lives in exactly
 * one place. This pack ships with implicit invocation OFF on purpose: it is meant
 * to run when you ask for it, not to fire on every long turn.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SKILL = 'tokenskip-context';
const SOURCE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_FILES = ['SKILL.md', path.join('agents', 'openai.yaml')];

const argv = process.argv.slice(2);
const uninstall = argv.includes('--uninstall');
const statusOnly = argv.includes('--status');
const help = argv.includes('--help') || argv.includes('-h');

function pluginRoot() {
  if (process.env.DSH_CODEX_SKILLS_PLUGIN) return process.env.DSH_CODEX_SKILLS_PLUGIN;
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'plugins', 'dsh-codex-skills');
}

const PLUGIN = pluginRoot();
const TARGET = path.join(PLUGIN, 'skills', SKILL);
const CATALOG = path.join(PLUGIN, 'catalog.json');

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12);
const readCatalog = () => JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const writeCatalog = (c) => fs.writeFileSync(CATALOG, JSON.stringify(c, null, 2) + '\n', 'utf8');
const findIndex = (c) => c.skills.findIndex((s) => s.name === SKILL);

function frontmatterDescription() {
  const raw = fs.readFileSync(path.join(SOURCE, 'SKILL.md'), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return '';
  const d = m[1].match(/^description:\s*(.+)$/m);
  return d ? d[1].trim() : '';
}

/** policy.allow_implicit_invocation from agents/openai.yaml; absent means true. */
function allowImplicitInvocation() {
  const p = path.join(SOURCE, 'agents', 'openai.yaml');
  if (!fs.existsSync(p)) return true;
  const m = fs.readFileSync(p, 'utf8').match(/^\s*allow_implicit_invocation:\s*(\S+)/m);
  if (!m) return true;
  return !/^(false|no|off|0)$/i.test(m[1].trim());
}

if (help) {
  console.log(`tokenskip-context installer

  node install.mjs              install (or refresh) the skill
  node install.mjs --status     report only, change nothing
  node install.mjs --uninstall  remove the bundle and its catalog entry

Target plugin root: ${PLUGIN}
  (override with DSH_CODEX_SKILLS_PLUGIN; default comes from DSH_HOME or ~/.dsh)`);
  process.exit(0);
}

if (!fs.existsSync(CATALOG)) {
  console.error('catalog.json not found at ' + CATALOG);
  console.error('Set DSH_CODEX_SKILLS_PLUGIN to the dsh-codex-skills plugin root.');
  process.exit(2);
}

const modelInvocable = allowImplicitInvocation();

if (statusOnly) {
  const c = readCatalog();
  const i = findIndex(c);
  const bundleOk = BUNDLE_FILES.every((rel) => fs.existsSync(path.join(TARGET, rel)));
  console.log(`skill           : ${SKILL}`);
  console.log(`source          : ${SOURCE} ${fs.existsSync(path.join(SOURCE, 'SKILL.md')) ? 'ok' : 'MISSING'}`);
  console.log(`installed bundle: ${TARGET} ${bundleOk ? 'ok' : 'MISSING'}`);
  console.log(`catalog entry   : ${i >= 0 ? 'present (index ' + i + ')' : 'absent'}`);
  if (i >= 0) console.log(`modelInvocable  : ${c.skills[i].modelInvocable} (pack says ${modelInvocable})`);
  console.log(`catalog skills  : ${c.skills.length}`);
  process.exit(0);
}

if (uninstall) {
  const c = readCatalog();
  const i = findIndex(c);
  if (i >= 0) {
    c.skills.splice(i, 1);
    c.stats = c.stats || {};
    c.stats.skillCount = c.skills.length;
    writeCatalog(c);
    console.log('catalog entry removed');
  } else {
    console.log('catalog entry already absent');
  }
  fs.rmSync(TARGET, { recursive: true, force: true });
  console.log('bundle removed from plugin: ' + TARGET);
  console.log('source kept at ' + SOURCE);
  process.exit(0);
}

// --- install -------------------------------------------------------------
const description = frontmatterDescription();
if (!description) {
  console.error('no description: found in SKILL.md frontmatter');
  process.exit(2);
}

fs.mkdirSync(TARGET, { recursive: true });
for (const rel of BUNDLE_FILES) {
  const src = path.join(SOURCE, rel);
  const dst = path.join(TARGET, rel);
  if (!fs.existsSync(src)) {
    console.error('missing source file: ' + src);
    process.exit(2);
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`  copied ${rel} (${sha(dst)})`);
}

const c = readCatalog();
const existing = findIndex(c);
if (existing >= 0) {
  c.skills[existing].description = description;
  c.skills[existing].modelInvocable = modelInvocable;
  console.log('catalog entry updated (index ' + existing + ')');
} else {
  const entry = {
    name: SKILL,
    dir: SKILL,
    file: 'SKILL.md',
    description,
    modelInvocable,
    userInvocable: true,
    metadata: {},
  };
  let at = c.skills.findIndex((s) => s.name.localeCompare(SKILL, 'en') > 0);
  if (at === -1) at = c.skills.length;
  c.skills.splice(at, 0, entry);
  console.log('catalog entry inserted at index ' + at);
}
c.stats = c.stats || {};
c.stats.skillCount = c.skills.length;
writeCatalog(c);

const check = readCatalog();
const ok =
  findIndex(check) >= 0 &&
  BUNDLE_FILES.every((rel) => fs.existsSync(path.join(TARGET, rel)));
console.log(`\nverify: ${ok ? 'OK' : 'FAILED'} — ${check.skills.length} skills in catalog`);
console.log(`modelInvocable: ${modelInvocable ? 'true (may fire on its own)' : 'false (opt-in: runs only when asked)'}`);
process.exit(ok ? 0 : 1);
