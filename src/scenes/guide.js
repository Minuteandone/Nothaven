// "How to play" field guide, reachable from the title screen.
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { SKILLS, SKILL_UNLOCKS } from '../combat/rules.js';

export const GUIDE_SECTIONS = Object.freeze([
  Object.freeze({ title: 'Exploring', lines: [
    'Move with the arrow buttons or the W, A, S and D keys. Each step in the wilds can stir up a random encounter. A fight that is not yet open, because it awaits a story step or landmark inspections, appears on the map as a “Sealed challenge” and keeps its foe’s name hidden until it unlocks.',
    'The Expedition log groups consecutive repeats and shows six recent entries. When older entries are retained, Show earlier entries reveals them; Show recent entries only restores the shorter view. This viewing choice is not saved and never spends a turn.',
    'Stand next to people to talk, and next to landmarks or foes to interact or fight. Exits lead to new regions once you reach them. Beneath the map, the Terrain compass lists open and blocked adjacent ways based on terrain walkability.',
    'Your bag and journal are available in the field, and the Field Pack summarizes your carried stacks by category alongside any ready crafting recipes. Recipes that use rare drops can only be crafted one at a time.',
    'In the Field Journal, choose All, Bosses, or Regular to filter the catalogue. Enter a recorded foe’s name and choose Search; unknown names cannot be searched. Clear search restores unknown placeholders within the chosen category. Progress totals and the comparison tray stay unfiltered. Search and category choices reset when you reopen the journal and never unlock entries or change your save.',
    'Foes marked as optional are never required to finish the story. After the Storm’s Heart, a far greater trial waits in the Storm’s Eye for seasoned wardens of level 15 or higher.',
  ] }),
  Object.freeze({ title: 'Battle', lines: [
    'Battles are turn-based. Choose Attack, a Skill, an Item, Defend or Flee, and your companions act after you. Attack and damaging skills show an estimated damage range, items show what they would restore on their target right now (for example “On Wren now: +12 HP.”), and a line beneath the foe estimates its basic hit, or an unleashed heavy blow, against your current defenses. Outside boss fights, the Flee button shows your current escape odds as a percentage: they start at 50% and move 10 percentage points for each point of speed you have above or below the foe, bounded from 0% to 90%. Healing, cleansing and revival skills likewise show their immediate effect on each target (for example “If used now: Wren +10 HP.”), capped at maximum HP and naming any conditions they would clear, before your companions act or the foe replies — not a prediction of end-of-turn health. The Action order panel shows this sequence, labels downed allies “Down now” (they are skipped unless revived before their formation turn), marks a stunned enemy’s skipped reply, and explains a faster foe’s single opening turn before your first command. Against late bosses and field trials, trading blows alone often falls short: raise Beacon Aegis or Warding Stance before a gathered heavy blow lands, restore the party with Rallying Light or Stormhaven Vigil before health runs low, clear shock with Steady Signal, and keep Rekindle ready for a fallen companion — a party that stays standing keeps dealing damage over a long fight.',
    'Defend halves damage to Wren during the next enemy action. Fleeing depends on speed and never works against a boss.',
    'Bosses grow fiercer once badly wounded. Watch for the warning line in the battle log.',
    'Every boss and field trial sometimes spends a turn gathering a heavy blow. A warning appears under the foe; Defend or a ward halves the strike that follows, and a stun or Stillpoint Strike breaks it entirely. A Break! flash over the foe confirms the blow was scattered, and Braced! appears over a hero who blunts it. When a boss is worn down far enough to turn desperate, a red Enraged! flash marks its harder-hitting second phase. Foes with such a second phase also show a tick on their HP bar and, beneath it, a line such as “Enrage threshold: 120 HP or lower.” naming exactly when that phase begins. After a victory, the outcome panel also lists the experience and gold earned and any items found, in a line such as “+10 XP · +9 gold”.',
    'After some hard-fought victories, a spoils panel offers a one-time choice between three bonus bundles; take one or leave them and continue on your way.',
    'The Beacon Charge gauge fills as Wren attacks, uses skills, defends and takes hits. When it is full, unleash a Beacon Burst: a def-ignoring blast that also clears bleeding and shock, usable even while shocked.',
    'After each victory, the battle summary tallies the rounds fought, total damage dealt, damage your party took and any Beacon Bursts fired. When companions dealt damage, it also separates Wren’s share from each companion’s contribution; together those shares account for the total HP removed from the foe.',
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
    'Up to three travelers fight together. Rescued allies join the Watch House muster board in Greyhaven, where you can swap them in or out. With two companions deployed, Move earlier and Move later change their roster order for free; Wren stays first. Companions act in that order after Wren, later allies do not act if one ends the battle, and the chosen order is retained in your save.',
    'Victories earn experience. Each level raises health, focus, attack, defense and speed, and some levels teach Wren a new skill.',
    'At level 8 each companion masters a signature technique: Keeper’s Mend, Bulwark Bash, Bright Flare or Piercing Shot.',
    'Shops sell gear for each region, and the bag lets you equip it and use supplies. Shops and the field craft upgrades from salvaged materials. The shop Craft tab has a Craft all button that repeats a recipe while materials last. Sort buttons above the bag groups reorder stacks by type, name, or total sell value. The Buy tab’s quantity stepper picks how many the Buy button purchases at once (up to 99), while Buy 5 and Buy & equip stay unchanged. Each row’s Buy max button purchases as many of that item as your gold allows, up to 99 at once. The Sell tab’s quantity stepper picks how many the Sell N button sells from a stack (Sell 1 and Sell all stay unchanged, and rare drops can only be sold one at a time). A search box above the bag groups narrows both the item groups and the craft table by name; reopening the bag clears it. Trading posts at Saltmere and the Relay Outpost add a Trade tab that swaps common materials for glass at rates that favor the shop; rare drops are never tradable. Trade all repeats the selected trade while its materials last. Each pack row has a Details button that opens a short sourcing note — where to buy or trade for the item, its Board Exchange price in marks, what it trades away, or why it never appears in shops — and choosing it again hides the note. Pack rows and shop buy and sell listings show a consumable’s effect: how much HP or MP it restores and which status it cures.',
  ] }),
  Object.freeze({ title: 'Settings and saving', lines: [
    'The Difficulty button in Greyhaven switches between Story, Standard, Veteran and Stormborn foes at any time; overcoming any boss on Stormborn earns the Calm in the Gale feat.',
    'Use Save journey in town to keep your progress on this device, and Continue on the title screen to return.',
    "Journey Archive keeps three manual slots on this device, separate from Save journey. Open it from the title screen, Greyhaven or the expedition screen. Save a slot while in town or exploring; loading a slot replaces the current journey after confirmation.",
    "To move a saved slot to another browser, choose Export and manually copy all its text. In the other browser, open Journey Archive, paste the text, choose Preview for a destination slot, then Confirm. Import writes only that slot, leaving your current journey and quick save unchanged; choose Load separately to play it. Confirming an import can overwrite the chosen slot.",
    "Archive text is editable and is not verified proof of progress. Import only text you trust. There is no cloud sync, and leaving the Archive clears its text fields; keep your own copy before leaving.",
    'Sound is muted by default. The audio controls let you turn on the storm ambience and adjust the volume.',
    'The Journey Journal lists every active task, the Character Sheet shows gear and effective stats, and Wardens’ Feats records the milestones of your journey — all open from Greyhaven or the expedition screen. In Wardens’ Feats, the All, Earned and Not yet buttons narrow the list. Below the earned count, a short line names the next feat you have not yet earned, in list order. Each filter button shows how many feats it would list. Once you have earned a feat, the town square also shows your feat count and the title of the next feat still to earn. The Journey Journal repeats that feat line and, once you have won a drill or attempted the Yard Gauntlet, adds a training yard line with your drill victories, the foes you have bested in drills and your best gauntlet run. Feats that count toward a target, such as level, contracts or drill wins, show your progress beneath their description until earned (for example “Progress: 2 of 4.”). Beneath the next unearned feat, a second line names the unearned feat whose target is closest to complete, by share of the target already reached (for example “Closest to earning: Full Muster (2 of 3).”).',
    'Sparring Drills in Greyhaven let you refight the yard bosses you have already beaten for half their experience. Optional field trials such as Old Tusk, Gloomfin, Frostmane and the Lenswarden stay out on the map. Drills pay no gold or spoils, and losing one costs nothing.',
    'The four field trials open once Warden Mara has paid for the Saltmere and Highwatch rescues. Overcoming Old Tusk, Gloomfin, Frostmane and the Lenswarden earns the Trial Warden feat.',
    'After the Stormcrown Spire is settled, Cinderclaw, a giant sand scorpion, waits in the dunes below the Sunscar signal lift. It is a harder, separate trial for level 9 or above and does not count toward Trial Warden; defeating it earns the Dune Breaker feat.',
    'After reporting Signal Calibration, Supply Lines offers a Coastal or Highland survey. Choose one route in Greyhaven, defeat its regional patrol threat, inspect its station, then defeat a Dust Marauder and inspect Sunscar’s Relay Capacitor Junction. Only fresh steps in that order count; explicitly report in Greyhaven for 280 gold. This surveys ahead of crews, not an escort with timers or convoy health.',
    'Once Signal Calibration is paid, Thunderhoof, a storm-charged elk, roams the lower bend of the Ridge Road. It is among the hardest optional trials (plan on level 14 or above); its Arcing Antlers leave you shocked, and it does not count toward Trial Warden; defeating it earns the Stampede Stopped feat and sometimes yields the Sparkrack Tine, a trinket that sharpens attack, focus and speed.',
    'The paid calibration also wakes the Glacierward Colossus, an old guardian of stone and ice by the south wall of Highwatch Pass. Tougher than Thunderhoof (plan on level 16 or above), its Rime Shard Volley leaves you bleeding and it sometimes gathers a Glacier Slam; it is a separate challenge outside Trial Warden and the drill yard; defeating it earns the Thaw the Sentinel feat and it sometimes drops a Frostward Cloak.',
    'Each drill keeps a record of your wins and your fewest rounds, so you can try to beat your best time. A summary line above the roster counts the drills you have unlocked, the foes you have bested in drills and your total drill victories. Beneath it, a hint names the next unlocked drill you have not yet won or, once all are won, the one with your slowest best time. Each unlocked drill also names its foe’s element and which skill elements hit it harder or are resisted (for example “Element: Water. Lightning skills hit it harder; Fire skills are resisted.”). A line beneath it lists the foe’s health, attack, defense and speed at your current difficulty (for example “Foe at Standard: 50 HP · 10 attack · 4 defense · 6 speed.”). Winning a drill against every boss in the Watch House yard earns the Yard Champion feat.',
    'Once three drills are unlocked, the Yard Gauntlet sends you through every unlocked drill back to back. HP and MP carry over between bouts, and your longest run is recorded. Beneath the record, a target line tracks the Unbroken Run feat: until every yard boss is unlocked it counts how many are, and afterwards it shows how many more foes your best run must beat.',
    'After the finale, Read the chronicle in Greyhaven replays the ending and credits without paying rewards again. Its Your journey list names your current difficulty and available companions, tallies battles won (with boss victories), foes recorded in the Field Journal, Wardens’ Feats earned out of thirty-one, any sparring drills won (with your best Yard Gauntlet run) and, after your first claim, your bounty board record; finished postgame challenges appear under Beyond the storm.',
    'The Greyhaven bounty board posts repeatable hunts against roaming foes. A contract opens once that foe is in your Field Journal, and each posted notice lists the regions where its target roams. Beneath the claim count, a line such as “Notices posted: 5 of 18.” shows how many contracts the board has opened so far. Each posted notice also shows its target’s health, attack, defense and speed at your current difficulty, and its element with the skill elements that hit it harder or are resisted. Take one at a time, defeat the listed number in the wilds (ambushes and patrols count, drills do not), then claim gold and crafting materials back at the board. Every contract can be taken again. While a contract is active, its progress shows in the town square, on the exploration screen (which also notes whether the target roams there), and in the Journey Journal. When no contract is active, the town square instead names the current urgent notice and any Board Marks you have to spend. After your first claim, the town square also shows your board rank and how many more claims the next rank needs. Each claim also counts toward a board rank — Contract Hand at 3 claims, Board Regular at 8, Ridge Tracker at 15 and Warden of the Board at 25 — which raises the gold every contract pays by 10% per rank, up to +40%. Your current rank and total claims also appear in the Service record on the Feats page. Region buttons on the board narrow the posted notices to the hunts roaming one region; your active contract always stays in view. One contract at a time is marked urgent and pays an extra 25% of its base gold on top of your rank (if it is still unposted, the board says so without naming it); the urgent mark moves to another contract after every claim. Claim the same contract three times and it is mastered: every later claim of it pays one extra of its first listed item, and the board counts how many contracts you have mastered. Sort buttons list the posted notices in board order, by highest pay, by fewest claims, or by easiest hunt (the least total base health across all the foes a contract asks for, shown on each posted notice as a line such as “Hunt total: 48 base HP across 4 foes.”); unposted notices always stay at the bottom. Claimed contracts that are not yet mastered show how many of the three claims you have made toward mastery. After your first claim, the Journey Journal keeps a board record of your total claims, current rank, mastered contracts and lifetime Board Marks earned. The same record appears under “Your journey” on the ending screen. Each recorded roaming foe’s Field Journal entry also lists the regions it roams and its board contract, with your claims on it and any active progress. Every claim also earns Board Marks — 1 for the first six postings, 2 for the next six and 3 for the last six — which the Board Exchange beneath the contracts trades for supplies: two Field Dressings, a Highland Flask, a Spiced Broth, Storm Glass, Relay Brass, Sunscar Glass or Thunder Iron. Reaching the Warden of the Board rank takes one mark off the price of every offer. Each offer also shows how many of that item are already in your pack. Above the offers, a line counts how many you can afford with your available marks and names the cheapest one still out of reach with the marks it needs.',
  ] }),
]);

const ROADMAP_TITLE = 'Skill roadmap';
export const GUIDE_CONTENTS_ID = 'guide-contents';
const BACK_LINK = `<p class="guide-section__back"><a class="guide-section__back-link" href="#${GUIDE_CONTENTS_ID}">Back to contents</a></p>`;

/** Stable anchor id for a guide section title, e.g. 'Party and growth' -> 'guide-party-and-growth'. */
export function guideSectionId(title) {
  const slug = String(title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `guide-${slug || 'section'}`;
}

/** Contents entries for every guide section plus the skill roadmap: [{ id, title, count }]. */
export function guideContents() {
  const rows = GUIDE_SECTIONS.map((s) => ({ id: guideSectionId(s.title), title: s.title, count: s.lines.length }));
  rows.push({ id: guideSectionId(ROADMAP_TITLE), title: ROADMAP_TITLE, count: skillRoadmap().length });
  return rows;
}

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
    const sections = GUIDE_SECTIONS.map((s) => `<section class="guide-section" id="${escapeHTML(guideSectionId(s.title))}"><h2>${escapeHTML(s.title)}</h2><ul>${s.lines.map((l) => `<li>${escapeHTML(l)}</li>`).join('')}</ul>${BACK_LINK}</section>`).join('');
    const contents = guideContents().map((c) => `<li><a class="guide-toc__link" href="#${escapeHTML(c.id)}">${escapeHTML(`${c.title} (${c.count})`)}</a></li>`).join('');
    const roadmap = skillRoadmap().map((r) => `<li>${escapeHTML(`Level ${r.level}: ${r.name}`)}</li>`).join('');
    return `<main class="game-shell guide">
      ${sceneHeader({ eyebrow: 'How to play', title: 'Wardens’ Field Guide', subtitle: 'Everything a new keeper of the beacon should know before setting out.', iconName: 'journal' })}
      <nav class="panel guide-toc" id="${GUIDE_CONTENTS_ID}" aria-label="Guide contents"><h2 class="guide-toc__title">Contents</h2><ul class="guide-toc__list">${contents}</ul></nav>
      <div class="panel">${sections}<section class="guide-section" id="${escapeHTML(guideSectionId(ROADMAP_TITLE))}"><h2>${escapeHTML(ROADMAP_TITLE)}</h2><ul class="guide-skills">${roadmap}</ul>${BACK_LINK}</section></div>
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
