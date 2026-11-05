import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, getDifficulty, cycleDifficulty, scaleEnemy } from '../src/combat/difficulty.js';
import { createCombat } from '../src/combat/rules.js';
import { ENEMIES } from '../src/data/enemies.js';
import { createInitialState } from '../src/state.js';
import { migrateSave } from '../src/core/save.js';

test('standard difficulty leaves enemies untouched and is the default', () => {
  const c = createCombat({ enemyId: 'stormcrown_tyrant' });
  assert.equal(c.enemy.hp, ENEMIES.stormcrown_tyrant.hp);
  assert.equal(c.enemy.atk, ENEMIES.stormcrown_tyrant.atk);
  assert.equal(getDifficulty(createInitialState()), 'standard');
  assert.equal(getDifficulty({ settings: { difficulty: 'toString' } }), 'standard');
});

test('story and veteran scale hp, atk and gold without mutating ENEMIES', () => {
  const base = ENEMIES.relay_warden;
  const story = createCombat({ enemyId: 'relay_warden', difficulty: 'story' }).enemy;
  const vet = createCombat({ enemyId: 'relay_warden', difficulty: 'veteran' }).enemy;
  assert.equal(story.hp, Math.round(base.hp * 0.75));
  assert.equal(story.maxHp, story.hp);
  assert.equal(story.atk, Math.round(base.atk * 0.8));
  assert.equal(vet.hp, Math.round(base.hp * 1.3));
  assert.equal(vet.atk, Math.round(base.atk * 1.2));
  assert.equal(vet.gold, Math.round(base.gold * 1.25));
  assert.equal(ENEMIES.relay_warden.hp, base.hp);
  assert.equal(scaleEnemy({ hp: 1, atk: 1, gold: 0 }, 'story').hp, 1);
});

test('cycling difficulty survives a save migration', () => {
  const s = createInitialState();
  assert.equal(cycleDifficulty(s), 'veteran');
  assert.equal(cycleDifficulty(s), 'stormborn');
  assert.equal(cycleDifficulty(s), 'story');
  assert.equal(cycleDifficulty(s), 'standard');
  cycleDifficulty(s);
  const loaded = migrateSave(JSON.parse(JSON.stringify(s)), createInitialState);
  assert.equal(getDifficulty(loaded), 'veteran');
  assert.ok(DIFFICULTIES.veteran.label === 'Veteran');
});

test('town shows the difficulty button and combat uses the chosen preset', async () => {
  const { townScene } = await import('../src/scenes/town.js');
  const { combatScene } = await import('../src/scenes/combat.js');
  const game = { state: createInitialState(), scenes: {}, setScene() {} };
  assert.match(townScene.render(game), /Difficulty: Standard/);
  townScene.actions.difficulty(game);
  assert.match(game.message, /Veteran/);
  assert.match(townScene.render(game), /Difficulty: Veteran/);
  game.rng = () => 0.5;
  combatScene.onEnter(game, { enemyId: 'storm_rat' });
  assert.equal(game.state.combat.enemy.hp, Math.round(ENEMIES.storm_rat.hp * 1.3));
});

test('stormborn scales foes hardest and is labelled in combat', async () => {
  const { difficultyNote } = await import('../src/ui/combat.js');
  const base = createCombat({ enemyId: 'relay_warden' }).enemy;
  const vet = createCombat({ enemyId: 'relay_warden', difficulty: 'veteran' }).enemy;
  const sb = createCombat({ enemyId: 'relay_warden', difficulty: 'stormborn' });
  assert.equal(sb.enemy.hp, Math.round(base.hp * 1.6));
  assert.equal(sb.enemy.atk, Math.round(base.atk * 1.4));
  assert.equal(sb.enemy.gold, Math.round(base.gold * 1.5));
  assert.ok(sb.enemy.hp > vet.hp && sb.enemy.atk > vet.atk);
  assert.equal(difficultyNote(sb), ' · Stormborn mode');
  assert.equal(DIFFICULTIES.stormborn.label, 'Stormborn');
});
