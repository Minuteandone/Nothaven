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

test('Glacierward Colossus is an optional Highwatch boss tougher than Thunderhoof', () => {
  const e = ENEMIES.glacierward_colossus;
  assert.ok(e && e.boss === true && e.drill === false);
  assert.equal(e.hp, 1500);
  assert.ok(e.hp > ENEMIES.thunderhoof.hp);
  assert.ok(e.atk > ENEMIES.thunderhoof.atk);
  assert.equal(e.ability.name, 'Rime Shard Volley');
  assert.equal(e.ability.status, 'bleeding');
  assert.deepEqual(e.windup, { name: 'Glacier Slam', chance: 0.15, mult: 1.8 });
  for (const l of e.loot) assert.ok(getItem(l.id), l.id);
  assert.ok(e.loot.some((l) => l.id === 'frostward_cloak'));
  assert.ok(FIELD_TIPS.glacierward_colossus);
  assert.ok(!DRILL_FOES.includes('glacierward_colossus'));
  assert.ok(!FIELD_TRIALS.includes('glacierward_colossus'));
  assert.ok(foeArt(e).includes('foe-art--construct'));
  assertEggFree([e.name, e.intro, e.defeat, e.enrage.line, e.ability.name, e.windup.name, FIELD_TIPS.glacierward_colossus].join(' '), 'glacierward text');
});

test('Glacierward Colossus sits on a free Highwatch tile and waits for strict calibration_reward', () => {
  const zone = ZONES.highwatch_pass;
  const enc = zone.encounters.find((x) => x.id === 'highwatch_glacierward');
  assert.ok(enc);
  assert.equal(enc.enemyId, 'glacierward_colossus');
  assert.equal(enc.encounterId, 'highwatch_glacierward');
  assert.equal(enc.main, false);
  assert.deepEqual([enc.x, enc.y], [5, 5]);
  assert.ok('.,'.includes(zone.grid[enc.y][enc.x]));
  const others = [...zone.encounters.filter((x) => x !== enc), ...(zone.interactables || []), ...(zone.exits || []), ...(zone.npcs || [])];
  assert.ok(!others.some((o) => o.x === enc.x && o.y === enc.y));
  assert.ok(!Object.values(zone.spawns || {}).some((p) => p.x === enc.x && p.y === enc.y));
  assert.equal(enc.requiresStoryFlag, 'calibration_reward');
  assertEggFree([enc.name, enc.description, enc.requirementMessage].join(' '), 'glacierward tile');
});

test('the field guide mentions the Glacierward Colossus', () => {
  const text = JSON.stringify(GUIDE_SECTIONS);
  assert.match(text, /Glacierward Colossus/);
  assertEggFree(text, 'guide');
});
