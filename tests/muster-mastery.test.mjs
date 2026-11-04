import test from 'node:test';
import assert from 'node:assert/strict';
import { masteryLine } from '../src/ui/muster.js';
import { COMPANIONS, createCompanionMember } from '../src/party/companions.js';

const get = (id) => (Array.isArray(COMPANIONS) ? COMPANIONS.find(c => c.id === id) : COMPANIONS[id]);

test('muster mastery line shows the unlock level before level 8', () => {
  const html = masteryLine(get('sela'), createCompanionMember('sela', 5));
  assert.match(html, /Mastery at Lv 8: Bright Flare/);
  assert.doesNotMatch(html, /companion-mastery--done/);
  assert.match(masteryLine(get('iven'), null), /Mastery at Lv 8: Keeper’s Mend/);
});

test('muster mastery line marks mastered companions', () => {
  const html = masteryLine(get('bram'), createCompanionMember('bram', 9));
  assert.match(html, /companion-mastery--done/);
  assert.match(html, /Mastered: Bulwark Bash/);
  assert.equal(masteryLine({ role: 'unknown' }, null), '');
});
