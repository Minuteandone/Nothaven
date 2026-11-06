// Greyhaven bounty board scene: accept, track, abandon and claim hunt contracts.
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { abandonBounty, acceptBounty, bountyRankText, bountyRewardText, bountyRows, claimBounty, recordBountyKill, totalBountiesClaimed } from '../core/bounties.js';

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
  return `<li class="bounty${r.active ? ' bounty--active' : ''}${r.unlocked ? '' : ' bounty--locked'}">
    <h2 class="bounty__title">${escapeHTML(title)}</h2>
    ${r.unlocked ? `<p class="bounty__brief">${escapeHTML(r.brief)}</p>
    <p class="bounty__terms">Defeat ${r.count} × ${escapeHTML(r.foe)} · Reward: ${escapeHTML(bountyRewardText(r, r.pay))}</p>
    ${r.roams.length ? `<p class="bounty__roams">Roams: ${escapeHTML(r.roams.join(', '))}.</p>` : ''}` : ''}
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

function regionFilterHTML(options, region) {
  if (!options.length) return '';
  const chip = (arg, label, on) => `<button type="button" class="bounty-filter${on ? ' bounty-filter--on' : ''}" data-action="filterBounties" data-arg="${escapeHTML(arg)}" aria-pressed="${on ? 'true' : 'false'}">${escapeHTML(label)}</button>`;
  return `<div class="bounties__filters" role="group" aria-label="Filter contracts by region">${chip('', 'All regions', !region)}${options.map((o) => chip(o, o, o === region)).join('')}</div>`;
}

export const bountiesScene = {
  onEnter(game) { game.bountyMessage = ''; game.bountyRegion = ''; },
  render(game) {
    const rows = bountyRows(game.state);
    const anyActive = rows.some((r) => r.active);
    const options = bountyRegionOptions(rows);
    const region = options.includes(game.bountyRegion) ? game.bountyRegion : '';
    const shown = filterBountyRows(rows, region);
    const matching = shown.filter((r) => r.unlocked && r.roams.includes(region)).length;
    const elsewhere = shown.find((r) => r.active && !r.roams.includes(region));
    const filterNote = region ? `<p class="bounties__filter-note" role="status">${matching} ${matching === 1 ? 'contract roams' : 'contracts roam'} ${escapeHTML(region)}.${elsewhere ? ` Your active contract, ${escapeHTML(elsewhere.title)}, stays listed too.` : ''}</p>` : '';
    const total = totalBountiesClaimed(game.state);
    const msg = game.bountyMessage ? `<p class="bounties__message" role="status">${escapeHTML(game.bountyMessage)}</p>` : '';
    return `<main class="game-shell bounties">
      ${sceneHeader({ eyebrow: 'Greyhaven square', title: 'Bounty Board', subtitle: 'Repeatable hunts posted by the townsfolk.', iconName: 'journal' })}
      <section class="panel" aria-label="Posted contracts">
        ${msg}
        <p class="bounties__intro">Take one contract at a time, then defeat its foe in the wilds — roaming ambushes and patrols both count, sparring drills do not. Claim the reward here; every contract can be taken again, and each claim counts toward a board rank that raises contract gold.</p>
        <p class="bounties__total">Contracts claimed: ${total}</p>
        <p class="bounties__rank">${escapeHTML(bountyRankText(game.state))}</p>
        ${regionFilterHTML(options, region)}
        ${filterNote}
        <ul class="bounties__list">${shown.map((r) => rowHTML(r, anyActive)).join('')}</ul>
      </section>
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
    filterBounties(game, el) {
      if (game.state.scene !== 'bounties' || game.state.combat) return;
      const arg = typeof el?.dataset?.arg === 'string' ? el.dataset.arg : '';
      game.bountyRegion = bountyRegionOptions(bountyRows(game.state)).includes(arg) ? arg : '';
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
