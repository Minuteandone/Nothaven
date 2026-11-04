import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { createCompanionMember } from '../src/party/companions.js';
import { musterScene } from '../src/scenes/muster.js';
import { companionPortrait, renderMuster } from '../src/ui/muster.js';

function gameWith(state = createInitialState()) {
  return { state, scenes: { town: {}, explore: {} }, musterMessage: '', musterTalk: null, musterReturn: 'town', setScene() {} };
}

function unlock(state, id) {
  const flags = {
    tamsin: 'victory_ridge_patrol', iven: 'victory_observatory_sentinel',
    bram: 'rescue_victory_coast', sela: 'rescue_victory_heights',
  };
  state.story.flags[flags[id]] = true;
}

test('muster board presents Wren, open slots, locked requirements, and four labelled original portraits', () => {
  const state = createInitialState();
  const before = structuredClone(state);
  const html = renderMuster(gameWith(state));
  assert.match(html, /<h1>Muster Board<\/h1>/);
  assert.match(html, /aria-label="1 of 3 party slots filled"/);
  assert.equal((html.match(/active-member--empty/g) || []).length, 2);
  assert.match(html, /0 of 4 available/);
  for (const id of ['tamsin', 'iven', 'bram', 'sela']) {
    assert.ok(html.includes(`data-companion="${id}" data-availability="locked"`), id);
    assert.ok(html.includes(`aria-labelledby="portrait-${id}-title portrait-${id}-desc"`), id);
    assert.ok(html.includes(`id="portrait-${id}-desc"`), id);
    assert.ok(!html.includes(`data-action="talk" data-arg="${id}"`), 'locked allies cannot be talked to');
  }
  assert.ok(!html.includes('data-action="recruit"'));
  assert.match(html, /Clear the ridge patrol/);
  assert.match(html, /Back to Greyhaven/);
  assert.deepEqual(state, before, 'rendering never changes game state');
});

test('recruitment and dismissal preserve existing actions, party capacity, and reserve progress', () => {
  const state = createInitialState();
  unlock(state, 'tamsin'); unlock(state, 'iven'); unlock(state, 'bram');
  const game = gameWith(state);
  let html = renderMuster(game);
  assert.match(html, /3 of 4 available/);
  assert.match(html, /data-action="recruit" data-arg="tamsin"/);
  assert.match(html, /Joins at Wren’s current level/);

  musterScene.actions.recruit(game, { dataset: { arg: 'tamsin' } });
  musterScene.actions.recruit(game, { dataset: { arg: 'iven' } });
  html = renderMuster(game);
  assert.match(html, /aria-label="3 of 3 party slots filled"/);
  assert.ok(html.includes('data-companion="tamsin" data-availability="deployed"'));
  assert.ok(html.includes('data-action="dismiss" data-arg="tamsin"'));
  assert.match(html, /data-action="recruit" data-arg="bram"[^>]* disabled/);
  assert.match(html, /Party full — send an active companion back first\./);

  musterScene.actions.dismiss(game, { dataset: { arg: 'tamsin' } });
  html = renderMuster(game);
  assert.ok(html.includes('data-companion="tamsin" data-availability="reserve"'));
  assert.match(html, /Invite from reserve/);
  assert.match(html, /level, equipment, and experience have been retained/);
  assert.ok(state.reserve.tamsin);
});

test('muster cards show equipment-aware reserve stats and accessible current-resource meters', () => {
  const state = createInitialState();
  unlock(state, 'tamsin');
  const tamsin = createCompanionMember('tamsin', 4);
  tamsin.equipment.weapon = 'salvaged_blade';
  tamsin.hp = 17;
  tamsin.mp = 3;
  state.reserve = { tamsin };
  const html = renderMuster(gameWith(state));
  const card = html.split('data-companion="tamsin"')[1].split('data-companion="iven"')[0];
  assert.match(card, /Lv 4/);
  assert.match(card, /aria-label="HP for Tamsin" aria-valuemin="0" aria-valuemax="42" aria-valuenow="17"/);
  assert.match(card, /aria-label="MP for Tamsin" aria-valuemin="0" aria-valuemax="15" aria-valuenow="3"/);
  assert.match(card, /<dt>ATK<\/dt><dd>22<\/dd>/);
  assert.match(card, /At the watch house/);
});

test('companion remarks are labelled disclosures with stable focus actions and hidden inactive content', () => {
  const state = createInitialState();
  unlock(state, 'tamsin'); unlock(state, 'iven');
  const game = gameWith(state);
  let html = renderMuster(game);
  assert.match(html, /data-action="talk" data-arg="tamsin" aria-expanded="false" aria-controls="remark-tamsin"/);
  assert.match(html, /class="remark" id="remark-tamsin" hidden/);
  game.musterTalk = 'tamsin';
  html = renderMuster(game);
  assert.match(html, /data-action="talk" data-arg="tamsin" aria-expanded="true" aria-controls="remark-tamsin"/);
  assert.match(html, /class="remark" id="remark-tamsin"><span class="visually-hidden">Tamsin says:<\/span>/);
  assert.match(html, /data-action="talk" data-arg="iven" aria-expanded="false"/);
});

test('save-derived party names, roles, messages, and numeric labels cannot inject markup', () => {
  const state = createInitialState();
  state.party[0].name = '<img src=x onerror=alert(1)>';
  state.party[0].role = '<svg onload=alert(1)>';
  state.party[0].level = 'not-a-number';
  const game = gameWith(state);
  game.musterMessage = '<script>alert(1)</script>';
  game.musterReturn = 'explore';
  const html = renderMuster(game);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<svg onload'));
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.match(html, /Back to expedition/);
});

test('portrait fallback uses known safe SVG ids and accessible text', () => {
  const html = companionPortrait('unknown', '<b>Traveller</b>', true);
  assert.ok(html.includes('id="portrait-tamsin-title"'));
  assert.ok(html.includes('&lt;b&gt;Traveller&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Traveller</b>'));
  assert.match(html, /companion-portrait--locked/);
});
