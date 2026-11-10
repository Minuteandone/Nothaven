import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { SKILLS } from '../src/combat/rules.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = ' Against late bosses and field trials, trading blows alone often falls short: raise Beacon Aegis or Warding Stance before a gathered heavy blow lands, restore the party with Rallying Light or Stormhaven Vigil before health runs low, clear shock with Steady Signal, and keep Rekindle ready for a fallen companion — a party that stays standing keeps dealing damage over a long fight.';

test('guide teaches support play once in PLAYER_GUIDE and the in-game guide', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE, 'support play sentence');
});

test('support play sentence names real skills with the roles it describes', () => {
  const byName = Object.fromEntries(Object.values(SKILLS).map((s) => [s.name, s]));
  const expect = {
    'Beacon Aegis': 'party_ward',
    'Warding Stance': 'ward',
    'Rallying Light': 'party_heal',
    'Stormhaven Vigil': 'vigil',
    'Steady Signal': 'cleanse',
    Rekindle: 'revive',
  };
  for (const [name, kind] of Object.entries(expect)) {
    assert.ok(SENTENCE.includes(name), name);
    assert.ok(byName[name], `${name} exists`);
    assert.equal(byName[name].kind, kind, name);
  }
});
