import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { createStoryState, getJournal } from '../src/story/index.js';
import { questJournalEntries, renderQuestEntry, questJournalScene, installQuestJournal } from '../src/scenes/quests.js';
import { townScene } from '../src/scenes/town.js';
import { exploreScene } from '../src/map/exploreScene.js';

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function game() {
  return { state: createInitialState(), scenes: { town: townScene, explore: exploreScene },
    registerScene(id, scene) { this.scenes[id] = scene; },
    setScene(id, data) { this.last = { id, data }; } };
}
function finishedChapter() {
  return { ...createStoryState(), stage: 'complete', ending: 'protect_town', flags: { road_reward: true, lens_reward: true, chapter_reward: true } };
}

test('new journal has the current road objective and an empty completed view', () => {
  const g = game();
  assert.deepEqual(questJournalEntries(g.state.story), getJournal(g.state.story));
  assert.deepEqual(questJournalEntries(undefined), getJournal(createStoryState()));
  assert.deepEqual(questJournalEntries(g.state.story, 'complete'), []);
  questJournalScene.onEnter(g);
  questJournalScene.actions.filterQuests(g, { dataset: { arg: 'complete' } });
  const html = questJournalScene.render(g);
  assert.match(html, /Journey Journal/);
  assert.match(html, /No completed objectives yet\./);
  assert.match(html, /1 active · 0 completed/);
  assert.match(html, /data-arg="complete" aria-pressed="true"/);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
});

test('completed chapter retains completed quests and active relief/rescue offers in catalog order', () => {
  const s = finishedChapter();
  const all = getJournal(s);
  assert.deepEqual(questJournalEntries(s, 'all'), all);
  assert.deepEqual(questJournalEntries(s, 'complete').map(e => e.id), ['road', 'lens', 'beacon']);
  assert.ok(questJournalEntries(s).some(e => e.id === 'relief'));
  assert.ok(questJournalEntries(s).some(e => e.id === 'rescue'));
  for (const invalid of ['constructor', '__proto__', 'other', null, {}]) {
    assert.deepEqual(questJournalEntries(s, invalid), questJournalEntries(s, 'active'));
  }
});

test('entry text is escaped and untrusted status cannot become markup', () => {
  const html = renderQuestEntry({ id: '<script>', title: '<img src=x onerror=alert(1)>', objective: 'Go <script>alert(2)</script> & report', status: '<svg onload=alert(3)>' });
  assert.doesNotMatch(html, /<img|<script|<svg|onload=/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt; &amp; report/);
  assert.match(html, />Active</);
});

test('rendering and filtering frozen state cannot change progress, rewards, or inventory', () => {
  const g = game(); g.state.story = finishedChapter(); freeze(g.state);
  const before = JSON.stringify(g.state);
  questJournalScene.onEnter(g, { returnScene: 'town' });
  for (const id of ['active', 'complete', 'all', 'constructor']) {
    questJournalScene.actions.filterQuests(g, { dataset: { arg: id } });
    assert.match(questJournalScene.render(g), /Accept jobs and report completed work/);
    questJournalEntries(g.state.story, id);
  }
  assert.equal(JSON.stringify(g.state), before);
});

test('entry resets filters, validates returns, and leave clears transient data', () => {
  const g = game();
  for (const target of ['town', 'explore']) {
    g.questJournalFilter = 'complete';
    questJournalScene.onEnter(g, { returnScene: target });
    assert.equal(g.questJournalFilter, 'active');
    questJournalScene.actions.leave(g);
    assert.equal(g.last.id, target);
    assert.equal(g.questJournalReturn, undefined);
    assert.equal(g.questJournalFilter, undefined);
  }
  for (const target of ['combat', 'constructor', 'quests', undefined]) {
    questJournalScene.onEnter(g, { returnScene: target });
    assert.equal(g.questJournalReturn, 'town');
  }
  delete g.scenes.explore;
  questJournalScene.onEnter(g, { returnScene: 'explore' });
  assert.equal(g.questJournalReturn, 'town');
  g.questJournalReturn = 'combat';
  questJournalScene.actions.leave(g);
  assert.equal(g.last.id, 'town');
});

test('installation and optional town/explore links preserve the separate Field Journal', () => {
  const g = game();
  assert.doesNotMatch(townScene.render(g), /data-action="questJournal"/);
  assert.doesNotMatch(exploreScene.render(g), /data-action="openQuests"/);
  townScene.actions.questJournal(g); exploreScene.actions.openQuests(g);
  assert.equal(g.last, undefined);
  installQuestJournal(g);
  assert.equal(g.scenes.quests, questJournalScene);
  assert.match(townScene.render(g), /data-action="questJournal"/);
  const html = exploreScene.render(g);
  assert.match(html, /data-action="openQuests"/);
  assert.match(html, /data-action="openJournal"/);
  assert.match(html, /Field Journal/);
  townScene.actions.questJournal(g);
  assert.deepEqual(g.last, { id: 'quests', data: { returnScene: 'town' } });
  exploreScene.actions.openQuests(g);
  assert.deepEqual(g.last, { id: 'quests', data: { returnScene: 'explore' } });
});
