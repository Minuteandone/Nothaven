import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat } from '../src/combat/rules.js';
import { renderCombat, rewardsLine } from '../src/ui/combat.js';

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


test('rewardsLine returns XP, gold, and items for victory', () => {
  const combat = { over: 'victory', rewards: { xp: 50, gold: 30, items: [{ id: 'healing_herb', qty: 2 }, { id: 'bandage', qty: 1 }] } };
  const html = rewardsLine(combat);
  assert.match(html, /\+50 XP/);
  assert.match(html, /\+30 gold/);
  assert.match(html, /Found:/);
  assert.match(html, /2× Healing Herb/);
  assert.match(html, /1× Linen Bandage/);
  assert.match(html, /class="battle-rewards"/);
});

test('rewardsLine shows only XP for drill victory (no gold or items)', () => {
  const combat = { over: 'victory', rewards: { xp: 25, gold: 0, items: [] } };
  const html = rewardsLine(combat);
  assert.match(html, /\+25 XP/);
  assert.ok(!html.includes('gold'));
  assert.ok(!html.includes('Found:'));
});

test('rewardsLine returns empty string when combat has no rewards', () => {
  assert.strictEqual(rewardsLine({ over: 'defeat' }), '');
  assert.strictEqual(rewardsLine({ over: 'escaped' }), '');
  assert.strictEqual(rewardsLine(null), '');
  assert.strictEqual(rewardsLine({}), '');
});

test('rewardsLine falls back to item ID when getItem throws for unknown id', () => {
  const combat = { over: 'victory', rewards: { xp: 10, gold: 0, items: [{ id: 'nonexistent_xyz', qty: 1 }] } };
  const html = rewardsLine(combat);
  assert.match(html, /\+10 XP/);
  assert.match(html, /nonexistent_xyz/);
  assert.ok(!html.includes('undefined'));
});

test('rewardsLine escapes hostile item quantity values', () => {
  const combat = { over: 'victory', rewards: { xp: 5, gold: 0, items: [{ id: 'healing_herb', qty: '<script>alert(1)</script>' }] } };
  const html = rewardsLine(combat);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.match(html, /Healing Herb/);
});

test('rewardsLine renders via renderCombat on victory outcome screen', () => {
  const combat = createCombat({ enemyId: 'storm_rat' });
  combat.over = 'victory';
  combat.rewards = { xp: 40, gold: 15, items: [{ id: 'healing_herb', qty: 1 }] };
  const html = view({ combat });
  assert.match(html, /battle-rewards/);
  assert.match(html, /\+40 XP/);
  assert.match(html, /\+15 gold/);
  assert.match(html, /1× Healing Herb/);
});
