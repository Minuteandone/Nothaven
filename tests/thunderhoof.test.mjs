import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { FIELD_TIPS } from '../src/data/fieldTips.js';
import { ZONES } from '../src/map/zones.js';
import { foeArt } from '../src/ui/bestiary.js';
import { DRILL_FOES } from '../src/scenes/drills.js';
import { FIELD_TRIALS } from '../src/scenes/feats.js';
import { GUIDE_SECTIONS } from '../src/scenes/guide.js';
import { getItem } from '../src/items/items.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('Thunderhoof is an optional late ridge boss outside the drill yard and the Trial Warden set', () => {
  const e = ENEMIES.thunderhoof;
  assert.ok(e && e.boss === true && e.drill === false);
  assert.equal(e.hp, 1300);
  assert.ok(e.hp > ENEMIES.cinderclaw.hp && e.hp < ENEMIES.last_squall.hp);
  assert.equal(e.ability.name, 'Arcing Antlers');
  assert.equal(e.ability.status, 'shocked');
  assert.deepEqual(e.windup, { name: 'Stampede Rush', chance: 0.15, mult: 1.8 });
  for (const l of e.loot) assert.ok(getItem(l.id), l.id);
  assert.ok(FIELD_TIPS.thunderhoof);
  assert.ok(!DRILL_FOES.includes('thunderhoof'));
  assert.ok(!FIELD_TRIALS.includes('thunderhoof'));
  assert.ok(foeArt(e).includes('foe-art--beast'));
  assertEggFree([e.name, e.intro, e.defeat, e.enrage.line, e.ability.name, e.windup.name, FIELD_TIPS.thunderhoof].join(' '), 'thunderhoof text');
});

test('Thunderhoof sits on a free ridge tile and waits for strict calibration_reward', () => {
  const zone = ZONES.ridge_road;
  const enc = zone.encounters.find((x) => x.id === 'ridge_thunderhoof');
  assert.ok(enc);
  assert.equal(enc.enemyId, 'thunderhoof');
  assert.equal(enc.encounterId, 'ridge_thunderhoof');
  assert.equal(enc.main, false);
  assert.deepEqual([enc.x, enc.y], [6, 4]);
  assert.ok('.,'.includes(zone.grid[enc.y][enc.x]));
  const others = [...zone.encounters.filter((x) => x !== enc), ...zone.interactables, ...zone.exits];
  assert.ok(!others.some((o) => o.x === enc.x && o.y === enc.y));
  assert.ok(!Object.values(zone.spawns || {}).some((p) => p.x === enc.x && p.y === enc.y));
  assert.equal(enc.requiresStoryFlag, 'calibration_reward');
  assertEggFree([enc.name, enc.description, enc.requirementMessage].join(' '), 'thunderhoof tile');
});

test('the field guide mentions Thunderhoof', () => {
  const text = JSON.stringify(GUIDE_SECTIONS);
  assert.match(text, /Thunderhoof, a storm-charged elk/);
  assertEggFree(text, 'guide');
});
