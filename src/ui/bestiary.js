import { getItem } from '../items/items.js';
import { fieldTip } from '../data/fieldTips.js';
import { escapeHTML, icon, meter, sceneHeader, uiButton } from './components.js';
import { elementLabel, elementClass } from '../combat/elements.js';

const BEASTS = new Set(['storm_rat', 'gale_hound', 'frost_wolf', 'briar_boar', 'old_tusk', 'frostmane', 'thunderhoof']);
const SPECTRES = new Set(['tide_wraith', 'squall_revenant', 'tempest_shade', 'last_squall', 'lens_wisp', 'rime_wight']);

export const BESTIARY_COMPARISON_LIMIT = 3;

const ART = {
  beast: {
    label: 'a wind-running beast',
    body: '<path fill="#111d2a" d="M28 119l18-15 13-35 28-22 38 4 24 20 34 8 25 25-8 12-31-13-25 20H65l-37-4Z"/><path fill="#49677a" d="M61 91l28-30 34 1 19 18-35-7-23 27Z"/><path fill="#d5b56d" d="m150 74 9 3-8 5Z"/><path fill="none" stroke="#94c7d4" stroke-width="3" d="m43 53 15-18-2 16 19-24M176 45l13-17-1 14 17-20"/>',
  },
  humanoid: {
    label: 'an armed storm-road adversary',
    body: '<path fill="#111d2a" d="M66 133l13-55 25-18-7-17 11-21 24-3 17 18-5 25 25 17 19 54Z"/><path fill="#4b5e70" d="m86 79 28-17 25 2 26 18-14 51h-57Z"/><path fill="#b48b6b" d="m108 29 23-4 11 16-8 20-22-4-8-14Z"/><path fill="#273b4d" d="m100 33 12-20 28 1 14 22-25-9Z"/><path fill="none" stroke="#d5b56d" stroke-width="5" d="m50 126 125-95M164 27l22-5-5 22"/><path fill="none" stroke="#7895a6" stroke-width="3" d="m72 93 89 15"/>',
  },
  construct: {
    label: 'a storm-powered construct',
    body: '<path fill="#111d2a" d="M62 132l9-51 18-12-4-33 23-19h40l24 19-5 34 19 13 7 49Z"/><path fill="#526878" d="m94 43 23-15h30l15 17-8 25H99Z"/><path fill="#2b3f50" d="m84 82 34-13 41 12 11 51H73Z"/><path fill="#d5b56d" d="m108 48 12-5 12 5-3 9h-18Z"/><path fill="none" stroke="#94c7d4" stroke-width="3" d="M97 95h48M91 110h62M120 72v60"/><path fill="none" stroke="#d5b56d" stroke-width="4" d="m63 67-21 34 20 11M174 66l24 32-17 15"/>',
  },
  spectre: {
    label: 'a spectral storm apparition',
    body: '<path fill="#142535" d="M66 132l20-38-9-26 23-39 29-12 31 25 7 34-14 24 29 32-38-10-21 14-20-16Z"/><path fill="#3e6375" d="m91 65 23-33 20 2 20 25-16 42-33-9Z"/><path fill="#a8d3d9" d="m105 57 10-4-4 10Zm25-2 10 5-9 5Z"/><path fill="none" stroke="#8fbcc9" stroke-width="3" d="m54 55-20 30 25-7-19 36M177 38l23 34-20-4 16 33"/><path fill="none" stroke="#4f7b8e" stroke-width="4" d="M35 128q38-19 73 0t77-1"/>',
  },
  crawler: {
    label: 'an armored reef crawler',
    body: '<path fill="#111d2a" d="m43 112 25-45 42-20 45 13 31 48-27 21H70Z"/><path fill="#486b72" d="m70 74 40-19 38 12 19 31-44 19-54-14Z"/><path fill="#233d49" d="m84 70 27-8 28 9-12 27-34-3Z"/><path fill="none" stroke="#a8d3c3" stroke-width="5" d="m65 79-33-17-14 18 29 22M159 76l34-19 16 17-27 25M72 111l-23 23M100 119l-10 19M148 115l20 22"/><path fill="#d5b56d" d="m86 80 8-3-3 8Zm46-2 8 4-8 4Z"/>',
  },
  scorpion: {
    label: 'a giant copper-plated sand scorpion',
    body: '<path fill="#111d2a" d="m64 114 20-26 38-9 38 5 22 15-5 17-40 9-48-2Z"/><path fill="#6b4a3a" d="m88 95 32-8 34 5 17 10-31 7-42-3Z"/><path fill="none" stroke="#2a1d17" stroke-width="3" d="M106 90l-3 20M126 88v23M146 91l3 20"/><path fill="none" stroke="#3a2a22" stroke-width="10" stroke-linejoin="round" d="m174 104 20-24 6-30-11-22-21-5"/><path fill="none" stroke="#8a5d44" stroke-width="4" stroke-linejoin="round" d="m174 104 20-24 6-30-11-22-21-5"/><path fill="#e0794a" d="m170 23-20 8 14 9Z"/><path fill="none" stroke="#f0b27a" stroke-width="2" d="m146 22-8-6M144 33l-10 2M152 44l-6 8"/><path fill="#111d2a" d="m84 96-26-14-22 2 8 8-18 2 16 10 22-2Z"/><path fill="#6b4a3a" d="m60 88-20-12-14 4 6 6 22 8Z"/><path fill="#111d2a" d="m82 108-26 4-20 14 12 2-10 12 20-8 18-12Z"/><path fill="#6b4a3a" d="m54 118-14 10-4 8 12-6 12-8Z"/><path fill="none" stroke="#a07a5a" stroke-width="3" d="m98 121-12 18M114 124l-5 20M136 124l5 20M154 120l13 17"/><path fill="#d5b56d" d="m80 98 7-3-1 7Zm2 8 7 1-5 5Z"/>',
  },
  heart: {
    label: 'an angular lightning vortex',
    body: '<path fill="#142535" d="m120 16 53 38-14 63-42 24-48-34-9-57Z"/><path fill="#385b71" d="m120 29 35 32-11 43-29 23-32-29-7-38Z"/><path fill="#d5b56d" d="m123 39 12 33 24 5-28 15-10 28-8-31-25-11 27-9Z"/><path fill="none" stroke="#a8d3d9" stroke-width="3" d="M49 31 25 63l21-3-19 32M188 22l24 32-19-2 20 35M44 125l-18 13M190 121l23 15"/>',
  },
};

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function victoryCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function bestiaryQueryText(value) {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

export function bestiaryFilterName(value) {
  return ['all', 'bosses', 'regular'].includes(value) ? value : 'all';
}

export function filterBestiaryEntries(entries, filter = 'all', query = '') {
  const category = bestiaryFilterName(filter);
  const text = bestiaryQueryText(query).toLowerCase();
  return (Array.isArray(entries) ? entries : []).filter(entry => {
    if (!entry?.enemy) return false;
    if (category === 'bosses' && !entry.enemy.boss) return false;
    if (category === 'regular' && entry.enemy.boss) return false;
    if (!text) return true;
    return Number.isInteger(entry.count) && entry.count > 0 &&
      typeof entry.enemy.name === 'string' && entry.enemy.name.toLowerCase().includes(text);
  });
}

export function bestiaryComparisonIds(entries, compareIds = []) {
  const records = Array.isArray(entries) ? entries.filter(entry => entry?.enemy) : [];
  const requested = Array.isArray(compareIds) ? compareIds : [];
  const selected = [];
  for (const id of requested) {
    if (typeof id !== 'string' || selected.includes(id)) continue;
    const known = records.some(entry => entry.enemy.id === id && victoryCount(entry.count) > 0);
    if (known) selected.push(id);
    if (selected.length === BESTIARY_COMPARISON_LIMIT) break;
  }
  return selected;
}

function kindFor(enemy) {
  if (enemy.id === 'storm_heart') return 'heart';
  if (enemy.id === 'reef_crawler' || enemy.id === 'wrack_eel' || enemy.id === 'gloomfin') return 'crawler';
  if (enemy.id === 'cinderclaw') return 'scorpion';
  if (BEASTS.has(enemy.id)) return 'beast';
  if (SPECTRES.has(enemy.id)) return 'spectre';
  if (Array.isArray(enemy.tags) && enemy.tags.includes('construct')) return 'construct';
  return 'humanoid';
}

export function foeArt(enemy) {
  const kind = kindFor(enemy);
  const art = ART[kind];
  const name = String(enemy.name || 'Recorded foe');
  return `<svg class="foe-art foe-art--${kind}" viewBox="0 0 240 150" role="img" aria-label="${escapeHTML(`${name}: ${art.label}`)}">
    <title>${escapeHTML(name)}</title><desc>${escapeHTML(`Angular field sketch of ${art.label}.`)}</desc>
    <path fill="#172b3c" d="M0 0h240v150H0z"/><path fill="#203c4e" d="m0 45 45-21 40 15 50-27 49 26 56-19v53H0Z"/><path fill="#10202e" d="m0 126 42-20 42 12 41-18 50 21 65-17v46H0Z"/>
    ${art.body}
  </svg>`;
}

function stats(enemy) {
  const values = [['HP', enemy.hp], ['ATK', enemy.atk], ['DEF', enemy.def], ['SPD', enemy.spd], ['XP', enemy.xp], ['Gold', enemy.gold]];
  return `<dl class="foe-stats" aria-label="Combat record">${values.map(([label, value]) => `<div><dt>${label}</dt><dd>${number(value)}</dd></div>`).join('')}</dl>`;
}

/** Element badge chip shown when a foe has a defined element. */
function elementBadge(enemy) {
  const cls = elementClass(enemy?.element);
  if (!cls) return "";
  return `<span class="element-chip ${cls}">${escapeHTML(elementLabel(enemy.element))}</span>`;
}

/** Static catalogue guidance, only called after the known-victory filter. */
function windupDetails(enemy, comparison = false) {
  const w = enemy.windup;
  if (!w || typeof w.name !== 'string' || !w.name.trim() ||
      !Number.isFinite(w.chance) || w.chance <= 0 || w.chance > 1 ||
      !Number.isFinite(w.mult) || w.mult <= 0) return '';
  const tag = comparison ? 'div' : 'section';
  const className = comparison ? 'comparison-tactic' : 'foe-tactic';
  return `<${tag} class="${className} foe-windup"><h4>Windup: ${escapeHTML(w.name)}</h4><p>${escapeHTML(Math.round(w.chance * 100))}% chance to begin gathering. Gathers for one enemy action, then aims a ×${escapeHTML(w.mult)} ATK strike at Wren on its next action. After the warning, Defend or a ward halves the strike; stunning the foe or landing a Stillpoint Strike interrupts it.</p></${tag}>`;
}

function comparisonCard({ enemy }) {
  const ability = enemy.ability;
  const details = ability
    ? `${ability.status ? `Inflicts ${escapeHTML(ability.status)}. ` : ''}${Number.isFinite(Number(ability.chance)) ? `${Math.round(Number(ability.chance) * 100)}% use chance.` : ''}`
    : 'No signature move recorded.';
  return `<article class="comparison-card" data-comparison-enemy="${escapeHTML(enemy.id)}">
    <div class="comparison-card__heading"><div><p class="eyebrow">${enemy.boss ? 'Boss record' : 'Patrol record'}</p><h3>${escapeHTML(enemy.name)}</h3></div>${uiButton({ action: 'removeComparedFoe', arg: enemy.id, label: 'Remove', variant: 'ghost', className: 'comparison-remove' })}</div>
    ${stats(enemy)}
    ${elementBadge(enemy) ? `<p class="foe-element">${elementBadge(enemy)}</p>` : ''}
    <div class="comparison-tactic"><h4>${escapeHTML(ability?.name || 'Signature move')}</h4><p>${details || 'No additional trigger details recorded.'}</p></div>
    ${windupDetails(enemy, true)}
    ${enemy.enrage ? `<p class="foe-phase"><strong>Second phase: grows enraged below ${Math.round(number(enemy.enrage.threshold) * 100)}% HP (+${number(enemy.enrage.atk)} ATK)</strong>.</p>` : ''}
  </article>`;
}

function comparisonTray(records, selectedIds) {
  const selected = selectedIds.map(id => records.find(entry => entry.enemy.id === id)).filter(Boolean);
  const full = selected.length === BESTIARY_COMPARISON_LIMIT;
  const status = `${selected.length}/${BESTIARY_COMPARISON_LIMIT} selected. ${full ? 'Tray full; remove a foe before adding another.' : selected.length ? 'Add another recorded foe or remove a selection.' : 'Choose recorded foes from the catalogue below.'}`;
  return `<section class="panel bestiary-comparison" aria-labelledby="bestiary-comparison-title">
    <div class="bestiary-comparison__heading"><div><p class="eyebrow">Side-by-side tactics</p><h2 id="bestiary-comparison-title">Tactical comparison</h2><p id="bestiary-comparison-status" role="status" aria-live="polite">${status}</p></div>${selected.length ? uiButton({ action: 'clearComparison', label: 'Clear comparison', variant: 'ghost', className: 'comparison-clear' }) : ''}</div>
    ${selected.length ? `<div class="bestiary-comparison__grid">${selected.map(comparisonCard).join('')}</div>` : '<p class="comparison-empty">Use <strong>Compare</strong> on any recorded foe. You can compare up to three confirmed victories; unrecorded foes stay hidden.</p>'}
  </section>`;
}

function knownEntry({ enemy, count }, selected = false, full = false) {
  const kind = kindFor(enemy);
  const defeats = victoryCount(count);
  const traits = Array.isArray(enemy.tags) ? enemy.tags : [];
  const tags = [enemy.boss ? 'Boss' : null, ...traits].filter(Boolean);
  const ability = enemy.ability ? `<section class="foe-tactic" aria-label="Signature move"><span>${icon('sword')}Signature move</span><h4>${escapeHTML(enemy.ability.name)}</h4><p>${enemy.ability.status ? `Inflicts <strong>${escapeHTML(enemy.ability.status)}</strong>. ` : ''}${Number.isFinite(Number(enemy.ability.chance)) ? `${Math.round(Number(enemy.ability.chance) * 100)}% use chance.` : ''}</p></section>` : '';
  const drops = Array.isArray(enemy.loot) ? enemy.loot : [];
  const loot = drops.map(item => getItem(item?.id)?.name || item?.id).filter(Boolean);
  const tip = fieldTip(enemy.id);
  return `<li class="bestiary-entry bestiary-entry--known" data-enemy="${escapeHTML(enemy.id)}" data-kind="${kind}"${enemy.boss ? ' data-boss="true"' : ''}>
    <div class="foe-artwork">${foeArt(enemy)}<span class="foe-recorded">${icon('journal')}Recorded</span></div>
    <div class="foe-entry-body">
      <div class="foe-heading"><div><p class="eyebrow">${enemy.boss ? 'Boss record' : 'Patrol record'}</p><h3>${escapeHTML(enemy.name)}</h3></div><span class="foe-kind">${escapeHTML(kind)}</span></div>
      ${tags.length ? `<ul class="foe-tags" aria-label="Foe traits">${tags.map(tag => `<li>${escapeHTML(tag)}</li>`).join('')}</ul>` : ''}
      ${enemy.intro ? `<p class="foe-intro">${escapeHTML(enemy.intro)}</p>` : ''}
      ${stats(enemy)}
      ${elementBadge(enemy) ? `<p class="foe-element">${elementBadge(enemy)}</p>` : ''}
      ${ability}
      ${windupDetails(enemy)}
      ${enemy.enrage ? `<p class="foe-phase"><strong>Second phase: grows enraged below ${Math.round(number(enemy.enrage.threshold) * 100)}% HP (+${number(enemy.enrage.atk)} ATK)</strong>.</p>` : ''}
      ${loot.length ? `<div class="foe-spoils"><strong>Known spoils:</strong><ul>${loot.map(name => `<li>${escapeHTML(name)}</li>`).join('')}</ul></div>` : ''}
      ${tip ? `<p class="field-tip"><strong>Mara’s advice:</strong> ${escapeHTML(tip)}</p>` : ''}
      <p class="foe-defeats">${icon('shield')}<span><strong>Defeated: ${defeats}</strong> ${defeats === 1 ? 'confirmed victory' : 'confirmed victories'}</span></p>
      <div class="foe-compare"><button type="button" class="action-button action-button--${selected ? 'ghost' : 'secondary'}" data-action="${selected ? 'removeComparedFoe' : 'compareFoe'}" data-arg="${escapeHTML(enemy.id)}" aria-pressed="${selected}" aria-describedby="bestiary-comparison-status"${full && !selected ? ' disabled title="Remove a foe from the full comparison tray first"' : ''}>${icon('journal')}<span>${selected ? 'Remove' : 'Compare'}</span></button></div>
    </div>
  </li>`;
}

function unknownEntry({ enemy }) {
  return `<li class="bestiary-entry unknown"><span class="unknown-mark" aria-hidden="true">?</span><div><h3>??? ${enemy.boss ? '<small>(boss)</small>' : ''}</h3><p class="hint"><em>Not yet encountered and defeated.</em></p><p>Return after a victory to reveal this patrol record.</p></div></li>`;
}

/** Presentation only: victory recording remains in installBestiary. */
export function renderBestiary({ entries, returnScene = 'town', compareIds = [], filter = 'all', query = '' }) {
  const records = Array.isArray(entries) ? entries.filter(entry => entry?.enemy) : [];
  const category = bestiaryFilterName(filter);
  const text = bestiaryQueryText(query);
  const shown = filterBestiaryEntries(records, category, text);
  const known = records.filter(entry => victoryCount(entry.count) > 0);
  const comparisonIds = bestiaryComparisonIds(records, compareIds);
  const victories = known.reduce((sum, entry) => sum + victoryCount(entry.count), 0);
  const bosses = known.filter(entry => entry.enemy.boss).length;
  const totalBosses = records.filter(entry => entry.enemy.boss).length;
  const returnLabel = returnScene === 'explore' ? 'Back to expedition' : returnScene === 'town' ? 'Back to Greyhaven' : 'Back';
  return `<main class="game-shell bestiary bestiary-screen">
    ${sceneHeader({ eyebrow: 'Greyhaven patrol archive', title: "Warden's Field Journal", subtitle: 'Study confirmed victories, signature moves, known spoils, and Mara’s tactical notes before returning to the storm roads.', iconName: 'journal' })}
    <section class="panel bestiary-overview" aria-labelledby="bestiary-overview-title">
      <div><p class="eyebrow">Field research</p><h2 id="bestiary-overview-title">Catalogue progress</h2><p>Entries: ${known.length}/${records.length}. Defeat a foe to preserve its tactics here; unknown names remain unrecorded.</p></div>
      <div class="bestiary-completion">${meter({ label: 'Journal completion', value: known.length, max: Math.max(1, records.length), tone: 'xp' })}<div class="bestiary-totals"><span><strong>${victories}</strong> victories</span><span><strong>${bosses}/${totalBosses}</strong> bosses recorded</span></div></div>
    </section>
    ${comparisonTray(known, comparisonIds)}
    <section class="bestiary-catalogue" aria-labelledby="bestiary-catalogue-title"><div class="bestiary-catalogue-heading"><div><p class="eyebrow">Storm-road field notes</p><h2 id="bestiary-catalogue-title">Foe records</h2></div><p>${known.length ? `${known.length} revealed · ${records.length - known.length} unrecorded` : 'No foes recorded yet'}</p></div>
      <div class="bestiary-tools">
        <div class="bestiary-filters" role="group" aria-label="Foe category">${[['all', 'All'], ['bosses', 'Bosses'], ['regular', 'Regular']].map(([id, label]) => `<button type="button" data-action="bestiaryFilter" data-arg="${id}" aria-pressed="${category === id}">${label}</button>`).join('')}</div>
        <label for="bestiary-search">Search recorded foes</label>
        <p id="bestiary-search-help" class="hint">Search recorded foe names, then choose Search. Unknown foes stay hidden; clear the search to show their placeholders.</p>
        <div class="bestiary-search-row"><input id="bestiary-search" type="search" maxlength="120" value="${escapeHTML(text)}" aria-describedby="bestiary-search-help"><button type="button" data-action="searchBestiary">Search</button><button type="button" data-action="clearBestiarySearch" ${text ? '' : 'disabled'}>Clear search</button></div>
        <p role="status">Showing ${shown.length} of ${records.length} foes.</p>
      </div>
      ${shown.length ? `<ul class="bestiary-list">${shown.map(entry => victoryCount(entry.count) > 0 ? knownEntry(entry, comparisonIds.includes(entry.enemy.id), comparisonIds.length === BESTIARY_COMPARISON_LIMIT) : unknownEntry(entry)).join('')}</ul>` : '<p class="bestiary-empty">No foes match these choices.</p>'}
    </section>
    <nav class="bestiary-footer" aria-label="Leave field journal">${uiButton({ action: 'leave', label: returnLabel, iconName: returnScene === 'explore' ? 'map' : 'compass', variant: 'ghost' })}</nav>
  </main>`;
}
