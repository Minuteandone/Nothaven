import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombat } from '../src/combat/rules.js';
import { renderCombat } from '../src/ui/combat.js';
import { combatShortcutTarget, installCombatControls } from '../src/ui/combatControls.js';

function hero(overrides = {}) {
  return {
    id: 'hero', name: 'Wren', level: 20, hp: 80, maxHp: 80, mp: 30, maxMp: 30,
    atk: 12, def: 8, spd: 10, xp: 0, statuses: [], equipment: {}, ...overrides,
  };
}

function view({ combat = createCombat({ enemyId: 'rust_sentinel' }), menu = 'main', inventory = [] } = {}) {
  return renderCombat({ combat, party: [hero()], inventory, menu });
}

function fakeButton(action, { arg = null, disabled = false, card = false, ariaDisabled = null } = {}) {
  return {
    dataset: { action, ...(arg === null ? {} : { arg }) },
    disabled,
    clicks: 0,
    classList: { contains: name => card && name === 'command-card' },
    click() { this.clicks += 1; },
    hasAttribute(name) { return name === 'disabled' && disabled; },
    getAttribute(name) {
      if (name === 'data-action') return action;
      if (name === 'data-arg') return arg;
      if (name === 'aria-disabled') return ariaDisabled;
      return null;
    },
  };
}

function fakeRoot(buttons, { displayOpen = false } = {}) {
  return {
    ownerDocument: { querySelector: selector => displayOpen && selector === '.display-settings:not([hidden])' ? {} : null },
    querySelectorAll: selector => selector === 'button[data-action]' ? buttons : [],
  };
}

function key(code, overrides = {}) {
  return { code, target: { tagName: 'DIV' }, preventDefault() { this.prevented = true; }, ...overrides };
}

test('main combat commands expose visible keyboard hints without changing actions or disabled states', () => {
  const html = view();
  for (const [action, label] of [['attack', 'A'], ['defend', 'D'], ['flee', 'F'], ['burst', 'B']]) {
    const pattern = new RegExp(`data-action="${action}"[^>]*>[\\s\\S]*?<kbd class="key-hint" aria-hidden="true">${label}</kbd>`);
    assert.match(html, pattern, action);
  }
  assert.match(html, /data-action="menu" data-arg="skills"[\s\S]*?aria-hidden="true">S<\/kbd>/);
  assert.match(html, /data-action="menu" data-arg="items"[\s\S]*?aria-hidden="true">I<\/kbd>/);
  assert.match(html, /<details class="shortcut-guide"><summary>Keyboard commands<\/summary>/);
  assert.match(html, /1–9/);
  assert.match(html, /data-action="burst"[^>]* disabled/);

  const boss = view({ combat: createCombat({ enemyId: 'tide_wraith' }) });
  assert.match(boss, /data-action="flee"[^>]* disabled/);
  assert.match(boss, /Boss encounters must be fought to resolution\./);
});

test('skill and item lists retain visible positions, costs, descriptions, and Escape navigation', () => {
  const skills = view({ menu: 'skills' });
  assert.match(skills, /data-arg="power_strike"[\s\S]*?aria-hidden="true">1<\/kbd>/);
  assert.match(skills, /data-arg="mend"[\s\S]*?aria-hidden="true">2<\/kbd>/);
  assert.match(skills, /data-action="menu" data-arg="main"[\s\S]*?aria-hidden="true">Esc<\/kbd>/);
  assert.match(skills, /Skills &amp; techniques|Skills & techniques/);

  const items = view({ menu: 'items', inventory: [{ id: 'healing_herb', qty: 2 }, { id: 'storm_tonic', qty: 1 }] });
  assert.match(items, /data-arg="healing_herb"[\s\S]*?aria-hidden="true">1<\/kbd>/);
  assert.match(items, /data-arg="storm_tonic"[\s\S]*?aria-hidden="true">2<\/kbd>/);
  assert.match(items, /Healing Herb/);
  assert.match(items, /×2/);
});

test('the collapsed chronicle retains every event separately from the latest-eight live log and escapes content', () => {
  const combat = createCombat({ enemyId: 'storm_rat' });
  combat.log = Array.from({ length: 12 }, (_, index) => index === 3 ? '<script>alert(1)</script>' : `Event ${index + 1}`);
  const before = JSON.stringify(combat);
  const html = view({ combat });
  const live = html.split('<details class="battle-chronicle">')[0];
  const chronicle = html.split('<details class="battle-chronicle">')[1];
  assert.match(live, /role="log" aria-live="polite"/);
  assert.ok(!live.includes('Event 1</p>'));
  assert.ok(live.includes('Event 5</p>'));
  assert.ok(live.includes('Event 12</p>'));
  assert.match(html, /12 retained events/);
  assert.match(chronicle, /aria-label="Full retained battle events"/);
  assert.ok(chronicle.indexOf('Event 1</li>') < chronicle.indexOf('Event 12</li>'));
  assert.ok(chronicle.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.equal(JSON.stringify(combat), before, 'rendering does not mutate combat state');
});

test('main keyboard resolution chooses only exact enabled actions', () => {
  const attack = fakeButton('attack');
  const skills = fakeButton('menu', { arg: 'skills' });
  const flee = fakeButton('flee', { disabled: true });
  const burst = fakeButton('burst', { ariaDisabled: 'true' });
  const finish = fakeButton('finish');
  const root = fakeRoot([attack, skills, flee, burst, finish]);
  assert.equal(combatShortcutTarget(root, key('KeyA')), attack);
  assert.equal(combatShortcutTarget(root, key('KeyS')), skills);
  assert.equal(combatShortcutTarget(root, key('KeyF')), null);
  assert.equal(combatShortcutTarget(root, key('KeyB')), null);
  assert.equal(combatShortcutTarget(root, key('KeyC')), finish);
  assert.equal(combatShortcutTarget(root, key('', { key: 'a' })), attack);
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'repeat', 'defaultPrevented']) {
    assert.equal(combatShortcutTarget(root, key('KeyA', { [modifier]: true })), null, modifier);
  }
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(combatShortcutTarget(root, key('KeyA', { target: { tagName } })), null, tagName);
  }
  assert.equal(combatShortcutTarget(root, key('KeyA', { target: { tagName: 'DIV', isContentEditable: true } })), null);
  assert.equal(combatShortcutTarget(fakeRoot([attack], { displayOpen: true }), key('KeyA')), null);
});

test('numbered choices follow visible positions and disabled cards never activate', () => {
  const first = fakeButton('skill', { arg: 'power_strike', disabled: true, card: true });
  const second = fakeButton('skill', { arg: 'mend', card: true });
  const third = fakeButton('skill', { arg: 'spark', card: true });
  const back = fakeButton('menu', { arg: 'main' });
  const root = fakeRoot([first, second, third, back]);
  assert.equal(combatShortcutTarget(root, key('Digit1')), null);
  assert.equal(combatShortcutTarget(root, key('Digit2')), second);
  assert.equal(combatShortcutTarget(root, key('Numpad3')), third);
  assert.equal(combatShortcutTarget(root, key('Digit4')), null);
  assert.equal(combatShortcutTarget(root, key('Escape')), back);
});

test('installed listener is combat-scoped, clicks through normal buttons, deduplicates, and cleans up', () => {
  const attack = fakeButton('attack');
  const root = fakeRoot([attack]);
  const listeners = new Map();
  const view = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const game = { root, state: { scene: 'explore' } };
  const cleanup = installCombatControls(game, { window: view, document: root.ownerDocument });
  assert.equal(typeof cleanup, 'function');
  assert.equal(installCombatControls(game, { window: view }), cleanup, 'duplicate installation is harmless');
  assert.equal(listeners.has('keydown'), true);

  const outside = key('KeyA');
  listeners.get('keydown')(outside);
  assert.equal(attack.clicks, 0);
  assert.equal(outside.prevented, undefined);

  game.state.scene = 'combat';
  const inside = key('KeyA');
  listeners.get('keydown')(inside);
  assert.equal(attack.clicks, 1);
  assert.equal(inside.prevented, true);

  cleanup();
  assert.equal(listeners.has('keydown'), false);
  assert.equal(typeof installCombatControls(null), 'function');
});

test('bootstrap installs keyboard controls after combat registration and before the title scene', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const registration = main.indexOf("game.registerScene('combat', combatScene);");
  const installation = main.indexOf('installCombatControls(game);');
  const title = main.indexOf("game.setScene('title');");
  assert.ok(registration >= 0 && installation > registration && title > installation);
});
