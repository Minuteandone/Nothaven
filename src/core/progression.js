// Character progression: XP thresholds and stat growth. Pure functions + a bus installer.
export const MAX_LEVEL = 20;
export const xpForLevel = level => Math.floor(10 * (level - 1) * level * 0.75); // L2=15, L3=45, L4=90...

export const GROWTH = { maxHp: 6, maxMp: 3, atk: 2, def: 1, spd: 1 };

/** Apply any pending level-ups to a member. Mutates and returns an array of log lines. */
export function applyLevelUps(member) {
  const log = [];
  while (member.level < MAX_LEVEL && member.xp >= xpForLevel(member.level + 1)) {
    member.level += 1;
    for (const [stat, amt] of Object.entries(GROWTH)) member[stat] += amt;
    member.hp = member.maxHp; member.mp = member.maxMp;
    log.push(`${member.name} reached level ${member.level}! (+${GROWTH.maxHp} HP, +${GROWTH.atk} ATK, +${GROWTH.def} DEF)`);
  }
  return log;
}

export function xpToNext(member) {
  return member.level >= MAX_LEVEL ? 0 : xpForLevel(member.level + 1) - member.xp;
}

/** After every victory, check the party for level-ups and append to the combat log if present. */
export function installProgression(game) {
  game.bus.on('combat:victory', () => {
    const lines = game.state.party.flatMap(applyLevelUps);
    if (lines.length) {
      game.state.combat?.log?.push(...lines);
      game.bus.emit('party:levelup', { lines });
    }
  });
}
