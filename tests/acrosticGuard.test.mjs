import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, ZONE_ORDER } from '../src/map/zones.js';
import { ENEMIES } from '../src/data/enemies.js';

// Hidden words can be spelled by the first letters of a text field read in game order.
const HIDDEN = /egg|yolk|omel|scram|fried|boil|sunny|easter|hatch|nest|chick|poach|shell|devil|bened|quail|hen|coddl|clutch|ovum|oeuf|huevo/i;

function fieldsOf(list) {
  const fields = {};
  const walk = (value, path) => {
    if (typeof value === 'string') (fields[path] ??= []).push(value);
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const key of Object.keys(value)) walk(value[key], path ? `${path}.${key}` : key);
    }
  };
  for (const entry of list) walk(entry, '');
  return fields;
}

export function acrosticProblems(list) {
  const problems = [];
  for (const [path, values] of Object.entries(fieldsOf(list))) {
    const words = values.map((v) => v.trim().split(/\s+/));
    const reads = {
      first: words.map((w) => (w[0] || '')[0] || '').join(''),
      second: words.map((w) => (w[1] || '')[0] || '').join(''),
      last: words.map((w) => (w[w.length - 1] || '')[0] || '').join('')
    };
    for (const [kind, letters] of Object.entries(reads)) {
      for (const text of [letters, [...letters].reverse().join('')]) {
        if (HIDDEN.test(text)) problems.push(`${path} ${kind}-word initials read ${text}`);
      }
    }
  }
  return problems;
}

test('zone text fields hide no words in their initials (zone order)', () => {
  assert.deepEqual(acrosticProblems(ZONE_ORDER.map((id) => ZONES[id])), []);
});

test('enemy text fields hide no words in their initials (roster order)', () => {
  assert.deepEqual(acrosticProblems(Object.values(ENEMIES)), []);
});

test('the guard flags a planted acrostic', () => {
  const planted = ['Every', 'Grey', 'Gust'].map((w) => ({ note: `${w} wind` }));
  assert.ok(acrosticProblems(planted).some((p) => p.startsWith('note first')));
});
