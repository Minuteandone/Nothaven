import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_SECTIONS, guideScene } from '../src/scenes/guide.js';

test('guide explains local Archive slots and the explicit portable transfer sequence', () => {
  const lines = GUIDE_SECTIONS.find(section => section.title === 'Settings and saving').lines;
  const slots = lines.find(line => line.startsWith('Journey Archive keeps'));
  const transfer = lines.find(line => line.startsWith('To move a saved slot'));
  const trust = lines.find(line => line.startsWith('Archive text is editable'));
  assert.ok(slots && transfer && trust);
  assert.match(slots, /three manual slots on this device, separate from Save journey/);
  assert.match(slots, /title screen, Greyhaven or the expedition screen/);
  assert.match(slots, /Save a slot while in town or exploring/);
  assert.match(slots, /loading a slot replaces the current journey after confirmation/);
  assert.match(transfer, /choose Export and manually copy all its text/);
  assert.match(transfer, /paste the text, choose Preview for a destination slot, then Confirm/);
  assert.match(transfer, /Import writes only that slot, leaving your current journey and quick save unchanged; choose Load separately/);
  assert.match(transfer, /Confirming an import can overwrite the chosen slot/);
  assert.match(trust, /editable and is not verified proof of progress/);
  assert.match(trust, /Import only text you trust/);
  assert.match(trust, /no cloud sync/);
  assert.match(trust, /leaving the Archive clears its text fields; keep your own copy before leaving/);
  const html = guideScene.render();
  for (const line of [slots, transfer, trust]) assert.ok(html.includes(`<li>${line}</li>`));
});

test('Archive guidance renders without touching journey state and keeps Guide Back behavior', () => {
  const state = Object.freeze({ scene: 'guide', gold: 20,
    party: Object.freeze([Object.freeze({ id: 'wren', name: 'Wren', level: 1 })]),
    story: Object.freeze({ stage: 'briefing', flags: Object.freeze({}) }) });
  const before = structuredClone(state);
  for (const returnScene of ['title', 'town', 'explore']) {
    const visits = [];
    const game = { state, scenes: { title: {}, town: {}, explore: {} },
      setScene(name) { visits.push(name); } };
    guideScene.onEnter(game, { returnScene });
    assert.match(guideScene.render(game), /Journey Archive keeps three manual slots/);
    assert.deepEqual(game.state, before);
    guideScene.actions.closeGuide(game);
    assert.deepEqual(visits, [returnScene]);
    assert.equal(game.guideReturn, null);
    assert.strictEqual(game.state, state);
    assert.deepEqual(game.state, before);
  }
});
