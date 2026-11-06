# Beacon of Stormhaven — player guide

[Play in your browser](https://stormhaven-rpg.pages.dev) · [Project README](../README.md)

## Starting without spoilers

- Choose **New journey**, speak to Warden Mara in Greyhaven, and read the quest journal below the main panels. You can also speak to Iven and Tamsin for context.
- **Explore the wilds** opens the map. Use its movement buttons, WASD, or the arrow keys. Nearby actions appear as you approach people, landmarks, enemies, and exits.
- **Display settings → Letter & number shortcuts** can turn off WASD, E (Survey), combat letters, and numbered actions for speech input or personal preference. Arrow movement, Escape, and native buttons still work. This device-local preference is separate from your saved journey; Reset display turns these shortcuts back on.
- Walk to new regions to discover them before using their travel shortcuts. Some passages also require quest progress.
- **Inspect landmarks and open caches explicitly.** Standing on a chest is not the same as taking its supplies. Read nearby action labels when you reach an objective.
- **Pin an objective** in the Journey journal to show its current instructions in town and exploration. One pin is kept at a time; its text follows your progress, and a completed pin stays marked completed until you unpin it. Your manual quick save and Journey Archive checkpoints preserve the selection; pinning does not save automatically or accept a job.
- **Journey archive** keeps three separate manual checkpoints. Open it in town or exploration to save a slot, or from the title screen to load one. Replacing or deleting an occupied slot requires confirmation; loading asks before replacing your unsaved journey. **Save journey / Save Game** and **Continue** still use the separate quick save. Archive slots are device-local, do not synchronize, and never save automatically.
- **Portable archive backups:** first save a Journey Archive slot, choose **Export slot**, then select and copy the entire text into a file you keep. On another browser/device, open Journey Archive (also available from the title), paste the text, choose **Preview into slot 1, 2, or 3**, check the incoming journey and destination, then **Confirm import**. Even empty slots require confirmation. Import replaces only that checkpoint; it does not load it, change your current journey, or replace the quick save. Use **Load slot** separately when ready. Text is local, editable JSON, not an authenticated record; only import text you trust. Format checks reject unsupported versions, combat snapshots, oversized text (over 250,000 characters), excessively deep/large structures and unsafe object keys, but do not verify earned progress. Leaving the archive clears unimported text and export panels; no cloud upload or automatic synchronization occurs.
- Use **Save journey** in town or **Save Game** while exploring. Saves are local to this browser/device; **Continue** on the title screen resumes your saved journey. Do not rely on automatic saving or cross-device synchronization.
- Combat is turn-based: nothing attacks while you decide. Read **Skills** and **Items**, not just Attack. Healing and defensive skills can make a longer fight manageable; fleeing is not available against bosses.
- Every boss and field trial can spend a turn **gathering a heavy blow**: about one and a half times a normal hit for the Tide Wraith; a little more for the four field trials (Old Tusk, Gloomfin, Frostmane and the Lenswarden); nearly twice for the Drowned Harbormaster, the Highwatch Warlord, the Relay Warden, Cinderclaw, Thunderhoof and the Glacierward Colossus; and twice for the Stormcrown Tyrant, the Storm’s Heart and the Last Squall. A warning appears under the foe: Defend or a ward halves the strike on the next turn, and stunning the foe or landing a Stillpoint Strike breaks it. A **Break!** flash over the foe confirms the blow was scattered, and **Braced!** appears over the hero who blunted a release with Defend or a ward. When a boss is worn down far enough to turn desperate, a red **Enraged!** flash over it marks its harder-hitting second phase.
- Watch the **Beacon Charge** gauge. Attacks, skills, defending and taking hits fill it; when it is full, **Beacon Burst** strikes for heavy damage that ignores defense and clears bleeding and shock. Burst is not a skill, so it still works while you are shocked.
- New equipment must be **equipped**, not merely bought. Shops also have Sell and Craft tabs; inspect recipe requirements before selling materials. The shop Craft tab has a Craft all button that repeats a recipe while materials last. The exploration Field Pack offers ready-to-craft recipes when you have their ingredients. Recipes that use rare drops can only be crafted one at a time. The Buy tab’s quantity stepper picks how many the Buy button purchases at once (up to 99), while Buy 5 and Buy & equip stay unchanged. Each row’s Buy max button purchases as many of that item as your gold allows, up to 99 at once. The Sell tab’s quantity stepper picks how many the Sell N button sells from a stack (Sell 1 and Sell all stay unchanged, and rare drops can only be sold one at a time). Trading posts at Saltmere and the Relay Outpost add a Trade tab that swaps common materials for glass at rates that favor the shop; rare drops are never tradable. Trade all repeats the selected trade while its materials last.
- Visit the **Watch House muster board** in town as allies unlock. Your active party has three slots including Wren. Dismissed companions become reserves rather than being deleted.
- Companions grow with the party. At **level 8** each masters a signature technique: Iven’s **Keeper’s Mend** heals 50% more, Bram’s **Bulwark Bash** triggers more often (35%) and hits harder, Sela’s **Bright Flare** deals 50% more damage, and Tamsin’s **Piercing Shot** fires more often (40%) at ×1.7 power.
- In combat **Items**, choose a living **Item recipient** before using a supply. Wren is selected each time you open Items; selecting a recipient or returning to commands spends no turn. Using an item spends one turn, including companion actions and the enemy reply. Number shortcuts still choose items, not recipients. Ordinary supplies cannot revive downed allies.
- In combat, **Tactics** (**T**) sets each living companion to **Automatic** or **Conserve MP**. Automatic keeps their usual behavior; Conserve MP replaces Iven’s Mend/Spark and Sela’s Signal Flare with ordinary attacks, even when someone needs healing. Tamsin and Bram retain their free techniques. Choosing a tactic spends no turn; Escape returns to commands. Preferences stay with companions in reserve and are kept when you save.
- Wren keeps learning into the postgame: **Rekindle** (level 15) revives every knocked-out ally at 40% health with conditions cleared, **Skyfire Lance** (level 17) is an armour-piercing strike at 260% power, and **Stormhaven Vigil** (level 19, 16 MP) restores 35% of maximum health to every standing ally and clears bleeding and shock. Rekindle does nothing (and costs no MP) if nobody has fallen, and like other support skills it is blocked while Wren is shocked. Stormhaven Vigil, like Steady Signal, can be used while shocked, but it cannot lift a fallen ally. At the level cap, **Stillpoint Strike** (level 20, 13 MP) is an armour-piercing strike at 200% power that also breaks any heavy blow the foe is gathering, and it can be used while shocked.
- Paid rests restore the active party and clear statuses. Bring remedies for bleeding and shock on longer trips. If Wren falls, defeat costs half your gold, rounded down, and returns the party to Greyhaven; quest progress remains.
- The **Warden’s field journal** reveals enemy information after victories. Its field tips are useful preparation for rematches and related threats. Use **Compare** on up to three recorded foes for a side-by-side tactical tray; Remove or Clear comparison changes no progress. Recorded bosses also show their windup name, gathering chance, next-action strike at Wren, and counterplay in both views; unknown foes stay hidden. Windup multipliers scale ATK before defense, not final damage. Use **All / Bosses / Regular** to filter the catalogue, or enter a recorded foe’s name and choose **Search**. Unknown names cannot be searched; **Clear search** restores their placeholders within the chosen category. Progress totals and the comparison tray stay unfiltered. Search and category choices reset when you reopen the journal; they never unlock entries or change your save.
- The town **Difficulty** button cycles Standard → Veteran → Stormborn → Story → Standard. Standard is unchanged; Story gives foes 75% HP and 80% attack, while Veteran gives them 130% HP and 120% attack with 125% gold, and Stormborn gives them 160% HP and 140% attack with 150% gold. Values are rounded, the setting is saved, and it applies to newly started fights.
- Music and sound are optional. Use the audio controls if you want them; the game does not require sound.

### When a quest seems stuck

1. Read its current journal objective rather than repeating the last fight.
2. Check whether it asks you to **inspect** something after winning.
3. Return to Greyhaven for town reports. Later commissions use explicit **Accept** and **Report** buttons; ordinary conversation does not submit them.
4. Expand **Companion commissions** to see those separate requests.
5. Earlier discoveries count for later commissions, but discovering everything does not itself accept or pay a request.

---

## Walkthrough — story and reward spoilers below

The five chapters share one save. The first beacon ending is permanent, but it is not the end of exploration. Choose **Keep exploring** after an ending to continue.

### 1. Relight the beacon

1. Speak to Mara. Leave Greyhaven through the **East Gate** for Ridge Road and clear the road patrol.
2. Report to Mara, then speak to Iven about the lens.
3. Take Ridge Road’s **North Ascent** to Observatory Ruins. Defeat the Observatory Sentinel and return to Iven.
4. Consult Mara and Tamsin, then visit Beacon Tower through the observatory’s **North Causeway**. If you explored the tower earlier, visit it again after the council conversations.
5. Make your permanent beacon choice: protect Greyhaven or share the light along the distant roads. The result changes the story, not your ability to play the following chapters.

The three main payments total **105 gold** (20 + 35 + 50). Find the **Lost Ridge Dispatch** and **Observatory Dispatch**, then speak to Tamsin for a separate **15 gold**. Beacon Tower has a **Signal Lift** home.

After the beacon choice, **First Light Relief** asks for **2 rations and 1 bandage**. Buy or find them, then explicitly hand them over in Greyhaven for **30 gold once**. Buying all three from Hesta costs 22 gold. This is optional and independent of the settlement expedition.

Hesta’s Goods also sells the **Tin Whistle** trinket for **25 gold** (+5 HP), an affordable first accessory while you save for better weapons and armor.

### 2. Open both rescue routes

Accept Mara’s relief expedition in Greyhaven. Complete these routes in either order:

| Route | How to reach it | Required task |
|---|---|---|
| Saltmere Coast | Greyhaven’s **South Pier** | Clear the reef creatures at the coastal rescue crossing. |
| Highwatch Pass | Ridge Road’s **North Trail** | Clear the frost wolves at the supply crossing. |

Return to Greyhaven and explicitly report both safe routes for **80 gold once**. The first route you cleared is remembered. The Drowned Harbormaster and Pass Warlord are **optional bosses**, not substitutes for the rescue encounters.

Tamsin and Iven unlock through the earlier road and observatory victories; Bram and Sela unlock through the respective settlement rescue victories. Use the muster board to recruit them. Saltmere’s trading post sells coastal equipment if you want an upgrade before pushing inland.
Its signature weapon is the **Warden’s Blade** (**180 gold**, ATK +12), a solid step up from the iron sword.

### 3. Restore the inland relay

After reporting both rescues, accept **A Signal of Our Own** in Greyhaven.

1. Enter **Sunscar Relay** through Highwatch’s **East Gate**.
2. Inspect the **Relay Capacitor Junction**.
3. Defeat the **Relay Warden** and inspect the **Master Relay Console**.
4. While beside the console, make one permanent service choice for **100 gold once**:
   - **Shelter network:** paid rests cost **2 gold instead of 5**.
   - **Route network:** random wandering encounters occur **half as often**. Fixed enemies remain.

Neither choice replaces your original beacon ending. The **Sunscar Relay Outpost** offers inland gear and supplies; the region’s **Signal Lift** returns to Greyhaven. If you explored before accepting, your completed tasks remain valid—accept in town, then return to the console to choose.

### 4. Survey Stormcrown Spire

Accept **Above the Gathering Storm** in Greyhaven after choosing the relay service. From Sunscar Relay, take the **Spire Switchback**.

1. Inspect the **Western Storm-Survey Archive** and **Eastern Barometer Logbook**.
2. Prepare at the **Stormcrown Trading Post**; the expedition cache is another source of supplies.
3. Defeat the **Stormcrown Tyrant**.
4. Inspect the **Stormcrown Summit Cradle**, which is guarded until the Tyrant falls.
5. Return by the **Signal Lift** and explicitly report for **150 gold once**.

This report opens the **Stormhaven Endures** finale once. Keep exploring afterward. The passage beyond the summit remains locked until you have actually submitted this survey report, even if the Tyrant is already defeated.

### 5. Optional: investigate the Storm’s Heart

After the summit report, accept **The Storm’s Heart** in Greyhaven. Return to the spire summit and take the **Summit Passage** into **The Storm’s Eye**.

- The trading post and supply cache are reachable before the anchor fights. Upgrade with money you have already earned; the final reward is not an advance.
- Defeat the **western Tempest Shade**, then inspect the **Western Lightning Anchor**.
- Defeat the **eastern Thunderhead Colossus**, then inspect the **Eastern Lightning Anchor**.
- Either anchor order works. The core remains inaccessible until **both anchors have been inspected**, not merely their guardians defeated.
- Defeat **the Storm’s Heart** at the central core. You can use the Signal Lift to rest and return before this fight; inspected anchors remain grounded.
- Return to Greyhaven and explicitly report for **200 gold once**. If you explored before accepting, accept now; those discoveries still count.

Defeating the exact core immediately halves random encounters in **Stormcrown Spire and the Storm’s Eye**, even before reporting. The route-network benefit stacks, making those encounters one quarter as likely as their original rate. Other regions, fixed enemies, and ordinary weather are not removed.

Your original beacon choice, relay service, and earlier rewards remain unchanged. The report does not automatically replay an ending. **Read the chronicle** in town lets you revisit the ending and credits with the completed chapter’s aftermath; **Back to Greyhaven** returns without paying rewards again. Once you finish postgame challenges such as the Last Squall, Cinderclaw, Signal Calibration, Supply Lines, the Glacierward Colossus or a fully claimed bounty board, the chronicle also lists them under **Beyond the storm**.

#### Optional challenge: The Last Squall

After you claim the **Heart report reward**, a final storm gathers on the northern causeway of **the Storm’s Eye**. **The Last Squall** is an optional trial far stronger than the Storm’s Heart. Level **15 or higher** with your best gear is recommended; keep Beacon Aegis up and save a Beacon Burst for when it draws in every storm. Victory grants experience, gold and materials only. It records a journal entry but pays no report reward and changes no ending, so you can leave it be.

#### Crafting the squall-grade gear

Three **craft-only** upgrades appear in every shop’s **Craft** tab and the town **Field Recipe Book** once you hold their inputs: **Squall Cleaver** (Tempest Edge + 3 Thunder Iron + 1 Stormcrown Shard), **Squall Bulwark** (Maelstrom Plate + 3 Thunder Iron + 1 Stormcrown Shard) and **Squall Sigil** (Stormeye Signet + 2 Thunder Iron + 2 Storm Glass, with no shard required). None of them are ever sold outright. Stormcrown Shards drop from the Stormcrown Tyrant, the Storm’s Heart and The Last Squall, with a rare chance from the Thunderhead Colossus.

#### Optional survey: The Long Watch

After claiming the **Heart report reward**, explicitly accept **The Long Watch** in Greyhaven. This survey is independent of **The Last Squall**; you do not need to fight that optional boss.

Take **fresh readings after accepting** at all three repeatable stations, in any order:

- **Saltmere Harbor Lamp:** south from Greyhaven, at the pier’s southern end.
- **Highwatch Signal Cairn:** through Ridge Road’s north trail, at the northern overlook.
- **Observatory Forecast Stand:** through Ridge Road’s north ascent, beside the old lens pedestal. The stand is a separate, repeatable landmark; the recovered lens is not moved or collected again.

Old inspections do **not** count, unlike the earlier companion requests. You can save between readings. Return to Greyhaven and explicitly **report the three readings for 180 gold once**; conversation alone neither accepts nor pays. The completed journal records the shared forecast timetable. This survey changes no ending, combat difficulty, or encounter rate; ordinary storms and road threats remain.

#### Optional ordered survey: Signal Calibration

After **reporting The Long Watch and receiving its reward**, explicitly accept **Signal Calibration** in Greyhaven. Take fresh readings in order: **Eye Reference Gauge** on the Storm’s Eye lower platform (3,5), **Eastern Barometer Logbook** on Stormcrown Spire’s eastern parapet (7,3), then **Relay Capacitor Junction** on Sunscar’s northern terrace (3,1). Earlier or out-of-order inspections do not count; the Journey Journal always identifies the next step. Return to Greyhaven and explicitly report for **220 gold**. Talking alone pays nothing. Reporting also earns the **True Interval** feat. The survey changes no ending, beacon reach, relay benefit, or combat statistics.

### Optional companion commissions

Expand **Companion commissions** in Greyhaven. Each unlocks with its companion; you do **not** need that companion recruited or in the active party. Accept, complete both tasks, and explicitly report in Greyhaven.

| Request | Fixed enemy | Landmark to inspect | Reward |
|---|---|---|---:|
| Tamsin — The Scout’s Missing Route | Ridge Road’s hound den | Lost Ridge Dispatch | 25 gold |
| Iven — The Keeper’s Second Look | Eastern observatory construct | Refractory Lens Pedestal | 35 gold |
| Bram — A Lamp for the Late Boats | Drowned Harbormaster | Saltmere Harbor Lamp | 45 gold |
| Sela — The Runner’s Bearings | Rockslide Golem | Highwatch Signal Cairn | 45 gold |

These are one-time requests. Their exact fixed enemies matter: defeating the same species on a wandering patrol does not replace the requested encounter. Earlier victories and inspections count; an older save may need the repeatable harbor lamp or cairn inspected again.

### Repeatable expedition board

After the summit report, Greyhaven offers the first two patrol contracts:

- **Sunscar Road Patrol:** defeat **2 Dust Marauders**, then claim **35 gold** in town.
- **Stormcrown Sentry Patrol:** defeat **2 Spire Sentries**, then claim **60 gold** in town.
- **Storm’s Eye Sweep:** after claiming the **Heart report reward**, defeat **2 Tempest Shades**, then claim **90 gold** in town. Defeating the core alone does not unlock this contract.

Accept one contract at a time, then use patrols to seek new victories. Earlier kills do not count. Matching victories advance the quota but **do not automatically pay**; return and claim the reward. You may accept the same contract again from zero. Cancelling discards progress and gives no payment.

### Frontier wanderers

Four wandering foes can appear on the early roads in addition to the familiar patrols. They are never required, and the fixed story encounters are unchanged.

| Foe | Where it roams | What to watch for | Counter |
|---|---|---|---|
| Briar Boar | Ridge Road | **Thorn Gore** hits about 1.4× harder | Defending halves the next hit; Warding Stance helps too |
| Lens Wisp | Observatory Ruins | **Prism Glare** can leave you **shocked** | Plain attacks still work; Steady Signal or Burst clears it |
| Wrack Eel | Saltmere Coast | **Coiling Bite** causes **bleeding** | Rallying Light or a bandage stops the bleed |
| Rime Wight | Highwatch Pass | **Numbing Frost** can leave you **shocked** | Keep a storm tonic handy and lean on attacks |

**Old Tusk (optional ridge trial).** Once Saltmere and Highwatch are home and you have reported to Mara, the grey king of the briar boars appears on a Ridge Road ledge. His **Bramble Charge** causes heavy bleeding and he hits harder below half health, so bring bandages or Rallying Light. He is a one-off field challenge: nothing depends on him and he does not join the sparring drills.

**Gloomfin (optional coast trial).** After the same report, a giant storm-charged wrack eel starts hunting off Saltmere's north seawall. Its **Riptide Shock** leaves you shocked, which blocks most skills, so carry storm tonics and keep Steady Signal or Burst ready. Like Old Tusk, it is a one-off field challenge that stays out of the sparring drills.

**Frostmane (optional heights trial).** After that report, the white-maned leader of the Highwatch wolf packs prowls the southern bastion of Highwatch Pass. Its **Rime Fang** opens bleeding wounds, so bring bandages or field dressings and keep Rallying Light ready. It is another one-off field challenge that stays out of the sparring drills.

**The Lenswarden (optional observatory trial).** The same report unseals the northeast vault of the Observatory Ruins, where the old opticians’ brass guardian still stands watch. It is a construct, so Spark and Signal Flare deal extra damage, but its **Focused Beam** leaves you shocked: pack storm tonics or keep Steady Signal ready. Like the other field trials, it never appears in the sparring drills.

**Cinderclaw (optional plateau trial).** Once the Stormcrown Spire is settled and Mara has paid for it, a giant sand scorpion surfaces in the dunes below the Sunscar signal lift. It is much tougher than the four rescue-era trials (plan on level 9 or higher). Its **Searing Sting** opens bleeding wounds and it can gather a **Pincer Vise**, so Defend on the warning and carry bandages or field dressings. It is a separate challenge: it does not count toward Trial Warden and never appears in the sparring drills. Its one unique drop is the **Cinder Stinger** trinket (+3 atk, +1 def, +2 spd), which no shop sells.

**Thunderhoof (optional ridge trial).** After you report Signal Calibration and Mara pays for it, a storm-charged elk starts roaming the lower bend of the Ridge Road. It is one of the hardest optional fights (plan on level 14 or higher with a full party). Its **Arcing Antlers** leave you shocked, so keep a cleanse or Stormhaven Vigil ready, and Defend when it gathers a **Stampede Rush**. Like Cinderclaw it is a separate challenge: it does not count toward Trial Warden and never appears in the sparring drills. It drops thunder iron, storm glass and ember broth for the forge and the road, and sometimes its one unique drop, the **Sparkrack Tine** trinket (+3 atk, +6 MP, +3 spd), which no shop sells.

**Glacierward Colossus (optional Highwatch trial).** The same paid calibration wakes an old guardian of stone and blue ice by the south wall of Highwatch Pass (east of Captain Rusk). It is tougher than Thunderhoof (plan on level 16 or higher with a full party), and its ice plating shrugs off weak blows. Its **Rime Shard Volley** leaves you bleeding, so keep Rallying Light, Steady Signal or Stormhaven Vigil ready, and Defend when it gathers a **Glacier Slam**. It is a separate challenge outside Trial Warden and the sparring drills. It drops thunder iron, storm glass, relay brass and spiced broth, and sometimes a **Frostward Cloak**.

Each adds an entry to the bestiary, so they help toward the **catalogue** feat. Their drops are ordinary supplies such as healing herbs, storm glass, field dressings, and tonics.

### Elements and the elemental wheel

Five elements shape every battle: **Fire melts Ice**, **Ice grounds Lightning**, **Lightning parts Water**, and **Water douses Fire**. **Earth** stands neutral, neither strong nor weak against any element.

Some skills carry an element: Spark, Stormbreaker and Tempest Cleave (Lightning), Beacon Lance, Signal Flare and Skyfire Lance (Fire), and Stillpoint Strike (Ice). Basic attacks are untyped and ignore the wheel altogether.

Enemies have elemental affinities too — a Gale Hound is Lightning, a Cinderclaw is Fire, a Wrack Eel is Water. Check the coloured badge under an enemy's name during combat to plan your moves.

Super-effective hits deal **1.5× damage** and flash *It's super effective!* in the battle log. Resisted hits deal **0.75×** and warn *It's not very effective…* Earth-element foes still show their badge but never multiply or resist damage.

Companion techniques get elements too: Iven's Spark is Lightning, and Sela's Signal Flare is Fire, both making full use of the wheel.


### Greyhaven forge: weapon and armour fittings

Choose **Greyhaven forge** in town to have Hesta fit each party member's weapon and armour slots, up to +3 each. A weapon fitting adds +2 attack per level. An armour fitting adds +1 defence and +4 max HP per level. Fittings belong to the wearer's slot, so they carry over when that member changes gear, but they only help while something is equipped there.

| Level | Cost (either slot) |
|---|---|
| +1 | 30 gold, 2 Scrap Metal |
| +2 | 70 gold, 2 Storm Glass, 1 Scrap Metal |
| +3 | 140 gold, 2 Relay Brass, 1 Storm Glass |

Current fitting levels appear on each member's character sheet and beside equipped gear in the bag. Bringing both fittings on one member to +3 earns the **Well Fitted** feat.

### Watch House yard: drills, gauntlet and feats

Greyhaven's **Sparring drills** board lets you refight the yard bosses you have already defeated in the field, one bout at a time. Optional field trials (Old Tusk, Gloomfin, Frostmane and the Lenswarden) are not part of the yard. Each drill pays **half that foe's experience to every party member**, but no gold, items, or journal entries — it is pure practice and cannot change the story. Defeating a boss in the field unlocks its drill. Each drill records how many times you have won and your best (fewest) rounds.

Once **three** drills are unlocked, the **Yard Gauntlet** opens beside them: face every unlocked drill boss back to back, with wounds and spent MP carrying over between bouts. Losing ends the run but costs nothing — no gold is lost and the party stands back up. Your best run (foes beaten in one attempt) is recorded.

**Bounty board.** The Greyhaven bounty board posts eighteen repeatable hunts against roaming foes, from the Ridge Road Rat Cull to Thunder over the Eye. A contract opens once that foe is in your Field Journal, and each posted notice lists the regions where its target roams. Take one at a time, defeat the listed number in the wilds (roaming ambushes and patrols both count; sparring drills do not), then return to the board to claim gold and crafting materials such as scrap metal, storm glass and relay brass. You can abandon a contract at no cost, and every contract can be taken again. While a contract is active, its progress (or a reminder to claim it) shows in the town square, on the exploration screen (which also notes whether the target roams there), and in the Journey Journal. Each claim also counts toward a board rank — Contract Hand at 3 claims, Board Regular at 8, Ridge Tracker at 15 and Warden of the Board at 25 — which raises the gold every contract pays by 10% per rank, up to +40%. Your current rank and total claims also appear in the Service record on the Feats page.

The **Wardens' feats** panel lists milestones of your journey. Alongside the chapter milestones it tracks sixteen yard, road, forge and record achievements:

- **Yard Champion** — win a Sparring Drill against every boss in the Watch House yard.
- **Unbroken Run** — clear the full Yard Gauntlet against every yard boss without a single loss.
- **Roadwise** — defeat each of the four frontier wanderers described above.
- **Tusk Breaker** — defeat Old Tusk, the optional Ridge Road trial described above.
- **Seawall Sentinel** — defeat Gloomfin, the optional Saltmere Coast trial described above.
- **Packbreaker** — defeat Frostmane, the optional Highwatch Pass trial described above.
- **Vault Keeper** — defeat the Lenswarden, the optional Observatory Ruins trial described above.
- **Trial Warden** — overcome all four optional field trials (Old Tusk, Gloomfin, Frostmane and the Lenswarden).
- **Dune Breaker** — defeat Cinderclaw, the optional Sunscar plateau trial described above. It does not count toward Trial Warden.
- **Stampede Stopped** — defeat Thunderhoof, the optional ridge trial unlocked by paid Signal Calibration. It does not count toward Trial Warden.
- **Thaw the Sentinel** — defeat the Glacierward Colossus, the optional Highwatch Pass trial unlocked by paid Signal Calibration. It does not count toward Trial Warden.
- **Undaunted** — win a battle after being carried home from a defeat.
- **Steady Road** — win fifteen real battles in a row without a defeat. Fleeing does not break the run.
- **Calm in the Gale** — overcome any boss in a real battle while the Difficulty is set to Stormborn. Sparring drills do not count.
- **Well Fitted** — have the Greyhaven forge bring both the weapon and armour fittings of one party member to +3.
- **Every Notice Answered** — claim every contract on the Greyhaven bounty board at least once.

Use the **All**, **Earned** and **Not yet** buttons above the list to show only the feats you want; the earned count stays the same and the choice resets each time you open the panel.

Below the feats, the **Service record** tallies your real battles: battles won, bosses overcome, times carried home, safe withdrawals, wins after a defeat, and your current and longest winning runs. Sparring Drills and the Yard Gauntlet are practice and are not counted.

### The field bag

The bag screen holds the whole party's supplies and is reachable from town and the field. Member tabs choose whose stat line, gear comparisons and Equip buttons apply to; each stack lists its total sell value, and consumables can be used on the selected member without leaving the screen. Sort buttons above the item groups reorder stacks by type, name, or total sell value; the default order stays the way items were gathered. A search box above the groups narrows both the item groups and the craft table by name; search ignores letter case, and reopening the bag clears it.

### Signal Line Patrol

After collecting the summit survey and Signal Calibration payments, Greyhaven's expedition board offers **Signal Line Patrol** for **120 gold**. Accept it, then win one new battle each against a Dust Marauder in Sunscar Relay, a Spire Sentry in Stormcrown Spire, and a Tempest Shade in The Storm’s Eye, in any order. The journal tracks each target separately; repeat victories against the same target cannot replace another, and earlier victories do not count.

Return to Greyhaven and explicitly claim the payment. This repeatable contract shares the board's one-active-patrol limit; cancelling or accepting it again starts all three counts over. It does not change the beacon ending or your relay choice.

### Planning with the Recipe Book

Use **All**, **Ready**, or **Missing** to narrow the Field Recipe Book, and type a recipe, ingredient, or output name before choosing **Search**. Search ignores letter case; **Clear search** keeps your availability filter. Filters use the last applied search, not unfinished typing. Reopening the book resets both choices. These controls only change the reference view: crafting still happens in the Bag or at a trader, and your journey save is unchanged.

### Supply Lines: choose a survey route

After explicitly reporting **Signal Calibration**, accept one optional **Supply Lines** route in Greyhaven. The route cannot be changed after acceptance; both pay **280 gold** on an explicit Greyhaven report. This is advance surveying for supply crews, not an escort with timers or convoy health.

- **Coastal:** use Patrol in Saltmere until you defeat a new **Wrack Eel**, then inspect the **Harbor Lamp (4,5)**.
- **Highland:** use Patrol in Highwatch until you defeat a new **Rime Wight**, then inspect the **Highwatch Cairn (4,1)**.
- **Either route:** next use Patrol in Sunscar Relay until you defeat a new **Dust Marauder**, then inspect the **Relay Capacitor Junction (3,1)**. Return to Greyhaven and explicitly report **Supply Lines**.

Steps must occur in that order after acceptance. Earlier victories, inspections, and unrelated foes do not count; repeating a completed step gives no extra credit. Save journey preserves the chosen route and completed steps. Talking alone never pays. Ordinary road threats, your original ending, and the relay’s chosen purpose remain unchanged.
