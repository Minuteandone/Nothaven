// Companion combat banter lines.  Each key is a combat event; each role
// provides one line.  A companion must be conscious to speak.
// These are flavour-only — they never change state or reveal hidden info.

const LINES = Object.freeze({
  // When the hero takes a single hit >= 30% of max HP
  bigHit: Object.freeze({
    scout:   'Tamsin hisses through her teeth: “Shake it off — keep your feet!”',
    keeper:  'Iven flinches: “That blow would have felled a lesser warden.”',
    guardian:'Bram grits his teeth: “I should have been in front of that.”',
    signaler:'Sela calls sharply: “Stay steady — I’ve got the next flare ready!”',
  }),
  // When the hero drops below 25% HP (triggers once per combat)
  lowHealth: Object.freeze({
    scout:   'Tamsin’s voice tightens: “You’re bleeding bad. I can see it from here.”',
    keeper:  'Iven’s hands tremble: “Hold on — I still have bandages and prayer.”',
    guardian:'Bram shouts: “Not on my watch! Someone get a poultice!”',
    signaler:'Sela’s flare-pouch rattles: “The light hasn’t gone out yet. Stay with us.”',
  }),
  // When a companion is knocked out
  allyDown: Object.freeze({
    scout:   'Tamsin’s jaw sets: “You’ll pay for that.”',
    keeper:  'Iven murmurs: “I will carry them out myself if I must.”',
    guardian:'Bram’s roar echoes: “Nobody else falls today!”',
    signaler:'Sela’s eyes flash: “I’m marking that one for the beacon.”',
  }),
  // When the enemy enrages (second phase)
  enemyEnrage: Object.freeze({
    scout:   'Tamsin readies another arrow: “It’s desperate now — that makes it dangerous.”',
    keeper:  'Iven scribbles a note mid-combat: “Enrage threshold confirmed. Fascinating.”',
    guardian:'Bram plants his feet: “Good. I was starting to get bored.”',
    signaler:'Sela lights a fresh flare: “Desperate things make mistakes. Watch for the opening.”',
  }),
  // Victory — the enemy is defeated
  victory: Object.freeze({
    scout:   'Tamsin lowers her bow: “Another one for the journal.”',
    keeper:  'Iven closes his notebook: “I’ll have the entry written before we get back.”',
    guardian:'Bram dusts off his shield: “That’s the way we do it in Saltmere.”',
    signaler:'Sela snuffs her flare: “Clear skies ahead. The road is ours.”',
  }),
  // Flee success
  fleeSuccess: Object.freeze({
    scout:   'Tamsin glances back: “I know when to cut and run. Good call.”',
    keeper:  'Iven stumbles: “Discretion is the better part of scholarship.”',
    guardian:'Bram grumbles: “I don’t like running. But I like dying less.”',
    signaler:'Sela catches her breath: “Live to signal another day, that’s what I say.”',
  }),
  // Flee failure
  fleeFail: Object.freeze({
    scout:   'Tamsin curses: “No gap — it’s got every route covered!”',
    keeper:  'Iven’s voice shakes: “It’s faster than the survey notes said.”',
    guardian:'Bram raises his shield: “Then we stand! No more running.”',
    signaler:'Sela grits her teeth: “Blocked. Somebody better have a plan B.”',
  }),
  // Enemy uses a windup (telegraphed heavy blow)
  windupWarning: Object.freeze({
    scout:   'Tamsin shouts: “It’s gathering something — brace!”',
    keeper:  'Iven squints: “That buildup pattern… defend or ward, quickly!”',
    guardian:'Bram raises his shield higher: “Heavy blow coming! Get behind me!”',
    signaler:'Sela points: “Telegraphed strike! You’ve got one turn to answer it!”',
  }),
  // Hero is shocked (can't use skills)
  heroShocked: Object.freeze({
    scout:   'Tamsin winces: “Lightning’s got you — just swing, don’t try to cast!”',
    keeper:  'Iven calls: “The shock will pass. Your blade still works!”',
    guardian:'Bram growls: “Shake it off! A little spark never stopped a warden.”',
    signaler:'Sela grips her flare-pouch: “I know that feeling. Breathe through it.”',
  }),
  // Hero is bleeding
  heroBleeding: Object.freeze({
    scout:   'Tamsin sees the blood trail: “You’re leaking. Finish this quick.”',
    keeper:  'Iven frets: “Two HP a round will add up. Don’t drag this out.”',
    guardian:'Bram points at the wound: “Bind that when you can. I’ll hold the line.”',
    signaler:'Sela’s voice softens: “Bleeding’s slow but mean. Stay on your feet.”',
  }),
  // Companion delivers killing blow (rare, fun moment)
  companionKill: Object.freeze({
    scout:   'Tamsin blows smoke from her arrow-tip: “Told you I’d get there first.”',
    keeper:  'Iven looks almost apologetic: “I was only trying to help.”',
    guardian:'Bram thumps his chest: “THAT one was mine!”',
    signaler:'Sela grins: “Flare beats fang, every time.”',
  }),
});

// Track which banter events have fired this combat to avoid spam.
// We store fired event keys per combat, so lowHealth only fires once, etc.

/** @param {object} c combat object */
export function banterFired(c, key) {
  if (!c._banterFired) c._banterFired = new Set();
  if (c._banterFired.has(key)) return true;
  c._banterFired.add(key);
  return false;
}

/** Pick a conscious companion that is NOT the subject (e.g. when an ally falls,
 *  we want a different companion to speak). Returns null if none available. */
function pickSpeaker(party, excludeId) {
  const candidates = (party || []).filter(
    (m) => m && m.hp > 0 && m.role && m.id !== excludeId
  );
  if (!candidates.length) return null;
  // Prefer the first conscious companion in party order for consistency
  return candidates[0];
}

/** Get the banter line for a given event key and a speaker member. */
function lineFor(member, eventKey) {
  if (!member || !member.role) return null;
  const roleLines = LINES[eventKey];
  if (!roleLines) return null;
  return roleLines[member.role] || null;
}

/**
 * Build a banter line for the given event, injecting it into the combat log
 * at the right moment.  Returns the log line or null if this event shouldn't fire.
 *
 * @param {object} c combat object
 * @param {string} event - one of the LINES keys
 * @param {object} [opts]
 * @param {object[]} [opts.party] - array of party members including hero
 * @param {object} [opts.hero] - hero member (skipped as speaker for ally-down)
 * @param {string} [opts.excludeId] - don't pick this member as speaker
 * @param {string} [opts.forceRole] - pick this role specifically
 * @returns {string|null} banter line with '::banter::' prefix, or null
 */
export function combatBanter(c, event, opts = {}) {
  const { party = [], hero, excludeId, forceRole } = opts;

  // One-shot events (only fire once per combat)
  const oneShot = new Set([
    'lowHealth', 'enemyEnrage', 'victory', 'fleeSuccess', 'fleeFail',
  ]);
  if (oneShot.has(event) && banterFired(c, event)) return null;

  let speaker = null;

  if (forceRole) {
    speaker = (party || []).find(
      (m) => m && m.hp > 0 && m.role === forceRole && m.id !== excludeId
    );
  } else {
    speaker = pickSpeaker(party, excludeId || (hero ? hero.id : undefined));
  }

  if (!speaker) {
    // Fallback: try any conscious companion
    speaker = (party || []).find(
      (m) => m && m.hp > 0 && m.role && m.id !== (hero ? hero.id : undefined)
    );
  }

  const line = lineFor(speaker, event);
  if (!line) return null;

  return `::banter::${line}`;
}

/**
 * Check if a "big hit" banter should fire after an enemy attack.
 * @param {number} damage - damage dealt to hero
 * @param {object} hero - hero member with hp and calculated maxHp
 * @param {number} maxHp - pre-calculated max HP of hero
 * @returns {boolean}
 */
export function isBigHit(damage, hero, maxHp) {
  if (!hero || !maxHp || maxHp <= 0) return false;
  return damage > 0 && hero.hp > 0 && damage >= maxHp * 0.3;
}

/**
 * Check if hero is at low health (below 25% max).
 */
export function isLowHealth(hero, maxHp) {
  if (!hero || !maxHp || maxHp <= 0) return false;
  return hero.hp > 0 && hero.hp < maxHp * 0.25;
}

/** Companion who delivered the killing blow (if any). */
export function companionKillCheck(c, lastActionLines) {
  // If the last companion action killed the enemy, we check for that
  if (!c || !c.enemy || c.enemy.hp > 0) return null;
  // Look through recent lines to see if a companion killed
  if (!Array.isArray(lastActionLines)) return null;
  const companionNames = ['Tamsin', 'Iven', 'Bram', 'Sela'];
  for (const line of lastActionLines) {
    for (const name of companionNames) {
      if (line.includes(`${name} `) && (
        line.includes('strikes for') || line.includes('casts Spark') ||
        line.includes('lands a') || line.includes('hurls a') ||
        line.includes('looses')
      )) {
        return name;
      }
    }
  }
  return null;
}

export { LINES };
