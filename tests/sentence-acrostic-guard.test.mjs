import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Same hidden-word list as tests/acrosticGuard.test.mjs, applied to the
// initials of consecutive SENTENCES in player-facing prose. Catalogue guards
// only read list/field initials; this closes the gap where a run of appended
// sentences spells a word with their first letters.
const HIDDEN = /egg|yolk|omel|scram|fried|boil|sunny|easter|hatch|nest|chick|poach|shell|devil|bened|quail|hen|coddl|clutch|ovum|oeuf|huevo/i;

export function splitSentences(text) {
  const plain = String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*|`|\[|\]\([^)]*\)/g, '');
  return plain
    .split(/(?<=[.!?][”"’)]?)\s+(?=[“"‘(]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function sentenceInitials(text) {
  return splitSentences(text)
    .map((s) => (s.match(/[A-Za-z]/) || [''])[0].toLowerCase())
    .join('');
}

export function sentenceAcrosticProblems(label, units) {
  const problems = [];
  units.forEach((unit, i) => {
    const forward = sentenceInitials(unit);
    const reversed = [...forward].reverse().join('');
    for (const [kind, s] of [['forward', forward], ['reversed', reversed]]) {
      const m = s.match(HIDDEN);
      if (m) problems.push(`${label} unit ${i + 1}: ${kind} sentence initials "${forward}" hide "${m[0]}"`);
    }
  });
  return problems;
}

function markdownUnits(text) {
  return text.split(/\n\s*\n|\n(?=[-*#] |\d+\. )/);
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MARKDOWN = ['README.md', 'docs/PLAYER_GUIDE.md', 'docs/DEV_WORKFLOW.md', 'src/map/README.md'];
const LINE_SOURCES = ['src/scenes/guide.js'];

for (const file of MARKDOWN) {
  test(`${file} paragraphs hide no words in their sentence initials`, () => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.deepEqual(sentenceAcrosticProblems(file, markdownUnits(text)), []);
  });
}

for (const file of LINE_SOURCES) {
  test(`${file} lines hide no words in their sentence initials`, () => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.deepEqual(sentenceAcrosticProblems(file, text.split('\n')), []);
  });
}

test('the guard flags a planted sentence acrostic, forwards and reversed', () => {
  const planted = 'Every craft previews its output. Get the full stat line first. Gear choices get easier.';
  assert.equal(sentenceInitials(planted), 'egg');
  assert.equal(sentenceAcrosticProblems('planted', [planted]).length, 1);
  const backwards = 'Gear choices get easier. Get the full stat line first. Every craft previews its output.';
  assert.match(sentenceAcrosticProblems('backwards', [backwards]).join('\n'), /reversed/);
  assert.deepEqual(sentenceAcrosticProblems('clean', ['Defend halves it. A stun breaks it.']), []);
});
