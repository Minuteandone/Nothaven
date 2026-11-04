import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat } from '../src/combat/rules.js';
import { renderCombat } from '../src/ui/combat.js';

function hero(overrides = {}) {
  return {
    id: 'hero', name: 'Wren', level: 5, hp: 28, maxHp: 36, mp: 12, maxMp: 16,
    atk: 6, def: 3, spd: 5, xp: 0, statuses: [], equipment: { weapon: 'iron_sword' },
    ...overrides,
  };
}

function ally(overrides = {}) {
  return {
    id: 'tamsin', name: 'Tamsin', level: 3, hp: 18, maxHp: 28, mp: 6, maxMp: 10,
    atk: 4, def: 2, spd: 4, statuses: ['bleeding'], equipment: {}, ...overrides,
  };
}

function view(overrides = {}) {
  const combat = overrides.combat || createCombat({ enemyId: 'rust_sentinel' });
  const party = overrides.party || [hero(), ally()];
  return renderCombat({ combat, party, inventory: overrides.inventory || [], menu: overrides.menu || 'main' });
}

test('combat HUD renders effective stats, all party members, statuses, and main commands', () => {
  const html = view();
  assert.match(html, /Battle — Round 1/);
  assert.match(html, /Your party/);
  assert.match(html, /2 fighters/);
  assert.match(html, /Wren/);
  assert.match(html, /Tamsin/);
  assert.match(html, /bleeding/);
  assert.match(html, /Signature move/);
  assert.match(html, /Arc Discharge/);
  assert.match(html, /<dt>ATK<\/dt><dd>13<\/dd>/, 'equipment-aware attack is visible');
  assert.match(html, /role="progressbar" aria-label="HP"/);
  assert.match(html, /role="log" aria-live="polite"/);
  for (const action of ['attack', 'defend', 'flee']) assert.ok(html.includes(`data-action="${action}"`), action);
  assert.ok(html.includes('data-action="menu" data-arg="skills"'));
  assert.ok(html.includes('data-action="menu" data-arg="items"'));
});

test('skill commands expose descriptions, costs, unlocks, MP disabled states, and back action', () => {
  const html = view({ party: [hero({ mp: 3 })], menu: 'skills' });
  for (const id of ['power_strike', 'mend', 'spark', 'warding_stance', 'rallying_light', 'stormbreaker']) {
    assert.ok(html.includes(`data-action="skill" data-arg="${id}"`), id);
  }
  assert.match(html, /A heavy two-handed blow for 160% damage\./);
  assert.match(html, /3 MP/);
  assert.match(html, /data-arg="power_strike" title="[^"]+"(?! disabled)/);
  assert.match(html, /data-arg="mend" title="[^"]+" disabled/);
  assert.match(html, /data-arg="stormbreaker" title="[^"]+" disabled/);
  assert.ok(html.includes('data-action="menu" data-arg="main"'));
});

test('item commands list only consumables with quantities and provide an empty state', () => {
  const html = view({ menu: 'items', inventory: [{ id: 'healing_herb', qty: 2 }, { id: 'iron_sword', qty: 1 }] });
  assert.ok(html.includes('data-action="item" data-arg="healing_herb"'));
  assert.match(html, /Healing Herb/);
  assert.match(html, /×2/);
  assert.ok(!html.includes('data-action="item" data-arg="iron_sword"'));
  const empty = view({ menu: 'items', inventory: [{ id: 'iron_sword', qty: 1 }] });
  assert.match(empty, /No usable items\./);
  assert.ok(empty.includes('data-action="menu" data-arg="main"'));
});

test('bosses disable fleeing and resolved encounters expose only Continue', () => {
  const bossCombat = createCombat({ enemyId: 'tide_wraith' });
  const boss = view({ combat: bossCombat });
  assert.match(boss, /Boss encounter/);
  assert.match(boss, /data-action="flee"[^>]* disabled/);
  assert.match(boss, /Boss encounters must be fought to resolution\./);
  bossCombat.enraged = true;
  assert.match(view({ combat: bossCombat }), /<em class="enraged">\(enraged\)<\/em>/);

  bossCombat.over = 'victory';
  bossCombat.log.push('Victory! +50 XP, +30 gold.');
  const resolved = view({ combat: bossCombat });
  assert.match(resolved, /Encounter resolved/);
  assert.match(resolved, /Rewards have been gathered\./);
  assert.ok(resolved.includes('data-action="finish"'));
  for (const action of ['attack', 'defend', 'flee', 'skill', 'item']) assert.ok(!resolved.includes(`data-action="${action}"`), action);
});

test('down allies and dynamic combat content are presented safely', () => {
  const combat = createCombat({ enemyId: 'storm_rat' });
  combat.enemy.name = '<img src=x onerror=alert(1)>';
  combat.enemy.ability.name = '<svg onload=alert(1)>';
  combat.enemy.tags = ['<script>'];
  combat.log = ['<script>alert(1)</script>'];
  const html = view({
    combat,
    party: [hero({ name: '<b>Wren</b>', statuses: [{ id: '<shocked>', turns: 2 }] }), ally({ hp: 0 })],
  });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<svg onload'));
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('<b>Wren</b>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;shocked&gt; · 2'));
  assert.match(html, /class="unit ally down"/);
  assert.match(html, /<em>Down<\/em>/);
});
