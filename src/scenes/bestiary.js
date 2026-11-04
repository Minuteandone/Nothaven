// "Warden's Field Journal": a bestiary of every foe the party has defeated.
// installBestiary(game) records victories (state.bestiary[enemyId] = count)
// from the combat:victory event and registers the 'bestiary' scene.
import { ENEMIES } from '../data/enemies.js';
import { getItem } from '../items/items.js';
import { fieldTip } from '../data/fieldTips.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

export function recordDefeat(state, enemyId) {
  if (!state || typeof enemyId !== 'string' || !own(ENEMIES, enemyId)) return false;
  if (!state.bestiary || typeof state.bestiary !== 'object' || Array.isArray(state.bestiary)) state.bestiary = {};
  const prev = Number.isInteger(state.bestiary[enemyId]) && state.bestiary[enemyId] > 0 ? state.bestiary[enemyId] : 0;
  state.bestiary[enemyId] = prev + 1;
  return true;
}

export function bestiaryEntries(state) {
  const book = state?.bestiary && typeof state.bestiary === 'object' ? state.bestiary : {};
  return Object.keys(ENEMIES).map((id) => ({ enemy: ENEMIES[id], count: own(book, id) && Number.isInteger(book[id]) ? book[id] : 0 }));
}

function entryHtml({ enemy: e, count }) {
  if (count <= 0) {
    return `<li class="bestiary-entry unknown"><h3>??? ${e.boss ? '<small>(boss)</small>' : ''}</h3><p class="hint"><em>Not yet encountered and defeated.</em></p></li>`;
  }
  const tags = [e.boss ? 'Boss' : null, ...(e.tags || []).map((t) => t[0].toUpperCase() + t.slice(1))].filter(Boolean);
  const ability = e.ability ? `<p>Signature move: <strong>${esc(e.ability.name)}</strong>${e.ability.status ? ` (inflicts ${esc(e.ability.status)})` : ''}</p>` : '';
  const loot = (e.loot || []).map((l) => esc(getItem(l.id)?.name || l.id)).join(', ');
  return `<li class="bestiary-entry"><h3>${esc(e.name)}${tags.length ? ` <small>${esc(tags.join(' · '))}</small>` : ''}</h3>
    <p><em>${esc(e.intro || '')}</em></p>
    <p>HP ${e.hp} · ATK ${e.atk} · DEF ${e.def} · SPD ${e.spd} · XP ${e.xp} · Gold ${e.gold}</p>
    ${ability}${e.enrage ? `<p class="hint">Second phase: grows enraged below ${Math.round(e.enrage.threshold * 100)}% HP (+${e.enrage.atk} ATK).</p>` : ''}${loot ? `<p>Known spoils: ${loot}</p>` : ''}
    ${fieldTip(e.id) ? `<p class="field-tip"><strong>Mara’s advice:</strong> ${esc(fieldTip(e.id))}</p>` : ''}
    <p>Defeated: ${count}</p></li>`;
}

export const bestiaryScene = {
  onEnter(game, data = {}) {
    game.bestiaryReturn = data.returnScene || game.bestiaryReturn || 'town';
  },
  render(game) {
    const entries = bestiaryEntries(game.state);
    const known = entries.filter((x) => x.count > 0).length;
    return `<div class="panel bestiary"><h2>Warden's Field Journal</h2>
      <p>Warden Mara asks every patrol to record what walks the storm roads. Entries: ${known}/${entries.length}.</p>
      <ul class="bestiary-list">${entries.map(entryHtml).join('')}</ul>
      <div class="actions"><button data-action="leave">Back</button></div></div>`;
  },
  actions: {
    leave(game) { game.setScene(game.bestiaryReturn || 'town'); },
  },
};

export function installBestiary(game) {
  game.registerScene('bestiary', bestiaryScene);
  const handler = (ev) => { if (ev && game.state) recordDefeat(game.state, ev.enemyId); };
  game.bus.on('combat:victory', handler);
  return () => game.bus.off('combat:victory', handler);
}
