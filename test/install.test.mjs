import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTALL = path.join(REPO, 'install.mjs');

/** An isolated fake plugin root: <tmp>/catalog.json, empty skills tree. */
function sandbox({ withCatalog = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenskip-install-'));
  if (withCatalog) {
    fs.writeFileSync(
      path.join(root, 'catalog.json'),
      JSON.stringify({ skills: [], stats: { skillCount: 0 } }, null, 2),
      'utf8',
    );
  }
  return root;
}

function run(root, ...args) {
  const res = spawnSync(process.execPath, [INSTALL, ...args], {
    encoding: 'utf8',
    env: { ...process.env, DSH_CODEX_SKILLS_PLUGIN: root, DSH_HOME: root },
  });
  return { code: res.status, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

const catalogOf = (root) => JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
const bundleDir = (root) => path.join(root, 'skills', 'tokenskip-context');
const entryOf = (root) => catalogOf(root).skills.find((s) => s.name === 'tokenskip-context');

test('install copies the bundle and registers an opt-in catalog entry', () => {
  const root = sandbox();
  const { code, out } = run(root);
  assert.equal(code, 0, out);
  assert.match(out, /verify: OK/);

  assert.ok(fs.existsSync(path.join(bundleDir(root), 'SKILL.md')), 'SKILL.md copied');
  assert.ok(fs.existsSync(path.join(bundleDir(root), 'agents', 'openai.yaml')), 'openai.yaml copied');

  const entry = entryOf(root);
  assert.ok(entry, 'catalog entry present');
  assert.equal(entry.dir, 'tokenskip-context');
  assert.equal(entry.file, 'SKILL.md');
  assert.ok(entry.description.length > 40, 'description comes from the frontmatter');
  // The pack ships with allow_implicit_invocation: false, so the catalog must agree.
  assert.equal(entry.modelInvocable, false, 'opt-in only');
  assert.equal(entry.userInvocable, true);
  assert.equal(catalogOf(root).stats.skillCount, 1);
});

test('install is idempotent — a second run updates instead of duplicating', () => {
  const root = sandbox();
  assert.equal(run(root).code, 0);
  const { code, out } = run(root);
  assert.equal(code, 0, out);
  assert.match(out, /catalog entry updated/);
  assert.equal(catalogOf(root).skills.filter((s) => s.name === 'tokenskip-context').length, 1);
});

test('--status reports without changing anything', () => {
  const root = sandbox();
  const before = fs.readFileSync(path.join(root, 'catalog.json'), 'utf8');
  const { code, out } = run(root, '--status');
  assert.equal(code, 0, out);
  assert.match(out, /catalog entry   : absent/);
  assert.equal(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'), before, 'catalog untouched');
  assert.equal(fs.existsSync(bundleDir(root)), false, 'nothing installed');

  run(root);
  const after = run(root, '--status');
  assert.equal(after.code, 0, after.out);
  assert.match(after.out, /catalog entry   : present/);
  assert.match(after.out, /installed bundle: .* ok/);
});

test('--uninstall removes entry and bundle, keeps the source, and is safe to repeat', () => {
  const root = sandbox();
  run(root);

  const first = run(root, '--uninstall');
  assert.equal(first.code, 0, first.out);
  assert.match(first.out, /catalog entry removed/);
  assert.equal(entryOf(root), undefined);
  assert.equal(fs.existsSync(bundleDir(root)), false);

  const second = run(root, '--uninstall');
  assert.equal(second.code, 0, second.out);
  assert.match(second.out, /already absent/);

  // the repo copy is the source of truth and must never be touched
  assert.ok(fs.existsSync(path.join(REPO, 'SKILL.md')));
});

test('a missing catalog.json is a clear, non-zero failure', () => {
  const root = sandbox({ withCatalog: false });
  const { code, out } = run(root);
  assert.equal(code, 2, out);
  assert.match(out, /catalog\.json not found/);
});

test('a UTF-8 BOM in catalog.json does not break the installer', () => {
  // Hand-editing catalog.json on Windows easily adds a BOM; JSON.parse would throw.
  const root = sandbox();
  const catalog = path.join(root, 'catalog.json');
  fs.writeFileSync(catalog, '\uFEFF' + fs.readFileSync(catalog, 'utf8'), 'utf8');

  const { code, out } = run(root);
  assert.equal(code, 0, out);
  assert.match(out, /verify: OK/);
  assert.equal(entryOf(root)?.name, 'tokenskip-context');
});

test('--help explains the modes without touching the filesystem', () => {
  const root = sandbox();
  const { code, out } = run(root, '--help');
  assert.equal(code, 0, out);
  assert.match(out, /--uninstall/);
  assert.match(out, /DSH_CODEX_SKILLS_PLUGIN/);
});
