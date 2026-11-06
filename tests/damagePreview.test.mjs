import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { damagePreview } from '../src/combat/damagePreview.js';

// ----- helpers -----
const heroBase = { name: 'Ren', level: 5, class: 'warden', atk: 14, def: 8, hp: 60, maxHp: 60, mp: 28, maxMp: 28, spd: 12, equipment: [] };
const enemyFire = { name: 'Ember Wisp', hp: 30, maxHp: 30, atk: 12, def: 4, spd: 8, element: 'fire' };
const enemyWater = { name: 'Tide Caller', hp: 40, maxHp: 40, atk: 10, def: 6, spd: 7, element: 'water' };
const enemyEarth = { name: 'Dust Marauder', hp: 45, maxHp: 45, atk: 14, def: 8, spd: 6, element: 'earth' };
const enemyUntyped = { name: 'Storm Rat', hp: 20, maxHp: 20, atk: 8, def: 3, spd: 10 };
const constructEnemy = { name: 'Rust Sentinel', hp: 50, maxHp: 50, atk: 16, def: 10, spd: 5, element: 'lightning', tags: ['construct'] };

const skillDamage = { id: 'power_strike', name: 'Power Strike', mp: 3, kind: 'damage', mult: 1.6, description: '' };
const skillMagic = { id: 'spark', name: 'Spark', mp: 4, kind: 'magic', power: 8, element: 'lightning', description: '' };
const skillMagicFire = { id: 'signal_flare', name: 'Signal Flare', mp: 8, kind: 'magic', power: 20, element: 'fire', description: '' };
const skillPierce = { id: 'beacon_lance', name: 'Beacon Lance', mp: 9, kind: 'pierce', mult: 1.8, element: 'fire', description: '' };
const skillBreak = { id: 'stillpoint_strike', name: 'Stillpoint Strike', mp: 13, kind: 'break', mult: 2, element: 'ice', description: '' };
const skillHeal = { id: 'mend', name: 'Mend', mp: 4, kind: 'heal', power: 10, description: '' };
const skillWard = { id: 'warding_stance', name: 'Warding Stance', mp: 2, kind: 'ward', description: '' };
const skillCleanse = { id: 'steady_signal', name: 'Steady Signal', mp: 3, kind: 'cleanse', description: '' };
const skillRevive = { id: 'rekindle', name: 'Rekindle', mp: 12, kind: 'revive', share: 0.4, description: '' };
const skillVigil = { id: 'stormhaven_vigil', name: 'Stormhaven Vigil', mp: 16, kind: 'vigil', share: 0.35, description: '' };

// ----- tests -----

describe('damagePreview — basic attack', () => {
  it('computes range for basic attack against fire enemy (no element)', () => {
    const r = damagePreview(null, heroBase, enemyFire);
    assert.ok(r);
    assert.strictEqual(r.kind, 'attack');
    assert.strictEqual(r.element, null);
    // atk=14, def=4: base=14, min=14-4-1=9, max=14-4+2=12
    assert.strictEqual(r.min, 9);
    assert.strictEqual(r.max, 12);
    assert.strictEqual(r.effective, '');
  });

  it('basic attack min clamps to 1 with high enemy def', () => {
    const tanky = { ...enemyFire, def: 30 };
    const r = damagePreview(null, heroBase, tanky);
    assert.ok(r);
    assert.strictEqual(r.min, 1);
    assert(r.max >= 1);
  });

  it('basic attack respects element matchup (lightning vs water is neutral since attack has no element)', () => {
    // Basic attack has no element, so matchup is always neutral
    const r = damagePreview(null, heroBase, enemyWater);
    assert.ok(r);
    assert.strictEqual(r.effective, '');
  });
});

describe('damagePreview — damage skill', () => {
  it('computes range for Power Strike (damage, mult=1.6, no element)', () => {
    const r = damagePreview(skillDamage, heroBase, enemyFire);
    assert.ok(r);
    assert.strictEqual(r.kind, 'damage');
    // base = floor(14*1.6)=22, min=22-4-1=17, max=22-4+2=20
    assert.strictEqual(r.min, 17);
    assert.strictEqual(r.max, 20);
    assert.strictEqual(r.effective, '');
  });

  it('damage skill clamps min to 1', () => {
    const tanky = { ...enemyFire, def: 50 };
    const r = damagePreview(skillDamage, heroBase, tanky);
    assert.ok(r);
    assert.strictEqual(r.min, 1);
  });
});

describe('damagePreview — magic skill', () => {
  it('computes range for Spark (magic, power=8, level=5, element=lightning)', () => {
    // power=8 + 5*2=10 → 18, min=18+0=18, max=18+2=20
    // lightning vs fire → neutral (lightning doesn't beat fire)
    const r = damagePreview(skillMagic, heroBase, enemyFire);
    assert.ok(r);
    assert.strictEqual(r.kind, 'magic');
    assert.strictEqual(r.min, 18);
    assert.strictEqual(r.max, 20);
    assert.strictEqual(r.effective, '');
  });

  it('magic vs construct gets ×1.5 bonus', () => {
    // power=8 + 5*2=10 → 18
    // construct: min=floor(18*1.5)=27, max=floor(20*1.5)=30
    // lightning vs lightning → neutral
    const r = damagePreview(skillMagic, heroBase, constructEnemy);
    assert.ok(r);
    assert.strictEqual(r.min, 27);
    assert.strictEqual(r.max, 30);
  });

  it('magic skill strong element (Signal Flare fire vs water)', () => {
    // Signal Flare: power=20 + 5*2=10 → 30, min=30, max=32
    // fire vs water: water beats fire (WATER > FIRE in the element cycle), so fire is weak vs water.
    // Use fire vs ice instead: fire beats ice (FIRE > ICE) → strong.
    const iceEnemy = { name: 'Glacier Wisp', hp: 35, maxHp: 35, atk: 10, def: 4, spd: 7, element: 'ice' };
    const r = damagePreview(skillMagicFire, heroBase, iceEnemy);
    assert.ok(r);
    assert.strictEqual(r.effective, 'strong');
    // power=20+10=30, min=30*1.5=45, max=32*1.5=48
    assert.strictEqual(r.min, 45);
    assert.strictEqual(r.max, 48);
  });

  it('magic skill weak element (Signal Flare fire vs water)', () => {
    const r = damagePreview(skillMagicFire, heroBase, enemyWater);
    assert.ok(r);
    assert.strictEqual(r.effective, 'weak');
    // power=20+10=30, min=floor(30*0.75)=22, max=floor(32*0.75)=24
    assert.strictEqual(r.min, 22);
    assert.strictEqual(r.max, 24);
  });
});

describe('damagePreview — pierce/break', () => {
  it('Beacon Lance (pierce, mult=1.8, fire) ignores enemy def', () => {
    // base = floor(14*1.8)=25, min=25-1=24 but max(1,...) =24, max=25+2=27
    // fire vs fire → neutral
    const r = damagePreview(skillPierce, heroBase, enemyFire);
    assert.ok(r);
    assert.strictEqual(r.kind, 'pierce');
    assert.strictEqual(r.min, 24);
    assert.strictEqual(r.max, 27);
  });

  it('Stillpoint Strike (break, mult=2, ice)', () => {
    // base = floor(14*2)=28, min=28-1=27, max=28+2=30
    // ice vs fire: fire beats ice (FIRE > ICE), so ice is weak vs fire
    // ICE beats LIGHTNING, FIRE beats ICE
    // ice vs fire: fire beats ice → weak for ice (attacker is ice, defender is fire)
    const r = damagePreview(skillBreak, heroBase, enemyFire);
    assert.ok(r);
    assert.strictEqual(r.kind, 'break');
    assert.strictEqual(r.effective, 'weak');
    // min=floor(27*0.75)=20, max=floor(30*0.75)=22
    assert.strictEqual(r.min, 20);
    assert.strictEqual(r.max, 22);
  });

  it('pierce min clamps to 1', () => {
    const weak = { ...skillPierce, mult: 0.01 }; // absurd
    const r = damagePreview(weak, heroBase, enemyFire);
    assert.ok(r);
    assert.strictEqual(r.min, 1);
  });
});

describe('damagePreview — element matchups', () => {
  it('earth defender makes matchup neutral regardless of attacker element', () => {
    const r = damagePreview(skillMagicFire, heroBase, enemyEarth);
    assert.ok(r);
    assert.strictEqual(r.effective, '');
    // No multiplier applied — raw magic range
    const power = 20 + 5 * 2;
    assert.strictEqual(r.min, power);
    assert.strictEqual(r.max, power + 2);
  });

  it('untargeted enemy (no element) makes matchup neutral', () => {
    const r = damagePreview(skillMagicFire, heroBase, enemyUntyped);
    assert.ok(r);
    assert.strictEqual(r.effective, '');
  });
});

describe('damagePreview — non-damaging skills return null', () => {
  it('heal returns null', () => assert.strictEqual(damagePreview(skillHeal, heroBase, enemyFire), null));
  it('ward returns null', () => assert.strictEqual(damagePreview(skillWard, heroBase, enemyFire), null));
  it('cleanse returns null', () => assert.strictEqual(damagePreview(skillCleanse, heroBase, enemyFire), null));
  it('revive returns null', () => assert.strictEqual(damagePreview(skillRevive, heroBase, enemyFire), null));
  it('vigil returns null', () => assert.strictEqual(damagePreview(skillVigil, heroBase, enemyFire), null));
});

describe('damagePreview — edge cases', () => {
  it('null hero returns null', () => assert.strictEqual(damagePreview(skillDamage, null, enemyFire), null));
  it('null enemy returns null', () => assert.strictEqual(damagePreview(skillDamage, heroBase, null), null));
  it('undefined skill is basic attack', () => {
    const r = damagePreview(undefined, heroBase, enemyFire);
    assert.ok(r);
    assert.strictEqual(r.kind, 'attack');
  });
  it('skill with unknown kind returns null', () => {
    const weird = { kind: 'unknown_thing', name: 'Weird', mp: 0 };
    assert.strictEqual(damagePreview(weird, heroBase, enemyFire), null);
  });
  it('skill with string id is not supported (returns null)', () => {
    // The function doesn't look up SKILLS by string ID
    assert.strictEqual(damagePreview('power_strike', heroBase, enemyFire), null);
  });
});

describe('damagePreview — warded halving', () => {
  // When warded, all damage is halved (floor, min 1) after element calculations.

  it('basic attack halved when warded', () => {
    // atk=14, enemy def=4 → phys range 9–12. No element. Warded → 4–6.
    const r = damagePreview(null, heroBase, enemyFire, { warded: true });
    assert.ok(r);
    assert.strictEqual(r.kind, 'attack');
    assert.strictEqual(r.min, 4);
    assert.strictEqual(r.max, 6);
    assert.strictEqual(r.effective, '');
  });

  it('damage skill halved when warded', () => {
    // Power Strike: mult=1.6, atk=14 → base=22. enemy def=4 → 17–20. Warded → 8–10.
    const r = damagePreview(skillDamage, heroBase, enemyFire, { warded: true });
    assert.ok(r);
    assert.strictEqual(r.kind, 'damage');
    assert.strictEqual(r.min, 8);
    assert.strictEqual(r.max, 10);
  });

  it('magic skill halved when warded (element strong)', () => {
    // Spark: power=8, level=5 → 18. +randInt(0,2) → 18–20.
    // lightning vs water → strong (×1.5) → 27–30. Warded → 13–15.
    const r = damagePreview(skillMagic, heroBase, enemyWater, { warded: true });
    assert.ok(r);
    assert.strictEqual(r.kind, 'magic');
    assert.strictEqual(r.effective, 'strong');
    assert.strictEqual(r.min, 13);
    assert.strictEqual(r.max, 15);
  });

  it('magic vs construct: construct bonus BEFORE ward halving', () => {
    // Signal Flare: power=20, level=5 → 30. +randInt(0,2) → 30–32.
    // construct ×1.5 BEFORE element → 45–48.
    // fire vs lightning → neutral. Warded → 22–24.
    const r = damagePreview(skillMagicFire, heroBase, constructEnemy, { warded: true });
    assert.ok(r);
    assert.strictEqual(r.kind, 'magic');
    assert.strictEqual(r.min, 22);
    assert.strictEqual(r.max, 24);
  });

  it('pierce halved when warded (element weak)', () => {
    // Beacon Lance: mult=1.8, atk=14 → base=25. pierce ignores def.
    // pierceMin=24, pierceMax=27. fire vs water → weak (×0.75) → 18–20.
    // Warded → 9–10.
    const r = damagePreview(skillPierce, heroBase, enemyWater, { warded: true });
    assert.ok(r);
    assert.strictEqual(r.kind, 'pierce');
    assert.strictEqual(r.effective, 'weak');
    assert.strictEqual(r.min, 9);
    assert.strictEqual(r.max, 10);
  });

  it('warded=false gives same result as no opts (backward-compatible)', () => {
    const r = damagePreview(null, heroBase, enemyFire, { warded: false });
    const base = damagePreview(null, heroBase, enemyFire);
    assert.ok(r);
    assert.ok(base);
    assert.strictEqual(r.min, base.min);
    assert.strictEqual(r.max, base.max);
    assert.strictEqual(r.kind, base.kind);
  });

  it('no opts object is backward-compatible (defaults to unwarded)', () => {
    const r = damagePreview(null, heroBase, enemyFire);
    assert.ok(r);
    assert.strictEqual(r.min, 9);
    assert.strictEqual(r.max, 12);
  });

  it('non-damaging skill with warded=true still returns null', () => {
    assert.strictEqual(damagePreview(skillHeal, heroBase, enemyFire, { warded: true }), null);
  });

  it('break skill halved when warded', () => {
    // Stillpoint Strike: mult=2, atk=14 → base=28. pierce ignores def.
    // pierceMin=27, pierceMax=30. ice element vs fire (fire > ice → weak) → ×0.75 → 20–22.
    // Warded → 10–11.
    const r = damagePreview(skillBreak, heroBase, enemyFire, { warded: true });
    assert.ok(r);
    assert.strictEqual(r.kind, 'break');
    assert.strictEqual(r.effective, 'weak');
    assert.strictEqual(r.min, 10);
    assert.strictEqual(r.max, 11);
  });

  it('warded floor: small damage rounds to 1', () => {
    // Low-atk hero vs high-def enemy with ward → should floor to 1
    const weakHero = { ...heroBase, atk: 4 };
    const tankEnemy = { name: 'Iron Wall', hp: 100, maxHp: 100, atk: 10, def: 20, spd: 3, element: 'earth' };
    // atk=4, def=20, physMin=max(1,4-20-1)=1, physMax=max(1,4-20+2)=1. element neutral. Warded → max(1, floor(1/2))=1.
    const r = damagePreview(null, weakHero, tankEnemy, { warded: true });
    assert.ok(r);
    assert.strictEqual(r.min, 1);
    assert.strictEqual(r.max, 1);
  });
});
