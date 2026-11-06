// "How to play" field guide, reachable from the title screen.
import { sceneHeader, uiButton } from '../ui/components.js';
import { SKILLS, SKILL_UNLOCKS } from '../combat/rules.js';

export const GUIDE_SECTIONS = Object.freeze([
  Object.freeze({ title: 'Exploring', lines: [
    'Move with the arrow buttons or the W, A, S and D keys. Each step in the wilds can stir up a random encounter.',
    'Stand next to people to talk, and next to landmarks or foes to interact or fight. Exits lead to new regions once you reach them.',
    'Your bag and journal are available in the field, and ready crafting recipes appear right on the exploration screen. Recipes that use rare drops can only be crafted one at a time.',
    'In the Field Journal, choose All, Bosses, or Regular to filter the catalogue. Enter a recorded foe’s name and choose Search; unknown names cannot be searched. Clear search restores unknown placeholders within the chosen category. Progress totals and the comparison tray stay unfiltered. Search and category choices reset when you reopen the journal and never unlock entries or change your save.',
    'Foes marked as optional are never required to finish the story. After the Storm’s Heart, a far greater trial waits in the Storm’s Eye for seasoned wardens of level 15 or higher.',
  ] }),
  Object.freeze({ title: 'Battle', lines: [
    'Battles are turn-based. Choose Attack, a Skill, an Item, Defend or Flee, and your companions act after you.',
    'Defend halves damage to Wren during the next enemy action. Fleeing depends on speed and never works against a boss.',
    'Bosses grow fiercer once badly wounded. Watch for the warning line in the battle log.',
    'Every boss and field trial sometimes spends a turn gathering a heavy blow. A warning appears under the foe; Defend or a ward halves the strike that follows, and a stun or Stillpoint Strike breaks it entirely. A Break! flash over the foe confirms the blow was scattered, and Braced! appears over a hero who blunts it. When a boss is worn down far enough to turn desperate, a red Enraged! flash marks its harder-hitting second phase.',
    'The Beacon Charge gauge fills as Wren attacks, uses skills, defends and takes hits. When it is full, unleash a Beacon Burst: a def-ignoring blast that also clears bleeding and shock, usable even while shocked.',
    'After each victory, the battle summary tallies the rounds fought, damage dealt, damage your party took and any Beacon Bursts fired.',
    'If Wren falls, the patrol carries the party back to Greyhaven at half health, minus half your gold.',
  ] }),
  Object.freeze({ title: 'Elements', lines: [
    'Five elements shape the battlefield: Fire melts Ice, Ice grounds Lightning, Lightning parts Water, and Water douses Fire. Earth stands neutral, neither strong nor weak against any element.',
    'Some skills carry an element: Spark, Stormbreaker and Tempest Cleave (Lightning), Beacon Lance, Signal Flare and Skyfire Lance (Fire), and Stillpoint Strike (Ice). Basic attacks are untyped and ignore the elemental wheel.',
    'Enemies have elemental affinities too — a Gale Hound channels lightning, a Cinderclaw burns with fire, a Wrack Eel draws from water. Check the element badge under an enemy\'s name to plan your approach.',
    'Super-effective hits deal 1.5× damage and flash It\'s super effective! in the log. Resisted hits deal 0.75× and warn It\'s not very effective… Earth-element foes still show their badge but never multiply or resist damage.',
    'Companion techniques get elements too: Iven\'s Spark is Lightning, and Sela\'s Signal Flare is Fire, both making full use of the wheel.',
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
    'Shops sell gear for each region, and the bag lets you equip it and use supplies. Shops and the field craft upgrades from salvaged materials. The shop Craft tab has a Craft all button that repeats a recipe while materials last. Sort buttons above the bag groups reorder stacks by type, name, or total sell value. The Buy tab’s quantity stepper picks how many the Buy button purchases at once (up to 99), while Buy 5 and Buy &amp; equip stay unchanged. Each row’s Buy max button purchases as many of that item as your gold allows, up to 99 at once. The Sell tab’s quantity stepper picks how many the Sell N button sells from a stack (Sell 1 and Sell all stay unchanged, and rare drops can only be sold one at a time). A search box above the bag groups narrows both the item groups and the craft table by name; reopening the bag clears it. Trading posts at Saltmere and the Relay Outpost add a Trade tab that swaps common materials for glass at rates that favor the shop; rare drops are never tradable. Trade all repeats the selected trade while its materials last.',
  ] }),
  Object.freeze({ title: 'Settings and saving', lines: [
    'The Difficulty button in Greyhaven switches between Story, Standard, Veteran and Stormborn foes at any time; overcoming any boss on Stormborn earns the Calm in the Gale feat.',
    'Use Save journey in town to keep your progress on this device, and Continue on the title screen to return.',
    "Journey Archive keeps three manual slots on this device, separate from Save journey. Open it from the title screen, Greyhaven or the expedition screen. Save a slot while in town or exploring; loading a slot replaces the current journey after confirmation.",
    "To move a saved slot to another browser, choose Export and manually copy all its text. In the other browser, open Journey Archive, paste the text, choose Preview for a destination slot, then Confirm. Import writes only that slot, leaving your current journey and quick save unchanged; choose Load separately to play it. Confirming an import can overwrite the chosen slot.",
    "Archive text is editable and is not verified proof of progress. Import only text you trust. There is no cloud sync, and leaving the Archive clears its text fields; keep your own copy before leaving.",
    'Sound is muted by default. The audio controls let you turn on the storm ambience and adjust the volume.',
    'The Journey Journal lists every active task, the Character Sheet shows gear and effective stats, and Wardens’ Feats records the milestones of your journey — all open from Greyhaven or the expedition screen. In Wardens’ Feats, the All, Earned and Not yet buttons narrow the list.',
    'Sparring Drills in Greyhaven let you refight the yard bosses you have already beaten for half their experience. Optional field trials such as Old Tusk, Gloomfin, Frostmane and the Lenswarden stay out on the map. Drills pay no gold or spoils, and losing one costs nothing.',
    'The four field trials open once Warden Mara has paid for the Saltmere and Highwatch rescues. Overcoming Old Tusk, Gloomfin, Frostmane and the Lenswarden earns the Trial Warden feat.',
    'After the Stormcrown Spire is settled, Cinderclaw, a giant sand scorpion, waits in the dunes below the Sunscar signal lift. It is a harder, separate trial for level 9 or above and does not count toward Trial Warden; defeating it earns the Dune Breaker feat.',
    'After reporting Signal Calibration, Supply Lines offers a Coastal or Highland survey. Choose one route in Greyhaven, defeat its regional patrol threat, inspect its station, then defeat a Dust Marauder and inspect Sunscar’s Relay Capacitor Junction. Only fresh steps in that order count; explicitly report in Greyhaven for 280 gold. This surveys ahead of crews, not an escort with timers or convoy health.',
    'Once Signal Calibration is paid, Thunderhoof, a storm-charged elk, roams the lower bend of the Ridge Road. It is among the hardest optional trials (plan on level 14 or above); its Arcing Antlers leave you shocked, and it does not count toward Trial Warden; defeating it earns the Stampede Stopped feat and sometimes yields the Sparkrack Tine, a trinket that sharpens attack, focus and speed.',
    'The paid calibration also wakes the Glacierward Colossus, an old guardian of stone and ice by the south wall of Highwatch Pass. Tougher than Thunderhoof (plan on level 16 or above), its Rime Shard Volley leaves you bleeding and it sometimes gathers a Glacier Slam; it is a separate challenge outside Trial Warden and the drill yard; defeating it earns the Thaw the Sentinel feat and it sometimes drops a Frostward Cloak.',
    'Each drill keeps a record of your wins and your fewest rounds, so you can try to beat your best time. Winning a drill against every boss in the Watch House yard earns the Yard Champion feat.',
    'Once three drills are unlocked, the Yard Gauntlet sends you through every unlocked drill back to back. HP and MP carry over between bouts, and your longest run is recorded.',
    'The Greyhaven bounty board posts repeatable hunts against roaming foes. A contract opens once that foe is in your Field Journal, and each posted notice lists the regions where its target roams; take one at a time, defeat the listed number in the wilds (ambushes and patrols count, drills do not), then claim gold and crafting materials back at the board. Every contract can be taken again. While a contract is active, its progress shows in the town square, on the exploration screen (which also notes whether the target roams there), and in the Journey Journal. Each claim also counts toward a board rank — Contract Hand at 3 claims, Board Regular at 8, Ridge Tracker at 15 and Warden of the Board at 25 — which raises the gold every contract pays by 10% per rank, up to +40%. Your current rank and total claims also appear in the Service record on the Feats page. Region buttons on the board narrow the posted notices to the hunts roaming one region; your active contract always stays in view. One contract at a time is marked urgent and pays an extra 25% of its base gold on top of your rank (if it is still unposted, the board says so without naming it); the urgent mark moves to another contract after every claim. Claim the same contract three times and it is mastered: every later claim of it pays one extra of its first listed item, and the board counts how many contracts you have mastered. Sort buttons list the posted notices in board order, by highest pay, or by fewest claims; unposted notices always stay at the bottom. Claimed contracts that are not yet mastered show how many of the three claims you have made toward mastery. After your first claim, the Journey Journal keeps a board record of your total claims, current rank, and mastered contracts.',
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
