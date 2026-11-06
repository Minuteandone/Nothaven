// Elemental damage system — five-element pentagram
// Fire > Ice > Lightning > Water > Fire  (Earth is neutral)

export const ELEMENTS = Object.freeze({
  FIRE: 'fire',
  ICE: 'ice',
  LIGHTNING: 'lightning',
  WATER: 'water',
  EARTH: 'earth',
});

const STRONG_AGAINST = Object.freeze({
  fire: 'ice',
  ice: 'lightning',
  lightning: 'water',
  water: 'fire',
  earth: null,
});

const WEAK_TO = Object.freeze({
  fire: 'water',
  ice: 'fire',
  lightning: 'ice',
  water: 'lightning',
  earth: null,
});

/** Multiplier when attackerElement hits defenderElement */
export function elementMultiplier(attackerElement, defenderElement) {
  if (!attackerElement || !defenderElement) return 1.0;
  if (attackerElement === 'earth' || defenderElement === 'earth') return 1.0;
  if (STRONG_AGAINST[attackerElement] === defenderElement) return 1.5;
  if (WEAK_TO[attackerElement] === defenderElement) return 0.75;
  return 1.0;
}

/** Short label for displaying element in UI */
export function elementLabel(element) {
  switch (element) {
    case 'fire': return 'Fire';
    case 'ice': return 'Ice';
    case 'lightning': return 'Lightning';
    case 'water': return 'Water';
    case 'earth': return 'Earth';
    default: return '';
  }
}

/** CSS class suffix for element styling */
export function elementClass(element) {
  if (!element) return '';
  const key = element.toUpperCase();
  return ELEMENTS[key] ? `element--${ELEMENTS[key]}` : '';
}

/** Effectiveness text: 'strong', 'weak', 'neutral', or empty if no elements */
export function elementEffectivenessText(attackerElement, defenderElement) {
  const mult = elementMultiplier(attackerElement, defenderElement);
  if (mult === 1.5) return 'strong';
  if (mult === 0.75) return 'weak';
  if (attackerElement && defenderElement && mult === 1.0 && attackerElement !== 'earth' && defenderElement !== 'earth') return 'neutral';
  return '';
}
/** Returns which attack elements are strong/resist against a defending element.
 *  For Earth or missing elements, returns empty arrays. */
export function elementMatchups(defenderElement) {
  if (!defenderElement || defenderElement === 'earth') return { strong: [], resist: [] };
  const strong = [];
  const resist = [];
  for (const atkEl of Object.values(ELEMENTS)) {
    if (atkEl === 'earth') continue;
    const mult = elementMultiplier(atkEl, defenderElement);
    if (mult === 1.5) strong.push(atkEl);
    else if (mult === 0.75) resist.push(atkEl);
  }
  return { strong, resist };
}

