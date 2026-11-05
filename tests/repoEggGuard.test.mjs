import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EGG_RE, findEggWords } from './helpers/eggGuard.mjs';

// Repo-wide Easter-egg guard: every shipped source, stylesheet, page and doc.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const FILES = [
  ...walk(join(root, 'src')),
  ...walk(join(root, 'docs')),
  join(root, 'style.css'),
  join(root, 'index.html'),
  join(root, 'README.md'),
].filter((path) => /\.(m?js|css|html|md)$/.test(path));

// Vetted benign wording. Strip exact tokens rather than skipping whole lines,
// so anything else on the same line is still scanned.
const BENIGN_TOKENS = [/\bgame-shell\b/g, /cuts a golden path through the storm/g];
const scrub = (text) => BENIGN_TOKENS.reduce((acc, re) => acc.replace(re, ''), text);

test('shared EGG_RE catches the classic references', () => {
  for (const word of ['egg', 'Yolk', 'hatchling', 'over-easy', 'Humpty', 'omelette', 'cackling', 'pearl', '🥚', '🍳']) {
    assert.match(word, EGG_RE, word);
  }
  for (const word of ['eastern', 'pearl_focus', 'shelter', 'hence', 'nestled_in_code_ids', 'ground']) {
    assert.doesNotMatch(word, EGG_RE, word);
  }
});

test('the guard actually scans a meaningful set of files', () => {
  assert.ok(FILES.length > 40, `only ${FILES.length} files found`);
  assert.ok(FILES.some((f) => f.endsWith('style.css')));
});

test('no shipped source, stylesheet, page or doc contains egg references', () => {
  const hits = FILES.flatMap((path) => findEggWords(scrub(readFileSync(path, 'utf8'))).map((h) => `${path.slice(root.length + 1)}:${h}`));
  assert.deepEqual(hits, []);
});

test('no egg-shaped (elliptical) CSS or SVG shapes ship', () => {
  const OVAL_RE = /<ellipse\b|ellipse\(|radial-gradient\(\s*ellipse|border-radius\s*:[^;]*\//i;
  const hits = FILES.filter((path) => /\.(m?js|css|html)$/.test(path))
    .flatMap((path) => readFileSync(path, 'utf8').split('\n')
      .map((line, i) => (OVAL_RE.test(line) ? `${path.slice(root.length + 1)}:${i + 1}` : null))
      .filter(Boolean));
  assert.deepEqual(hits, []);
});
