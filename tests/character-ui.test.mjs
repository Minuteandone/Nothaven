import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { characterProgress, heroPortrait, renderCharacter } from '../src/ui/character.js';
import { characterScene, installCharacter } from '../src/scenes/character.js';
import { townScene } from '../src/scenes/town.js';
import { MAX_LEVEL, xpForLevel } from '../src/core/progression.js';
import { SKILLS, SKILL_UNLOCKS } from '../src/combat/rules.js';

function gameWith(state = createInitialState()) {
  return {
    state,
    scenes: { town: {}, explore: {}, character: characterScene },
    characterReturn: 'town',
    setScene(name) { this.enteredScene = name; this.state.scene = name; },
    registerScene(name, scene) { this.scenes[name] = scene; },
  };
}

test('level-one sheet is read-only and shows open gear, current resources, XP, and known skills', () => {
  const state = createInitialState();
  const before = structuredClone(state);
  const html = renderCharacter({ member: state.party[0] });
  assert.match(html, /<h1>Character Sheet<\/h1>/);
  assert.match(html, /<h2 id="character-identity-title">Wren<\/h2>/);
  assert.match(html, /aria-label="Current HP for Wren" aria-valuemin="0" aria-valuemax="30" aria-valuenow="30"/);
  assert.match(html, /aria-label="Current MP for Wren" aria-valuemin="0" aria-valuemax="10" aria-valuenow="10"/);
  assert.match(html, /aria-label="Level 1 experience" aria-valuemin="0" aria-valuemax="15" aria-valuenow="0"/);
  assert.match(html, /15 XP to level 2/);
  assert.match(html, /Next threshold: 15 total XP/);
  assert.match(html, /2 \/ 15 known/);
  assert.match(html, /data-skill="power_strike" data-learned="true"/);
  assert.match(html, /data-skill="mend" data-learned="true"/);
  assert.match(html, /data-skill="spark" data-learned="false"/);
  assert.match(html, /Unlocks at level 2/);
  assert.match(html, /No weapon equipped/);
  assert.match(html, /No armour equipped/);
  assert.match(html, /No trinket equipped/);
  assert.match(html, /aria-labelledby="hero-portrait-title hero-portrait-desc"/);
  assert.match(html, /data-action="leave"/);
  assert.match(html, /Back to Greyhaven/);
  assert.deepEqual(state, before);
});

test('equipment-aware stat table separates base values, gear bonuses, and effective totals', () => {
  const member = {
    ...createInitialState().party[0], level: 4, xp: 90, hp: 39, mp: 12,
    maxHp: 48, maxMp: 19, atk: 12, def: 6, spd: 8,
    equipment: { weapon: 'salvaged_blade', armor: 'maelstrom_plate', trinket: 'storm_lantern' },
  };
  const before = structuredClone(member);
  const html = renderCharacter({ member });
  assert.match(html, /data-stat="maxHp"><th scope="row">Max HP<\/th><td>48<\/td><td class="stat-bonus">\+22<\/td><td><strong>70<\/strong>/);
  assert.match(html, /data-stat="maxMp"><th scope="row">Max MP<\/th><td>19<\/td><td class="stat-bonus">0<\/td><td><strong>19<\/strong>/);
  assert.match(html, /data-stat="atk"><th scope="row">Attack<\/th><td>12<\/td><td class="stat-bonus">\+9<\/td><td><strong>21<\/strong>/);
  assert.match(html, /data-stat="def"><th scope="row">Defence<\/th><td>6<\/td><td class="stat-bonus">\+15<\/td><td><strong>21<\/strong>/);
  assert.match(html, /aria-valuemax="70" aria-valuenow="39"/);
  assert.match(html, /aria-valuemax="19" aria-valuenow="12"/);
  assert.match(html, /Salvaged Blade/);
  assert.match(html, /Maelstrom Plate/);
  assert.match(html, /Storm Lantern/);
  assert.match(html, /Manage gear in your bag/);
  assert.ok(!html.includes('data-action="equip"'));
  assert.deepEqual(member, before);
});

test('skill roadmap uses the combat registry and distinguishes every known and upcoming unlock', () => {
  const html = renderCharacter({ member: { ...createInitialState().party[0], level: 7, xp: xpForLevel(7) } });
  assert.match(html, /8 \/ 15 known/);
  for (const [id, unlock] of Object.entries(SKILL_UNLOCKS)) {
    assert.ok(html.includes(`data-skill="${id}" data-learned="${unlock <= 7}"`), id);
    assert.ok(html.includes(SKILLS[id].name), id);
    assert.ok(html.includes(SKILLS[id].description), id);
    if (unlock > 7) assert.ok(html.includes(`Unlocks at level ${unlock}`), id);
  }
  assert.match(html, /Beacon Lance/);
  assert.match(html, /9 MP/);
  assert.match(html, /Tempest Cleave/);
  assert.match(html, /6 levels to go/);
});

test('experience meter reflects within-level progress and clamps pending or malformed XP', () => {
  const member = { ...createInitialState().party[0], level: 3, xp: 60 };
  assert.deepEqual(characterProgress(member), { level: 3, totalXp: 60, atMax: false, floor: 45, ceiling: 90, earned: 15, needed: 45, remaining: 30 });
  assert.match(renderCharacter({ member }), /aria-label="Level 3 experience" aria-valuemin="0" aria-valuemax="45" aria-valuenow="15"/);
  const pending = renderCharacter({ member: { ...member, xp: 5000 } });
  assert.match(pending, /aria-valuemax="45" aria-valuenow="45"/);
  assert.match(pending, /0 XP to level 4/);
  const malformed = renderCharacter({ member: { ...member, level: -4, xp: 'not-a-number' } });
  assert.match(malformed, /Level 1 experience/);
  assert.match(malformed, /aria-valuenow="0"/);
});

test('maximum level presents a completion state rather than a false next-level goal', () => {
  const member = { ...createInitialState().party[0], level: MAX_LEVEL, xp: xpForLevel(MAX_LEVEL) };
  const html = renderCharacter({ member });
  assert.match(html, /Maximum level reached/);
  assert.match(html, /Level 20 is the current cap/);
  assert.match(html, /15 \/ 15 known/);
  assert.ok(!html.includes('XP to level 21'));
  assert.ok(!html.includes('aria-label="Level 20 experience"'));
  assert.equal(characterProgress(member).remaining, 0);
});

test('malformed equipment and untrusted names are safe and escaped', () => {
  const hostile = '<img src=x onerror=alert(1)>"\'';
  const member = { name: hostile, level: 2, xp: 15, hp: 4, mp: 2, atk: 6, def: 3, spd: 5, maxHp: 30, maxMp: 10, equipment: { weapon: hostile, armor: 42, trinket: null } };
  const before = structuredClone(member);
  const html = renderCharacter({ member });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.match(html, /Unrecognized equipment/);
  assert.match(html, /not in the current equipment registry/);
  assert.doesNotThrow(() => renderCharacter({ member: null }));
  assert.doesNotThrow(() => renderCharacter({ member: { equipment: 'invalid' } }));
  assert.deepEqual(member, before);
});

test('scene installation, town action, and return navigation remain caller-safe', () => {
  const state = createInitialState();
  const game = gameWith(state);
  installCharacter(game);
  const town = townScene.render(game);
  assert.match(town, /data-action="character"/);
  assert.match(town, /Wren&#39;s character sheet/);
  townScene.actions.character(game);
  assert.equal(game.enteredScene, 'character');
  characterScene.onEnter(game, { returnScene: 'explore' });
  assert.match(characterScene.render(game), /Back to expedition/);
  characterScene.actions.leave(game);
  assert.equal(game.enteredScene, 'explore');
  characterScene.onEnter(game, { returnScene: 'missing' });
  characterScene.actions.leave(game);
  assert.equal(game.enteredScene, 'town');
  assert.equal(game.scenes.character, characterScene);
});

test('portrait is original accessible path-only artwork with no image dependency', () => {
  const art = heroPortrait();
  assert.match(art, /role="img"/);
  assert.match(art, /<title id="hero-portrait-title">/);
  assert.match(art, /<desc id="hero-portrait-desc">/);
  assert.ok(!/<(?:circle|ellipse|image)\b/i.test(art));
  assert.ok(!/<script\b|onerror=|onload=/i.test(art));
});

test('character sheet counts forge fittings in gear stats and shows them on gear cards', () => {
  const state = createInitialState();
  const hero = state.party[0];
  hero.equipment = { ...(hero.equipment || {}), weapon: 'iron_sword', armor: 'leather_armor' };
  const plain = renderCharacter({ member: structuredClone(hero) });
  assert.doesNotMatch(plain, /equipment-card__fitting/);
  hero.temper = { weapon: 2, armor: 3 };
  const before = structuredClone(hero);
  const html = renderCharacter({ member: hero });
  assert.deepEqual(hero, before, 'rendering must not mutate the member');
  assert.match(html, /data-fitting-level="2">Forge fitting \+2 of 3 · \+4 atk<\/p>/);
  assert.match(html, /data-fitting-level="3">Forge fitting \+3 of 3 · \+3 def, \+12 HP<\/p>/);
  const atkRow = (s) => s.match(/<th scope="row">Attack<\/th>[\s\S]*?<\/tr>/)?.[0] || '';
  const nums = (row) => [...row.matchAll(/<td[^>]*>(?:<strong>)?\+?(-?\d+)/g)].map(m => Number(m[1]));
  const [baseP, gearP, effP] = nums(atkRow(plain));
  const [baseF, gearF, effF] = nums(atkRow(html));
  assert.equal(baseF, baseP);
  assert.equal(gearF, gearP + 4);
  assert.equal(effF, effP + 4);
});

test('fitting on an empty slot is shown as inactive and adds nothing', () => {
  const state = createInitialState();
  const hero = state.party[0];
  hero.equipment = {};
  hero.temper = { weapon: 1, armor: 'x' };
  const html = renderCharacter({ member: hero });
  assert.match(html, /Forge fitting \+1 of 3 · inactive until something is equipped/);
  assert.equal((html.match(/equipment-card__fitting/g) || []).length, 1);
});
