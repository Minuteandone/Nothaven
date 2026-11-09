// Tests for enemy intent preview system
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enemyIntentPreview } from '../src/combat/intentPreview.js';

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

  it('returns enemy intent when both intent and special states present', () => {
    const result = enemyIntentPreview({
      enemy: { hp: 10, intent: 'Fast strikes.' },
      over: false,
      enraged: true,
      windup: { name: 'Crush' },
    });
    assert.equal(result, 'Fast strikes.');
  });
});
