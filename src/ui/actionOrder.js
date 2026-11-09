import { heroStats } from '../combat/rules.js';
import { escapeHTML } from './components.js';

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function actorName(actor, fallback) {
  return typeof actor?.name === 'string' && actor.name.trim() ? actor.name : fallback;
}

function isDown(actor) {
  return number(actor?.hp, NaN) <= 0;
}

/**
 * Read-only description of the engine's action sequence. The enemy may already
 * have taken its single faster opening before the first command is rendered.
 */
export function combatActionOrder(combat, party) {
  if (!combat || typeof combat !== 'object' || combat.over || !combat.enemy || typeof combat.enemy !== 'object') return null;
  if (!Array.isArray(party) || !party[0] || typeof party[0] !== 'object') return null;
  const hero = party[0];
  const enemy = combat.enemy;
  const entries = [{
    kind: 'leader', name: actorName(hero, 'Wren'), state: 'Your command', down: isDown(hero),
  }];
  for (const member of party.slice(1)) {
    // These are the same skipped entries as afterHeroAction's companion loop.
    if (!member || typeof member !== 'object' || member === hero) continue;
    const down = isDown(member);
    entries.push({
      kind: 'ally', name: actorName(member, 'Companion'),
      state: down ? 'Down · skipped' : 'Automatic ally', down,
    });
  }
  const enemyDown = isDown(enemy);
  const enemyStunned = Array.isArray(enemy.statuses) && enemy.statuses.includes('stunned');
  entries.push({
    kind: 'enemy', name: actorName(enemy, 'Enemy'),
    state: enemyDown ? 'Defeated · skipped' : enemyStunned ? 'Stunned · reply skipped' : 'Enemy reply',
    down: enemyDown,
  });

  let opening = null;
  const heroSpeed = number(heroStats(hero)?.spd);
  const enemySpeed = number(enemy.spd);
  if (number(combat.turn, 1) === 1 && enemySpeed > heroSpeed) {
    opening = `Faster opening: ${actorName(enemy, 'Enemy')} takes one turn before your first command (SPD ${enemySpeed} versus ${actorName(hero, 'Wren')}’s ${heroSpeed}).`;
  }
  return { entries, opening };
}

/** Static tactical information; intentionally not a live region and has no actions. */
export function renderActionOrder(combat, party) {
  const model = combatActionOrder(combat, party);
  if (!model) return '';
  const items = model.entries.map((entry, index) => `<li class="action-order__actor action-order__actor--${entry.kind}${entry.down ? ' action-order__actor--down' : ''}">
    <span class="action-order__position" aria-hidden="true">${index + 1}</span>
    <span class="action-order__identity"><strong>${escapeHTML(entry.name)}</strong><span class="action-order__state">${escapeHTML(entry.state)}</span></span>
  </li>`).join('');
  return `<section class="panel action-order" aria-labelledby="action-order-title">
    <div class="combat-side__heading"><h2 id="action-order-title">Action order</h2><span>One round</span></div>
    <ol class="action-order__list">${items}</ol>
    <p class="action-order__note">Companions act in formation order after each turn-spending command; downed allies are skipped. If an action ends the battle, everyone later in the order is skipped.</p>
    ${model.opening ? `<p class="action-order__opening">${escapeHTML(model.opening)}</p>` : ''}
  </section>`;
}
