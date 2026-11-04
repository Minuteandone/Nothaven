import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { fieldTip } from '../src/data/fieldTips.js';
import { foeArt } from '../src/ui/bestiary.js';
import { ZONES } from '../src/map/zones.js';
import { isKnownItem } from '../src/items/items.js';
import { createCombat } from '../src/combat/rules.js';

const FOES = { briar_boar: ['ridge_road', 'beast'], lens_wisp: ['observatory_ruins', 'spectre'], wrack_eel: ['saltmere_coast', 'crawler'], rime_wight: ['highwatch_pass', 'spectre'] };
const EGG_RE = /egg|yolk|shell|hatch|nest|chick|omelet|scramble|\bhen\b|poach|cluck|goose|quail|oval/i;

test('frontier foes are defined, tipped, illustrated and placed in their zone pools', () => {
  for (const [id, [zone, kind]] of Object.entries(FOES)) {
    const e = ENEMIES[id];
    assert.ok(e, id);
    assert.notEqual(e.boss, true, `${id} is a patrol foe`);
    assert.ok(e.hp >= 16 && e.hp <= 28 && e.atk <= 9, `${id} fits early-zone tuning`);
    for (const drop of e.loot) assert.ok(isKnownItem(drop.id), `${id} drops known ${drop.id}`);
    assert.ok(fieldTip(id).length > 10);
    assert.match(foeArt(e), new RegExp(`foe-art--${kind}`));
    const pool = ZONES[zone].randomEncounters;
    assert.equal(pool.filter((r) => r.enemyId === id).length, 1, `${id} appears once in ${zone}`);
    assert.equal(createCombat({ enemyId: id, encounterId: null }).enemy.id, id);
    const text = [e.name, e.intro, e.ability.name, fieldTip(id)].join(' ');
    assert.doesNotMatch(text, EGG_RE, id);
  }
});
