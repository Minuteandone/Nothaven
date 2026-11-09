import { xpForLevel, MAX_LEVEL } from "../core/progression.js";

// role display names for exploration party sidebar
const ROLE_DISPLAY = {
  keeper: 'Keeper', guardian: 'Guardian', signaler: 'Signaler', scout: 'Scout',
};
const ICONS = {
  beacon: '<path d="M9 21h6M10 21l1-10h2l1 10M8 11h8l-4-6-4 6Z"/><path d="M4 8 1 6M20 8l3-2M4 13H1M20 13h3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  focus: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
  sword: '<path d="m14.5 4.5 5-1-1 5L9 18l-4 1 1-4 8.5-10.5ZM4 20l-1 1M13 16l5 5M16 14l5 5"/>',
  map: '<path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6ZM8 3v15M16 6v15"/>',
  bag: '<path d="M6 8h12l2 13H4L6 8ZM9 9V6a3 3 0 0 1 6 0v3M9 13h6"/>',
  journal: '<path d="M4 3h13a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V3Z"/><path d="M8 3v18M11 8h5M11 12h5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.5-1.6-.8-2.7-.8-1.5 0-2.5.7-2.5 1.8 0 2.8 5.2 1.4 5.2 4.5 0 1.3-1.1 2.2-2.8 2.2-1.2 0-2.3-.4-3.1-1.1M12 5.5v13"/>',
  save: '<path d="M4 3h13l3 3v15H4V3Z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/>',
  bed: '<path d="M3 20V5M3 16h18v4M7 16V9h7a4 4 0 0 1 4 4v3M7 9V6h5a2 2 0 0 1 2 2v1"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
};

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function icon(name, className = '') {
  const paths = ICONS[name] || ICONS.compass;
  return `<svg class="ui-icon ${escapeHTML(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function meter({ label, value, max, tone = 'hp', marker = 0, descriptionId = null }) {
  const safeMax = Math.max(1, finiteNumber(max, 1));
  const safeValue = Math.min(safeMax, Math.max(0, finiteNumber(value)));
  const percent = Math.round((safeValue / safeMax) * 100);
  const safeTone = ['hp', 'mp', 'xp'].includes(tone) ? tone : 'hp';
  return `<div class="meter meter--${safeTone}" role="progressbar" aria-label="${escapeHTML(label)}" aria-valuemin="0" aria-valuemax="${safeMax}" aria-valuenow="${safeValue}"${descriptionId ? ` aria-describedby="${escapeHTML(descriptionId)}"` : ''}>
    <div class="meter__labels"><span>${escapeHTML(label)}</span><span>${safeValue}/${safeMax}</span></div>
    <div class="meter__track"><span class="meter__fill" style="width:${percent}%"></span>${marker > 0 && marker < 100 && safeTone === 'hp' ? `<span class="meter__marker" aria-hidden="true" style="left:${marker}%" title="Boss enrages at or below ${marker}% HP"></span>` : ''}</div>
  </div>`;
}

export function partyStatus(party) {
  const members = Array.isArray(party) ? party : [];
  return `<section class="party-status" aria-label="Party status">${members.map(member => {
    const name = escapeHTML(member?.name || 'Unknown traveller');
    const level = Math.max(0, finiteNumber(member?.level, 1));
    return `<article class="party-member">
      <div class="party-member__heading"><span class="party-member__name">${name}</span><span class="level-badge">Level ${level}</span></div>
      ${typeof member?.role === 'string' && Object.prototype.hasOwnProperty.call(ROLE_DISPLAY, member.role) ? `<p class="party-member__role">${escapeHTML(ROLE_DISPLAY[member.role])}</p>` : ''}
      ${meter({ label: 'HP', value: member?.hp, max: member?.maxHp, tone: 'hp' })}
      ${meter({ label: 'MP', value: member?.mp, max: member?.maxMp, tone: 'mp' })}
      <div class="xp-line"><span>Experience</span><strong>${(() => { const xp = Math.max(0, finiteNumber(member?.xp)); if (level >= MAX_LEVEL) return `${xp} XP (Max level)`; const floor = xpForLevel(level); const ceiling = xpForLevel(level + 1); const earned = Math.max(0, xp - floor); const needed = ceiling - floor; return `${earned} / ${needed} XP`; })()}</strong>${level >= MAX_LEVEL ? "" : ` · to Level ${level + 1}`}</div>
    </article>`;
  }).join('')}</section>`;
}

export function sceneHeader({ eyebrow, title, subtitle, iconName }) {
  return `<header class="scene-header">
    <div class="scene-header__mark">${icon(iconName)}</div>
    <div>${eyebrow ? `<p class="eyebrow">${escapeHTML(eyebrow)}</p>` : ''}<h1>${escapeHTML(title)}</h1>${subtitle ? `<p class="scene-subtitle">${escapeHTML(subtitle)}</p>` : ''}</div>
  </header>`;
}

export function uiButton({ action, label, iconName, variant = 'secondary', disabled = false, arg = null, className = '', title = null }) {
  const safeVariant = ['primary', 'secondary', 'ghost', 'danger'].includes(variant) ? variant : 'secondary';
  return `<button type="button" class="action-button action-button--${safeVariant} ${escapeHTML(className)}" data-action="${escapeHTML(action)}"${arg !== null ? ` data-arg="${escapeHTML(arg)}"` : ''}${title ? ` title="${escapeHTML(title)}"` : ''}${disabled ? ' disabled' : ''}>
    ${iconName ? icon(iconName) : ''}<span>${escapeHTML(label)}</span>
  </button>`;
}

export function resourceChip({ iconName, label, value }) {
  return `<div class="resource-chip">${icon(iconName)}<span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
}

export function beaconArt() {
  return `<svg class="beacon-art" viewBox="0 0 720 620" role="img" aria-labelledby="beacon-art-title beacon-art-desc">
    <title id="beacon-art-title">The beacon above Greyhaven</title>
    <desc id="beacon-art-desc">A lighthouse on steep coastal cliffs cuts a golden path through the storm.</desc>
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#101c31"/><stop offset="1" stop-color="#21364a"/></linearGradient>
      <linearGradient id="beam" x1="1" y1="0" x2="0" y2="1"><stop stop-color="#ffe3a1" stop-opacity=".7"/><stop offset="1" stop-color="#d7a94e" stop-opacity="0"/></linearGradient>
      <linearGradient id="tower" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#6b7781"/><stop offset=".55" stop-color="#c2c2b6"/><stop offset="1" stop-color="#596875"/></linearGradient>
    </defs>
    <path fill="url(#sky)" d="M0 0h720v620H0z"/>
    <g class="storm-clouds" fill="#2c3b50"><path d="m0 90 75-33 72 14 57-42 84 28 70-15 70 42 91-30 90 21 111-35v116H0Z"/><path d="m0 151 91-27 88 25 96-38 106 41 80-29 87 23 83-42 89 29v71H0Z" fill="#1c2a3d"/></g>
    <path class="beacon-beam" fill="url(#beam)" d="M464 197 0 321v154l464-244Z"/>
    <g class="lightning" fill="none" stroke="#a8c7d9" stroke-width="3" opacity=".55"><path d="m119 156-25 54 28-5-31 67"/><path d="m626 111-21 44 24-4-22 48"/></g>
    <path fill="#142333" d="M0 511 118 466l97 31 83-52 77 23 70-51 89 20 86-58 100 38v203H0Z"/>
    <path fill="#0b1623" d="m0 559 146-40 96 30 122-52 85 36 113-46 158 36v97H0Z"/>
    <g class="lighthouse">
      <path fill="#111b28" d="m405 476 140 4 35 34-205-2Z"/>
      <path fill="url(#tower)" d="m438 240 61 1 27 241-116-1Z"/>
      <path fill="#344454" d="m423 315 90 1 4 32-97-1ZM416 412l108 1 3 26-114-1Z"/>
      <path fill="#142333" d="M426 218h86v29h-86zM435 187h68v33h-68z"/>
      <path fill="#d9ad56" d="M444 194h50v21h-50z" class="beacon-light"/>
      <path fill="#0d1825" d="m423 187 46-43 46 43Z"/>
      <path fill="none" stroke="#9ca8ad" stroke-width="5" d="M426 218v-39M512 218v-39M426 180h86"/>
      <path fill="#132232" d="M458 432h24v50h-24zM460 270h18v28h-18z"/>
    </g>
    <path fill="none" stroke="#56758a" stroke-width="3" opacity=".45" d="M0 577q85-25 170 0t170 0 170 0 210 0"/>
  </svg>`;
}
