import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombat, afterHeroAction, heroAction } from '../src/combat/rules.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { combatActionOrder, renderActionOrder } from '../src/ui/actionOrder.js';
import { renderCombat } from '../src/ui/combat.js';
import { guideScene } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function hero(overrides = {}) {
  return {
    id: 'hero', name: 'Wren', level: 5, hp: 28, maxHp: 36, mp: 12, maxMp: 16,
    atk: 6, def: 3, spd: 5, xp: 0, statuses: [], equipment: {}, ...overrides,
  };
}

function ally(id, name, role = 'scout', overrides = {}) {
  return {
    id, name, role, level: 3, hp: 18, maxHp: 28, mp: 8, maxMp: 10,
    atk: 7, def: 2, spd: 4, statuses: [], equipment: {}, ...overrides,
  };
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function names(model) { return model.entries.map(entry => entry.name); }

test('action order follows saved formation, renders read-only semantics, and preserves frozen inputs', () => {
  const combat = createCombat({ enemyId: 'storm_rat' });
  const party = [hero(), ally('tamsin', 'Tamsin'), ally('iven', 'Iven', 'keeper')];
  const before = JSON.stringify({ combat, party });
  deepFreeze(combat); deepFreeze(party);
  const model = combatActionOrder(combat, party);
  assert.deepEqual(names(model), ['Wren', 'Tamsin', 'Iven', 'Storm Rat']);
  assert.deepEqual(model.entries.map(entry => entry.state), ['Your command', 'Automatic ally', 'Automatic ally', 'Enemy reply']);
  assert.equal(model.opening, null);
  const html = renderActionOrder(combat, party);
  assert.match(html, /<section class="panel action-order" aria-labelledby="action-order-title">/);
  assert.match(html, /<ol class="action-order__list">/);
  assert.equal((html.match(/<li class="action-order__actor/g) || []).length, 4);
  assert.ok(html.indexOf('Wren') < html.indexOf('Tamsin'));
  assert.ok(html.indexOf('Tamsin') < html.indexOf('Iven'));
  assert.ok(html.indexOf('Iven') < html.indexOf('Storm Rat'));
  assert.ok(!html.includes('data-action='));
  assert.ok(!html.includes('<button'));
  assert.ok(!html.includes('role="status"'));
  assert.ok(!html.includes('aria-live'));
  assert.equal(JSON.stringify({ combat, party }), before);
  assertEggFree(html, 'action order rendered panel');
});

test('the combat HUD inserts exactly one active order panel and omits it after resolution', () => {
  const combat = createCombat({ enemyId: 'storm_rat' });
  const party = [hero(), ally('tamsin', 'Tamsin')];
  const active = renderCombat({ combat, party, inventory: [] });
  assert.equal((active.match(/class="panel action-order"/g) || []).length, 1);
  assert.ok(active.indexOf('combat-arena') < active.indexOf('action-order'));
  assert.ok(active.indexOf('action-order') < active.indexOf('combat-dashboard'));
  for (const over of ['victory', 'defeat', 'fled']) {
    combat.over = over;
    assert.equal(renderActionOrder(combat, party), '');
    assert.ok(!renderCombat({ combat, party, inventory: [] }).includes('action-order-title'));
  }
});

test('null and repeated-leader entries are skipped like the real companion loop; downed allies remain visible', () => {
  const leader = hero();
  const down = ally('tamsin', 'Tamsin', 'scout', { hp: 0 });
  const living = ally('iven', 'Iven', 'keeper');
  const combat = createCombat({ enemyId: 'storm_rat' });
  const model = combatActionOrder(combat, [leader, null, leader, down, living]);
  assert.deepEqual(names(model), ['Wren', 'Tamsin', 'Iven', 'Storm Rat']);
  assert.equal(model.entries[1].state, 'Down now');
  assert.equal(model.entries[1].down, true);
  assert.equal(model.entries[2].state, 'Automatic ally');
  const html = renderActionOrder(combat, [leader, down, living]);
  assert.match(html, /action-order__actor--down/);
  assert.ok(html.includes('“Down now” allies are skipped unless revived before their formation turn.'));
  down.hp = 12;
  assert.equal(combatActionOrder(combat, [leader, down, living]).entries[1].state, 'Automatic ally');
});

test('real Rekindle changes Down now before the revived ally acts in formation order', () => {
  const leader = hero({ level: 15, mp: 12, maxMp: 12 });
  const down = ally('tamsin', 'Tamsin', 'scout', { hp: 0, statuses: ['bleeding'] });
  const combat = createCombat({ enemyId: 'storm_rat' });
  const party = [leader, down];
  assert.equal(combatActionOrder(combat, party).entries[1].state, 'Down now');
  const result = heroAction(combat, leader, { type: 'skill', skillId: 'rekindle' }, () => 0.99, party);
  assert.equal(result.ok, true);
  assert.ok(down.hp > 0);
  assert.deepEqual(down.statuses, []);
  const reviveIndex = result.lines.findIndex(line => /^Tamsin rises with [1-9]\d* HP\.$/.test(line));
  const strikeIndex = result.lines.findIndex(line => /^Tamsin strikes for \d+\.$/.test(line));
  assert.ok(reviveIndex >= 0, 'Rekindle records the restored HP before later damage');
  assert.ok(strikeIndex > reviveIndex, 'revived ally acts later in the same round');
  assert.equal(combatActionOrder(combat, party).entries[1].state, 'Automatic ally');
});

test('stunned and defeated opposition states are explicit, with defeat taking precedence', () => {
  const combat = createCombat({ enemyId: 'storm_rat' });
  combat.enemy.statuses = ['stunned'];
  assert.equal(combatActionOrder(combat, [hero()]).entries.at(-1).state, 'Stunned · reply skipped');
  combat.enemy.hp = 0;
  const entry = combatActionOrder(combat, [hero()]).entries.at(-1);
  assert.equal(entry.state, 'Defeated · skipped');
  assert.equal(entry.down, true);
});

test('a faster enemy gets one explained opening turn only before the first command', () => {
  const combat = createCombat({ enemyId: 'gale_hound' });
  const party = [hero()];
  const model = combatActionOrder(combat, party);
  assert.equal(model.opening, 'Faster opening: Gale Hound takes one turn before your first command (SPD 8 versus Wren’s 5).');
  assert.match(renderActionOrder(combat, party), /class="action-order__opening"/);
  combat.turn = 2;
  assert.equal(combatActionOrder(combat, party).opening, null);
  combat.turn = 1; combat.enemy.spd = 5;
  assert.equal(combatActionOrder(combat, party).opening, null);
  combat.enemy.spd = 4;
  assert.equal(combatActionOrder(combat, party).opening, null);
});

test('real combatScene performs the faster opening described by the panel without render mutation', () => {
  const makeGame = enemyId => {
    const state = createInitialState();
    state.party = [hero()]; state.scene = 'combat'; state.combat = null;
    return { state, combatRng: () => 0.5, combatMenu: 'main' };
  };
  const fast = makeGame('gale_hound');
  combatScene.onEnter(fast, { enemyId: 'gale_hound' });
  assert.ok(fast.state.combat.log.some(line => line.includes('Gale Hound moves first!')));
  assert.ok(fast.state.party[0].hp < 28);
  const before = JSON.stringify(fast.state);
  const html = combatScene.render(fast);
  assert.ok(html.includes('Faster opening: Gale Hound takes one turn before your first command (SPD 8 versus Wren’s 5).'));
  assert.equal(JSON.stringify(fast.state), before);

  const slow = makeGame('storm_rat');
  combatScene.onEnter(slow, { enemyId: 'storm_rat' });
  assert.ok(!slow.state.combat.log.some(line => line.includes('moves first!')));
  assert.equal(slow.state.party[0].hp, 28);
  assert.equal(combatActionOrder(slow.state.combat, slow.state.party).opening, null);
});

test('real engine resolves companions in displayed order and stops later actors after victory', () => {
  const setup = order => {
    const combat = createCombat({ enemyId: 'storm_rat' });
    combat.enemy.hp = 1; combat.enemy.def = 0;
    const leader = hero({ hp: 5 });
    const tamsin = ally('tamsin', 'Tamsin', 'scout', { atk: 50 });
    const iven = ally('iven', 'Iven', 'keeper');
    const party = [leader, ...(order === 'tamsin' ? [tamsin, iven] : [iven, tamsin])];
    assert.deepEqual(names(combatActionOrder(combat, party)).slice(1, 3), order === 'tamsin' ? ['Tamsin', 'Iven'] : ['Iven', 'Tamsin']);
    return { combat, leader, party };
  };
  const first = setup('tamsin');
  const lines = afterHeroAction(first.combat, first.leader, () => 0.5, first.party);
  assert.equal(first.combat.over, 'victory');
  assert.ok(lines.some(line => line.startsWith('Tamsin ')));
  assert.ok(!lines.some(line => line.startsWith('Iven ')));
  assert.equal(first.leader.hp, 5, 'later Mend is skipped after Tamsin wins');
  assert.equal(combatActionOrder(first.combat, first.party), null);

  const second = setup('iven');
  const secondLines = afterHeroAction(second.combat, second.leader, () => 0.5, second.party);
  assert.equal(second.combat.over, 'victory');
  assert.ok(secondLines.some(line => line.startsWith('Iven ')));
  assert.ok(secondLines.some(line => line.startsWith('Tamsin ')));
  assert.ok(second.leader.hp > 5, 'Iven acts before Tamsin wins');
});

test('real engine skips a downed displayed ally and consumes a displayed enemy stun', () => {
  const combat = createCombat({ enemyId: 'storm_rat' });
  combat.enemy.statuses = ['stunned'];
  const leader = hero();
  const down = ally('tamsin', 'Downed Scout', 'scout', { hp: 0 });
  const living = ally('iven', 'Iven', 'keeper');
  const party = [leader, down, living];
  const before = combatActionOrder(combat, party);
  assert.equal(before.entries[1].state, 'Down now');
  assert.equal(before.entries.at(-1).state, 'Stunned · reply skipped');
  const hp = leader.hp;
  const lines = afterHeroAction(combat, leader, () => 0.5, party);
  assert.ok(!lines.some(line => line.startsWith('Downed Scout ')));
  assert.ok(lines.some(line => line.startsWith('Iven ')));
  assert.ok(lines.some(line => line.includes('Storm Rat is stunned and loses its turn.')));
  assert.equal(leader.hp, hp);
  assert.equal(combatActionOrder(combat, party).entries.at(-1).state, 'Enemy reply');
});

test('formation, health, stun, and round matrix preserves actor order and labels', () => {
  const companions = [
    ally('tamsin', 'Tamsin'), ally('iven', 'Iven', 'keeper'),
    ally('bram', 'Bram', 'guardian'), ally('sela', 'Sela', 'signaler'),
  ];
  let cases = 0;
  for (let a = 0; a < companions.length; a++) for (let b = 0; b < companions.length; b++) {
    if (a === b) continue;
    for (const mask of [0, 1, 2, 3]) for (const enemyState of ['ready', 'stunned', 'defeated']) for (const turn of [1, 2]) {
      const pair = [companions[a], companions[b]].map((member, index) => ({ ...member, hp: mask & (1 << index) ? 0 : member.hp }));
      const party = [hero(), ...pair];
      const combat = createCombat({ enemyId: 'storm_rat' });
      combat.turn = turn;
      if (enemyState === 'stunned') combat.enemy.statuses = ['stunned'];
      if (enemyState === 'defeated') combat.enemy.hp = 0;
      const before = JSON.stringify({ combat, party });
      const model = combatActionOrder(combat, party);
      assert.deepEqual(names(model), ['Wren', companions[a].name, companions[b].name, 'Storm Rat']);
      assert.deepEqual(model.entries.slice(1, 3).map(entry => entry.down), [Boolean(mask & 1), Boolean(mask & 2)]);
      assert.equal(model.entries.at(-1).state, enemyState === 'ready' ? 'Enemy reply' : enemyState === 'stunned' ? 'Stunned · reply skipped' : 'Defeated · skipped');
      assert.equal(JSON.stringify({ combat, party }), before);
      cases++;
    }
  }
  assert.equal(cases, companions.length * (companions.length - 1) * 4 * 3 * 2);
});

test('malformed models fail closed and hostile names are escaped everywhere including the opening note', () => {
  for (const [combat, party] of [[null, []], [{}, []], [{ enemy: {} }, null], [{ enemy: {} }, [null]], [{ enemy: {}, over: 'victory' }, [hero()]]]) {
    assert.equal(combatActionOrder(combat, party), null);
    assert.equal(renderActionOrder(combat, party), '');
  }
  const fallback = combatActionOrder({ enemy: { hp: 1, spd: 0 }, turn: 1 }, [{ hp: 1, spd: 1 }]);
  assert.deepEqual(names(fallback), ['Wren', 'Enemy']);
  const combat = createCombat({ enemyId: 'gale_hound' });
  const leader = hero({ name: 'Wren <script>alert(1)</script>' });
  const companion = ally('tamsin', 'Tamsin"><svg onload=alert(1)>');
  combat.enemy.name = '<img src=x onerror=alert(1)>';
  const html = renderActionOrder(combat, [leader, companion]);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<svg onload=alert(1)>'));
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes('Wren &lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; takes one turn'));
});

test('both guides describe the panel and its opening and skipped-actor rules', () => {
  const sentence = 'The Action order panel shows this sequence, labels downed allies “Down now” (they are skipped unless revived before their formation turn), marks a stunned enemy’s skipped reply, and explains a faster foe’s single opening turn before your first command.';
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(sentence).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(sentence));
  assertEggFree(sentence, 'action order guide sentence');
});
