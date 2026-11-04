import { getItem } from '../items/items.js';
import { fieldTip } from '../data/fieldTips.js';
import { escapeHTML, icon, meter, sceneHeader, uiButton } from './components.js';

const BEASTS = new Set(['storm_rat', 'gale_hound', 'frost_wolf', 'briar_boar', 'old_tusk']);
const SPECTRES = new Set(['tide_wraith', 'squall_revenant', 'tempest_shade', 'last_squall', 'lens_wisp', 'rime_wight']);

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

function kindFor(enemy) {
  if (enemy.id === 'storm_heart') return 'heart';
  if (enemy.id === 'reef_crawler' || enemy.id === 'wrack_eel' || enemy.id === 'gloomfin') return 'crawler';
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

function knownEntry({ enemy, count }) {
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
      ${ability}
      ${enemy.enrage ? `<p class="foe-phase"><strong>Second phase: grows enraged below ${Math.round(number(enemy.enrage.threshold) * 100)}% HP (+${number(enemy.enrage.atk)} ATK)</strong>.</p>` : ''}
      ${loot.length ? `<div class="foe-spoils"><strong>Known spoils:</strong><ul>${loot.map(name => `<li>${escapeHTML(name)}</li>`).join('')}</ul></div>` : ''}
      ${tip ? `<p class="field-tip"><strong>Mara’s advice:</strong> ${escapeHTML(tip)}</p>` : ''}
      <p class="foe-defeats">${icon('shield')}<span><strong>Defeated: ${defeats}</strong> ${defeats === 1 ? 'confirmed victory' : 'confirmed victories'}</span></p>
    </div>
  </li>`;
}

function unknownEntry({ enemy }) {
  return `<li class="bestiary-entry unknown"><span class="unknown-mark" aria-hidden="true">?</span><div><h3>??? ${enemy.boss ? '<small>(boss)</small>' : ''}</h3><p class="hint"><em>Not yet encountered and defeated.</em></p><p>Return after a victory to reveal this patrol record.</p></div></li>`;
}

/** Presentation only: victory recording remains in installBestiary. */
export function renderBestiary({ entries, returnScene = 'town' }) {
  const records = Array.isArray(entries) ? entries.filter(entry => entry?.enemy) : [];
  const known = records.filter(entry => victoryCount(entry.count) > 0);
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
    <section class="bestiary-catalogue" aria-labelledby="bestiary-catalogue-title"><div class="bestiary-catalogue-heading"><div><p class="eyebrow">Storm-road field notes</p><h2 id="bestiary-catalogue-title">Foe records</h2></div><p>${known.length ? `${known.length} revealed · ${records.length - known.length} unrecorded` : 'No foes recorded yet'}</p></div>
      <ul class="bestiary-list">${records.map(entry => victoryCount(entry.count) > 0 ? knownEntry(entry) : unknownEntry(entry)).join('')}</ul>
    </section>
    <nav class="bestiary-footer" aria-label="Leave field journal">${uiButton({ action: 'leave', label: returnLabel, iconName: returnScene === 'explore' ? 'map' : 'compass', variant: 'ghost' })}</nav>
  </main>`;
}
