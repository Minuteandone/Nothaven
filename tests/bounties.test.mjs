import test from 'node:test';
import assert from 'node:assert/strict';
import { BOUNTIES, acceptBounty, abandonBounty, bountyRows, bountyState, claimBounty, recordBountyKill, totalBountiesClaimed, bountyRewardText } from '../src/core/bounties.js';
import { bountiesScene, installBounties } from '../src/scenes/bounties.js';
import { townScene } from '../src/scenes/town.js';
import { ENEMIES } from '../src/data/enemies.js';
import { ZONES } from '../src/map/zones.js';
import { getItem } from '../src/items/items.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const fresh = () => { const s = createInitialState(); s.bestiary = {}; return s; };
const roaming = new Set(Object.values(ZONES).flatMap((z) => (z.randomEncounters || []).map((e) => e.enemyId || e.id || e)));

test('every bounty targets a real, non-boss roaming foe and pays known items', () => {
  assert.equal(BOUNTIES.length, 9);
  assert.equal(new Set(BOUNTIES.map((b) => b.id)).size, BOUNTIES.length);
  for (const b of BOUNTIES) {
    assert.ok(ENEMIES[b.enemyId], b.id);
    assert.notEqual(ENEMIES[b.enemyId].boss, true, b.id);
    assert.ok(roaming.has(b.enemyId), `${b.id} foe roams somewhere`);
    assert.ok(Number.isInteger(b.count) && b.count >= 2 && b.count <= 4, b.id);
    assert.ok(Number.isInteger(b.gold) && b.gold > 0, b.id);
    for (const it of b.items) assert.ok(getItem(it.id), it.id);
    assertEggFree(`${b.title} ${b.brief} ${bountyRewardText(b)}`, `bounty ${b.id}`);
  }
});

test('gold rewards rise along the board order', () => {
  for (let i = 1; i < BOUNTIES.length; i++) assert.ok(BOUNTIES[i].gold > BOUNTIES[i - 1].gold);
});

test('a contract opens only after its foe is in the Field Journal', () => {
  const s = fresh();
  assert.equal(acceptBounty(s, 'ridge_rats').ok, false);
  s.bestiary.storm_rat = 1;
  assert.equal(acceptBounty(s, 'ridge_rats').ok, true);
  assert.equal(bountyState(s).active, 'ridge_rats');
  assert.equal(acceptBounty(s, 'nope').ok, false);
});

test('only one contract is active; abandoning frees the slot and resets progress', () => {
  const s = fresh(); s.bestiary = { storm_rat: 1, ridge_bandit: 1 };
  acceptBounty(s, 'ridge_rats');
  recordBountyKill(s, 'storm_rat');
  assert.equal(acceptBounty(s, 'bandit_toll').ok, false);
  assert.equal(abandonBounty(s).ok, true);
  assert.deepEqual(bountyState(s), { active: null, progress: 0, completed: {} });
  assert.equal(abandonBounty(s).ok, false);
  assert.equal(acceptBounty(s, 'bandit_toll').ok, true);
});

test('kills count only for the active foe and cap at the contract size', () => {
  const s = fresh(); s.bestiary = { storm_rat: 1 };
  assert.equal(recordBountyKill(s, 'storm_rat'), null);
  acceptBounty(s, 'ridge_rats');
  assert.equal(recordBountyKill(s, 'gale_hound'), null);
  assert.match(recordBountyKill(s, 'storm_rat'), /1\/4/);
  recordBountyKill(s, 'storm_rat'); recordBountyKill(s, 'storm_rat');
  assert.match(recordBountyKill(s, 'storm_rat'), /complete/i);
  assert.equal(recordBountyKill(s, 'storm_rat'), null);
  assert.equal(bountyState(s).progress, 4);
});

test('claiming pays gold and items once, and the contract can be taken again', () => {
  const s = fresh(); s.bestiary = { storm_rat: 1 }; s.gold = 10; s.inventory = [];
  acceptBounty(s, 'ridge_rats');
  assert.equal(claimBounty(s).ok, false);
  for (let i = 0; i < 4; i++) recordBountyKill(s, 'storm_rat');
  const r = claimBounty(s);
  assert.equal(r.ok, true);
  assert.match(r.message, /30 gold, 1× Scrap Metal/);
  assert.equal(s.gold, 40);
  assert.deepEqual(s.inventory, [{ id: 'scrap_metal', qty: 1 }]);
  assert.equal(claimBounty(s).ok, false);
  assert.equal(totalBountiesClaimed(s), 1);
  assert.equal(acceptBounty(s, 'ridge_rats').ok, true);
});

test('malformed saved bounty data reads safely', () => {
  for (const bad of [null, 7, [], { active: 'zzz', progress: 3 }, { active: 'ridge_rats', progress: -2, completed: [] }, { active: 'ridge_rats', progress: 99, completed: { ridge_rats: 1.5, x: 3 } }]) {
    const v = bountyState({ bounties: bad });
    assert.ok(v.active === null || v.active === 'ridge_rats');
    assert.ok(v.progress >= 0 && v.progress <= 4);
    assert.deepEqual(Object.keys(v.completed), []);
  }
  assert.equal(bountyState({ bounties: { active: 'ridge_rats', progress: 99 } }).progress, 4);
});

test('the victory hook advances progress and logs to combat', () => {
  const handlers = {};
  const s = fresh(); s.bestiary = { storm_rat: 1 };
  const game = { state: s, registerScene(id, sc) { this.registered = [id, sc]; }, bus: { on: (k, f) => { handlers[k] = f; } } };
  installBounties(game);
  assert.equal(game.registered[0], 'bounties');
  acceptBounty(s, 'ridge_rats');
  s.combat = { log: [] };
  handlers['combat:victory']({ enemyId: 'storm_rat', encounterId: null });
  assert.equal(bountyState(s).progress, 1);
  assert.match(s.combat.log.at(-1), /Bounty progress: 1\/4/);
});

test('the scene lists locked and open contracts and drives accept/claim', () => {
  const s = fresh(); s.bestiary = { storm_rat: 1 }; s.gold = 0; s.inventory = []; s.scene = 'bounties'; s.combat = null;
  const game = { state: s, setScene(id) { this.went = id; } };
  bountiesScene.onEnter(game);
  let html = bountiesScene.render(game);
  assert.match(html, /Ridge Road Rat Cull/);
  assert.match(html, /Unposted contract/);
  assert.doesNotMatch(html, /Shades in the Vortex/);
  bountiesScene.actions.acceptBounty(game, { dataset: { arg: 'ridge_rats' } });
  assert.match(game.bountyMessage, /Accepted/);
  for (let i = 0; i < 4; i++) recordBountyKill(s, 'storm_rat');
  html = bountiesScene.render(game);
  assert.match(html, /data-action="claimBounty"/);
  bountiesScene.actions.claimBounty(game);
  assert.equal(s.gold, 30);
  assert.match(bountiesScene.render(game), /Contracts claimed: 1/);
  bountiesScene.actions.closeBounties(game);
  assert.equal(game.went, 'town');
  assert.equal(bountyRows(s).find((r) => r.id === 'ridge_rats').claimed, 1);
});

test('town shows the bounty board button when the scene is installed', () => {
  const s = createInitialState(); s.scene = 'town'; s.combat = null;
  const game = { state: s, scenes: { bounties: bountiesScene }, setScene(id) { this.went = id; } };
  assert.match(townScene.render(game), /data-action="bounties"/);
  townScene.actions.bounties(game);
  assert.equal(game.went, 'bounties');
  assert.doesNotMatch(townScene.render({ state: s, scenes: {} }), /data-action="bounties"/);
});

test('stale bounty handlers leave the whole state untouched outside the board', () => {
  for (const [scene, combat] of [['combat', { enemyId: 'storm_rat', log: [] }], ['explore', null], ['bounties', { log: [] }]]) {
    const s = fresh(); s.bestiary = { storm_rat: 1 }; s.gold = 5; s.scene = scene; s.combat = combat;
    s.bounties = { active: 'ridge_rats', progress: 4, completed: {} };
    const before = JSON.stringify(s);
    const game = { state: s, setScene(id) { this.went = id; } };
    bountiesScene.actions.acceptBounty(game, { dataset: { arg: 'ridge_rats' } });
    bountiesScene.actions.abandonBounty(game);
    bountiesScene.actions.claimBounty(game);
    bountiesScene.actions.closeBounties(game);
    assert.equal(JSON.stringify(s), before, `${scene} state unchanged`);
    assert.equal(game.went, undefined);
    assert.equal(game.bountyMessage, undefined);
  }
  for (const [scene, combat] of [['combat', { log: [] }], ['explore', null], ['town', { log: [] }]]) {
    const s = createInitialState(); s.scene = scene; s.combat = combat;
    const before = JSON.stringify(s);
    const game = { state: s, scenes: { bounties: bountiesScene }, setScene(id) { this.went = id; } };
    townScene.actions.bounties(game);
    assert.equal(game.went, undefined, `${scene} town entry blocked`);
    assert.equal(JSON.stringify(s), before);
  }
});

test('a claim whose item grant fails changes nothing', () => {
  const s = fresh(); s.bestiary = { storm_rat: 1 }; s.gold = 7; s.inventory = [{ id: 'scrap_metal', qty: 1 }];
  s.bounties = { active: 'ridge_rats', progress: 4, completed: {} };
  const before = JSON.stringify(s);
  const broken = (id) => ({ ...BOUNTIES.find((b) => b.id === id), items: [{ id: 'scrap_metal', qty: 1 }, { id: 'no_such_item', qty: 1 }] });
  const r = claimBounty(s, broken);
  assert.equal(r.ok, false);
  assert.equal(JSON.stringify(s), before);
  assert.equal(claimBounty(s).ok, true);
  assert.equal(s.gold, 37);
});

test('the Journey Journal shows the active bounty contract and its progress', async () => {
  const { bountySummaryText } = await import('../src/core/bounties.js');
  const { questJournalScene } = await import('../src/scenes/quests.js');
  const s = fresh();
  assert.equal(bountySummaryText(s), null);
  const game = { state: s, scenes: { town: {} } };
  questJournalScene.onEnter(game, {});
  assert.ok(!questJournalScene.render(game).includes('quest-bounty-summary'));
  s.bestiary.storm_rat = 1;
  assert.equal(acceptBounty(s, 'ridge_rats').ok, true);
  recordBountyKill(s, 'storm_rat');
  assert.equal(bountySummaryText(s), 'Bounty contract: “Ridge Road Rat Cull” — 1/4 defeated.');
  const html = questJournalScene.render(game);
  assert.match(html, /<p class="quest-bounty-summary" role="status">Bounty contract: “Ridge Road Rat Cull” — 1\/4 defeated\.<\/p>/);
  for (let i = 0; i < 5; i++) recordBountyKill(s, 'storm_rat');
  assert.equal(bountySummaryText(s), 'Bounty contract: “Ridge Road Rat Cull” complete — claim it at the Greyhaven bounty board.');
  s.bounties.active = 'no_such_contract';
  assert.equal(bountySummaryText(s), null);
  assertEggFree(html, 'journal bounty line');
});

test('town shows the active bounty contract only while one is accepted', async () => {
  const { townScene } = await import('../src/scenes/town.js');
  const { createInitialState } = await import('../src/state.js');
  const s = createInitialState();
  s.scene = 'town'; s.combat = null;
  const game = { state: s, scenes: { bounties: {} }, message: '' };
  assert.ok(!townScene.render(game).includes('town-bounty-summary'));
  s.bounties = { active: 'ridge_rats', progress: 2, completed: {} };
  const html = townScene.render(game);
  assert.ok(html.includes('<p class="town-bounty-summary" role="status">Bounty contract: “Ridge Road Rat Cull” — 2/4 defeated.</p>'), html);
  s.bounties.progress = 4;
  assert.ok(townScene.render(game).includes('complete — claim it at the Greyhaven bounty board.'));
  assert.ok(!townScene.render({ ...game, scenes: {} }).includes('town-bounty-summary'));
});
