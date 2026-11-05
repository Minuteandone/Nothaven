import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { FIELD_TIPS } from '../src/data/fieldTips.js';
import { ZONES } from '../src/map/zones.js';
import { foeArt } from '../src/ui/bestiary.js';
import { DRILL_FOES } from '../src/scenes/drills.js';
import { FIELD_TRIALS } from '../src/scenes/feats.js';
import { getItem } from '../src/items/items.js';
import { companionRemark } from '../src/party/remarks.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('Cinderclaw is an optional plateau boss outside the drill yard and the Trial Warden set', () => {
  const e = ENEMIES.cinderclaw;
  assert.ok(e && e.boss === true && e.drill === false);
  assert.equal(e.hp, 440);
  assert.equal(e.ability.status, 'bleeding');
  assert.deepEqual(e.windup, { name: 'Pincer Vise', chance: 0.15, mult: 1.8 });
  for (const l of e.loot) assert.ok(getItem(l.id), l.id);
  assert.ok(FIELD_TIPS.cinderclaw);
  assert.ok(!DRILL_FOES.includes('cinderclaw'));
  assert.ok(!FIELD_TRIALS.includes('cinderclaw'));
  assert.ok(foeArt(e).includes('foe-art--crawler'));
  assertEggFree([e.name, e.intro, e.defeat, e.enrage.line, e.ability.name, e.windup.name, FIELD_TIPS.cinderclaw].join(' '), 'cinderclaw text');
});

test('Cinderclaw sits on a free Sunscar tile and waits for spire_reward', () => {
  const zone = ZONES.sunscar_relay;
  const enc = zone.encounters.find((x) => x.id === 'sunscar_cinderclaw');
  assert.ok(enc);
  assert.equal(enc.enemyId, 'cinderclaw');
  assert.equal(enc.main, false);
  assert.equal(enc.x, 4);
  assert.equal(enc.y, 5);
  assert.ok('.,'.includes(zone.grid[enc.y][enc.x]));
  const others = [...zone.encounters.filter((x) => x !== enc), ...zone.interactables, ...zone.exits];
  assert.ok(!others.some((o) => o.x === enc.x && o.y === enc.y));
  assert.ok(!Object.values(zone.spawns || {}).some((p) => p.x === enc.x && p.y === enc.y));
  assert.equal(enc.requiresStoryFlag, 'spire_reward');
  assertEggFree([enc.name, enc.description, enc.requirementMessage].join(' '), 'cinderclaw tile');
});

test('companions remark on Cinderclaw only after the Spire is paid and the foe is beaten', () => {
  const paid = { flags: { rescue_reward: true, spire_reward: true, spire_victory: true } };
  for (const id of ['tamsin', 'iven', 'bram', 'sela']) {
    const line = companionRemark(id, paid, { cinderclaw: 1 });
    assert.match(line, /Cinderclaw|scorpion/, id);
    assert.notEqual(companionRemark(id, paid, {}), line, id);
    assertEggFree(line, `${id} remark`);
  }
});
