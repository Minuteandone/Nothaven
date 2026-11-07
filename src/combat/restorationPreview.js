import { SKILLS, knownSkills, heroStats, hasStatus } from './rules.js';

const SUPPORT_SKILLS = ['mend', 'rallying_light', 'steady_signal', 'rekindle', 'stormhaven_vigil'];

/** Plain-text immediate support effects, before allies, enemy reply and status ticks. */
export function skillRestorationPreview(skillId, party) {
  if (!SUPPORT_SKILLS.includes(skillId) || !Array.isArray(party)) return '';
  const hero = party[0], skill = SKILLS[skillId];
  if (!hero || !Number.isFinite(hero.hp) || hero.hp <= 0
      || !Number.isFinite(hero.mp) || hero.mp < skill.mp
      || !Number.isFinite(hero.level || 1)
      || !knownSkills(hero).some(s => s.id === skillId)) return '';
  if (hasStatus(hero, 'shocked') && skill.kind !== 'cleanse' && skill.kind !== 'vigil') return '';
  const rows = [];
  const targets = skill.kind === 'heal' ? [hero] : party;
  for (const member of targets) {
    if (!member || !Number.isFinite(member.hp)) continue;
    const revive = skill.kind === 'revive';
    if (revive ? member === hero || member.hp > 0 : member.hp <= 0) continue;
    const maxHp = heroStats(member).maxHp;
    if (!Number.isFinite(maxHp) || maxHp <= 0) continue;
    const parts = [];
    if (revive) {
      parts.push(`rises with ${Math.max(1, Math.ceil(maxHp * (skill.share || 0.4)))} HP`);
      if (Array.isArray(member.statuses) && member.statuses.length) parts.push('Clears all conditions');
    } else {
      if (skill.kind !== 'cleanse') {
        const amount = skill.kind === 'vigil'
          ? Math.max(1, Math.ceil(maxHp * (skill.share || 0.35)))
          : skill.power + (hero.level || 1) * 2;
        const delta = Math.min(maxHp, member.hp + amount) - member.hp;
        parts.push(`${delta >= 0 ? '+' : ''}${delta} HP`);
      }
      const cures = skill.kind === 'party_heal' ? ['bleeding']
        : skill.kind === 'cleanse' || skill.kind === 'vigil' ? ['bleeding', 'shocked'] : [];
      const present = cures.filter(id => hasStatus(member, id));
      if (present.length) parts.push(`Clears ${present.join(', ')}`);
    }
    if (parts.length) rows.push(`${member.name || 'Ally'} ${parts.join(' · ')}`);
  }
  if (rows.length) return `If used now: ${rows.join('; ')}.`;
  if (skill.kind === 'revive') return 'No fallen ally to revive.';
  if (skill.kind === 'cleanse') return 'No bleeding or shock to clear.';
  return '';
}
