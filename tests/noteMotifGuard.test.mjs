import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Musical cues can spell words with note letters (E-G-G) where no text
// scanner looks. This guard maps equal-temperament frequencies to letters.
const NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

export function noteLetter(hz) {
  if (!Number.isFinite(hz) || hz < 20 || hz > 8000) return null;
  const semis = 12 * Math.log2(hz / 440);
  const near = Math.round(semis);
  if (Math.abs(semis - near) > 0.05) return null; // not a tuned pitch
  return NAMES[((near % 12) + 12) % 12];
}

export function spellsEgg(freqs) {
  const letters = freqs.map(noteLetter).map((l) => (l ? l[0] : '.')).join('');
  return /EGG/.test(letters) || /GGE/.test(letters);
}

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const nums = (s) => (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

export function noteMotifProblems(source, label = 'source') {
  const problems = [];
  for (const m of source.matchAll(/\[\s*\d[\d.,\s]*\]/g)) {
    if (spellsEgg(nums(m[0]))) problems.push(`${label}: array ${m[0]}`);
  }
  const assigned = [...source.matchAll(/frequency(?:\.value)?\s*[:=]\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (spellsEgg(assigned)) problems.push(`${label}: frequency sequence ${assigned.join(', ')}`);
  return problems;
}

test('note letters map from tuned frequencies', () => {
  assert.equal(noteLetter(329.63), 'E');
  assert.equal(noteLetter(392), 'G');
  assert.equal(noteLetter(82.41), 'E');
  assert.equal(noteLetter(43), null);
});

test('the guard catches a planted E-G-G cue and drone stack', () => {
  assert.ok(noteMotifProblems('[329.63, 392, 392].forEach(() => {});').length);
  assert.ok(noteMotifProblems('a.frequency.value = 82.41; b.frequency.value = 98; c.frequency.value = 98;').length);
  assert.ok(noteMotifProblems('[261.63, 329.63, 392, 392, 523.25]').length);
  assert.deepEqual(noteMotifProblems('[261.63, 329.63, 392, 523.25] [440, 554.37, 659.25]'), []);
});

test('no source file spells E-G-G in musical notes', () => {
  const problems = walk('src').flatMap((f) => noteMotifProblems(readFileSync(f, 'utf8'), f));
  assert.deepEqual(problems, []);
});
