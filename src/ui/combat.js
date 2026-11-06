import { companionTactic } from '../party/tactics.js';
import { isCompanionId } from '../party/companions.js';
import { BEACON_CHARGE_MAX, chargeReady, battleSummary, enemyWindingUp, fleeChance } from '../combat/rules.js';
import { heroStats, knownSkills, lockedSkills } from '../combat/rules.js';
import { elementLabel, elementClass, elementEffectivenessText, elementMatchups, elementMultiplier } from '../combat/elements.js';
import { damagePreview, incomingDamagePreview } from '../combat/damagePreview.js';

import { getItem, TYPES } from '../items/items.js';
import { useConsumable } from '../items/consumables.js';
import { escapeHTML, icon, meter, sceneHeader, uiButton } from './components.js';

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeClass(value) {
  return String(value || '').replace(/[^a-z0-9_-]/gi, '');
}

/** Small colored badge showing an element and optional effectiveness suffix. */
function elementChip(element, suffix = '') {
  if (!element) return '';
  return `<span class="element-chip ${elementClass(element)}">${escapeHTML(elementLabel(element))}${suffix ? ` <em>${escapeHTML(suffix)}</em>` : ''}</span>`;
}

/** Human-readable summary of an enemy ability for the combat tooltip. */
export function abilityDetail(ability) {
  if (!ability || typeof ability !== 'object' || !ability.name) return '';
  const parts = [];
  const chance = Number(ability.chance);
  if (Number.isFinite(chance) && chance > 0) parts.push(`${Math.round(chance * 100)}% ability roll`);
  const mult = Number(ability.mult);
  if (Number.isFinite(mult) && mult > 1) parts.push(`${mult}× ATK`);
  if (typeof ability.status === 'string' && ability.status) {
    let text = `Inflicts ${ability.status}`;
    const turns = Number(ability.turns);
    if (Number.isFinite(turns) && turns > 0) text += ` for ${turns} ${turns === 1 ? 'turn' : 'turns'}`;
    parts.push(text);
  }
  return parts.join(' · ');
}


/** Renders a log line, replacing ::elem:X:: markers with element chips. */
function renderLogLine(line) {
  return escapeHTML(line).replace(/::elem:(fire|ice|lightning|water|earth)::/g, (_m, el) => `${elementChip(el)} `);
}

/** Readable names and short hints for combat statuses, shown on unit cards. */
export const STATUS_INFO = {
  bleeding: { label: 'Bleeding', hint: 'Loses 2 HP each turn. Rallying Light, Steady Signal or Stormhaven Vigil stops it.' },
  shocked: { label: 'Shocked', hint: 'Blocks most magic, healing and wards; physical and piercing skills, Stillpoint Strike, cleansing, items and basic commands remain available. Steady Signal or Stormhaven Vigil clears it.' },
  stunned: { label: 'Stunned', hint: 'Loses its next turn.' },
};

function statusInfo(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(STATUS_INFO, id) ? STATUS_INFO[id] : null;
}

export function statusLabel(id) {
  const info = statusInfo(id);
  return info ? info.label : String(id || 'Unknown');
}

function statusChips(unit) {
  const statuses = Array.isArray(unit?.statuses) ? unit.statuses : [];
  if (!statuses.length) return '<span data-status="clear" class="status">Clear</span>';
  return statuses.map((status) => {
    const id = typeof status === 'object' && status ? status.id || status.name : status;
    const turns = typeof status === 'object' && status ? number(status.turns) : 0;
    const hint = statusInfo(id)?.hint;
    return `<span data-status="${safeClass(id)}" class="status"${hint ? ` title="${escapeHTML(hint)}"` : ''}>${escapeHTML(statusLabel(id))}${turns > 0 ? ` · ${turns}` : ''}</span>`;
  }).join('');
}

function statList(stats) {
  return `<dl class="unit-stats" aria-label="Combat attributes">
    <div><dt>ATK</dt><dd>${number(stats?.atk)}</dd></div>
    <div><dt>DEF</dt><dd>${number(stats?.def)}</dd></div>
    <div><dt>SPD</dt><dd>${number(stats?.spd)}</dd></div>
  </dl>`;
}

function unitCard(member, { enemy = false, leader = false, enraged = false } = {}) {
  const stats = enemy ? member : heroStats(member);
  const down = !enemy && number(member?.hp) <= 0;
  const boss = enemy && member?.boss;
  const kind = enemy ? 'enemy' : leader ? 'hero' : 'ally';
  const role = enemy ? (boss ? 'Boss' : 'Enemy') : leader ? 'Leader' : 'Ally';
  const name = member?.name || (enemy ? 'Unknown enemy' : 'Unknown traveller');
  const enrageMarker = enemy && member?.enrage ? Math.round(number(member.enrage.threshold) * 100) : 0;
  const threshold = typeof member?.enrage?.threshold === 'number' ? member.enrage.threshold : 0.5;
  const enrageMax = member?.maxHp || member?.hp;
  const enrageDescription = enemy && member?.enrage && Number.isFinite(enrageMax) && enrageMax > 0
    && Number.isFinite(threshold) && threshold > 0 && threshold < 1
    ? `Enrage threshold: ${Math.floor(enrageMax * threshold)} HP or lower.` : '';

  return `<article class="unit ${kind}${down ? ' down' : ''}${boss ? ' boss' : ''}" aria-label="${escapeHTML(`${name}, ${role}`)}">
    <div class="unit-card__heading">
      <span class="unit-card__portrait" aria-hidden="true">${icon(enemy ? 'sword' : leader ? 'shield' : 'heart')}</span>
      <div class="unit-card__identity"><span class="unit-card__role">${role}</span><h3>${escapeHTML(name)}</h3>${enemy && member?.element ? elementChip(member.element) : ''}</div>
      ${enraged ? '<em class="enraged">(enraged)</em>' : ''}${enemy ? '' : `<span class="level-badge">Lv ${Math.max(1, number(member?.level, 1))}</span>`}
    </div>
    <div class="unit-card__statuses" aria-label="Status effects">${statusChips(member)}${down ? ' <em>Down</em>' : ''}</div>
    ${meter({ label: 'HP', value: member?.hp, max: enemy ? member?.maxHp || member?.hp : stats.maxHp, tone: 'hp', marker: enrageMarker, descriptionId: enrageDescription ? 'enemy-enrage-threshold' : null })}
    ${enrageDescription ? `<p id="enemy-enrage-threshold" class="enemy-ability-detail">${escapeHTML(enrageDescription)}</p>` : ''}
    ${enemy ? '' : meter({ label: 'MP', value: member?.mp, max: stats.maxMp, tone: 'mp' })}
    ${statList(stats)}
    ${enemy && member?.element ? enemyMatchupHint(member.element) : ''}
    ${enemy && member?.ability ? `<p class="enemy-ability">${icon('focus')}<span>Signature move<strong>${escapeHTML(member.ability.name)}</strong></span></p>${abilityDetail(member.ability) ? `<p class="enemy-ability-detail">${escapeHTML(abilityDetail(member.ability))}</p>` : ''}` : ''}
    ${enemy && Array.isArray(member?.tags) && member.tags.length ? `<div class="enemy-tags">${member.tags.map(tag => `<span>${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
  </article>`;
}

function enemyMatchupHint(element) {
  const mu = elementMatchups(element);
  const parts = [];
  if (mu.strong.length) parts.push(`Weak to ${mu.strong.map(el => escapeHTML(elementLabel(el))).join(', ')}`);
  if (mu.resist.length) parts.push(`Resists ${mu.resist.map(el => escapeHTML(elementLabel(el))).join(', ')}`);
  return parts.length ? `<p class="enemy-matchup-hint">${parts.join(' · ')}</p>` : '';
}

function keyHint(key) {
  return key ? `<kbd class="key-hint" aria-hidden="true">${escapeHTML(key)}</kbd>` : '';
}

function commandButton({ shortcut = null, badge = '', ...options }) {
  let html = uiButton(options);
  if (badge) html = html.replace('</button>', `${badge}</button>`);
  return shortcut ? html.replace('</button>', `${keyHint(shortcut)}</button>`) : html;
}

function shortcutGuide() {
  const bindings = [
    ['A', 'Attack'], ['S', 'Skills'], ['I', 'Items'], ['T', 'Tactics'], ['D', 'Defend'],
    ['F', 'Flee'], ['B', 'Beacon Burst'], ['1–9', 'Choose a listed skill or item'],
    ['Esc', 'Back to commands'], ['C', 'Continue after battle'],
  ];
  return `<details class="shortcut-guide"><summary>Keyboard commands</summary><dl class="shortcut-guide__grid">${bindings.map(([key, label]) => `<div><dt><kbd>${key}</kbd></dt><dd>${label}</dd></div>`).join('')}</dl><p class="character-shortcuts-off">Letter and number shortcuts are off. Use buttons; Escape still returns to commands.</p><p>Turn letter and number shortcuts on or off in Display settings. Shortcuts never activate disabled commands. Text fields and modified key presses are ignored.</p></details>`;
}

/** Immediate item effect only; allies, enemy replies and status ticks are excluded. */
export function itemRestorationPreview(recipient, inventory, itemId) {
  if (!recipient || !(recipient.hp > 0) || !Array.isArray(inventory)) return '';
  const result = useConsumable(recipient, inventory, itemId);
  if (!result.ok) return '';
  const parts = [];
  if (result.effects.hp) parts.push(`+${result.actor.hp - (recipient.hp ?? 0)} HP`);
  if (result.effects.mp) parts.push(`+${result.actor.mp - (recipient.mp ?? 0)} MP`);
  const cure = result.effects.cure;
  if (cure && Array.isArray(recipient.statuses) && recipient.statuses.includes(cure)
      && !result.actor.statuses.includes(cure)) parts.push(`Clears ${cure}`);
  return parts.length ? `On ${recipient.name || 'Wren'} now: ${parts.join(' · ')}.` : '';
}

function commandCard({ action, arg, name, meta, description, preview = '', iconName = 'focus', disabled = false, shortcut = null, badge = '', damageRange = '', className = '' }) {
  const extraClass = className ? ` ${escapeHTML(className)}` : '';
  return `<button type="button" class="command-card${extraClass}" data-action="${escapeHTML(action)}" data-arg="${escapeHTML(arg)}" title="${escapeHTML(description)}"${disabled ? ' disabled' : ''}>
    <span class="command-card__top"><span>${icon(iconName)}${escapeHTML(name)}</span><span class="command-card__meta"><strong>${escapeHTML(meta)}</strong>${keyHint(shortcut)}</span></span>
    ${badge}${damageRange ? `<span class="damage-range">${escapeHTML(damageRange)}</span>` : ''}
    <span class="command-card__description">${escapeHTML(description)}</span>
    ${preview ? `<span class="command-card__description item-use-preview">${escapeHTML(preview)}</span>` : ''}
  </button>`;
}

function lockedSkillsHtml(hero, combat) {
  const locked = lockedSkills(hero);
  if (!locked.length) return '';
  const items = locked.map(skill => {
    const effSuffix = skill.element ? (elementEffectivenessText(skill.element, combat?.enemy?.element) === 'strong' ? 'strong' : elementEffectivenessText(skill.element, combat?.enemy?.element) === 'weak' ? 'weak' : '') : '';
    return commandCard({
      action: '', arg: '', name: skill.name,
      meta: `Lv ${skill.unlockLevel}`,
      description: skill.description,
      iconName: 'focus',
      disabled: true,
      badge: skill.element ? elementChip(skill.element, effSuffix) : '',
      damageRange: '',
      shortcut: null,
      className: 'command-card--locked',
    });
  }).join('');
  return `<details class="locked-skills"><summary>Upcoming skills (${locked.length})</summary>${items}</details>`;
}

function commands({ combat, hero, party, inventory, menu, itemTargetIndex }) {
  if (combat.over) {
    return `<div class="actions command-grid"><div class="combat-outcome" role="status">${icon(combat.over === 'victory' ? 'beacon' : combat.over === 'defeat' ? 'heart' : 'compass')}<div><strong>${combat.over === 'victory' ? 'Victory' : combat.over === 'defeat' ? 'Party defeated' : 'Escaped'}</strong><p>${combat.over === 'victory' ? 'Rewards have been gathered. The road ahead is clear.' : combat.over === 'defeat' ? 'Warden Mara’s patrol will carry you back to Greyhaven.' : 'You withdrew from the encounter.'}</p>${combat.over === 'victory' ? summaryLine(combat) + rewardsLine(combat) : ''}</div></div>${commandButton({ action: 'finish', label: 'Continue', iconName: 'compass', variant: 'primary', className: 'command-continue', shortcut: 'C' })}</div>${shortcutGuide()}`;
  }
  if (menu === 'skills') {
    const skills = knownSkills(hero).map((skill, index) => {
      const effectiveness = elementEffectivenessText(skill.element, combat.enemy?.element);
      const effSuffix = effectiveness === 'strong' ? 'strong' : effectiveness === 'weak' ? 'weak' : '';
      const preview = damagePreview(skill, hero, combat.enemy);
      const dmgRange = preview ? `${preview.min}–${preview.max}` : '';
      return commandCard({
        action: 'skill', arg: skill.id, name: skill.name, meta: `${skill.mp} MP`,
        description: skill.description, iconName: skill.kind === 'heal' || skill.kind === 'party_heal' || skill.kind === 'revive' || skill.kind === 'vigil' ? 'heart' : (skill.kind === 'ward' || skill.kind === 'party_ward') ? 'shield' : 'focus',
        disabled: hero.mp < skill.mp, shortcut: index < 9 ? String(index + 1) : null,
        badge: skill.element ? elementChip(skill.element, effSuffix) : '',
        damageRange: dmgRange,
      });
    }).join('');
    return `<div class="actions command-list" role="group" aria-label="Skill actions">${skills || '<p class="empty-state">No skills learned yet.</p>'}${lockedSkillsHtml(hero, combat)}${commandButton({ action: 'menu', arg: 'main', label: 'Back to commands', iconName: 'compass', variant: 'ghost', shortcut: 'Esc' })}</div>${shortcutGuide()}`;
  }
  if (menu === 'tactics') {
    const allies = party.slice(1).filter(member => member && isCompanionId(member.id));
    const rows = allies.map(member => `<div class="companion-tactic" role="group" aria-label="${escapeHTML(member.name)} tactics">
      <h3>${escapeHTML(member.name)}${member.hp > 0 ? '' : ' · Down'}</h3>
      <div class="companion-tactic__buttons">${[['auto', 'Automatic'], ['conserve', 'Conserve MP']].map(([value, label]) => `<button type="button" data-action="setTactic" data-arg="${escapeHTML(member.id)}:${value}" aria-pressed="${companionTactic(member) === value}"${member.hp > 0 ? '' : ' disabled'}>${label}</button>`).join('')}</div>
    </div>`).join('');
    return `<div class="actions command-list" role="group" aria-label="Companion tactics"><p class="tactics-note">Automatic uses each companion’s usual techniques. Conserve MP replaces Mend, Spark and Signal Flare with ordinary attacks; free techniques remain available. Changes cost no turn and are kept when you save.</p>${rows || '<p>No companions are in the party.</p>'}${commandButton({ action: 'menu', arg: 'main', label: 'Back to commands', iconName: 'compass', variant: 'ghost', shortcut: 'Esc' })}</div>${shortcutGuide()}`;
  }
  if (menu === 'items') {
    const recipient = Number.isInteger(itemTargetIndex) ? party[itemTargetIndex] : null;
    const validRecipient = Boolean(recipient && recipient.hp > 0);
    const recipients = `<div class="item-recipients" role="group" aria-label="Item recipient">${party.map((member, index) => {
      const stats = heroStats(member), down = !(member.hp > 0);
      return `<button type="button" data-action="itemTarget" data-arg="${index}" aria-pressed="${index === itemTargetIndex && !down}"${down ? ' disabled' : ''}><strong>${escapeHTML(member.name)}</strong><span>HP ${number(member.hp)}/${number(stats.maxHp)} · MP ${number(member.mp)}/${number(stats.maxMp)}${down ? ' · Down' : ''}</span></button>`;
    }).join('')}</div><p class="item-recipient-note" role="status">${validRecipient ? `Using items on ${escapeHTML(recipient.name)}. Choosing a recipient does not spend a turn.` : 'Choose a living party member to use an item.'}</p><p class="item-recipient-note">Items cannot revive downed allies. Rekindle can revive them once learned.</p><p class="item-recipient-note">Preview shows immediate restoration before allies act and the normal enemy reply, not end-of-turn totals.</p>`;
    const usable = (inventory || []).filter((stack) => {
      try { return getItem(stack.id).type === TYPES.CONSUMABLE; } catch { return false; }
    });
    const items = usable.map((stack, index) => {
      const item = getItem(stack.id);
      return commandCard({ action: 'item', arg: stack.id, name: item.name, meta: `×${stack.qty}`, description: item.description || 'Use this consumable item.', preview: itemRestorationPreview(recipient, inventory, stack.id), iconName: 'bag', disabled: !validRecipient, shortcut: index < 9 ? String(index + 1) : null });
    }).join('');
    return `<div class="actions command-list" role="group" aria-label="Item actions">${recipients}${items || '<p class="empty-state">No usable items. Visit Hesta or search caches to stock your pack.</p>'}${commandButton({ action: 'menu', arg: 'main', label: 'Back to commands', iconName: 'compass', variant: 'ghost', shortcut: 'Esc' })}</div>${shortcutGuide()}`;
  }
  const usableCount = (inventory || []).filter((stack) => {
    try { return getItem(stack.id).type === TYPES.CONSUMABLE; } catch { return false; }
  }).length;
  const attackPreview = damagePreview(null, hero, combat.enemy);
  const attackBadge = attackPreview ? `<span class="damage-preview-badge">${escapeHTML(String(attackPreview.min))}–${escapeHTML(String(attackPreview.max))}</span>` : '';
  const fleePct = fleeChance(combat, hero);
  return `${chargeMeter(combat)}<div class="actions command-grid" role="group" aria-label="Combat actions">
    ${commandButton({ action: 'burst', label: chargeReady(combat) ? 'Beacon Burst — ready!' : 'Beacon Burst', iconName: 'beacon', variant: chargeReady(combat) ? 'primary' : 'secondary', disabled: !chargeReady(combat), className: 'command-button command-button--burst', shortcut: 'B' })}
    ${commandButton({ action: 'attack', label: 'Attack', iconName: 'sword', variant: 'primary', className: 'command-button', shortcut: 'A', badge: attackBadge })}
    ${commandButton({ action: 'menu', arg: 'skills', label: `Skills · ${knownSkills(hero).length}`, iconName: 'focus', className: 'command-button', shortcut: 'S' })}
    ${commandButton({ action: 'menu', arg: 'items', label: `Items · ${usableCount}`, iconName: 'bag', className: 'command-button', shortcut: 'I' })}
    ${commandButton({ action: 'menu', arg: 'tactics', label: 'Tactics', iconName: 'focus', className: 'command-button', disabled: !party.slice(1).some(member => member && isCompanionId(member.id) && member.hp > 0), shortcut: 'T' })}
    ${commandButton({ action: 'defend', label: 'Defend', iconName: 'shield', className: 'command-button', shortcut: 'D' })}
    ${commandButton({ action: 'flee', label: 'Flee', iconName: 'compass', variant: 'danger', disabled: Boolean(combat.enemy.boss), className: 'command-button command-button--flee', shortcut: 'F', title: combat.enemy.boss ? 'Boss encounters cannot be fled.' : (fleePct != null ? `Escape odds: ${Math.round(fleePct*100)}%. Your SPD against the foe's SPD.` : ''), badge: fleePct != null ? `<span class="flee-chance-badge">${Math.round(fleePct*100)}%</span>` : '' })}
    <p class="command-hint">${combat.enemy.boss ? 'Boss encounters must be fought to resolution.' : 'Attack or use a skill to press the advantage. Defend halves incoming damage.'}</p>
  </div>${shortcutGuide()}`;
}

/** Beacon Charge gauge shown above the main commands. */
export function chargeMeter(combat) {
  const value = Math.min(BEACON_CHARGE_MAX, Math.max(0, number(combat?.charge, 0)));
  return `<div class="beacon-charge${value >= BEACON_CHARGE_MAX ? ' beacon-charge--ready' : ''}">${meter({ label: 'Beacon Charge', value, max: BEACON_CHARGE_MAX, tone: 'xp' })}</div>`;
}

const DIFFICULTY_NOTES = { story: 'Story mode', veteran: 'Veteran mode', stormborn: 'Stormborn mode' };
/** Shows the active preset only when it differs from Standard. */
export function difficultyNote(combat) {
  const id = combat?.difficulty;
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_NOTES, id) ? ` · ${DIFFICULTY_NOTES[id]}` : '';
}

/** Small banner summarising elemental matchups between the hero's known skills and the enemy. */
export function elementalMatchupBanner(hero, enemy) {
  if (!hero || !enemy || !enemy.element) return '';
  const skills = knownSkills(hero);
  if (!skills.length) return '';
  const heroElements = [...new Set(skills.map(s => s.element).filter(Boolean))];
  if (!heroElements.length) return '';

  const defEl = enemy.element;
  const strong = [];
  const weak = [];
  const neutral = [];

  for (const atkEl of heroElements) {
    const mult = elementMultiplier(atkEl, defEl);
    const label = elementLabel(atkEl);
    if (mult > 1) strong.push(label);
    else if (mult < 1) weak.push(label);
    else neutral.push(label);
  }

  const defLabel = elementLabel(defEl);
  const parts = [];
  if (strong.length) parts.push('<span class="matchup-strong">' + escapeHTML(strong.join(', ')) + ' skills strong vs ' + escapeHTML(defLabel) + ' (' + escapeHTML('1.5×') + ')</span>');
  if (weak.length) parts.push('<span class="matchup-weak">' + escapeHTML(weak.join(', ')) + ' skills weak vs ' + escapeHTML(defLabel) + ' (' + escapeHTML('0.75×') + ')</span>');
  if (neutral.length) parts.push('<span class="matchup-neutral">' + escapeHTML(neutral.join(', ')) + ' skills neutral vs ' + escapeHTML(defLabel) + '</span>');

  if (!parts.length) return '';
  return '<div class="elemental-matchup-banner">' + parts.join(' · ') + '</div>';
}

export function renderCombat({ combat, party, inventory = [], menu = 'main', itemTargetIndex = 0 }) {
  const hero = party[0];
  const round = Math.max(1, number(combat.turn, 1));
  const phase = combat.over ? 'Resolved' : menu === 'skills' ? 'Choose a skill' : menu === 'items' ? 'Choose an item' : menu === 'tactics' ? 'Set companion tactics' : 'Your command';
  const commandTitle = combat.over ? 'Encounter resolved' : menu === 'skills' ? 'Skills & techniques' : menu === 'items' ? 'Field supplies' : menu === 'tactics' ? 'Companion tactics' : 'Choose your action';
  const chronicleLines = Array.isArray(combat.log) ? combat.log : [];
  const logLines = chronicleLines.slice(-8);
  return `<div class="game-shell combat-screen" data-combat-state="${safeClass(combat.over || 'active')}">
    <div class="combat-heading-row">
      ${sceneHeader({ eyebrow: 'Turn-based encounter', title: `Battle — Round ${round}`, subtitle: `${combat.enemy.name} · ${combat.enemy.boss ? 'Boss encounter' : 'Hostile encounter'}${difficultyNote(combat)}`, iconName: 'sword' })}
      <div class="turn-indicator"><span class="status-dot"></span><span>${phase}</span><strong>Round ${round}</strong></div>
    </div>
    ${elementalMatchupBanner(hero, combat.enemy)}
    <section class="panel combat combat-arena" aria-label="Combatants">
      <div class="combatants">
        <section class="combat-side combat-side--party" aria-labelledby="combat-party-title">
          <div class="combat-side__heading"><h2 id="combat-party-title">Your party</h2><span>${party.length} ${party.length === 1 ? 'fighter' : 'fighters'}</span></div>
          <div class="party-units">${party.map((member, index) => unitCard(member, { leader: index === 0 })).join('')}</div>
        </section>
        <section class="combat-side combat-side--enemy" aria-labelledby="combat-enemy-title">
          <div class="combat-side__heading"><h2 id="combat-enemy-title">Opposition</h2><span>${combat.enemy.boss ? 'Boss' : 'Hostile'}</span></div>
          ${unitCard(combat.enemy, { enemy: true, enraged: Boolean(combat.enraged) })}
          ${windupCue(combat)}
          ${incomingDamageHint(combat, hero)}
        </section>
      </div>
    </section>
    <div class="combat-dashboard">
      <section class="panel command-panel" aria-labelledby="command-title">
        <p class="eyebrow">Command phase</p><h2 id="command-title">${commandTitle}</h2>
        ${commands({ combat, hero, party, inventory, menu, itemTargetIndex })}
      </section>
      <section class="panel combat-log-panel" aria-labelledby="combat-log-title">
        <div class="combat-side__heading"><h2 id="combat-log-title">Battle log</h2><span>Latest 8 events</span></div>
        <div class="log combat-log" role="log" aria-live="polite" aria-relevant="additions text">
          ${logLines.length ? logLines.map(line => `<p>${renderLogLine(line)}</p>`).join('') : '<p>The opponent watches your next move.</p>'}
        </div>
        ${chronicleLines.length ? `<details class="battle-chronicle"><summary><span>Full battle chronicle</span><span>${chronicleLines.length} retained ${chronicleLines.length === 1 ? 'event' : 'events'}</span></summary><p>The live log above stays concise. Review every retained event here, from oldest to newest.</p><ol class="battle-chronicle__list" aria-label="Full retained battle events">${chronicleLines.map(line => `<li>${renderLogLine(line)}</li>`).join('')}</ol></details>` : ''}
      </section>
    </div>
  </div>`;
}

/** Warning shown while a boss gathers a telegraphed blow for next turn. */
export function windupCue(combat) {
  if (!enemyWindingUp(combat)) return '';
  const name = combat.windup?.name || combat.enemy?.windup?.name || 'a heavy blow';
  return `<p class="windup-cue" role="status"><strong>Gathering ${escapeHTML(name)}</strong> · Next turn it lands on your leader. Defend or a ward halves it; a stun or Stillpoint Strike breaks it.</p>`;
}

/** Conditional incoming physical estimate using current stats and defenses. */
export function incomingDamageHint(combat, hero) {
  const preview = incomingDamagePreview(combat, hero);
  if (!preview) return '';
  const { min, max, warded, windupName } = preview;
  const range = min === max ? `${min}` : `${min}–${max}`;
  const target = hero?.name || 'Wren';
  const label = windupName ? `Unleashed ${windupName} vs ${target}` : `Basic hit vs ${target}`;
  const note = warded ? ' (halved)' : '';
  const caveat = 'Estimate using current defenses, not a next-turn prediction.' +
    (windupName ? '' : ' Abilities and other targets differ.');
  return `<p class="incoming-damage-hint"><span class="incoming-damage-label">${escapeHTML(label)}:</span> ${escapeHTML(range)}${escapeHTML(note)} · ${escapeHTML(caveat)}</p>`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Short post-battle recap shown under the Victory heading. */
export function summaryLine(combat) {
  const sm = battleSummary(combat);
  const parts = [plural(sm.rounds, 'round'), `${sm.dealt} damage dealt`, `${sm.taken} damage taken`];
  if (sm.bursts > 0) parts.push(plural(sm.bursts, 'Beacon Burst'));
  return `<p class="battle-summary">${parts.join(' · ')}</p>`;
}

/** Brief rewards summary shown on the victory outcome screen. */
export function rewardsLine(combat) {
  const r = combat?.rewards;
  if (!r) return '';
  const parts = [];
  if (Number.isFinite(r.xp) && r.xp > 0) parts.push(`+${r.xp} XP`);
  if (Number.isFinite(r.gold) && r.gold > 0) parts.push(`+${r.gold} gold`);
  if (Array.isArray(r.items) && r.items.length) {
    const names = r.items.map((s) => {
      try { return `${escapeHTML(String(s.qty))}× ${escapeHTML(getItem(s.id).name)}`; } catch { return escapeHTML(String(s.id)); }
    });
    parts.push(`Found: ${names.join(', ')}`);
  }
  return parts.length ? `<p class="battle-rewards">${parts.join(' · ')}</p>` : '';
}

