import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const frontmatter = (md) => {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, 'SKILL.md must start with a --- frontmatter block');
  return m[1];
};

test('SKILL.md frontmatter carries the identity the installer reads', () => {
  const fm = frontmatter(read('SKILL.md'));
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();

  assert.equal(name, 'tokenskip-context');
  assert.ok(description && description.length > 80, 'description must be substantive');

  const pkg = JSON.parse(read('package.json'));
  assert.equal(name, pkg.name, 'skill name and package name must agree');
});

test('SKILL.md states the force-token rule and its honest limits', () => {
  const md = read('SKILL.md');
  for (const needle of ['force-token', 'droppable', 'light', 'balanced', 'deep']) {
    assert.ok(md.toLowerCase().includes(needle.toLowerCase()), `SKILL.md should mention "${needle}"`);
  }
  assert.match(md, /does not|not a|no token-saving percentage|No token-saving/i, 'must not promise a savings figure');
});

test('agents/openai.yaml keeps the pack opt-in', () => {
  const yaml = read(path.join('agents', 'openai.yaml'));
  assert.match(yaml, /allow_implicit_invocation:\s*false/, 'must not fire on its own');
  assert.match(yaml, /display_name:/);
  assert.match(yaml, /default_prompt:/);
});

test('installer bundle list matches the files on disk', () => {
  const installer = read('install.mjs');
  assert.match(installer, /BUNDLE_FILES\s*=\s*\['SKILL\.md', path\.join\('agents', 'openai\.yaml'\)\]/);
  assert.ok(fs.existsSync(path.join(REPO, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(REPO, 'agents', 'openai.yaml')));
});

test('the measurement numbers in docs match the committed sheet', () => {
  const doc = read(path.join('docs', 'measurement.md'));
  for (const figure of ['20.5%', '15.0%', '719,532', '19.07M', '1.024']) {
    assert.ok(doc.includes(figure), `docs/measurement.md should carry ${figure}`);
  }
  assert.ok(
    fs.statSync(path.join(REPO, 'docs', 'assets', 'token-savings-measurement.xlsx')).size > 1000,
    'sheet is committed',
  );
});
