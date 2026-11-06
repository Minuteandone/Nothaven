import test from 'node:test';
import assert from 'node:assert/strict';
import { itemRestorationPreview, renderCombat } from '../src/ui/combat.js';
import { createInitialState } from '../src/state.js';
import { createCombat, heroStats } from '../src/combat/rules.js';
import { combatScene } from '../src/scenes/combat.js';
import { ITEMS, TYPES } from '../src/items/items.js';
import { escapeHTML } from '../src/ui/components.js';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
}
function fixture() {
  const state = createInitialState();
  state.party = ['Wren', 'Bram', 'Sela'].map((name, index) => ({
    ...structuredClone(state.party[0]), id: ['hero', 'bram', 'sela'][index], name,
    hp: 10, mp: 0, statuses: [], tactic: 'conserve',
  }));
  state.inventory = [{ id: 'bandage', qty: 2 }, { id: 'storm_tonic', qty: 2 }];
  state.combat = createCombat({ enemyId: 'storm_heart' });
  state.combat.enemy.statuses = ['stunned'];
  state.scene = 'combat';
  return state;
}
function render(state, index = 0) {
  const before = structuredClone(state);
  const html = renderCombat({ combat: state.combat, party: state.party,
    inventory: state.inventory, menu: 'items', itemTargetIndex: index });
  assert.deepEqual(state, before, 'render leaves the entire state unchanged');
  return html;
}
function itemCard(html, id) {
  const card = html.match(new RegExp(`<button[^>]*data-action="item"[^>]*data-arg="${id}"[^>]*>[\\s\\S]*?<\\/button>`));
  assert.ok(card, `item card ${id}`); return card[0];
}
function act(game, action, arg) {
  combatScene.actions[action](game, { dataset: { arg } });
}
function gameFor(state) {
  return { state, combatMenu: 'main', combatRng: () => .5,
    bus: { emit() {} }, scenes: { combat: combatScene, town: {} },
    setScene(name) { state.scene = name; } };
}

test('item preview gives literal effective-cap gains, zero gains and applicable cures', () => {
  const state = fixture(), actor = state.party[1];
  actor.equipment = { armor: 'maelstrom_plate' };
  actor.hp = actor.maxHp + 10;
  actor.statuses = ['bleeding', 'shocked'];
  assert.equal(itemRestorationPreview(actor, state.inventory, 'bandage'), 'On Bram now: +4 HP · Clears bleeding.');
  actor.hp = actor.maxHp + 14;
  assert.equal(itemRestorationPreview(actor, state.inventory, 'bandage'), 'On Bram now: +0 HP · Clears bleeding.');
  actor.hp += 10; actor.statuses = ['shocked'];
  assert.equal(itemRestorationPreview(actor, state.inventory, 'bandage'), 'On Bram now: +0 HP.');
  actor.equipment = { trinket: 'pearl_focus' };
  actor.mp = actor.maxMp + 6;
  assert.equal(itemRestorationPreview(actor, state.inventory, 'storm_tonic'), 'On Bram now: +2 MP · Clears shocked.');
  actor.mp = actor.maxMp + 20; actor.statuses = [];
  assert.equal(itemRestorationPreview(actor, state.inventory, 'storm_tonic'), 'On Bram now: +0 MP.');
});

test('unavailable item or recipient has no preview, without disabling zero-effect items', () => {
  const state = fixture(), actor = state.party[0];
  for (const recipient of [null, undefined, { ...actor, hp: 0 }, { ...actor, hp: -1 }]) {
    assert.equal(itemRestorationPreview(recipient, state.inventory, 'bandage'), '');
  }
  for (const [inventory, id] of [[null, 'bandage'], [[], 'bandage'], [[{ id: 'bandage', qty: 0 }], 'bandage'], [state.inventory, 'constructor'], [[{ id: 'scrap_metal', qty: 2 }], 'scrap_metal']]) {
    assert.equal(itemRestorationPreview(actor, inventory, id), '');
  }
  actor.hp = actor.maxHp;
  const card = itemCard(render(freeze(state)), 'bandage');
  assert.match(card, /On Wren now: \+0 HP\./);
  assert.doesNotMatch(card, / disabled/);
  for (const index of [-1, 3, '0', null]) assert.doesNotMatch(render(state, index), /class="command-card__description item-use-preview"/);
});

test('recipient-specific preview escapes once and retains descriptions, shortcuts and caveat', () => {
  const state = fixture();
  state.party[1].name = '<Bram & "Sela">';
  state.party[1].statuses = ['bleeding'];
  const html = render(freeze(state), 1), bandage = itemCard(html, 'bandage');
  assert.ok(bandage.includes(escapeHTML('On <Bram & "Sela"> now: +15 HP · Clears bleeding.')));
  assert.doesNotMatch(bandage, /&amp;lt;|<Bram/);
  assert.ok(bandage.includes(escapeHTML(ITEMS.bandage.description)));
  assert.match(bandage, /key-hint[^>]*[^]*?1/);
  assert.match(html, /Preview shows immediate restoration before allies act and the normal enemy reply, not end-of-turn totals\./);
  assert.doesNotMatch(bandage, /On Wren now/);
  assert.match(itemCard(html, 'storm_tonic'), /\+10 MP\./);
  assert.doesNotMatch(itemCard(html, 'storm_tonic'), /Clears shocked/);
});

test('every consumable preview matches the immediate restoration reported by real item actions', () => {
  const consumables = Object.values(ITEMS).filter(item => item.type === TYPES.CONSUMABLE);
  let actions = 0;
  for (const item of consumables) for (const target of [0, 1, 2]) for (const equipped of [false, true]) for (const resource of ['low', 'near', 'full', 'over']) {
    const state = fixture(), actor = state.party[target];
    if (equipped) { actor.equipment = { armor: 'maelstrom_plate', trinket: 'pearl_focus' }; actor.temper = { armor: 3 }; }
    const caps = heroStats(actor);
    actor.hp = resource === 'low' ? 1 : caps.maxHp + ({ near: -2, full: 0, over: 7 }[resource]);
    actor.mp = resource === 'low' ? 0 : caps.maxMp + ({ near: -2, full: 0, over: 7 }[resource]);
    actor.statuses = item.use.cure ? [item.use.cure] : [];
    state.inventory = [{ id: item.id, qty: 2 }];
    const html = render(freeze(state), target), card = itemCard(html, item.id);
    const game = gameFor(structuredClone(state));
    act(game, 'menu', 'items'); act(game, 'itemTarget', String(target));
    const round = game.state.combat.turn;
    act(game, 'item', item.id);
    const line = game.state.combat.log.find(line => line.startsWith(`${actor.name}: ${item.name}:`));
    assert.ok(line, `${item.id}/${target}/${equipped}/${resource}: immediate action log`);
    for (const unit of ['hp', 'mp']) {
      const match = line.match(new RegExp(`restored (\\d+) ${unit}`));
      if (match) assert.ok(card.includes(`+${match[1]} ${unit.toUpperCase()}`), line);
      else assert.doesNotMatch(card, new RegExp(`\\+\\d+ ${unit.toUpperCase()}`));
    }
    if (item.use.cure) assert.ok(card.includes(`Clears ${item.use.cure}`));
    assert.equal(game.state.inventory.find(stack => stack.id === item.id).qty, 1);
    assert.equal(game.state.combat.turn, round + 1);
    actions++;
  }
  assert.equal(actions, consumables.length * 24);
});

test('switching recipients refreshes the real scene preview without spending or saving state', () => {
  const state = fixture(), game = gameFor(state);
  state.party[1].hp = state.party[1].maxHp - 2;
  const before = structuredClone(state);
  act(game, 'menu', 'items');
  assert.match(combatScene.render(game), /On Wren now: \+15 HP\./);
  act(game, 'itemTarget', '1');
  assert.match(combatScene.render(game), /On Bram now: \+2 HP\./);
  act(game, 'menu', 'main');
  assert.doesNotMatch(combatScene.render(game), /item-use-preview/);
  assert.deepEqual(state, before);
});
