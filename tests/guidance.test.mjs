import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUIDANCE_STORAGE_KEY,
  GUIDANCE_TOPICS,
  normalizeGuidancePreferences,
  loadGuidancePreferences,
  saveGuidancePreferences,
  createLevelUpBriefing,
  renderGuidanceCard,
  installGuidance,
} from '../src/ui/guidance.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    value(key) { return values.get(key); },
  };
}

function makeBus() {
  const listeners = new Map();
  return {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    off(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, data) { for (const fn of [...(listeners.get(name) || [])]) fn(data); },
    count(name) { return listeners.get(name)?.size || 0; },
  };
}

function makeHarness(storage = memoryStorage()) {
  const scenes = {};
  const originals = {};
  for (const name of ['title', 'town', 'explore', 'combat', 'guide']) {
    const actions = { originalAction() {} };
    const render = name === 'explore' || name === 'combat'
      ? (game) => `<main><div class="${name}-heading-row"><header><div><h1>${name}</h1></div></header><div>${name} status</div></div><p>${game.state.scene}</p></main>`
      : (game) => `<main><header><h1>${name}</h1></header><p>${game.state.scene}</p></main>`;
    scenes[name] = { render, actions };
    originals[name] = { render: scenes[name].render, actions };
  }
  const bus = makeBus();
  const game = {
    scenes,
    bus,
    state: {
      scene: 'title', combat: null, gold: 17,
      party: [{ name: 'Wren', level: 1, hp: 10 }],
    },
  };
  const controller = installGuidance(game, { storage });
  return { game, scenes, originals, bus, controller, storage };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

test('normalization whitelists known exact-true dismissals and ignores prototypes', () => {
  const inherited = { combat: true };
  const source = Object.create(inherited);
  source.title = true;
  source.town = 1;
  source.explore = false;
  source.levelup = 'true';
  source.unknown = true;
  assert.deepEqual(normalizeGuidancePreferences({ dismissed: source }), { dismissed: { title: true } });
  assert.deepEqual(normalizeGuidancePreferences(null), { dismissed: {} });
  assert.deepEqual(normalizeGuidancePreferences([]), { dismissed: {} });
  assert.deepEqual(normalizeGuidancePreferences({ dismissed: [] }), { dismissed: {} });
  assert.deepEqual(normalizeGuidancePreferences(JSON.parse('{"dismissed":{"title":true,"__proto__":true}}')), { dismissed: { title: true } });
  assert.deepEqual(GUIDANCE_TOPICS, ['title', 'town', 'explore', 'combat', 'levelup']);
});

test('preference loading and saving survive malformed data and storage exceptions', () => {
  const storage = memoryStorage();
  assert.equal(saveGuidancePreferences(storage, { dismissed: { town: true, nope: true } }), true);
  assert.deepEqual(JSON.parse(storage.value(GUIDANCE_STORAGE_KEY)), { dismissed: { town: true } });
  assert.deepEqual(loadGuidancePreferences(storage), { dismissed: { town: true } });
  storage.setItem(GUIDANCE_STORAGE_KEY, '{broken');
  assert.deepEqual(loadGuidancePreferences(storage), { dismissed: {} });
  assert.deepEqual(loadGuidancePreferences({ getItem() { throw new Error('denied'); } }), { dismissed: {} });
  assert.equal(saveGuidancePreferences({ setItem() { throw new Error('full'); } }, { dismissed: { title: true } }), false);
  assert.equal(saveGuidancePreferences(null, { dismissed: { title: true } }), false);
});

test('static cards expose ordinary native controls and level-up content is escaped', () => {
  for (const topic of GUIDANCE_TOPICS) {
    const html = renderGuidanceCard(topic);
    assert.match(html, new RegExp(`data-guidance-topic="${topic}"`));
    assert.match(html, new RegExp(`aria-labelledby="guidance-${topic}-title"`));
    assert.match(html, /type="button"/);
    assert.match(html, /Replay quick tips from How to play/);
  }
  assert.match(renderGuidanceCard('title'), /Your first watch/);
  assert.match(renderGuidanceCard('town'), /Prepare in Greyhaven/);
  assert.match(renderGuidanceCard('explore'), /Nearby actions/);
  assert.match(renderGuidanceCard('combat'), /bosses cannot be fled/);
  const unsafe = renderGuidanceCard('levelup', { skills: [{ name: '<b>Spark</b>', mp: '4', description: '<img src=x>' }] });
  assert.match(unsafe, /&lt;b&gt;Spark&lt;\/b&gt; · 4 MP/);
  assert.match(unsafe, /&lt;img src=x&gt;/);
  assert.doesNotMatch(unsafe, /<b>Spark|<img/);
  assert.equal(renderGuidanceCard('unknown'), '');
});

test('level-up briefings collect every actual hero unlock across multiple levels', () => {
  const result = createLevelUpBriefing([
    'Wren reached level 2! (+6 HP)',
    'Tamsin reached level 8! (+6 HP)',
    'Wren reached level 3! (+6 HP)',
  ], { name: 'Wren' });
  assert.deepEqual(result.levels, [2, 3]);
  assert.deepEqual(result.skills.map((skill) => skill.name), ['Spark', 'Warding Stance']);
  assert.deepEqual(result.skills.map((skill) => skill.unlockLevel), [2, 3]);
});

test('companion-only level-ups are valid but never invent hero unlocks', () => {
  const result = createLevelUpBriefing(['Tamsin reached level 8!'], { name: 'Wren', level: 20 });
  assert.deepEqual(result, { levels: [], skills: [] });
  assert.equal(createLevelUpBriefing(['unrelated message'], { name: 'Wren' }), null);
  assert.equal(createLevelUpBriefing([], { name: 'Wren' }), null);
  assert.equal(createLevelUpBriefing(null, { name: 'Wren' }), null);
  assert.equal(createLevelUpBriefing([42, null, 'Wren reached level nope!'], null), null);
});

test('briefings follow the scene header without displacing its main heading', () => {
  const { game, scenes, controller } = makeHarness();
  const html = scenes.title.render(game);
  assert.ok(html.indexOf('<h1>title</h1>') < html.indexOf('data-guidance-topic='));
  assert.ok(html.indexOf('</header>') < html.indexOf('data-guidance-topic='));
  assert.ok(html.indexOf('data-guidance-topic=') < html.indexOf('<p>title</p>'));
  assert.match(scenes.guide.render(game), /<\/header><section class="panel guidance-replay"/);
  game.state.combat = { over: null };
  for (const name of ['explore', 'combat']) {
    const rowHtml = scenes[name].render(game);
    assert.ok(rowHtml.includes(`${name} status</div></div><section class="panel guidance-card"`));
    assert.ok(rowHtml.indexOf('data-guidance-topic=') > rowHtml.indexOf(`${name} status`));
  }
  controller.destroy();
});

test('combat guidance appears only while active; real victory level-ups take precedence', () => {
  const { game, scenes, bus, controller } = makeHarness();
  game.state.combat = { over: null };
  assert.match(scenes.combat.render(game), /data-guidance-topic="combat"/);
  game.state.combat.over = 'victory';
  assert.doesNotMatch(scenes.combat.render(game), /data-guidance-topic=/);
  bus.emit('party:levelup', { lines: ['Wren reached level 2! (+6 HP)'] });
  const html = scenes.combat.render(game);
  assert.match(html, /data-guidance-topic="levelup"/);
  assert.match(html, /Spark · 4 MP/);
  assert.doesNotMatch(html, /data-guidance-topic="combat"/);
  assert.deepEqual(controller.pendingLevelUp.levels, [2]);
  bus.emit('scene:enter', { name: 'town' });
  assert.equal(controller.pendingLevelUp, null);
  assert.doesNotMatch(scenes.combat.render(game), /data-guidance-topic=/);
  controller.destroy();
});

test('dismissal persists, while stale and invalid actions do nothing', () => {
  const { game, scenes, controller, storage } = makeHarness();
  assert.match(scenes.title.render(game), /Your first watch/);
  scenes.title.actions.dismissGuidance(game, { dataset: { arg: 'town' } });
  scenes.title.actions.dismissGuidance(game, { dataset: { arg: 'unknown' } });
  scenes.title.actions.dismissGuidance(game, null);
  assert.deepEqual(controller.preferences, { dismissed: {} });
  scenes.title.actions.dismissGuidance(game, { dataset: { arg: 'title' } });
  assert.deepEqual(controller.preferences, { dismissed: { title: true } });
  assert.deepEqual(JSON.parse(storage.value(GUIDANCE_STORAGE_KEY)), { dismissed: { title: true } });
  assert.doesNotMatch(scenes.title.render(game), /Your first watch/);
  scenes.title.actions.dismissGuidance(game, { dataset: { arg: 'title' } });
  assert.deepEqual(controller.preferences, { dismissed: { title: true } });
  controller.destroy();
});

test('a storage-write failure still dismisses only in memory', () => {
  const storage = { getItem() { return null; }, setItem() { throw new Error('full'); } };
  const { game, scenes, controller } = makeHarness(storage);
  scenes.title.actions.dismissGuidance(game, { dataset: { arg: 'title' } });
  assert.deepEqual(controller.preferences, { dismissed: { title: true } });
  assert.doesNotMatch(scenes.title.render(game), /data-guidance-topic=/);
  controller.destroy();
});

test('guide replay resets only device guidance and leaves a frozen journey untouched', () => {
  const { game, scenes, controller, storage } = makeHarness();
  scenes.title.actions.dismissGuidance(game, { dataset: { arg: 'title' } });
  const snapshot = structuredClone(game.state);
  deepFreeze(game.state);
  assert.match(scenes.guide.render(game), /Replay quick tips/);
  scenes.guide.actions.replayGuidance(game);
  assert.deepEqual(controller.preferences, { dismissed: {} });
  assert.deepEqual(JSON.parse(storage.value(GUIDANCE_STORAGE_KEY)), { dismissed: {} });
  assert.deepEqual(game.state, snapshot);
  assert.match(scenes.guide.render(game), /Quick tips will appear again as you play/);
  controller.destroy();
});

test('scene entry clears stale level-up data and replay feedback', () => {
  const { game, scenes, bus, controller } = makeHarness();
  scenes.guide.actions.replayGuidance(game);
  assert.match(scenes.guide.render(game), /Quick tips will appear again/);
  game.state.combat = { over: 'victory' };
  bus.emit('party:levelup', { lines: ['Wren reached level 2!'] });
  assert.ok(controller.pendingLevelUp);
  bus.emit('scene:enter', { name: 'combat' });
  assert.equal(controller.pendingLevelUp, null);
  bus.emit('party:levelup', { lines: ['Wren reached level 2!'] });
  scenes.guide.actions.replayGuidance(game);
  bus.emit('scene:enter', { name: 'town' });
  assert.equal(controller.pendingLevelUp, null);
  assert.doesNotMatch(scenes.guide.render(game), /Quick tips will appear again/);
  controller.destroy();
});

test('valid level-up dismissal clears its transient briefing', () => {
  const { game, scenes, bus, controller } = makeHarness();
  game.state.combat = { over: 'victory' };
  bus.emit('party:levelup', { lines: ['Wren reached level 2!'] });
  scenes.combat.actions.dismissGuidance(game, { dataset: { arg: 'combat' } });
  assert.ok(controller.pendingLevelUp);
  scenes.combat.actions.dismissGuidance(game, { dataset: { arg: 'levelup' } });
  assert.equal(controller.pendingLevelUp, null);
  assert.deepEqual(controller.preferences, { dismissed: { levelup: true } });
  controller.destroy();
});

test('duplicate installation replaces listeners and destroy restores every scene exactly', () => {
  const storage = memoryStorage();
  const first = makeHarness(storage);
  const { game, scenes, originals, bus } = first;
  const second = installGuidance(game, { storage });
  assert.equal(bus.count('party:levelup'), 1);
  assert.equal(bus.count('scene:enter'), 1);
  second.destroy();
  for (const name of Object.keys(scenes)) {
    assert.equal(scenes[name].render, originals[name].render);
    assert.equal(scenes[name].actions, originals[name].actions);
  }
  assert.equal(bus.count('party:levelup'), 0);
  assert.equal(bus.count('scene:enter'), 0);
  const output = scenes.title.render(game);
  assert.doesNotMatch(output, /guidance-card/);
  assert.doesNotMatch(scenes.guide.render(game), /guidance-replay/);
});
