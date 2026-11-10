import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatScene } from '../src/scenes/combat.js';
import { featStatus, newlyEarnedFeats } from '../src/scenes/feats.js';
import { featsEarnedLine, renderCombat } from '../src/ui/combat.js';
import { recordDefeat } from '../src/scenes/bestiary.js';
import { createInitialState } from '../src/state.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = ' When a real victory completes one or more feats, the victory summary adds a “Feat earned:” line naming each new title, so none slips by unnoticed.';

// A fake game whose bus records defeats like installBestiary does, synchronously.
function fakeGame() {
  const state = createInitialState();
  const handlers = {};
  const g = {
    state, scenes: { town: {}, explore: {}, title: {}, combat: combatScene },
    bus: {
      on(k, h) { (handlers[k] ||= []).push(h); }, off() {},
      emit(k, e) { (handlers[k] || []).forEach((h) => h(e)); },
    },
    combatRng: () => 0.99,
    setScene(name, data) { g.last = { name, data }; state.scene = name; g.scenes[name]?.onEnter?.(g, data); },
  };
  g.bus.on('combat:victory', (p) => recordDefeat(g.state, p?.enemyId));
  return g;
}

test('newlyEarnedFeats lists only feats that flipped, in FEATS order', () => {
  const s = createInitialState();
  const before = featStatus(s);
  const after = featStatus({ ...s, bestiary: { old_tusk: 1, gloomfin: 1, frostmane: 1, lenswarden: 1 } });
  const title = (id) => after.find(f => f.id === id).title;
  assert.deepEqual(newlyEarnedFeats(before, after), ['tusk', 'gloomfin', 'frostmane', 'lenswarden', 'trials'].map(title));
  assert.equal(title('tusk'), 'Tusk Breaker');
  assert.equal(title('trials'), 'Trial Warden');
  assert.deepEqual(newlyEarnedFeats(after, after), []);
  assert.deepEqual(newlyEarnedFeats(null, after), []);
  assert.deepEqual(newlyEarnedFeats(before, undefined), []);
});

test('a real victory over Old Tusk records Tusk Breaker on the combat and shows it', () => {
  const g = fakeGame();
  g.state.party[0].atk = 999;
  combatScene.onEnter(g, { enemyId: 'old_tusk', encounterId: 'ridge_old_tusk', returnScene: 'explore' });
  combatScene.actions.attack(g);
  const c = g.state.combat;
  assert.equal(c.over, 'victory');
  assert.deepEqual(c.featsGained, ['Tusk Breaker']);
  const html = combatScene.render(g);
  assert.equal(html.split('class="feats-earned-line"').length - 1, 1);
  assert.ok(html.includes('<span class="feats-earned-line__label">Feat earned:</span> “Tusk Breaker”.'));
  assert.ok(html.indexOf('feats-earned-line') > html.indexOf('battle-rewards'));
});

test('a second Old Tusk win and an ordinary win earn nothing new', () => {
  const g = fakeGame();
  g.state.party[0].atk = 999;
  g.state.bestiary = { old_tusk: 1 };
  combatScene.onEnter(g, { enemyId: 'old_tusk', encounterId: 'ridge_old_tusk', returnScene: 'explore' });
  combatScene.actions.attack(g);
  assert.deepEqual(g.state.combat.featsGained, []);
  assert.ok(!combatScene.render(g).includes('feats-earned-line'));
  const g2 = fakeGame();
  g2.state.party[0].atk = 999;
  g2.state.bestiary = { storm_rat: 3 };
  combatScene.onEnter(g2, { enemyId: 'storm_rat', encounterId: 'ridge_patrol', returnScene: 'explore' });
  combatScene.actions.attack(g2);
  assert.equal(g2.state.combat.over, 'victory');
  assert.deepEqual(g2.state.combat.featsGained, []);
});

test('the tenth recorded foe earns two feats in one line', () => {
  const g = fakeGame();
  g.state.party[0].atk = 999;
  g.state.bestiary = { storm_rat: 1, gale_hound: 1, ridge_bandit: 1, briar_boar: 1, rust_sentinel: 1, lens_wisp: 1, reef_crawler: 1, wrack_eel: 1, frost_wolf: 1 };
  combatScene.onEnter(g, { enemyId: 'rime_wight', encounterId: 'test', returnScene: 'explore' });
  combatScene.actions.attack(g);
  const titles = g.state.combat.featsGained;
  assert.ok(titles.length >= 2, JSON.stringify(titles));
  const html = featsEarnedLine(g.state.combat);
  assert.ok(html.includes('Feats earned:'));
  assert.ok(html.includes(' and “'));
});

test('featsEarnedLine is hidden outside victories, in drills, and escapes titles', () => {
  assert.equal(featsEarnedLine(null), '');
  assert.equal(featsEarnedLine({ over: 'defeat', featsGained: ['X'] }), '');
  assert.equal(featsEarnedLine({ over: 'victory', drill: true, featsGained: ['X'] }), '');
  assert.equal(featsEarnedLine({ over: 'victory', featsGained: [] }), '');
  assert.equal(featsEarnedLine({ over: 'victory', featsGained: 'X' }), '');
  assert.equal(featsEarnedLine({ over: 'victory' }), '');
  const html = featsEarnedLine({ over: 'victory', featsGained: ['<b>A</b>', 'B', 'C'] });
  assert.ok(html.includes('“&lt;b&gt;A&lt;/b&gt;”, “B” and “C”.'));
  assert.ok(!html.includes('<b>'));
});

test('guide documents the Feat earned line once, right after the Feat in reach sentence', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(md.includes('story, level, streak and difficulty feats are not forecast.' + SENTENCE));
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(SENTENCE.trim())).length - 1, 1);
  assertEggFree(SENTENCE);
  const ui = readFileSync(new URL('../src/ui/combat.js', import.meta.url), 'utf8');
  assert.ok(ui.includes("'Feat earned:'"));
});
