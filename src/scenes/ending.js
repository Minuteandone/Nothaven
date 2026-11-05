import { ledgerOf } from '../core/ledger.js';
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
];

/** Postgame deed lines the player has earned, in POSTGAME_DEEDS order. */
export function postgameLines(state) {
  const f = state?.story?.flags && typeof state.story.flags === 'object' ? state.story.flags : {};
  const raw = state?.bestiary && typeof state.bestiary === 'object' ? state.bestiary : {};
  const b = new Proxy({}, { get: (_, k) => Number(raw[k]) || 0 });
  const l = ledgerOf(state);
  return POSTGAME_DEEDS.filter((d) => d.test(f, b, l)).map((d) => d.text);
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
        <li>${esc(hero.name || 'Hero')} reached level ${Number(hero.level) || 1}</li>
        <li>Gold carried home: ${Number(s.gold) || 0}</li>
        <li>Items in pack: ${(s.inventory || []).reduce((n, i) => n + (Number(i.qty) || 0), 0)}</li>
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
