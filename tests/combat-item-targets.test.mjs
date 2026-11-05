import test from 'node:test';
import assert from 'node:assert/strict';
import { combatScene } from '../src/scenes/combat.js';
import { createCombat } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';
import { renderCombat } from '../src/ui/combat.js';
import { combatShortcutTarget } from '../src/ui/combatControls.js';

function fixture() {
  const state = createInitialState();
  const member = (id, name) => ({ ...structuredClone(state.party[0]), id, name, hp: 10, mp: 0, statuses: [] });
  state.party = [member('hero', 'Wren'), member('bram', 'Bram'), member('sela', 'Sela')];
  state.combat = createCombat({ enemyId: 'storm_heart' });
  state.combat.enemy.statuses = ['stunned'];
  state.inventory = [{ id: 'bandage', qty: 2 }, { id: 'storm_tonic', qty: 2 }];
  state.scene = 'combat';
  let calls = 0;
  return { state, combatMenu: 'main', combatRng: () => { calls++; return .5; }, calls: () => calls,
    bus: { emit() {} }, scenes: { town: {}, combat: combatScene }, setScene(name) { state.scene = name; } };
}
const act = (g, action, arg) => combatScene.actions[action](g, { dataset: { arg } });
const snapshot = g => structuredClone(g.state);

test('recipient selection and cancellation are turn-free, transient and strict', () => {
  const g = fixture(), before = snapshot(g);
  act(g, 'menu', 'items');
  assert.equal(g.combatItemTarget, g.state.party[0]);
  act(g, 'itemTarget', '1');
  assert.equal(g.combatItemTarget, g.state.party[1]);
  for (const arg of [undefined, null, '', '01', '-1', '1.0', '1e0', ' 1', 'constructor', '__proto__', '3', '99999999999999999999', 1]) {
    act(g, 'itemTarget', arg);
    assert.equal(g.combatItemTarget, g.state.party[1]);
  }
  assert.deepEqual(g.state, before);
  assert.equal(g.calls(), 0);
  act(g, 'menu', 'main');
  assert.equal(g.combatItemTarget, undefined);
  act(g, 'itemTarget', '2');
  assert.equal(g.combatItemTarget, undefined);
  act(g, 'menu', 'items');
  assert.equal(g.combatItemTarget, g.state.party[0]);
  assert.deepEqual(g.state, before);
});

test('direct item remains self-use and consumes one item and one round', () => {
  const g = fixture(), c = g.state.combat, turn = c.turn;
  act(g, 'item', 'bandage');
  assert.equal(g.state.party[0].hp, 25);
  assert.equal(g.state.party[1].hp, 10);
  assert.equal(g.state.inventory[0].qty, 1);
  assert.equal(c.turn, turn + 1);
  assert.deepEqual(c.enemy.statuses, []);
  assert.equal(c.log.filter(x => x.startsWith('Wren: Linen Bandage:')).length, 1);
  assert.equal(g.combatItemTarget, undefined);
});

test('ally healing uses equipment-aware cap and leaves other actors unchanged except normal replies', () => {
  const g = fixture(), ally = g.state.party[1], c = g.state.combat;
  ally.equipment = { armor: 'maelstrom_plate' };
  ally.hp = ally.maxHp + 10;
  act(g, 'menu', 'items'); act(g, 'itemTarget', '1'); act(g, 'item', 'bandage');
  assert.equal(ally.hp, ally.maxHp + 14);
  assert.equal(g.state.party[0].hp, 10);
  assert.equal(g.state.party[2].hp, 10);
  assert.equal(g.state.inventory[0].qty, 1);
  assert.equal(c.turn, 2);
  assert.equal(g.combatMenu, 'main');
  assert.equal(g.combatItemTarget, undefined);
  assert.match(c.log.join('\n'), /Bram: Linen Bandage: restored 4 hp/);
  assert.ok(c.enemy.hp < c.enemy.maxHp, 'living allies still act in the item round');
});

test('ally tonic restores MP and cures only that recipient timer before normal ticking', () => {
  const g = fixture(), [hero, ally, other] = g.state.party, c = g.state.combat;
  for (const m of [hero, ally, other]) m.statuses = ['shocked'];
  c.heroTimers = { shocked: 3 };
  c.allyTimers = { bram: { shocked: 3 }, sela: { shocked: 4 } };
  act(g, 'menu', 'items'); act(g, 'itemTarget', '1'); act(g, 'item', 'storm_tonic');
  assert.equal(ally.mp, ally.maxMp);
  assert.deepEqual(ally.statuses, []);
  assert.equal(c.allyTimers.bram.shocked, undefined);
  assert.equal(c.heroTimers.shocked, 2);
  assert.equal(c.allyTimers.sela.shocked, 3);
  assert.deepEqual(hero.statuses, ['shocked']);
  assert.deepEqual(other.statuses, ['shocked']);
  assert.equal(hero.mp, 0);
  assert.equal(other.mp, 0);
  assert.equal(g.state.inventory[1].qty, 1);
  assert.equal(c.turn, 2);
});

test('hero cure leaves companion timers to their normal tick', () => {
  const g = fixture(), c = g.state.combat;
  g.state.party[0].statuses = ['shocked']; g.state.party[1].statuses = ['shocked'];
  c.heroTimers = { shocked: 3 }; c.allyTimers = { bram: { shocked: 3 } };
  act(g, 'item', 'storm_tonic');
  assert.equal(c.heroTimers.shocked, undefined);
  assert.equal(c.allyTimers.bram.shocked, 2);
});

test('downed, stale and invalid selected recipients cannot consume, redirect or revive', () => {
  for (const kind of ['down', 'removed', 'null', 'object']) {
    const g = fixture(); act(g, 'menu', 'items'); act(g, 'itemTarget', '1');
    if (kind === 'down') g.state.party[1].hp = 0;
    if (kind === 'removed') g.state.party.splice(1, 1);
    if (kind === 'null') g.combatItemTarget = null;
    if (kind === 'object') g.combatItemTarget = { ...g.state.party[1] };
    const before = snapshot(g); act(g, 'item', 'bandage');
    assert.deepEqual(g.state, before, kind); assert.equal(g.calls(), 0);
  }
  const g = fixture(); g.state.party[1].hp = 0; act(g, 'menu', 'items');
  const before = snapshot(g); act(g, 'itemTarget', '1');
  assert.equal(g.combatItemTarget, g.state.party[0]); assert.deepEqual(g.state, before);
});

test('failed consumable preserves target and all state except its error log', () => {
  for (const item of ['unknown', 'iron_sword', 'healing_herb']) {
    const g = fixture(); act(g, 'menu', 'items'); act(g, 'itemTarget', '1');
    const before = snapshot(g); act(g, 'item', item);
    const after = snapshot(g); after.combat.log = before.combat.log;
    assert.deepEqual(after, before); assert.equal(g.calls(), 0);
    assert.equal(g.combatItemTarget, g.state.party[1]); assert.equal(g.combatMenu, 'items');
  }
});

test('resolved or missing combat is atomic and finish/new combat clears target', () => {
  const g = fixture(); act(g, 'menu', 'items'); act(g, 'itemTarget', '1');
  g.state.combat.over = 'fled'; const before = snapshot(g);
  act(g, 'itemTarget', '2'); act(g, 'item', 'bandage'); assert.deepEqual(g.state, before);
  act(g, 'finish'); assert.equal(g.combatItemTarget, undefined);
  const done = snapshot(g); act(g, 'item', 'bandage'); act(g, 'itemTarget', '1'); assert.deepEqual(g.state, done);
  g.combatItemTarget = g.state.party[1]; combatScene.onEnter(g, { enemyId: 'storm_rat' });
  assert.equal(g.combatItemTarget, undefined);
});

test('recipient UI is escaped, pressed, disabled for downed allies and read-only', () => {
  const g = fixture(); g.state.party[1].name = '<Bram & friends>'; g.state.party[2].hp = 0;
  act(g, 'menu', 'items'); act(g, 'itemTarget', '1'); const before = snapshot(g);
  const html = combatScene.render(g);
  assert.match(html, /role="group" aria-label="Item recipient"/);
  assert.match(html, /data-action="itemTarget" data-arg="1" aria-pressed="true"/);
  assert.match(html, /data-action="itemTarget" data-arg="2" aria-pressed="false" disabled/);
  assert.match(html, /Using items on &lt;Bram &amp; friends&gt;/);
  assert.ok(!html.includes('<Bram & friends>'));
  assert.match(html, /Items cannot revive downed allies/);
  assert.deepEqual(g.state, before);
  g.combatItemTarget = {};
  assert.match(combatScene.render(g), /data-action="item" data-arg="bandage"[^>]* disabled/);
  const fallback = renderCombat({ combat: g.state.combat, party: g.state.party, inventory: g.state.inventory, menu: 'items' });
  assert.match(fallback, /Using items on Wren/);
});

test('recipient buttons never displace numbered item shortcuts and Escape uses existing Back', () => {
  const g = fixture(); act(g, 'menu', 'items'); act(g, 'itemTarget', '1');
  const html = combatScene.render(g);
  const buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(([, attrs]) => {
    const attr = name => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;
    return { getAttribute: attr, disabled: / disabled/.test(attrs), click() {}, classList: { contains: n => (attr('class') || '').split(' ').includes(n) } };
  });
  const root = { querySelectorAll: () => buttons };
  assert.equal(combatShortcutTarget(root, { code: 'Digit1' }).getAttribute('data-arg'), 'bandage');
  assert.equal(combatShortcutTarget(root, { code: 'Numpad2' }).getAttribute('data-arg'), 'storm_tonic');
  const back = combatShortcutTarget(root, { code: 'Escape' });
  const before = snapshot(g); act(g, back.getAttribute('data-action'), back.getAttribute('data-arg'));
  assert.deepEqual(g.state, before); assert.equal(g.combatItemTarget, undefined);
});

test('ally item permits exactly one ordinary enemy reply and same-round restored MP use', () => {
  const g = fixture(), c = g.state.combat, [hero, ally] = g.state.party;
  c.enemy.statuses = [];
  // Use the ordinary weak rat to measure its normal physical reply without a knockout.
  g.state.combat = createCombat({ enemyId: 'storm_rat' });
  g.state.combat.enemy.hp = g.state.combat.enemy.maxHp = 100;
  ally.role = 'signaler';
  // .99 chooses Sela for the rat's target and avoids its signature attack.
  g.combatRng = () => .99;
  act(g, 'menu', 'items'); act(g, 'itemTarget', '1');
  act(g, 'item', 'storm_tonic');
  assert.equal(ally.mp, ally.maxMp - 3);
  assert.equal(hero.mp, 0);
  assert.equal(g.state.party[2].hp, 7); // 4 ATK - 3 DEF + 2 variance
  assert.equal(g.state.combat.turn, 2);
  assert.equal(g.state.combat.log.filter(x => x.includes('hurls a Signal Flare')).length, 1);
  assert.equal(g.state.combat.log.filter(x => /hits Sela for/.test(x)).length, 1);
  assert.equal(g.state.inventory[1].qty, 1);
});
