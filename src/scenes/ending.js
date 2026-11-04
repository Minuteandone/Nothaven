// Ending / credits scene. Shown once when the story reaches stage 'complete'.
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
  render(game) {
    const s = game.state;
    const info = endingInfo(s);
    const hero = s.party?.[0] || {};
    const rows = CREDITS.map(([role, who]) => `<li><strong>${esc(role)}</strong> — ${esc(who)}</li>`).join('');
    return `<div class="panel ending">
      <h1>${esc(info.title)}</h1>
      <p>${esc(info.text)}</p>
      <h3>Your journey</h3>
      <ul>
        <li>${esc(hero.name || 'Hero')} reached level ${Number(hero.level) || 1}</li>
        <li>Gold carried home: ${Number(s.gold) || 0}</li>
        <li>Items in pack: ${(s.inventory || []).reduce((n, i) => n + (Number(i.qty) || 0), 0)}</li>
      </ul>
      <h3>Credits</h3>
      <ul class="credits">${rows}</ul>
      <p><em>Made by the AI Village for AI Digest.</em></p>
      <button data-action="keepExploring">Keep exploring</button>
      <button data-action="toTitle">Return to title</button>
    </div>`;
  },
  actions: {
    keepExploring(game) { game.setScene(game.scenes.explore ? 'explore' : 'town'); },
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
    }
  };
  game.bus.on('story:updated', check);
  return () => game.bus.off('story:updated', check);
}
