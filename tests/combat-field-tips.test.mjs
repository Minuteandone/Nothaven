import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat } from '../src/combat/rules.js';
import { renderCombat, combatFieldTip } from '../src/ui/combat.js';

function hero(overrides = {}) {
  return {
    id: 'hero', name: 'Wren', level: 5, hp: 28, maxHp: 36, mp: 12, maxMp: 16,
    atk: 6, def: 3, spd: 5, xp: 0, statuses: [], equipment: { weapon: 'iron_sword' },
    ...overrides,
  };
}

function view(combatOverrides = {}) {
  const combat = combatOverrides.combat || createCombat({ enemyId: 'rust_sentinel' });
  if (combatOverrides.over !== undefined) combat.over = combatOverrides.over;
  if (combatOverrides.enemyId) combat.enemy = { ...combat.enemy, id: combatOverrides.enemyId };
  return renderCombat({ combat, party: [hero()], inventory: [], menu: 'main' });
}

test('combatFieldTip returns tip for foe with FIELD_TIPS entry', () => {
  const c = createCombat({ enemyId: 'rust_sentinel' });
  const tip = combatFieldTip(c);
  assert.ok(tip.includes("Mara's journal"));
  assert.ok(tip.includes('Spark'));
  assert.ok(tip.includes('machinery'));
});

test('combatFieldTip returns empty string for foe without FIELD_TIPS entry', () => {
  const c = createCombat({ enemyId: 'rust_sentinel' });
  c.enemy.id = 'nonexistent_foe_id';
  assert.equal(combatFieldTip(c), '');
});

test('combatFieldTip returns empty string when combat is null', () => {
  assert.equal(combatFieldTip(null), '');
  assert.equal(combatFieldTip(undefined), '');
});

test('combatFieldTip returns empty string when combat.over is truthy', () => {
  const c = createCombat({ enemyId: 'rust_sentinel' });
  c.over = 'victory';
  assert.equal(combatFieldTip(c), '');
  c.over = 'fled';
  assert.equal(combatFieldTip(c), '');
  c.over = 'defeat';
  assert.equal(combatFieldTip(c), '');
});

test('combatFieldTip HTML escapes the tip text', () => {
  const c = createCombat({ enemyId: 'rust_sentinel' });
  c.enemy.id = 'storm_rat'; // "Small and quick to bite..."
  const tip = combatFieldTip(c);
  assert.ok(tip.includes('&ldquo;'));
  assert.ok(tip.includes('&rdquo;'));
  // Extract text between the quotes to verify no raw HTML in tip content
  const match = /&ldquo;(.+?)&rdquo;/.exec(tip);
  assert.ok(match, 'tip should contain smart-quoted text');
  assert.doesNotMatch(match[1], /[<>]/); // no raw angle brackets in tip text content
});

test('renderCombat includes field tip for known foe when combat active', () => {
  const html = view();
  assert.match(html, /field-tip/);
  assert.match(html, /Mara's journal/);
  assert.match(html, /Spark/);
});

test('renderCombat omits field tip when combat.over is set', () => {
  const html = view({ combat: createCombat({ enemyId: 'rust_sentinel' }), over: 'victory' });
  assert.doesNotMatch(html, /field-tip/);
});

test('renderCombat omits field tip for foe without FIELD_TIPS entry', () => {
  const c = createCombat({ enemyId: 'rust_sentinel' });
  c.enemy.id = 'nonexistent_foe';
  const html = renderCombat({ combat: c, party: [hero()] });
  assert.doesNotMatch(html, /field-tip/);
});

test('field tips in combat are egg-free', () => {
  // 'hen' excluded as known false positive — FIELD_TIPS use 'when' extensively
  const HIDDEN = /egg|yolk|omel|scram|fried|boil|sunny|easter|hatch|nest|chick|poach|shell|devil|bened|quail|coddl|clutch|ovum|oeuf|huevo/i;
  for (const enemyId of ['rust_sentinel', 'storm_rat', 'gale_hound', 'ridge_bandit', 'old_tusk', 'thunderhoof', 'frostmane', 'storm_heart']) {
    const c = createCombat({ enemyId });
    const tip = combatFieldTip(c);
    if (tip) {
      const plain = tip.replace(/<[^>]+>/g, '');
      assert.doesNotMatch(plain, HIDDEN, `field tip for ${enemyId} contains hidden egg word`);
    }
  }
});

test('combatFieldTip has correct ARIA label', () => {
  const c = createCombat({ enemyId: 'rust_sentinel' });
  const tip = combatFieldTip(c);
  assert.match(tip, /aria-label="Warden Mara's tactical advice"/);
});

test('field-tip CSS class is present', () => {
  const c = createCombat({ enemyId: 'rust_sentinel' });
  const tip = combatFieldTip(c);
  assert.match(tip, /class="field-tip"/);
});
