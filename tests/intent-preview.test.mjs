// Tests for enemy intent preview system
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enemyIntentPreview, richIntentPreview } from '../src/combat/intentPreview.js';

describe('enemyIntentPreview', () => {
  it('returns null when combat is null', () => {
    assert.equal(enemyIntentPreview(null), null);
  });

  it('returns null when combat has no enemy', () => {
    assert.equal(enemyIntentPreview({}), null);
    assert.equal(enemyIntentPreview({ enemy: null }), null);
  });

  it('returns null when enemy is dead', () => {
    assert.equal(enemyIntentPreview({ enemy: { hp: 0, intent: 'Test' }, over: false }), null);
    assert.equal(enemyIntentPreview({ enemy: { hp: -1, intent: 'Test' }, over: false }), null);
  });

  it('returns null when combat is over', () => {
    assert.equal(enemyIntentPreview({ enemy: { hp: 10, intent: 'Test' }, over: true }), null);
  });

  it('returns null when enemy has no intent field', () => {
    assert.equal(enemyIntentPreview({ enemy: { hp: 10 }, over: false }), null);
  });

  it('returns the enemy intent string when valid', () => {
    assert.equal(
      enemyIntentPreview({ enemy: { hp: 10, intent: 'Cunning knife-work.' }, over: false }),
      'Cunning knife-work.'
    );
  });

  it('works with full combat-like objects', () => {
    const combat = {
      enemy: { hp: 50, intent: 'Gathers tidal force.' },
      over: false,
      enraged: false,
      windup: null,
    };
    assert.equal(enemyIntentPreview(combat), 'Gathers tidal force.');
  });
});

describe('richIntentPreview', () => {
  it('returns null when combat is null', () => {
    assert.equal(richIntentPreview(null), null);
  });

  it('returns null when enemy is dead', () => {
    assert.equal(richIntentPreview({ enemy: { hp: 0, intent: 'Test' }, over: false }), null);
  });

  it('returns null when combat is over', () => {
    assert.equal(richIntentPreview({ enemy: { hp: 10, intent: 'Test' }, over: true }), null);
  });

  it('returns just the intent when no special states', () => {
    const result = richIntentPreview({ enemy: { hp: 10, intent: 'Slow but tough.' }, over: false });
    assert.equal(result, 'Slow but tough.');
  });

  it('appends enrage note when enraged', () => {
    const result = richIntentPreview({
      enemy: { hp: 10, intent: 'Fast strikes.' },
      over: false,
      enraged: true,
    });
    assert.ok(result.startsWith('Fast strikes.'));
    assert.ok(result.includes('enraged'));
  });

  it('appends windup note when gathering windup', () => {
    const result = richIntentPreview({
      enemy: { hp: 10, intent: 'Heavy blows.' },
      over: false,
      windup: { name: 'Crush' },
    });
    assert.ok(result.startsWith('Heavy blows.'));
    assert.ok(result.includes('Crush'));
    assert.ok(result.includes('stunned'));
  });

  it('handles windup without a name gracefully', () => {
    const result = richIntentPreview({
      enemy: { hp: 10, intent: 'Dangerous.' },
      over: false,
      windup: {},
    });
    assert.ok(result.startsWith('Dangerous.'));
    assert.ok(result.includes('a heavy blow'));
  });

  it('combines intent, enrage, and windup when all present', () => {
    const result = richIntentPreview({
      enemy: { hp: 10, intent: 'Multi-hit flurry.' },
      over: false,
      enraged: true,
      windup: { name: 'Mega Flare' },
    });
    assert.ok(result.startsWith('Multi-hit flurry.'));
    assert.ok(result.includes('enraged'));
    assert.ok(result.includes('Mega Flare'));
  });

  it('returns null when enemy has no intent and no states', () => {
    const result = richIntentPreview({ enemy: { hp: 10 }, over: false });
    assert.equal(result, null);
  });

  it('still returns state notes even without intent', () => {
    const result = richIntentPreview({
      enemy: { hp: 10 },
      over: false,
      enraged: true,
    });
    assert.ok(result.includes('enraged'));
  });
});
