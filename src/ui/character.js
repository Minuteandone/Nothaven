import { MAX_LEVEL, xpForLevel, xpToNext } from '../core/progression.js';
import { effectiveStats, totalStats } from '../items/equipment.js';
import { getItem } from '../items/items.js';
import { SKILLS, SKILL_UNLOCKS, knownSkills } from '../combat/rules.js';
import { escapeHTML, icon, meter, sceneHeader, uiButton } from './components.js';

const EQUIPMENT_SLOTS = [
  ['weapon', 'Weapon', 'sword'],
  ['armor', 'Armour', 'shield'],
  ['trinket', 'Trinket', 'beacon'],
];

const STAT_ROWS = [
  ['maxHp', 'hp', 'Max HP'],
  ['maxMp', 'mp', 'Max MP'],
  ['atk', 'atk', 'Attack'],
  ['def', 'def', 'Defence'],
  ['spd', 'spd', 'Speed'],
];

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
  return Math.trunc(number(value, fallback));
}

function safeItem(id) {
  if (typeof id !== 'string' || !id) return null;
  try { return getItem(id); } catch { return null; }
}

function itemBonuses(item) {
  if (!item?.stats || typeof item.stats !== 'object') return 'No stat bonus';
  const names = { atk: 'ATK', def: 'DEF', hp: 'HP', mp: 'MP', spd: 'SPD' };
  const parts = Object.entries(names).flatMap(([key, label]) => {
    const value = number(item.stats[key]);
    return value ? [`${value > 0 ? '+' : ''}${value} ${label}`] : [];
  });
  return parts.length ? parts.join(' · ') : 'No stat bonus';
}

/** Original path-only portrait; no external assets or runtime drawing. */
export function heroPortrait() {
  return `<svg class="hero-portrait" viewBox="0 0 360 420" role="img" aria-labelledby="hero-portrait-title hero-portrait-desc">
    <title id="hero-portrait-title">Wren, keeper of the beacon lantern</title>
    <desc id="hero-portrait-desc">An angular field portrait of Wren in a weathered blue coat, holding a glowing brass lantern against the storm.</desc>
    <path fill="#101d2d" d="M0 0h360v420H0Z"/>
    <path fill="#1c3246" d="m0 76 58-34 66 25 72-44 73 39 91-27v145H0Z"/>
    <path fill="none" stroke="#83a9bd" stroke-width="3" opacity=".55" d="m47 73-17 39 21-6-24 48M304 58l-16 35 18-4-20 42"/>
    <path fill="#0a1522" d="m0 353 74-40 56 26 69-43 76 39 85-31v116H0Z"/>
    <path fill="#c9a27d" d="m139 92 44-27 46 27 8 73-38 53-49-34-18-54Z"/>
    <path fill="#263b4d" d="m126 121 8-55 49-34 52 37 14 76-25-34-15-37-35 23-39 5-3 46Z"/>
    <path fill="#162838" d="m131 125 17-19 3 61-21-22ZM220 111l17 17-4 49-20-22Z"/>
    <path fill="none" stroke="#273949" stroke-width="5" d="m153 130 17-4M199 126l16 5M176 164l20 3"/>
    <path fill="#d5b18b" d="m157 190 51 3 8 48-65-2Z"/>
    <path fill="#29485c" d="m108 228 46-23 32 35 30-35 48 24 39 171H62Z"/>
    <path fill="#1b3449" d="m108 228-46 37-25 135h77l28-137ZM264 229l44 43 31 128h-75l-27-139Z"/>
    <path fill="#3e6174" d="m154 205 32 35-29 47-29-63ZM216 205l-30 35 29 47 28-63Z"/>
    <path fill="#d2a84f" d="m177 249 9-9 10 9-4 19h-11Z"/>
    <path fill="none" stroke="#8aa5b3" stroke-width="4" d="m91 278 32 18M253 282l32-17M112 346h139"/>
    <path fill="#c9a27d" d="m268 337 31-9 23 25-12 33-31-4Z"/>
    <path fill="none" stroke="#caa654" stroke-width="7" d="M282 330v-34h40v34M276 330h52l-7 68h-39Z"/>
    <path fill="#f5d77d" d="m290 337 26-1-5 48h-17Z"/>
    <path fill="#fff0b0" d="m298 345 10-1-3 30h-6Z"/>
    <path fill="none" stroke="#dcb85c" stroke-width="3" opacity=".45" d="m277 311-22-12M330 310l21-15M302 282v-25"/>
  </svg>`;
}

function equipmentCard(member, slot, label, iconName) {
  const id = member.equipment?.[slot];
  const item = safeItem(id);
  const name = item ? item.name : id ? 'Unrecognized equipment' : `No ${label.toLowerCase()} equipped`;
  const description = item ? itemBonuses(item) : id ? 'This item is not in the current equipment registry.' : 'This slot is open for future gear.';
  return `<article class="equipment-card" data-equipment-slot="${slot}">
    <div class="equipment-card__icon">${icon(iconName)}</div>
    <div><p class="eyebrow">${label}</p><h3>${escapeHTML(name)}</h3><p>${escapeHTML(description)}</p></div>
  </article>`;
}

function skillCard(id, level) {
  const skill = SKILLS[id];
  const unlock = integer(SKILL_UNLOCKS[id], 1);
  const learned = unlock <= level;
  return `<li class="skill-record ${learned ? 'skill-record--known' : 'skill-record--locked'}" data-skill="${escapeHTML(id)}" data-learned="${learned}">
    <div class="skill-record__heading"><h3>${escapeHTML(skill.name)}</h3><span class="skill-availability">${learned ? 'Known' : `Unlocks at level ${unlock}`}</span></div>
    <p>${escapeHTML(skill.description)}</p>
    <div class="skill-record__meta"><span>${icon('focus')} ${integer(skill.mp)} MP</span><span>${learned ? 'Ready for battle' : `${Math.max(0, unlock - level)} ${unlock - level === 1 ? 'level' : 'levels'} to go`}</span></div>
  </li>`;
}

export function characterProgress(member = {}) {
  const level = Math.min(MAX_LEVEL, Math.max(1, integer(member?.level, 1)));
  const totalXp = Math.max(0, integer(member?.xp));
  const atMax = level >= MAX_LEVEL;
  const floor = xpForLevel(level);
  const ceiling = atMax ? floor : xpForLevel(level + 1);
  const earned = atMax ? 0 : Math.min(Math.max(0, totalXp - floor), Math.max(0, ceiling - floor));
  const needed = atMax ? 0 : Math.max(0, ceiling - floor);
  const remaining = atMax ? 0 : Math.max(0, integer(xpToNext({ level, xp: totalXp })));
  return { level, totalXp, atMax, floor, ceiling, earned, needed, remaining };
}

/** Read-only Wren character record. Rendering never changes the supplied member. */
export function renderCharacter({ member = {}, returnScene = 'town' } = {}) {
  const source = member && typeof member === 'object' ? member : {};
  const safeMember = {
    atk: number(source.atk), def: number(source.def), maxHp: number(source.maxHp),
    maxMp: number(source.maxMp), spd: number(source.spd),
    equipment: source.equipment && typeof source.equipment === 'object' ? source.equipment : {},
  };
  const effective = effectiveStats(safeMember);
  const bonus = totalStats(safeMember);
  const progress = characterProgress(source);
  const known = new Set(knownSkills({ level: progress.level }).map(skill => skill.id));
  const knownCount = Object.keys(SKILL_UNLOCKS).filter(id => known.has(id)).length;
  const name = typeof source.name === 'string' && source.name.trim() ? source.name : 'Wren';
  const backLabel = returnScene === 'explore' ? 'Back to expedition' : returnScene === 'town' ? 'Back to Greyhaven' : 'Back';
  const xpMeter = progress.atMax
    ? '<div class="character-max-level" role="status">Maximum level reached · the full skill discipline is available.</div>'
    : meter({ label: `Level ${progress.level} experience`, value: progress.earned, max: progress.needed, tone: 'xp' });

  return `<main class="game-shell character character-screen">
    ${sceneHeader({ eyebrow: 'Beacon Ward · Adventurer record', title: 'Character Sheet', subtitle: `${name}’s training, equipment, and growing command of the beacon.`, iconName: 'journal' })}
    <div class="character-layout">
      <section class="panel character-identity" aria-labelledby="character-identity-title">
        <div class="character-portrait-frame">${heroPortrait()}<span class="character-level">Level ${progress.level}</span></div>
        <div class="character-identity__copy"><p class="eyebrow">Stormhaven expedition</p><h2 id="character-identity-title">${escapeHTML(name)}</h2><p>Beacon keeper · Wayfarer</p></div>
        <div class="character-vitals">
          ${meter({ label: `Current HP for ${name}`, value: source.hp, max: effective.maxHp, tone: 'hp' })}
          ${meter({ label: `Current MP for ${name}`, value: source.mp, max: effective.maxMp, tone: 'mp' })}
        </div>
      </section>
      <div class="character-details">
        <section class="panel character-experience" aria-labelledby="character-xp-title">
          <div class="character-section-heading"><div><p class="eyebrow">The road shapes the warden</p><h2 id="character-xp-title">Experience</h2></div><strong>${progress.totalXp} XP</strong></div>
          ${xpMeter}
          <div class="character-xp-notes"><span>${progress.atMax ? `Level ${MAX_LEVEL} is the current cap.` : `${progress.remaining} XP to level ${progress.level + 1}`}</span><span>${progress.atMax ? `${progress.totalXp} total XP earned` : `Next threshold: ${progress.ceiling} total XP`}</span></div>
        </section>
        <section class="panel character-stats" aria-labelledby="character-stats-title">
          <div class="character-section-heading"><div><p class="eyebrow">Training meets equipment</p><h2 id="character-stats-title">Battle statistics</h2></div><span class="character-section-note">Base + gear = effective</span></div>
          <div class="character-stat-table-wrap"><table class="character-stat-table"><caption class="sr-only">Base statistics, equipment bonuses, and effective battle statistics for ${escapeHTML(name)}</caption><thead><tr><th scope="col">Stat</th><th scope="col">Base</th><th scope="col">Gear</th><th scope="col">Effective</th></tr></thead><tbody>
            ${STAT_ROWS.map(([key, bonusKey, label]) => `<tr data-stat="${key}"><th scope="row">${label}</th><td>${integer(safeMember[key])}</td><td class="stat-bonus">${bonus[bonusKey] > 0 ? '+' : ''}${integer(bonus[bonusKey])}</td><td><strong>${integer(effective[key])}</strong></td></tr>`).join('')}
          </tbody></table></div>
        </section>
      </div>
    </div>
    <section class="panel character-equipment" aria-labelledby="character-equipment-title">
      <div class="character-section-heading"><div><p class="eyebrow">Carried into every encounter</p><h2 id="character-equipment-title">Equipped gear</h2></div><span class="character-section-note">Manage gear in your bag</span></div>
      <div class="character-equipment-grid">${EQUIPMENT_SLOTS.map(([slot, label, iconName]) => equipmentCard(safeMember, slot, label, iconName)).join('')}</div>
    </section>
    <section class="panel character-skills" aria-labelledby="character-skills-title">
      <div class="character-section-heading"><div><p class="eyebrow">Beacon discipline</p><h2 id="character-skills-title">Skill roadmap</h2></div><strong>${knownCount} / ${Object.keys(SKILL_UNLOCKS).length} known</strong></div>
      <p class="character-skills__intro">Known techniques are ready in combat. Future entries reveal their cost and purpose without unlocking them early.</p>
      <ol class="character-skill-list">${Object.entries(SKILL_UNLOCKS).sort((a, b) => a[1] - b[1]).map(([id]) => skillCard(id, progress.level)).join('')}</ol>
    </section>
    <footer class="character-footer">${uiButton({ action: 'leave', label: backLabel, iconName: returnScene === 'explore' ? 'map' : 'beacon', variant: 'primary' })}</footer>
  </main>`;
}
