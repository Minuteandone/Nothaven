// "How to play" field guide, reachable from the title screen.
import { sceneHeader, uiButton } from '../ui/components.js';
import { SKILLS, SKILL_UNLOCKS } from '../combat/rules.js';

export const GUIDE_SECTIONS = Object.freeze([
  Object.freeze({ title: 'Exploring', lines: [
    'Move with the arrow buttons or the W, A, S and D keys. Each step in the wilds can stir up a random encounter.',
    'Stand next to people to talk, and next to landmarks or foes to interact or fight. Exits lead to new regions once you reach them.',
    'Your bag and journal are available in the field, and ready crafting recipes appear right on the exploration screen. Recipes that use rare drops can only be crafted one at a time.',
    'Foes marked as optional are never required to finish the story. After the Storm’s Heart, a far greater trial waits in the Storm’s Eye for seasoned wardens of level 15 or higher.',
  ] }),
  Object.freeze({ title: 'Battle', lines: [
    'Battles are turn-based. Choose Attack, a Skill, an Item, Defend or Flee, and your companions act after you.',
    'Defend halves damage to Wren during the next enemy action. Fleeing depends on speed and never works against a boss.',
    'Bosses grow fiercer once badly wounded. Watch for the warning line in the battle log.',
    'The Tide Wraith, the Drowned Harbormaster, the Highwatch Warlord, the Relay Warden, Cinderclaw, the Stormcrown Tyrant, the Storm’s Heart and the Last Squall sometimes spend a turn gathering a heavy blow. A warning appears under the foe; Defend or a ward halves the strike that follows, and a stun breaks it entirely.',
    'The Beacon Charge gauge fills as Wren attacks, uses skills, defends and takes hits. When it is full, unleash a Beacon Burst: a def-ignoring blast that also clears bleeding and shock, usable even while shocked.',
    'After each victory, the battle summary tallies the rounds fought, damage dealt, damage your party took and any Beacon Bursts fired.',
    'If Wren falls, the patrol carries the party back to Greyhaven at half health, minus half your gold.',
  ] }),
  Object.freeze({ title: 'Conditions', lines: [
    'Bleeding drains 2 health each round until it wears off or is treated.',
    'Shocked blocks magic and support skills such as Spark, Mend and Signal Flare. Attacks, physical skills like Power Strike, Beacon Lance, items and Steady Signal still work, and Steady Signal clears it.',
    'Resting at the Greyhaven inn restores the whole party and clears every condition.',
  ] }),
  Object.freeze({ title: 'Party and growth', lines: [
    'Up to three travelers fight together. Rescued allies join the Watch House muster board in Greyhaven, where you can swap them in or out.',
    'Victories earn experience. Each level raises health, focus, attack, defense and speed, and some levels teach Wren a new skill.',
    'At level 8 each companion masters a signature technique: Keeper’s Mend, Bulwark Bash, Bright Flare or Piercing Shot.',
    'Shops sell gear for each region, and the bag lets you equip it and use supplies. Shops and the field craft upgrades from salvaged materials.',
  ] }),
  Object.freeze({ title: 'Settings and saving', lines: [
    'The Difficulty button in Greyhaven switches between Story, Standard and Veteran foes at any time.',
    'Use Save journey in town to keep your progress on this device, and Continue on the title screen to return.',
    'Sound is muted by default. The audio controls let you turn on the storm ambience and adjust the volume.',
    'The Journey Journal lists every active task, the Character Sheet shows gear and effective stats, and Wardens’ Feats records the milestones of your journey — all open from Greyhaven or the expedition screen.',
    'Sparring Drills in Greyhaven let you refight the yard bosses you have already beaten for half their experience. Optional field trials such as Old Tusk, Gloomfin, Frostmane and the Lenswarden stay out on the map. Drills pay no gold or spoils, and losing one costs nothing.',
    'The four field trials open once Warden Mara has paid for the Saltmere and Highwatch rescues. Overcoming Old Tusk, Gloomfin, Frostmane and the Lenswarden earns the Trial Warden feat.',
    'After the Stormcrown Spire is settled, Cinderclaw, a giant sand scorpion, waits in the dunes below the Sunscar signal lift. It is a harder, separate trial for level 9 or above and does not count toward Trial Warden; defeating it earns the Dune Breaker feat.',
    'Each drill keeps a record of your wins and your fewest rounds, so you can try to beat your best time. Winning a drill against every boss in the Watch House yard earns the Yard Champion feat.',
    'Once three drills are unlocked, the Yard Gauntlet sends you through every unlocked drill back to back. HP and MP carry over between bouts, and your longest run is recorded.',
  ] }),
]);

/** Skill unlock rows ordered by level: [{ level, name }]. */
export function skillRoadmap() {
  return Object.entries(SKILL_UNLOCKS)
    .filter(([id]) => Object.prototype.hasOwnProperty.call(SKILLS, id))
    .map(([id, level]) => ({ level, name: SKILLS[id].name }))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export const guideScene = {
  onEnter(game, data = {}) {
    game.guideReturn = data && typeof data.returnScene === 'string' ? data.returnScene : 'title';
  },
  render() {
    const sections = GUIDE_SECTIONS.map((s) => `<section class="guide-section"><h2>${s.title}</h2><ul>${s.lines.map((l) => `<li>${l}</li>`).join('')}</ul></section>`).join('');
    const roadmap = skillRoadmap().map((r) => `<li>Level ${r.level}: ${r.name}</li>`).join('');
    return `<main class="game-shell guide">
      ${sceneHeader({ eyebrow: 'How to play', title: 'Wardens’ Field Guide', subtitle: 'Everything a new keeper of the beacon should know before setting out.', iconName: 'journal' })}
      <div class="panel">${sections}<section class="guide-section"><h2>Skill roadmap</h2><ul class="guide-skills">${roadmap}</ul></section></div>
      <div class="title-actions">${uiButton({ action: 'closeGuide', label: 'Back', iconName: 'compass', variant: 'primary' })}</div>
    </main>`;
  },
  actions: {
    closeGuide(game) {
      const target = game.guideReturn && game.scenes?.[game.guideReturn] ? game.guideReturn : 'title';
      game.guideReturn = null;
      game.setScene(target);
    },
  },
};
