import { ledgerOf } from '../core/ledger.js';
import { FEATS, featsEarned, closestFeatText } from './feats.js';
import { BOUNTIES, bountyState, bountyRecordText } from '../core/bounties.js';
import { ENEMIES } from '../data/enemies.js';
import { DIFFICULTIES, getDifficulty } from '../combat/difficulty.js';
import { COMPANIONS, isUnlocked } from '../party/companions.js';
import { DRILL_FOES, drillRecord, gauntletRecord } from './drills.js';
import { bountyAnsweredText } from './bounties.js';
// Ending / credits scene. Shown once when the story reaches stage 'complete',
// and again as a finale with epilogue after the Stormcrown Spire report.
const ENDINGS = {
  protect_town: {
    title: 'The Shielded Town',
    text: 'A steady blue light settles over Greyhaven. The town is safe tonight; tomorrow, its people must find another way to reach their neighbors.',
  },
  share_signal: {
    title: 'Lanterns on the Horizon',
    text: 'Lines of silver light trace the distant roads. Greyhaven’s shield is thinner, but answering lanterns appear along the horizon. No settlement faces the storm alone.',
  },
};

const RELAY_EPILOGUE = {
  shelter_network: 'The Sunscar Relay keeps shelters warm and lit across the frontier, and weary travelers rest for a smaller fee wherever its power reaches.',
  route_network: 'The Sunscar Relay guides patrols along the trade roads. Ambushes grow rarer between Greyhaven, Saltmere and Highwatch, though travelers still keep their blades close.',
};

const HEART_EPILOGUE = 'Beyond the summit, both lightning anchors hold and the Storm’s Heart lies still. The great storm over Stormcrown has broken, and the high paths are quieter for every traveler who follows.';
const SPIRE_EPILOGUE = 'Atop Stormcrown Spire, the Tyrant has fallen and its instruments no longer feed the storm. With the recovered survey records, the settlements now forecast dangerous weather together, and the expedition board keeps the roads watched.';

/** Epilogue lines for every chapter the player has completed, in order. */
export function epilogueLines(state) {
  const f = state?.story?.flags || {};
  const lines = [];
  if (f.rescue_reward) lines.push('Saltmere’s harbor and Highwatch’s garrison stand again, and their people remember who came down the roads to help.');
  if (RELAY_EPILOGUE[f.relay_choice]) lines.push(RELAY_EPILOGUE[f.relay_choice]);
  if (f.spire_reward) lines.push(SPIRE_EPILOGUE);
  if (f.heart_reward === true) lines.push(HEART_EPILOGUE);
  return lines;
}

/** Postgame deeds, in the order a warden usually meets them. Shown under “Beyond the storm”. */
export const POSTGAME_DEEDS = [
  { id: 'last_squall', test: (f) => f.victory_last_squall === true,
    text: 'The Last Squall has rolled away over the mountains, and the high passes breathe easier.' },
  { id: 'long_watch', test: (f) => f.watch_reward === true,
    text: 'The Long Watch is kept, and the beacon’s keepers sleep in shifts again.' },
  { id: 'cinderclaw', test: (f, b) => b.cinderclaw > 0,
    text: 'Cinderclaw no longer stalks the Sunscar dunes; caravans cross by daylight.' },
  { id: 'calibration', test: (f) => f.calibration_reward === true,
    text: 'The signal line hums in true interval from the Eye to the Sunscar junction.' },
  { id: 'thunderhoof', test: (f, b) => b.thunderhoof > 0,
    text: 'Thunderhoof’s stampede is stopped, and the ridge road is quiet underfoot.' },
  { id: 'supply', test: (f) => f.supply_reward === true,
    text: 'Your Supply Lines survey is filed: the chosen route is scouted and the relay junction checked.' },
  { id: 'glacierward', test: (f, b) => b.glacierward_colossus > 0,
    text: 'The Glacierward Colossus stands thawed and silent at Highwatch Pass.' },
  { id: 'stormborn', test: (f, b, l) => l.stormbornBossVictories >= 1,
    text: 'A Stormborn victory is entered in the Service Record: a calm kept in the fiercest gale.' },
  { id: 'bounties', test: (f, b, l, s) => BOUNTIES.every((x) => (bountyState(s).completed[x.id] || 0) >= 1),
    text: 'Every contract on the Greyhaven bounty board has been claimed at least once, and each notice bears the warden’s mark.' },
];

/** Postgame deed lines the player has earned, in POSTGAME_DEEDS order. */
export function postgameLines(state) {
  const f = state?.story?.flags && typeof state.story.flags === 'object' ? state.story.flags : {};
  const raw = state?.bestiary && typeof state.bestiary === 'object' ? state.bestiary : {};
  const b = new Proxy({}, { get: (_, k) => Number(raw[k]) || 0 });
  const l = ledgerOf(state);
  const st = state && typeof state === 'object' ? state : {};
  return POSTGAME_DEEDS.filter((d) => d.test(f, b, l, st)).map((d) => d.text);
}

/** One-line battle tally for “Your journey”, from the Service Record (drills never count). */
export function battlesText(state) {
  const l = ledgerOf(state);
  const won = `Battles won: ${l.victories}`;
  return l.bossVictories > 0 ? `${won} (${l.bossVictories} against bosses)` : won;
}

/** One-line Field Journal tally for “Your journey”: distinct foes recorded out of the full roster. */
export function journalText(state) {
  const book = state?.bestiary && typeof state.bestiary === 'object' && !Array.isArray(state.bestiary) ? state.bestiary : {};
  const ids = Object.keys(ENEMIES);
  const seen = ids.filter((id) => Object.prototype.hasOwnProperty.call(book, id) && Number.isInteger(book[id]) && book[id] > 0).length;
  return `Field Journal: ${seen} of ${ids.length} foes recorded`;
}

/** Cumulative lifetime battle stats from the Service Record. Returns null when all counters are zero. */
export function cumulativeStatsText(state) {
  const l = ledgerOf(state);
  const parts = [];
  if (l.totalRounds > 0) parts.push(`Rounds fought: ${l.totalRounds}`);
  if (l.totalDealt > 0) parts.push(`Damage dealt: ${l.totalDealt}`);
  if (l.totalTaken > 0) parts.push(`Damage taken: ${l.totalTaken}`);
  if (l.totalBursts > 0) parts.push(`Beacon Bursts fired: ${l.totalBursts}`);
  if (l.totalItemsUsed > 0) parts.push(`Items used in battle: ${l.totalItemsUsed}`);
  return parts.length > 0 ? parts : null;
}

/** "Current difficulty: Label" — the preset selected now, not a run history. */
// Sparring drills won across every restaged boss, plus the best Yard Gauntlet
// run. Null until the party has won a drill or run the gauntlet.
export function drillsText(state) {
  const wins = DRILL_FOES.reduce((sum, id) => sum + drillRecord(state, id).wins, 0);
  const gauntlet = gauntletRecord(state);
  if (!wins && !gauntlet.runs) return null;
  let text = `Sparring drills won: ${wins}`;
  if (gauntlet.runs) text += ` (Yard Gauntlet best: ${gauntlet.best} ${gauntlet.best === 1 ? 'foe' : 'foes'} beaten)`;
  return text;
}

export function difficultyText(state) {
  return `Current difficulty: ${DIFFICULTIES[getDifficulty(state)].label}`;
}

/** Companions whose unlock flag is set, in roster order; null when none. */
export function companionsText(state) {
  const names = Object.keys(COMPANIONS).filter((id) => isUnlocked(state, id)).map((id) => COMPANIONS[id].name);
  if (!names.length) return null;
  return `Companions available: ${names.join(', ')}`;
}

export function isFinale(state) {
  return Boolean(state?.story?.flags?.spire_reward);
}

export const CREDITS = [
  ['Combat, bestiary, companions & progression', 'Claude Opus 5.5'],
  ['Map, zones & exploration', 'Gemini 4 Argon'],
  ['Items, shops & crafting', 'GLM-5.3 Flash'],
  ['Story, quests & playtest campaigns', 'GPT-6 Astra'],
  ['Interface, accessibility & presentation', 'Kimi K3.1 Pro'],
  ['Early design planning', 'DeepSeek-V4-Pro'],
];

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function endingInfo(state) {
  return ENDINGS[state?.story?.ending] || { title: 'The Beacon Burns', text: 'The beacon is lit once more.' };
}

export const endingScene = {
  onEnter(game, data) { game.endingReturn = data?.returnScene === 'town' ? 'town' : null; },
  render(game) {
    const s = game.state;
    const info = endingInfo(s);
    const hero = s.party?.[0] || {};
    const rows = CREDITS.map(([role, who]) => `<li><strong>${esc(role)}</strong> — ${esc(who)}</li>`).join('');
    return `<div class="panel ending">
      ${isFinale(s) ? '<h1>Stormhaven Endures</h1><p class="finale-sub">' + esc(info.title) + '</p>' : `<h1>${esc(info.title)}</h1>`}
      <p>${esc(info.text)}</p>
      ${epilogueLines(s).map((l) => `<p class="epilogue">${esc(l)}</p>`).join('')}
      ${postgameLines(s).length ? `<h3>Beyond the storm</h3><ul class="postgame-deeds">${postgameLines(s).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      <h3>Your journey</h3>
      <ul>
        <li>${esc(hero.name || 'Hero')} reached level ${esc(String(Number(hero.level) || 1))}</li>
        <li>Gold carried home: ${esc(String(Number(s.gold) || 0))}</li>
        <li>Items in pack: ${esc(String((s.inventory || []).reduce((n, i) => n + (Number(i.qty) || 0), 0)))}</li>
        <li class="ending-difficulty">${esc(difficultyText(s))}</li>
        ${companionsText(s) ? `<li class="ending-companions">${esc(companionsText(s))}</li>` : ''}
        <li class="ending-battles">${esc(battlesText(s))}</li>
        <li class="ending-journal">${esc(journalText(s))}</li>
        ${cumulativeStatsText(s) ? cumulativeStatsText(s).map((l) => `<li class="ending-cumulative">${esc(l)}</li>`).join('') : ''}
        <li class="ending-feats">Wardens’ Feats earned: ${esc(String(featsEarned(s)))} of ${esc(String(FEATS.length))}</li>
        ${closestFeatText(s) ? `<li class="ending-feats-next">${esc(closestFeatText(s))}</li>` : ''}
        ${drillsText(s) ? `<li class="ending-drills">${esc(drillsText(s))}</li>` : ''}
        ${bountyRecordText(s) ? `<li class="ending-bounty-record">${esc(bountyRecordText(s))}</li>` : ''}
        ${bountyAnsweredText(s) ? `<li class="ending-bounty-answered">${esc(bountyAnsweredText(s))}</li>` : ''}
      </ul>
      <h3>Credits</h3>
      <ul class="credits">${rows}</ul>
      <p><em>Made by the AI Village for AI Digest.</em></p>
      ${game.endingReturn === 'town' ? '<button data-action="keepExploring">Back to Greyhaven</button>' : '<button data-action="keepExploring">Keep exploring</button>'}
      <button data-action="toTitle">Return to title</button>
    </div>`;
  },
  actions: {
    keepExploring(game) {
      if (game.endingReturn === 'town') { game.endingReturn = null; game.setScene('town'); return; }
      game.setScene(game.scenes.explore ? 'explore' : 'town');
    },
    toTitle(game) { game.setScene('title'); },
  },
};

/** Switch to the ending scene the first time the story completes. */
export function installEnding(game) {
  const check = () => {
    const st = game.state;
    if (st?.story?.stage === 'complete' && !st.flags?.endingShown) {
      st.flags = { ...(st.flags || {}), endingShown: true };
      game.setScene('ending');
    } else if (isFinale(st) && !st.flags?.finaleShown) {
      st.flags = { ...(st.flags || {}), endingShown: true, finaleShown: true };
      game.setScene('ending');
    }
  };
  game.bus.on('story:updated', check);
  return () => game.bus.off('story:updated', check);
}
