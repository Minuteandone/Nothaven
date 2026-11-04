import test from 'node:test';
import assert from 'node:assert/strict';
import { getSettlerDialogue, SETTLERS } from '../src/story/settlers.js';
import { getDialogue, createStoryState } from '../src/story/index.js';
import { ZONES } from '../src/map/zones.js';

const story = flags => ({ ...createStoryState(), stage: 'complete', ending: 'share_signal', flags });

test('settlers progress from waiting to rescued to relay to summit lines', () => {
  for (const [id, s] of Object.entries(SETTLERS)) {
    assert.equal(getSettlerDialogue(story({}), id).text, s.lines.waiting);
    assert.equal(getSettlerDialogue(story({ [s.victoryFlag]: true }), id).text, s.lines.rescued);
    for (const choice of ['shelter_network', 'route_network']) {
      assert.equal(getSettlerDialogue(story({ [s.victoryFlag]: true, relay_choice: choice }), id).text, s.lines[choice]);
    }
    assert.equal(getSettlerDialogue(story({ relay_choice: 'route_network', spire_reward: true }), id).text, s.lines.spire);
    assert.equal(getDialogue(story({}), id).speaker, s.speaker);
  }
  assert.equal(getSettlerDialogue(story({}), 'mara'), null);
  assert.equal(getSettlerDialogue(story({}), 'constructor'), null);
});

test('settlers stand on open tiles in their zones without overlapping anything', () => {
  for (const [zoneId, npcId] of [['saltmere_coast', 'ona'], ['highwatch_pass', 'rusk']]) {
    const z = ZONES[zoneId];
    const npc = z.npcs.find(n => n.id === npcId);
    assert.ok(npc, `${npcId} in ${zoneId}`);
    assert.ok(['.', ','].includes(z.grid[npc.y][npc.x]), 'walkable tile');
    const taken = [...z.interactables, ...z.encounters, ...z.exits].map(e => `${e.x},${e.y}`);
    assert.ok(!taken.includes(`${npc.x},${npc.y}`), 'no overlap');
  }
});

test('settler lines contain no egg references', () => {
  const EGG_RE = /egg|yolk|shell|hatch|nest|chick|\bhen\b|omelet|scrambl|poach|fried|boil|crack|golden|pearl|basket|feather|quail|easter|yolk|oval|albumen/i;
  for (const s of Object.values(SETTLERS)) for (const line of Object.values(s.lines)) assert.doesNotMatch(line, EGG_RE);
});
