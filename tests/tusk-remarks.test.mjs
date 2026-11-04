import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';

const IDS = ['tamsin', 'iven', 'bram', 'sela'];
const EGG_RE = /\b(egg|yolk|shell|hatch|nest|chick|hen|omelet|scrambl|benedict|faberge|easter|cackle|poach|albumen)\w*/i;

test('companions remark on Old Tusk after the rescues, before the relay choice', () => {
  for (const id of IDS) {
    const story = { flags: { rescue_reward: true } };
    const rescued = companionRemark(id, story);
    const tusk = companionRemark(id, story, { old_tusk: 1 });
    assert.notEqual(tusk, rescued, id);
    assert.match(tusk, /Tusk|boar/, id);
    assert.doesNotMatch(tusk, EGG_RE, id);
    assert.equal(companionRemark(id, story, { old_tusk: 0 }), rescued, `${id} needs a defeat`);
    assert.equal(companionRemark(id, story, null), rescued, `${id} null bestiary`);
    const relay = companionRemark(id, { flags: { rescue_reward: true, relay_choice: 'route_network' } });
    assert.equal(companionRemark(id, { flags: { rescue_reward: true, relay_choice: 'route_network' } }, { old_tusk: 2 }), relay, `${id} relay wins`);
  }
});
