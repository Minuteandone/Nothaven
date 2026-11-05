// Companion conversation lines for the muster board. Read-only: talking never
// changes state. Lines react to the story stage, the beacon ending, rescues and
// the chapter-three relay choice.

import { ledgerOf } from '../core/ledger.js';

const LINES = {
  tamsin: {
    stormborn: 'You set the frontier to its hardest and still walked back through the gate. I stopped counting the bruises and started counting the wins.',
    glacierward: 'That Colossus swung like the whole south wall had decided to walk. When it knelt, I swear the pass went ten degrees warmer.',
    thunderhoof: 'Thunderhoof ran the ridge bend like it owned the road. I counted its stride from the switchback; we will not be racing that one again.',
    calibration: 'Eye, Spire and Sunscar keep one signal interval now. I timed the flashes from the ridge and they matched my count to the beat.',
    cinderclaw: 'Cinderclaw dug in so fast I lost its trail twice. Next time I am watching the sand, not the sky.',
    frostmane: 'Frostmane ran faster than any wolf I have ever chased. I still got there first. Mostly.',
    trials: 'Tusk, Gloomfin, Frostmane and that brass guardian. Four old legends, four roads, and not one of them got the better of us. I am writing this down for the next scouts.',
    lenswarden: 'That brass guardian tracked me with every prism it had. Turns out light is easy to dodge if you keep moving.',
    gloomfin: 'I heard Gloomfin was big. Nobody said it was big enough to make the whole cove go quiet. I am counting that one twice.',
    tusk: 'Old Tusk charged me once when I was nine. I finally got to watch him run the other way. Took me long enough.',
    squall: 'I watched the Last Squall roll off over the mountains from the ridge. First time I ever cheered at weather.',
    watch: 'Mara pinned the Long Watch readings by the door. Three calm marks in a row, and she still checks them every morning.',
    heart: 'With the great storm over Stormcrown broken, I can see the far mountains from the ridge. I did not know they were there.',
    spire: 'The Spire’s crown is dark at last. From the summit I could see every road we ever cleared, all at once.',
    shelter_network: 'Sheltered waystations every half day of walking. My feet thank you; my scouting pride is wounded.',
    route_network: 'With the relay calling the patrols, half the dust raiders turn back before we even reach them. Boring roads are good roads.',
    early: 'The ridge road twists like a snapped rope. Stay low on the switchbacks and the bandits never see you coming.',
    protect_town: 'A shield over Greyhaven, then. I will miss watching the light run down the coast, but the children sleep easier.',
    share_signal: 'You sent the light down every road. Out there, someone just found their way home because of you.',
    rescued: 'Both roads are open again. I counted the caravans this morning and ran out of fingers.',
  },
  iven: {
    stormborn: 'I logged our Stormborn battle beside the old storm tables. By every number we should have lost; I have checked the sums three times.',
    glacierward: 'The Glacierward Colossus was built from the same survey stone as our old benchmarks. I would give a month of readings to see its original plans.',
    thunderhoof: 'Those antlers threw sparks hot enough to fuse my lens clips. I am keeping one of the scorched tines for the observatory shelf.',
    calibration: 'The three stations finally keep the same interval. I checked my pocket timer against them; it was only a little bit wrong.',
    cinderclaw: 'I measured the trench Cinderclaw left below the lift. Forty paces. I am not putting that number in the report to Mara; she would only worry.',
    frostmane: 'Frost was still on my sleeves when we came down from the bastion. I wrote the whole fight down before it melted.',
    trials: 'Every old terror on the frontier has been met and turned back. Mara says the Watch House has not had a full trial roll since her own training days.',
    lenswarden: 'The Lenswarden kept the old opticians’ vault for a century. I copied their notes before we left; the beacon lens was only one of their ideas.',
    gloomfin: 'I kept a spark from Gloomfin’s fin in a jar of seawater. It glowed for a whole day before it faded.',
    tusk: 'I measured the scrape marks Old Tusk left on the ridge boulders. I would rather not tell you how deep they go.',
    squall: 'My barometer has not twitched since the Last Squall broke. I tapped it twice to be sure it still works.',
    watch: 'The forecast stand at the observatory finally agrees with my notebook. I have decided the stand is the one that was wrong all along.',
    heart: 'The anchors still hum where we grounded them. I wrote down every reading; someday someone will want to know how a storm’s core was calmed.',
    spire: 'I kept a sliver of the Stormcrown Shard under glass. It still flickers when thunder rolls far out at sea.',
    shelter_network: 'The relay feeds warmth to every waystation now. I added a little dial to each one. Nobody asked, but they all use it.',
    route_network: 'Routing the network means every signal tower talks to every other. I spent all night listening to them chatter.',
    early: 'The focusing lens bends storm light into a single beam. Without it the beacon is just a very tall lamp.',
    protect_town: 'I tuned the lens to hold the shield steady. It hums at night; I find it oddly comforting.',
    share_signal: 'Sharing the signal thins the town shield, so I check the coils every hour. Worth it, I think.',
    rescued: 'Saltmere sent spare copper wire and Highwatch sent star charts. I may never sleep again.',
  },
  bram: {
    stormborn: 'Stormborn foes hit like a winter sea against the harbor wall. My shield rang for an hour, and I would still stand there again tomorrow.',
    glacierward: 'I have held a wall against winter storms, but never one that punched back. My arm still hums from that Glacier Slam.',
    thunderhoof: 'I braced for that stampede like a breakwater braces for a spring tide. Next time I would rather be the tide.',
    calibration: 'Ona timed the harbor lamp against the new interval and it lined up on the first try. She looked almost disappointed.',
    cinderclaw: 'That scorpion’s pincers closed on my shield like a dockside winch. The shield held. My arm is still deciding.',
    frostmane: 'I have braced a shield against winter gales off the harbor. Frostmane hit harder than any of them, and it still went home first.',
    trials: 'Four trials, four scars on this shield. Harbor folk will be telling those stories over chowder for years, and they will get every detail wrong.',
    lenswarden: 'A shield is a fine mirror, it turns out. That brass guardian did not enjoy its own beam coming back at it.',
    gloomfin: 'Saltmere fishers row past the north seawall again since Gloomfin went back to the deep. Ona says the nets come up full.',
    tusk: 'That old boar hit my shield harder than the tide ever did. I have kept the dent as a keepsake.',
    squall: 'Saltmere has a new saying now: calm as the day the Last Squall fell. The children use it for everything.',
    watch: 'The harbor lamp reading came back steady for the Long Watch. Ona had it painted on the lamp post so nobody forgets.',
    heart: 'The harbor bell has rung for fair weather three days running. The old fishers swear they have never heard that before.',
    spire: 'Saltmere fishers sailed past the headland today without once looking up at the sky. That is what peace looks like.',
    shelter_network: 'Saltmere runners rest at the waystations now. A roof and a fire for two coins is a fair trade on a long road.',
    route_network: 'The relay clears the roads before the caravans set out. Fewer fights, more cargo. Saltmere approves.',
    early: 'The tide took half the pier, but it will not take the rest while I can still lift a shield.',
    protect_town: 'Strong walls keep good people safe. Saltmere will rebuild ours with stone this time.',
    share_signal: 'We saw your light from the flooded pier. That is when we knew to hold on one more night.',
    rescued: 'The harbor watch is back on the breakwater. I owe you a proper meal at the Saltmere Post.',
  },
  sela: {
    stormborn: 'Highwatch runners heard we beat a boss on Stormborn and begged to train on the steepest slope. Rusk said yes before I could warn them.',
    glacierward: 'Rusk says the Colossus guarded Highwatch long before the beacon was lit. Now it rests by the south wall, and the runners leave it a lantern each night.',
    thunderhoof: 'The ridge runners can take the lower bend again without listening for hoofbeats in the thunder. The scorch marks will fade by spring.',
    calibration: 'Runners can read the flashes from any cairn now and trust the timing. I still count them under my breath anyway.',
    cinderclaw: 'The relay crews can run the signal lift without listening for scraping under the sand now. Cinderclaw burrowed off west and has not come back.',
    frostmane: 'Rusk’s sentries stand their night watches without flinching at every howl now. The packs scattered once Frostmane fled, and the cairn fires burn steady.',
    trials: 'Ridge, ruins, coast and heights, all four trials answered. Highwatch drills its recruits on lesser tales than ours now.',
    lenswarden: 'Every prism in that vault was cut by hand. I would like to study them properly someday, without one of them trying to blind me.',
    gloomfin: 'I have outrun wolves and rockslides, but I never want to race an eel through the shallows again.',
    tusk: 'Highwatch runners used to swing a whole mile wide of the ridge gorse because of Old Tusk. Now they cut straight through.',
    squall: 'The runners asked me what the Last Squall was like. I told them it was loud, and then it was quiet.',
    watch: 'The cairn at Highwatch read clear for the Long Watch. I carved the date into the stone beside the old storm marks.',
    heart: 'I lit every cairn from the pass to the summit last night. Not as a warning this time, just to show the sky we are still here.',
    spire: 'I ran the Spire switchbacks again this morning just to prove I could. The wind was only wind.',
    shelter_network: 'The cairn runners sleep in the relay shelters between legs. I have never seen them so rested, or so smug.',
    route_network: 'Signals race from the pass to the coast faster than I can run. I am not jealous. Much.',
    early: 'Every cairn on the pass is a promise: light it, and the next runner knows the path is safe.',
    protect_town: 'Greyhaven chose its walls. Highwatch understands; we keep a palisade of our own.',
    share_signal: 'Your beacon reached our highest cairn. I relit the whole chain by dawn just to answer it.',
    rescued: 'The pass is clear and the cairns are burning. Run with me sometime; you might keep up.',
  },
};

export function companionRemark(id, story = {}, bestiary = {}, ledger = {}) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(LINES, id)) return '';
  const set = LINES[id];
  const f = story?.flags || {};
  if (ledgerOf({ ledger }).stormbornBossVictories >= 1 && set.stormborn) return set.stormborn;
  if (f.calibration_reward === true && Number(bestiary?.glacierward_colossus) > 0 && set.glacierward) return set.glacierward;
  if (f.calibration_reward === true && Number(bestiary?.thunderhoof) > 0 && set.thunderhoof) return set.thunderhoof;
  if (f.calibration_reward === true && set.calibration) return set.calibration;
  if (f.victory_last_squall === true && set.squall) return set.squall;
  if (f.watch_reward === true && set.watch) return set.watch;
  if (f.victory_storm_heart === true && set.heart) return set.heart;
  if (f.spire_reward === true && Number(bestiary?.cinderclaw) > 0 && set.cinderclaw) return set.cinderclaw;
  if ((f.spire_summit || f.spire_victory || f.victory_stormcrown_tyrant) && set.spire) return set.spire;
  const relay = story?.flags?.relay_choice;
  if ((relay === 'shelter_network' || relay === 'route_network') && set[relay]) return set[relay];
  if (story?.flags?.rescue_reward && ['old_tusk', 'gloomfin', 'frostmane', 'lenswarden'].every(k => Number(bestiary?.[k]) > 0) && set.trials) return set.trials;
  if (story?.flags?.rescue_reward && Number(bestiary?.lenswarden) > 0 && set.lenswarden) return set.lenswarden;
  if (story?.flags?.rescue_reward && Number(bestiary?.frostmane) > 0 && set.frostmane) return set.frostmane;
  if (story?.flags?.rescue_reward && Number(bestiary?.gloomfin) > 0 && set.gloomfin) return set.gloomfin;
  if (story?.flags?.rescue_reward && Number(bestiary?.old_tusk) > 0 && set.tusk) return set.tusk;
  if (story?.flags?.rescue_reward) return set.rescued;
  if (story?.stage === 'complete' && (story.ending === 'protect_town' || story.ending === 'share_signal')) return set[story.ending];
  return set.early;
}
