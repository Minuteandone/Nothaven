import { COMPANION_MASTERY, COMPANION_MASTERY_LEVEL, hasMastery } from '../combat/rules.js';
import { COMPANIONS, MAX_PARTY, isUnlocked, inParty } from '../party/companions.js';
import { effectiveStats } from '../items/equipment.js';
import { companionRemark } from '../party/remarks.js';
import { escapeHTML, icon, meter, sceneHeader, uiButton } from './components.js';

const ROLE_LABELS = {
  hero: 'Beacon Bearer', scout: 'Ranged skirmisher', keeper: 'Field mender',
  guardian: 'Front-line defender', signaler: 'Arcane support',
};

const PORTRAIT_DETAILS = {
  tamsin: {
    description: 'A hooded ridge scout with a curved bow beside wind-cut peaks.',
    sky: '#203b4b', light: '#a8d3c3',
    art: `<path fill="#142735" d="M25 164 68 116l20 18 32-45 36 75Z"/><path fill="#294756" d="m19 163 49-47 20 18 32-45 10 75Z" opacity=".65"/><path fill="#101c29" d="M50 190c3-47 21-66 43-66s42 20 45 66Z"/><path fill="#446779" d="M57 107c0-37 15-58 36-58s37 21 37 58l-18 30H73Z"/><path fill="#d4a47f" d="M73 80c4-14 32-14 38 0l-4 35c-7 13-24 13-31 0Z"/><path fill="#263f50" d="M57 83c7-30 57-43 72 2-19-14-48-9-72-2Z"/><path fill="#152735" d="m70 68 24-29 28 34-12 4-17-19-14 17Z"/><path fill="none" stroke="#d5b56d" stroke-width="4" d="M139 57c-23 26-23 77 0 104M139 57l-9 52 9 52"/><path fill="none" stroke="#d7e6df" stroke-width="1.5" d="m139 57-9 52 9 52"/><path fill="#d5b56d" d="m111 109 36 3-1 4-36-3Z"/>`,
  },
  iven: {
    description: 'A young beacon keeper holding a brass lantern among tower mechanisms.',
    sky: '#29364e', light: '#f2cf7b',
    art: `<g fill="none" stroke="#60768b" stroke-width="3" opacity=".65"><circle cx="38" cy="60" r="21"/><circle cx="38" cy="60" r="9"/><path d="M38 32v12m0 32v12M10 60h12m32 0h12M18 40l9 9m22 22 9 9M18 80l9-9m22-22 9-9"/></g><path fill="#172538" d="M42 190c5-47 24-68 51-68s47 21 52 68Z"/><path fill="#63788a" d="m62 133 29 19 31-20 12 58H49Z"/><path fill="#d8aa82" d="M70 77c0-25 44-25 44 0v31c-7 18-35 18-43 0Z"/><path fill="#3b2e2b" d="M66 82c-2-39 53-45 54-5-15-12-34-8-54 5Z"/><path fill="#32465a" d="m68 121 24 22 24-22 10 15-34 29-34-29Z"/><path fill="#f0c56c" d="m84 150 8 8 8-8-8 22Z"/><g transform="translate(122 112)"><path fill="#bc9148" d="M3 17h31l5 51H-2Z"/><path fill="#ffe28b" d="M7 25h23l3 31H4Z"/><path fill="#28384a" d="M9 29h19l2 23H7Z"/><path fill="#f6d47e" d="m13 47 5-15 6 15-6 4Z"/><path fill="none" stroke="#d8b76d" stroke-width="4" d="M8 17C8-3 30-3 30 17M-3 69h43"/></g>`,
  },
  bram: {
    description: 'A broad harbor warden braced behind a weathered shield before rolling seas.',
    sky: '#183e4b', light: '#8fcbd0',
    art: `<path fill="none" stroke="#4e8390" stroke-width="4" opacity=".65" d="M0 75q24-15 48 0t48 0 48 0 48 0M0 94q24-15 48 0t48 0 48 0 48 0"/><path fill="#182c38" d="M22 190c3-46 32-72 69-72s68 26 72 72Z"/><path fill="#586d73" d="m44 137 45 22 48-23 17 54H28Z"/><path fill="#bd8d6c" d="M67 72c0-29 49-29 49 0v32c-7 22-40 22-49 0Z"/><path fill="#3b3330" d="M64 76c-1-38 56-41 56 0-18-12-35-11-56 0Z"/><path fill="#604b3d" d="M67 98c8 8 39 8 49 0-3 34-45 35-49 0Z"/><path fill="#354c56" d="m46 133 43 23 46-23-9 28-37 17-38-18Z"/><g transform="translate(82 115)"><path fill="#a58b58" d="M0 0h67v43c-5 22-25 35-34 39C24 78 5 65 0 43Z"/><path fill="#263f4a" d="M7 7h53v35c-4 17-18 28-27 33-10-5-22-16-26-33Z"/><path fill="none" stroke="#a8ced0" stroke-width="4" d="M33 12v48M14 32h39M18 50q15-12 30 0"/></g>`,
  },
  sela: {
    description: 'A mountain signal runner raising a bright flare above a trail of cairns.',
    sky: '#30334f', light: '#efb580',
    art: `<path fill="#1c283b" d="m0 157 42-60 24 25 39-61 42 64 33-28v93H0Z"/><path fill="#49526a" d="m5 157 37-51 24 25 39-61 14 87Z" opacity=".55"/><g fill="#718196"><path d="m20 157 15-9 14 9Z"/><path d="m23 148 12-8 11 8Z"/><path d="m27 140 8-6 8 6Z"/></g><path fill="#1b2438" d="M47 190c4-48 22-67 48-67s44 19 48 67Z"/><path fill="#675b78" d="m58 132 35 23 34-23 12 58H48Z"/><path fill="#c99174" d="M71 75c0-26 46-26 46 0v32c-7 18-37 18-46 0Z"/><path fill="#292b3b" d="M67 83c-4-44 57-45 55-4-14-15-38-12-55 4Z"/><path fill="#3d4059" d="m65 126 29 24 28-24 12 13-40 34-40-34Z"/><path fill="none" stroke="#c4a66c" stroke-width="5" d="m126 157 20-91"/><path fill="#f5d595" d="m145 60-5-18 10-15 6 17-4 17Z"/><path fill="#ed9f68" d="m146 47-3-12 7-8 4 13-4 10Z"/><g fill="none" stroke="#f5d595" stroke-width="2" opacity=".7"><path d="m132 30-10-8m39 8 10-9m-23-8V2"/></g>`,
  },
};

/** Original, dependency-free character art; ids come only from COMPANIONS. */
export function companionPortrait(id, name, locked = false) {
  const detail = PORTRAIT_DETAILS[id] || PORTRAIT_DETAILS.tamsin;
  const safeId = Object.hasOwn(PORTRAIT_DETAILS, id) ? id : 'tamsin';
  return `<svg class="companion-portrait${locked ? ' companion-portrait--locked' : ''}" viewBox="0 0 180 190" role="img" aria-labelledby="portrait-${safeId}-title portrait-${safeId}-desc">
    <title id="portrait-${safeId}-title">${escapeHTML(name)}</title><desc id="portrait-${safeId}-desc">${escapeHTML(detail.description)}</desc>
    <defs><linearGradient id="portrait-${safeId}-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${detail.sky}"/><stop offset="1" stop-color="#101b29"/></linearGradient></defs>
    <path fill="url(#portrait-${safeId}-sky)" d="M0 0h180v190H0z"/>
    <path fill="none" stroke="${detail.light}" stroke-width="1" opacity=".18" d="M15 18h150v154H15zM22 25h136v140H22z"/>
    <circle cx="145" cy="31" r="13" fill="${detail.light}" opacity=".18"/>
    ${detail.art}
  </svg>`;
}

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const stat = value => Math.max(0, finite(value));

function statGrid(stats) {
  return `<dl class="companion-stats" aria-label="Combat statistics">${[
    ['ATK', stats.atk], ['DEF', stats.def], ['SPD', stats.spd],
  ].map(([label, value]) => `<div><dt>${label}</dt><dd>${stat(value)}</dd></div>`).join('')}</dl>`;
}

function activeMember(member, index) {
  const stats = effectiveStats(member);
  const isHero = index === 0;
  return `<li class="active-member${isHero ? ' active-member--leader' : ''}">
    <div class="active-member__top"><span class="active-member__sigil">${icon(isHero ? 'beacon' : 'shield')}</span><div><h3>${escapeHTML(member.name || `Traveller ${index + 1}`)}</h3><p>${escapeHTML(isHero ? ROLE_LABELS.hero : ROLE_LABELS[member.role] || 'Expedition ally')} · Level ${stat(member.level || 1)}</p></div></div>
    ${meter({ label: `HP for ${member.name || `member ${index + 1}`}`, value: member.hp, max: stats.maxHp, tone: 'hp' })}
    ${meter({ label: `MP for ${member.name || `member ${index + 1}`}`, value: member.mp, max: stats.maxMp, tone: 'mp' })}
    ${statGrid(stats)}
  </li>`;
}

/** Signature technique line: mastered, or the level at which it unlocks. */
export function masteryLine(companion, member) {
  const m = COMPANION_MASTERY[companion?.role];
  if (!m) return '';
  const done = Boolean(member) && hasMastery(member);
  const label = done ? 'Mastered' : `Mastery at Lv ${COMPANION_MASTERY_LEVEL}`;
  return `<p class="companion-mastery${done ? ' companion-mastery--done' : ''}"><strong>${escapeHTML(label)}: ${escapeHTML(m.name)}</strong> — ${escapeHTML(m.note)}</p>`;
}

function companionCard(game, companion) {
  const { state } = game;
  const party = Array.isArray(state?.party) ? state.party : [];
  const member = party.find(entry => entry?.id === companion.id) || state?.reserve?.[companion.id] || null;
  const unlocked = isUnlocked(state, companion.id);
  const joined = inParty(state, companion.id);
  const talking = unlocked && game.musterTalk === companion.id;
  const availability = joined ? 'deployed' : unlocked ? member ? 'reserve' : 'available' : 'locked';
  const statusLabel = { deployed: 'In active party', reserve: 'At the watch house', available: 'Ready to recruit', locked: 'Not yet available' }[availability];
  const stats = member ? effectiveStats(member) : {
    atk: companion.stats.atk, def: companion.stats.def, spd: companion.stats.spd,
    maxHp: companion.stats.hp, maxMp: companion.stats.mp,
  };
  let action;
  if (joined) {
    action = uiButton({ action: 'dismiss', arg: companion.id, label: 'Send to watch house', iconName: 'shield', variant: 'ghost', className: 'companion-action' });
  } else if (unlocked) {
    const full = party.length >= MAX_PARTY;
    action = `${uiButton({ action: 'recruit', arg: companion.id, label: member ? 'Invite from reserve' : 'Invite to party', iconName: 'shield', variant: 'primary', disabled: full, className: 'companion-action' })}
      <p class="companion-action-note">${full ? 'Party full — send an active companion back first.' : member ? 'Their level, equipment, and experience have been retained.' : `Joins at Wren’s current level · ${party.length}/${MAX_PARTY} slots filled.`}</p>`;
  } else {
    action = `<div class="unlock-requirement"><span>${icon('journal')}Unlock requirement</span><p class="hint">${escapeHTML(companion.unlockHint)}</p></div>`;
  }
  const talk = unlocked ? `<button type="button" class="action-button action-button--ghost companion-talk" data-action="talk" data-arg="${companion.id}" aria-expanded="${talking}" aria-controls="remark-${companion.id}">${icon('journal')}<span>Talk with ${escapeHTML(companion.name)}</span></button>
    <blockquote class="remark" id="remark-${companion.id}"${talking ? '' : ' hidden'}><span class="visually-hidden">${escapeHTML(companion.name)} says:</span>“${escapeHTML(companionRemark(companion.id, state?.story, state?.bestiary))}”</blockquote>` : '';
  return `<li class="panel companion-card" data-companion="${companion.id}" data-availability="${availability}">
    <div class="companion-card__art">${companionPortrait(companion.id, companion.name, !unlocked)}<span class="companion-state companion-state--${availability}">${statusLabel}</span></div>
    <div class="companion-card__body">
      <div class="companion-card__heading"><div><p class="eyebrow">${escapeHTML(ROLE_LABELS[companion.role] || companion.role)}</p><h3>${escapeHTML(companion.name)}</h3><p class="companion-title">${escapeHTML(companion.title)}</p></div><span class="companion-level">Lv ${member ? stat(member.level || 1) : 1}</span></div>
      <p class="companion-blurb">${escapeHTML(companion.blurb)}</p>
      ${masteryLine(companion, member)}
      ${member ? `<div class="companion-vitals">${meter({ label: `HP for ${companion.name}`, value: member.hp, max: stats.maxHp, tone: 'hp' })}${meter({ label: `MP for ${companion.name}`, value: member.mp, max: stats.maxMp, tone: 'mp' })}</div>` : `<p class="companion-base">Base vitality <strong>${stat(stats.maxHp)} HP</strong> · <strong>${stat(stats.maxMp)} MP</strong></p>`}
      ${statGrid(stats)}
      <div class="companion-card__actions">${action}${talk}</div>
    </div>
  </li>`;
}

/** Render only: all mutations remain in musterScene's existing actions. */
export function renderMuster(game) {
  const state = game.state || {};
  const party = (Array.isArray(state.party) ? state.party : []).filter(Boolean);
  const emptySlots = Math.max(0, MAX_PARTY - party.length);
  const unlockedCount = Object.values(COMPANIONS).filter(c => isUnlocked(state, c.id)).length;
  return `<main class="game-shell muster muster-screen">
    ${sceneHeader({ eyebrow: 'Greyhaven Watch House', title: 'Muster Board', subtitle: 'Gather a balanced expedition party. Companions act on their own in battle and keep their progress when resting at the watch house.', iconName: 'shield' })}
    <section class="panel active-roster" aria-labelledby="active-roster-title">
      <div class="muster-section-heading"><div><p class="eyebrow">Expedition formation</p><h2 id="active-roster-title">Active party</h2></div><span class="party-capacity" aria-label="${party.length} of ${MAX_PARTY} party slots filled"><strong>${party.length}</strong><span>/ ${MAX_PARTY}</span><small>slots filled</small></span></div>
      <ol class="active-roster__list">${party.map(activeMember).join('')}${Array.from({ length: emptySlots }, () => `<li class="active-member active-member--empty">${icon('compass')}<div><h3>Open slot</h3><p>Invite an available companion below.</p></div></li>`).join('')}</ol>
      <p class="roster-guidance">${icon('heart')}<span>${party.length >= MAX_PARTY ? 'Your expedition is at full strength. You can exchange allies without losing their progress.' : `Wren always leads. Choose up to ${MAX_PARTY - 1} companions for a party of three.`}</span></p>
    </section>
    ${game.musterMessage ? `<p class="message muster-message" role="status">${escapeHTML(game.musterMessage)}</p>` : ''}
    <section class="muster-directory" aria-labelledby="companion-directory-title">
      <div class="muster-section-heading"><div><p class="eyebrow">People of the storm roads</p><h2 id="companion-directory-title">Companion directory</h2></div><p class="directory-count">${unlockedCount} of ${Object.keys(COMPANIONS).length} available</p></div>
      <ul class="companion-grid">${Object.values(COMPANIONS).map(companion => companionCard(game, companion)).join('')}</ul>
    </section>
    <nav class="muster-footer" aria-label="Leave muster board">${uiButton({ action: 'leave', label: game.musterReturn === 'explore' ? 'Back to expedition' : 'Back to Greyhaven', iconName: 'map', variant: 'ghost' })}</nav>
  </main>`;
}
