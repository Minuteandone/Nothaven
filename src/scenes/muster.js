// "Watch House Muster Board": recruit or dismiss companions in Greyhaven.
import { COMPANIONS, MAX_PARTY, isUnlocked, inParty, recruitCompanion, dismissCompanion } from '../party/companions.js';
import { effectiveStats } from '../items/equipment.js';
import { companionRemark } from '../party/remarks.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export const musterScene = {
  onEnter(game, data = {}) {
    game.musterReturn = data.returnScene || game.musterReturn || 'town';
    game.musterMessage = '';
    game.musterTalk = null;
  },
  render(game) {
    const s = game.state;
    const cards = Object.values(COMPANIONS).map((c) => {
      const member = s.party.find((m) => m && m.id === c.id) || s.reserve?.[c.id];
      const unlocked = isUnlocked(s, c.id);
      const joined = inParty(s, c.id);
      let action;
      if (joined) action = `<button data-action="dismiss" data-arg="${c.id}">Send back to the watch house</button>`;
      else if (!unlocked) action = `<p class="hint"><em>${esc(c.unlockHint)}</em></p>`;
      else action = `<button data-action="recruit" data-arg="${c.id}" ${s.party.length >= MAX_PARTY ? 'disabled' : ''}>Invite to party</button>`;
      const stats = member ? (() => { const e = effectiveStats(member); return `<p>Lv ${member.level || 1} · HP ${member.hp}/${e.maxHp} · ATK ${e.atk} · DEF ${e.def} · SPD ${e.spd}</p>`; })() : '';
      const talk = unlocked ? `<button data-action="talk" data-arg="${c.id}">Talk with ${esc(c.name)}</button>` : '';
      const said = unlocked && game.musterTalk === c.id ? `<blockquote class="remark">“${esc(companionRemark(c.id, s.story))}”</blockquote>` : '';
      return `<div class="panel companion"><h3>${esc(c.name)} <small>${esc(c.title)}</small>${joined ? ' <em>(in party)</em>' : ''}</h3>
        <p>${esc(c.blurb)}</p>${stats}${said}${action}${talk}</div>`;
    }).join('');
    return `<div class="panel muster"><h2>Watch House Muster Board</h2>
      <p>Warden Mara keeps a list of who can be spared from the walls. Party: ${s.party.length}/${MAX_PARTY}.</p>
      ${game.musterMessage ? `<p class="message" role="status">${esc(game.musterMessage)}</p>` : ''}</div>
      ${cards}
      <div class="panel actions"><button data-action="leave">Back</button></div>`;
  },
  actions: {
    recruit(game, el) { game.musterMessage = recruitCompanion(game.state, el?.dataset?.arg).message; },
    dismiss(game, el) { game.musterMessage = dismissCompanion(game.state, el?.dataset?.arg).message; },
    talk(game, el) {
      const id = el?.dataset?.arg;
      game.musterTalk = isUnlocked(game.state, id) ? id : null;
    },
    leave(game) {
      const target = game.scenes?.[game.musterReturn] ? game.musterReturn : 'town';
      game.setScene(target);
    },
  },
};

export function installCompanions(game) {
  game.registerScene('muster', musterScene);
}
