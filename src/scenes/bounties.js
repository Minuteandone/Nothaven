// Greyhaven bounty board scene: accept, track, abandon and claim hunt contracts.
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { EXCHANGE_OFFERS, boardMarks, boardMarksText, exchangeCost, exchangeMarks, exchangeOfferText, exchangePerkText, exchangeOwnedText, exchangeAffordText, markValue, MASTERY_CLAIMS, abandonBounty, acceptBounty, bountyRankText, urgentBountyText, masteryText, bountyRewardText, bountyRows, claimBounty, recordBountyKill, totalBountiesClaimed } from '../core/bounties.js';

function rowHTML(r, anyActive) {
  const status = !r.unlocked ? 'Defeat this foe once to open the contract.'
    : r.ready ? 'Complete — ready to claim.'
    : r.active ? `In progress: ${r.progress}/${r.count}.`
    : r.claimed ? `Claimed ${r.claimed} ${r.claimed === 1 ? 'time' : 'times'}.` : 'Open.';
  const title = r.unlocked ? r.title : 'Unposted contract';
  const button = !r.unlocked ? ''
    : r.ready ? uiButton({ action: 'claimBounty', label: `Claim reward`, iconName: 'coin', variant: 'primary' })
    : r.active ? uiButton({ action: 'abandonBounty', label: 'Abandon contract', iconName: 'compass', variant: 'ghost' })
    : uiButton({ action: 'acceptBounty', arg: r.id, label: `Accept: ${r.title}`, iconName: 'sword', variant: 'ghost', disabled: anyActive });
  return `<li class="bounty${r.active ? ' bounty--active' : ''}${r.unlocked ? '' : ' bounty--locked'}${r.unlocked && r.urgent ? ' bounty--urgent' : ''}">
    <h2 class="bounty__title">${escapeHTML(title)}</h2>
    ${r.unlocked && r.urgent ? '<p class="bounty__urgent">Urgent notice — premium pay until the next claim.</p>' : ''}
    ${r.unlocked ? `<p class="bounty__brief">${escapeHTML(r.brief)}</p>
    <p class="bounty__terms">Defeat ${escapeHTML(String(r.count))} × ${escapeHTML(r.foe)} · Reward: ${escapeHTML(bountyRewardText({ ...r, items: r.rewardItems || r.items }, r.pay))}</p>
    ${r.mastered && r.items.length ? `<p class="bounty__mastered">Mastered — +1 ${escapeHTML(r.rewardName || '')} per claim.</p>` : ''}
    ${!r.mastered && r.items.length && r.claimed > 0 ? `<p class="bounty__mastery-progress">Mastery progress: ${escapeHTML(`${Math.min(r.claimed, MASTERY_CLAIMS)} of ${MASTERY_CLAIMS}`)} claims.</p>` : ''}
    ${r.roams.length ? `<p class="bounty__roams">Roams: ${escapeHTML(r.roams.join(', '))}.</p>` : ''}` : ''}
    ${r.unlocked ? `<p class="bounty__marks">Earns ${escapeHTML(String(markValue(r.id)))} Board ${markValue(r.id) === 1 ? 'Mark' : 'Marks'} per claim.</p>` : ''}
    <p class="bounty__status">${escapeHTML(status)}</p>
    ${button}
  </li>`;
}

/** Regions named on unlocked contracts, in journey order (habitats are already ordered). */
export function bountyRegionOptions(rows) {
  const seen = [];
  for (const r of rows) {
    if (!r.unlocked) continue;
    for (const name of r.roams) if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

/** Rows shown under a region filter: unlocked contracts roaming there, plus any active contract. */
export function filterBountyRows(rows, region) {
  if (!region) return rows;
  return rows.filter((r) => r.active || (r.unlocked && r.roams.includes(region)));
}

/** Sort orders for the board; locked notices always stay last, in posting order, so nothing about them leaks. */
export const BOUNTY_SORTS = Object.freeze([
  Object.freeze({ id: 'board', label: 'Board order' }),
  Object.freeze({ id: 'pay', label: 'Highest pay' }),
  Object.freeze({ id: 'claims', label: 'Fewest claims' }),
]);

export function sortBountyRows(rows, sort) {
  const order = new Map(rows.map((r, i) => [r, i]));
  const open = rows.filter((r) => r.unlocked);
  const locked = rows.filter((r) => !r.unlocked);
  const byBoard = (a, b) => order.get(a) - order.get(b);
  const cmp = sort === 'pay' ? (a, b) => (b.pay - a.pay) || byBoard(a, b)
    : sort === 'claims' ? (a, b) => (a.claimed - b.claimed) || byBoard(a, b)
    : byBoard;
  return [...open.sort(cmp), ...locked];
}

/** Board Exchange panel: spend marks earned from claims on supplies. */
export function exchangeHTML(state) {
  const { available } = boardMarks(state);
  const offer = (o) => {
    const cost = exchangeCost(state, o);
    return `<li class="exchange__offer">${uiButton({ action: 'exchangeMarks', arg: o.id, label: `Exchange: ${exchangeOfferText(o, cost)}`, iconName: 'coin', variant: 'ghost', disabled: available < cost })}<p class="exchange__owned">${escapeHTML(exchangeOwnedText(state, o))}</p></li>`;
  };
  return `<section class="panel bounties__exchange" aria-label="Board Exchange">
        <h2 class="exchange__title">Board Exchange</h2>
        <p class="exchange__marks">${escapeHTML(boardMarksText(state))}</p>
        <p class="exchange__note">Each claim earns Board Marks: 1 for the first six postings, 2 for the next six and 3 for the last six.</p>
        <p class="exchange__perk">${escapeHTML(exchangePerkText(state))}</p>
        <p class="exchange__afford">${escapeHTML(exchangeAffordText(state))}</p>
        <ul class="exchange__offers">${EXCHANGE_OFFERS.map(offer).join('')}</ul>
      </section>`;
}

function sortHTML(sort) {
  const chip = (o) => `<button type="button" class="bounty-filter${o.id === sort ? ' bounty-filter--on' : ''}" data-action="sortBounties" data-arg="${escapeHTML(o.id)}" aria-pressed="${o.id === sort ? 'true' : 'false'}">${escapeHTML(o.label)}</button>`;
  return `<div class="bounties__filters bounties__sorts" role="group" aria-label="Sort contracts">${BOUNTY_SORTS.map(chip).join('')}</div>`;
}

function regionFilterHTML(options, region) {
  if (!options.length) return '';
  const chip = (arg, label, on) => `<button type="button" class="bounty-filter${on ? ' bounty-filter--on' : ''}" data-action="filterBounties" data-arg="${escapeHTML(arg)}" aria-pressed="${on ? 'true' : 'false'}">${escapeHTML(label)}</button>`;
  return `<div class="bounties__filters" role="group" aria-label="Filter contracts by region">${chip('', 'All regions', !region)}${options.map((o) => chip(o, o, o === region)).join('')}</div>`;
}

export const bountiesScene = {
  onEnter(game) { game.bountyMessage = ''; game.bountyRegion = ''; game.bountySort = 'board'; },
  render(game) {
    const rows = bountyRows(game.state);
    const anyActive = rows.some((r) => r.active);
    const options = bountyRegionOptions(rows);
    const region = options.includes(game.bountyRegion) ? game.bountyRegion : '';
    const sort = BOUNTY_SORTS.some((o) => o.id === game.bountySort) ? game.bountySort : 'board';
    const shown = sortBountyRows(filterBountyRows(rows, region), sort);
    const matching = shown.filter((r) => r.unlocked && r.roams.includes(region)).length;
    const elsewhere = shown.find((r) => r.active && !r.roams.includes(region));
    const filterNote = region ? `<p class="bounties__filter-note" role="status">${escapeHTML(String(matching))} ${matching === 1 ? 'contract roams' : 'contracts roam'} ${escapeHTML(region)}.${elsewhere ? ` Your active contract, ${escapeHTML(elsewhere.title)}, stays listed too.` : ''}</p>` : '';
    const total = totalBountiesClaimed(game.state);
    const msg = game.bountyMessage ? `<p class="bounties__message" role="status">${escapeHTML(game.bountyMessage)}</p>` : '';
    return `<main class="game-shell bounties">
      ${sceneHeader({ eyebrow: 'Greyhaven square', title: 'Bounty Board', subtitle: 'Repeatable hunts posted by the townsfolk.', iconName: 'journal' })}
      <section class="panel" aria-label="Posted contracts">
        ${msg}
        <p class="bounties__intro">Take one contract at a time, then defeat its foe in the wilds — roaming ambushes and patrols both count, sparring drills do not. Claim the reward here; every contract can be taken again, and each claim counts toward a board rank that raises contract gold.</p>
        <p class="bounties__total">Contracts claimed: ${escapeHTML(String(total))}</p>
        <p class="bounties__rank">${escapeHTML(bountyRankText(game.state))}</p>
        <p class="bounties__urgent">${escapeHTML(urgentBountyText(game.state))}</p>
        <p class="bounties__mastery">${escapeHTML(masteryText(game.state))}</p>
        ${regionFilterHTML(options, region)}
        ${sortHTML(sort)}
        ${filterNote}
        <ul class="bounties__list">${shown.map((r) => rowHTML(r, anyActive)).join('')}</ul>
      </section>
      ${exchangeHTML(game.state)}
      <div class="title-actions">${uiButton({ action: 'closeBounties', label: 'Back to Greyhaven', iconName: 'compass', variant: 'primary' })}</div>
    </main>`;
  },
  actions: {
    acceptBounty(game, el) {
      if (game.state.scene !== 'bounties' || game.state.combat) return;
      game.bountyMessage = acceptBounty(game.state, el?.dataset?.arg).message;
    },
    abandonBounty(game) {
      if (game.state.scene !== 'bounties' || game.state.combat) return;
      game.bountyMessage = abandonBounty(game.state).message;
    },
    claimBounty(game) {
      if (game.state.scene !== 'bounties' || game.state.combat) return;
      game.bountyMessage = claimBounty(game.state).message;
    },
    exchangeMarks(game, el) {
      if (game.state.scene !== 'bounties' || game.state.combat) return;
      game.bountyMessage = exchangeMarks(game.state, el?.dataset?.arg).message;
    },
    filterBounties(game, el) {
      if (game.state.scene !== 'bounties' || game.state.combat) return;
      const arg = typeof el?.dataset?.arg === 'string' ? el.dataset.arg : '';
      game.bountyRegion = bountyRegionOptions(bountyRows(game.state)).includes(arg) ? arg : '';
    },
    sortBounties(game, el) {
      if (game.state.scene !== 'bounties' || game.state.combat) return;
      const arg = typeof el?.dataset?.arg === 'string' ? el.dataset.arg : '';
      game.bountySort = BOUNTY_SORTS.some((o) => o.id === arg) ? arg : 'board';
    },
    closeBounties(game) { if (game.state.scene === 'bounties' && !game.state.combat) game.setScene('town'); },
  },
};

export function installBounties(game) {
  game.registerScene('bounties', bountiesScene);
  if (!game?.bus) return;
  game.bus.on('combat:victory', (p) => {
    const line = recordBountyKill(game.state, p?.enemyId);
    if (line && Array.isArray(game.state.combat?.log)) game.state.combat.log.push(line);
  });
}
