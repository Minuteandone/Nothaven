import test from 'node:test';
import assert from 'node:assert/strict';
import { getEffectiveRandomEncounterChance } from '../src/map/mapState.js';

const spire = { id: 'stormcrown_spire', randomEncounterChance: 0.2 };
const ridge = { id: 'ridge_road', randomEncounterChance: 0.2 };
const st = (flags) => ({ story: { flags } });

test('defeating the Storm’s Heart halves random encounters only near Stormcrown', () => {
  assert.equal(getEffectiveRandomEncounterChance(st({}), spire), 0.2);
  assert.equal(getEffectiveRandomEncounterChance(st({ victory_storm_heart: true }), spire), 0.1);
  assert.equal(getEffectiveRandomEncounterChance(st({ victory_storm_heart: true }), ridge), 0.2);
});

test('storm calm stacks with the route network bonus', () => {
  const flags = { victory_storm_heart: true, relay_choice: 'route_network' };
  assert.equal(getEffectiveRandomEncounterChance(st(flags), spire), 0.05);
  assert.equal(getEffectiveRandomEncounterChance(st(flags), ridge), 0.1);
});
