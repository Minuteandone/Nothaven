import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { FIELD_TIPS } from '../src/data/fieldTips.js';
import { ZONES } from '../src/map/zones.js';
import { foeArt } from '../src/ui/bestiary.js';
import { DRILL_FOES } from '../src/scenes/drills.js';
import { getItem } from '../src/items/items.js';

const EGG_RE = /\b(egg|eggs|yolk|shell|hatch|nest|chick|hen|omelet|scrambl\w*|poach\w*|fried|boil\w*|cackle|golden|feather|oval|easter)\b|🥚|🐣|🍳|🐔|🐤/i;

test('Gloomfin is an optional coast boss outside the drill yard', () => {
  const e = ENEMIES.gloomfin;
  assert.ok(e && e.boss === true && e.drill === false);
  assert.equal(e.hp, 150);
  assert.ok(e.enrage && e.ability.status === 'shocked');
  for (const l of e.loot) assert.ok(getItem(l.id), l.id);
  assert.ok(FIELD_TIPS.gloomfin);
  assert.ok(!DRILL_FOES.includes('gloomfin'));
  assert.ok(foeArt(e).includes('foe-art--crawler'));
  const text = [e.name, e.intro, e.defeat, e.enrage.line, e.ability.name, FIELD_TIPS.gloomfin].join(' ');
  assert.ok(!EGG_RE.test(text), text);
});

test('Gloomfin encounter sits on an open coast tile and waits for rescue_reward', () => {
  const zone = ZONES.saltmere_coast;
  const enc = zone.encounters.find((x) => x.id === 'saltmere_gloomfin');
  assert.ok(enc);
  assert.equal(enc.enemyId, 'gloomfin');
  assert.equal(enc.main, false);
  assert.ok('.,'.includes(zone.grid[enc.y][enc.x]));
  const others = [...zone.encounters.filter((x) => x !== enc), ...zone.interactables, ...zone.exits];
  assert.ok(!others.some((o) => o.x === enc.x && o.y === enc.y));
  assert.equal(enc.requiresStoryFlag, 'rescue_reward');
  assert.ok(enc.requirementMessage);
  assert.ok(!EGG_RE.test(enc.name + ' ' + enc.description + ' ' + enc.requirementMessage));
});
