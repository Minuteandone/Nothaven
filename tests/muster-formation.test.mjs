import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, loadGame, saveGame } from '../src/state.js';
import { createCompanionMember, moveActiveCompanion } from '../src/party/companions.js';
import { musterScene } from '../src/scenes/muster.js';
import { renderMuster } from '../src/ui/muster.js';
import { afterHeroAction, createCombat } from '../src/combat/rules.js';

function deployedState() {
  const state = createInitialState();
  state.scene = 'muster';
  state.party.push(createCompanionMember('tamsin'), createCompanionMember('iven'));
  return state;
}

function gameWith(state) {
  return {
    state,
    scenes: { town: {}, explore: {} },
    musterMessage: '',
    musterTalk: null,
    musterReturn: 'town',
    setScene() {},
  };
}

function activeRoster(html) {
  return html.split('<ol class="active-roster__list">')[1].split('</ol>')[0];
}

function buttonTag(html, action, id) {
  const match = html.match(new RegExp(`<button\\b[^>]*data-action="${action}" data-arg="${id}"[^>]*>`));
  assert.ok(match, `missing ${action} button for ${id}`);
  return match[0];
}

function assertNoop(state, id, direction) {
  const before = structuredClone(state);
  const party = state?.party;
  const result = moveActiveCompanion(state, id, direction);
  assert.equal(result.ok, false, `${String(id)} / ${String(direction)}`);
  assert.equal(typeof result.message, 'string');
  assert.ok(result.message.length > 0);
  assert.deepEqual(state, before, 'failed move is an atomic no-op');
  if (party && typeof party === 'object') assert.equal(state.party, party, 'party container identity is retained');
}

test('adjacent formation moves preserve member identity, progress, equipment, reserve, and unrelated state', () => {
  const state = deployedState();
  const [hero, tamsin, iven] = state.party;
  const party = state.party;
  tamsin.hp = 9;
  tamsin.xp = 23;
  tamsin.level = 2;
  tamsin.statuses = ['bleeding'];
  tamsin.tactic = 'conserve';
  tamsin.equipment.weapon = 'salvaged_blade';
  iven.mp = 4;
  state.gold = 47;
  state.inventory = [{ id: 'field_dressing', qty: 2 }];
  state.reserve = { bram: createCompanionMember('bram', 3) };
  const inventory = state.inventory;
  const reserve = state.reserve;
  const memberSnapshots = state.party.map(member => structuredClone(member));
  const before = structuredClone(state);

  const later = moveActiveCompanion(state, 'tamsin', 'later');
  assert.deepEqual(later, { ok: true, message: 'Tamsin moves later in the formation.' });
  assert.deepEqual(state.party.map(member => member.id), ['hero', 'iven', 'tamsin']);
  assert.equal(state.party, party);
  assert.equal(state.party[0], hero);
  assert.equal(state.party[1], iven);
  assert.equal(state.party[2], tamsin);
  assert.equal(state.inventory, inventory);
  assert.equal(state.reserve, reserve);
  assert.deepEqual(state.party[0], memberSnapshots[0]);
  assert.deepEqual(state.party[1], memberSnapshots[2]);
  assert.deepEqual(state.party[2], memberSnapshots[1]);

  const earlier = moveActiveCompanion(state, 'tamsin', 'earlier');
  assert.deepEqual(earlier, { ok: true, message: 'Tamsin moves earlier in the formation.' });
  assert.deepEqual(state, before, 'moving back restores the exact prior state with no hidden writes');
});

test('formation rejects boundaries, unknown or inherited ids, hero, reserve, stale ids, and malformed directions atomically', () => {
  const state = deployedState();
  for (const id of [undefined, null, '', 'nobody', 'constructor', '__proto__', 'hero', 'Tamsin', ' tamsin', 'tamsin ', 1, {}, ['tamsin']]) {
    assertNoop(state, id, 'earlier');
  }
  for (const direction of [undefined, null, '', 'Earlier', ' earlier', 'up', 0, {}, ['later']]) {
    assertNoop(state, 'tamsin', direction);
  }
  assertNoop(state, 'tamsin', 'earlier');
  assertNoop(state, 'iven', 'later');
  assertNoop(state, 'bram', 'earlier');

  const solo = createInitialState();
  solo.party.push(createCompanionMember('tamsin'));
  solo.reserve = { iven: createCompanionMember('iven') };
  assertNoop(solo, 'tamsin', 'earlier');
  assertNoop(solo, 'tamsin', 'later');
  assertNoop(solo, 'iven', 'later');
});

test('formation rejects missing parties, null or non-companion neighbours, and duplicate ids without writes', () => {
  for (const state of [null, undefined, {}, { party: null }, { party: 'bad' }, { party: {} }]) {
    assertNoop(state, 'tamsin', 'later');
  }
  const hero = createInitialState().party[0];
  const tamsin = createCompanionMember('tamsin');
  const iven = createCompanionMember('iven');
  assertNoop({ party: [hero, tamsin, null] }, 'tamsin', 'later');
  assertNoop({ party: [hero, null, tamsin] }, 'tamsin', 'earlier');
  assertNoop({ party: [hero, { id: 'hero' }, tamsin] }, 'tamsin', 'earlier');
  assertNoop({ party: [hero, { id: 'unknown' }, tamsin] }, 'tamsin', 'earlier');
  assertNoop({ party: [hero, tamsin, tamsin] }, 'tamsin', 'later');
  assertNoop({ party: [hero, iven] }, 'tamsin', 'earlier');
});

test('Muster actions reorder without RNG or journey turns and stale scene callbacks do nothing', () => {
  const state = deployedState();
  state.location = 'greyhaven';
  state.gold = 38;
  const game = gameWith(state);
  const before = structuredClone(state);
  const expected = structuredClone(state);
  [expected.party[1], expected.party[2]] = [expected.party[2], expected.party[1]];
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('formation must not consume RNG'); };
  try {
    musterScene.actions.moveCompanionLater(game, { dataset: { arg: 'tamsin' } });
  } finally {
    Math.random = originalRandom;
  }
  assert.deepEqual(state, expected, 'only the adjacent party entries change');
  assert.equal(game.musterMessage, 'Tamsin moves later in the formation.');
  assert.match(renderMuster(game), /role="status">Tamsin moves later in the formation\./);

  musterScene.actions.moveCompanionEarlier(game, { dataset: { arg: 'tamsin' } });
  assert.deepEqual(state, before);
  assert.equal(game.musterMessage, 'Tamsin moves earlier in the formation.');

  const originalParty = structuredClone(state.party);
  const staleMessage = 'Keep this message';
  game.musterMessage = staleMessage;
  for (const scene of ['title', 'town', 'explore', 'combat', 'guide']) {
    state.scene = scene;
    const stale = structuredClone(state);
    musterScene.actions.moveCompanionLater(game, { dataset: { arg: 'tamsin' } });
    musterScene.actions.moveCompanionEarlier(game, { dataset: { arg: 'iven' } });
    assert.deepEqual(state, stale, scene);
    assert.equal(game.musterMessage, staleMessage, scene);
  }
  state.scene = 'muster';
  musterScene.actions.moveCompanionLater(game, null);
  assert.deepEqual(state.party, originalParty);
  assert.equal(game.musterMessage, 'No companion by that name is available.');
});

test('native formation controls expose unambiguous labels, fixed ids, and correct disabled boundaries', () => {
  const state = deployedState();
  const game = gameWith(state);
  const before = structuredClone(state);
  let html = renderMuster(game);
  let roster = activeRoster(html);
  assert.ok(roster.indexOf('<h3>Wren</h3>') < roster.indexOf('<h3>Tamsin</h3>'));
  assert.ok(roster.indexOf('<h3>Tamsin</h3>') < roster.indexOf('<h3>Iven</h3>'));
  assert.equal((roster.match(/class="formation-controls"/g) || []).length, 2);
  assert.equal((roster.match(/data-action="moveCompanionEarlier"/g) || []).length, 2);
  assert.equal((roster.match(/data-action="moveCompanionLater"/g) || []).length, 2);
  assert.match(roster, /<span>Move Tamsin earlier<\/span>/);
  assert.match(roster, /<span>Move Tamsin later<\/span>/);
  assert.match(roster, /<span>Move Iven earlier<\/span>/);
  assert.match(roster, /<span>Move Iven later<\/span>/);
  assert.match(buttonTag(roster, 'moveCompanionEarlier', 'tamsin'), / disabled/);
  assert.doesNotMatch(buttonTag(roster, 'moveCompanionLater', 'tamsin'), / disabled/);
  assert.doesNotMatch(buttonTag(roster, 'moveCompanionEarlier', 'iven'), / disabled/);
  assert.match(buttonTag(roster, 'moveCompanionLater', 'iven'), / disabled/);
  assert.doesNotMatch(roster, /data-action="moveCompanion(?:Earlier|Later)" data-arg="hero"/);
  assert.match(html, /Companions act in roster order after Wren\. If one ends the battle, later allies do not act\. Changing the Muster formation spends no turn\./);
  assert.deepEqual(state, before, 'rendering does not mutate the journey');

  musterScene.actions.moveCompanionLater(game, { dataset: { arg: 'tamsin' } });
  html = renderMuster(game);
  roster = activeRoster(html);
  assert.ok(roster.indexOf('<h3>Iven</h3>') < roster.indexOf('<h3>Tamsin</h3>'));
  assert.match(buttonTag(roster, 'moveCompanionEarlier', 'iven'), / disabled/);
  assert.doesNotMatch(buttonTag(roster, 'moveCompanionLater', 'iven'), / disabled/);
  assert.doesNotMatch(buttonTag(roster, 'moveCompanionEarlier', 'tamsin'), / disabled/);
  assert.match(buttonTag(roster, 'moveCompanionLater', 'tamsin'), / disabled/);
});

test('formation controls and explanation stay hidden when fewer than two companions are deployed', () => {
  const soloHero = createInitialState();
  let html = renderMuster(gameWith(soloHero));
  assert.ok(!html.includes('class="formation-controls"'));
  assert.ok(!html.includes('class="formation-guidance"'));

  soloHero.party.push(createCompanionMember('tamsin'));
  html = renderMuster(gameWith(soloHero));
  assert.ok(!html.includes('class="formation-controls"'));
  assert.ok(!html.includes('class="formation-guidance"'));
  assert.ok(!html.includes('data-action="moveCompanionEarlier"'));
});

test('save-derived companion names are escaped in formation labels and rendering remains nonmutating', () => {
  const state = deployedState();
  const hostile = '<img src=x onerror=alert(1)>';
  state.party[1].name = hostile;
  const before = structuredClone(state);
  const html = renderMuster(gameWith(state));
  assert.ok(!html.includes(hostile));
  assert.ok(html.includes('Move &lt;img src=x onerror=alert(1)&gt; earlier'));
  assert.ok(html.includes('Move &lt;img src=x onerror=alert(1)&gt; later'));
  assert.deepEqual(state, before);
});

test('quick save and load preserve chosen formation order and member progress', () => {
  const state = deployedState();
  moveActiveCompanion(state, 'tamsin', 'later');
  state.party[2].hp = 7;
  state.party[2].xp = 31;
  state.party[2].equipment.weapon = 'salvaged_blade';
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  const memoryStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage });
  try {
    saveGame(state);
    const loaded = loadGame();
    assert.deepEqual(loaded.party.map(member => member.id), ['hero', 'iven', 'tamsin']);
    assert.equal(loaded.party[2].hp, 7);
    assert.equal(loaded.party[2].xp, 31);
    assert.equal(loaded.party[2].equipment.weapon, 'salvaged_blade');
    assert.equal(loaded.combat, null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('combat proves roster order matters: a first ally victory skips a later Mend, while Iven first heals', () => {
  const tamsinFirst = deployedState();
  const ivenFirst = deployedState();
  assert.equal(moveActiveCompanion(ivenFirst, 'tamsin', 'later').ok, true);

  function resolve(state) {
    const hero = state.party[0];
    hero.hp = 5;
    const combat = createCombat({ enemyId: 'ridge_bandit' });
    combat.enemy.hp = 1;
    state.combat = combat;
    const lines = afterHeroAction(combat, hero, () => 0.99, state.party);
    return { hero, combat, lines: lines.join('\n') };
  }

  const scoutFirst = resolve(tamsinFirst);
  assert.equal(scoutFirst.combat.over, 'victory');
  assert.equal(scoutFirst.combat.enemy.hp, 0);
  assert.equal(scoutFirst.hero.hp, 5, 'Iven cannot act after Tamsin has ended the battle');
  assert.match(scoutFirst.lines, /Tamsin strikes for/);
  assert.doesNotMatch(scoutFirst.lines, /Iven uses Mend/);
  assert.match(scoutFirst.lines, /Ridge Bandit is defeated!/);

  const keeperFirst = resolve(ivenFirst);
  assert.equal(keeperFirst.combat.over, 'victory');
  assert.equal(keeperFirst.combat.enemy.hp, 0);
  assert.ok(keeperFirst.hero.hp > 5, 'Iven acts before Tamsin ends the same battle');
  assert.match(keeperFirst.lines, /Iven uses Mend on Wren/);
  assert.match(keeperFirst.lines, /Tamsin strikes for/);
  assert.ok(keeperFirst.lines.indexOf('Iven uses Mend') < keeperFirst.lines.indexOf('Tamsin strikes'));
});
