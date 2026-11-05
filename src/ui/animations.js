// Combat animations for Beacon of Stormhaven.
// DOM-based effects: damage pop-ups, HP bar transitions, screen shake, fades.

let animContainer = null;

function ensureContainer() {
  if (animContainer && document.contains(animContainer)) return animContainer;
  animContainer = document.createElement('div');
  animContainer.className = 'anim-layer';
  animContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(animContainer);
  return animContainer;
}

/** Spawn a floating damage number that rises and fades. */
export function damagePopup(anchor, amount, kind = 'damage') {
  if (!anchor) return;
  const container = ensureContainer();
  const rect = anchor.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = `damage-pop damage-pop--${kind}`;
  el.textContent = kind === 'miss' ? 'Miss' : kind === 'heal' ? `+${amount}` : `${amount}`;
  el.style.left = `${rect.left + rect.width / 2 - 20}px`;
  el.style.top = `${rect.top - 10}px`;
  container.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

/** Shake the game container briefly. */
export function screenShake(intensity = 4, duration = 300) {
  const app = document.getElementById('app');
  if (!app) return;
  app.style.transition = 'transform 0.05s ease';
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    if (elapsed > duration) {
      app.style.transform = '';
      app.style.transition = '';
      return;
    }
    const decay = 1 - elapsed / duration;
    const dx = (Math.random() * 2 - 1) * intensity * decay;
    const dy = (Math.random() * 2 - 1) * intensity * decay;
    app.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/** Animate an HP meter fill to a new value. */
export function tweenMeter(meterEl, newValue, maxValue, duration = 300) {
  if (!meterEl) return;
  const fill = meterEl.querySelector('.meter__fill');
  const labels = meterEl.querySelector('.meter__labels');
  if (!fill) return;
  const newPercent = Math.round((newValue / maxValue) * 100);
  fill.style.transition = `width ${duration}ms ease-out`;
  fill.style.width = `${newPercent}%`;
  if (labels) {
    const parts = labels.querySelectorAll('span');
    if (parts.length >= 2) parts[1].textContent = `${newValue}/${maxValue}`;
  }
}

/** Crossfade between scenes. */
export function crossfadeScene(container, newHTML, duration = 250) {
  if (!container) return;
  container.style.opacity = '0';
  container.style.transition = `opacity ${duration}ms ease`;
  setTimeout(() => {
    container.innerHTML = newHTML;
    container.style.opacity = '1';
  }, duration);
}

/** Flash red and fade out a defeated enemy element. */
export function enemyDeathFade(enemyEl) {
  if (!enemyEl) return;
  enemyEl.style.transition = 'opacity 0.5s ease, filter 0.3s ease';
  enemyEl.style.filter = 'brightness(2) saturate(0)';
  setTimeout(() => { enemyEl.style.opacity = '0'; }, 300);
}

export const ANIM_CSS = `
.anim-layer {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 1000; overflow: hidden;
}
.damage-pop {
  position: absolute;
  font-family: 'Courier New', monospace;
  font-weight: bold; font-size: 1.2rem;
  animation: popUp 1s ease-out forwards;
  pointer-events: none;
}
.damage-pop--damage { color: #ef4444; text-shadow: 0 0 4px rgba(239,68,68,0.5); }
.damage-pop--crit { color: #f59e0b; font-size: 1.6rem; text-shadow: 0 0 8px rgba(245,158,11,0.6); }
.damage-pop--heal { color: #22c55e; text-shadow: 0 0 4px rgba(34,197,94,0.4); }
.damage-pop--miss { color: #94a3b8; font-style: italic; }
@keyframes popUp {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  30% { opacity: 1; transform: translateY(-12px) scale(1.15); }
  100% { opacity: 0; transform: translateY(-36px) scale(0.9); }
}
@media (prefers-reduced-motion: reduce) {
  .damage-pop { animation: none; opacity: 0.8; }
  .meter__fill { transition: none !important; }
}
`;

let cssInjected = false;
export function injectAnimCSS() {
  if (cssInjected) return;
  const style = document.createElement('style');
  style.id = 'stormhaven-anim-css';
  style.textContent = ANIM_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

/** Wire animations to game events. Returns a cleanup function.
 *  Hooks combat:victory, combat:defeat, and party:levelup for screen effects.
 *  Crossfade is handled by the engine — call crossfadeScene() directly from
 *  engine.setScene() if desired. */
export function installAnimations(game) {
  if (!game || !game.bus) return () => {};
  injectAnimCSS();
  const bus = game.bus;

  function onVictory() { screenShake(3, 250); }
  function onDefeat() { screenShake(8, 500); }
  function onLevelUp() { screenShake(2, 200); }

  bus.on('combat:victory', onVictory);
  bus.on('combat:defeat', onDefeat);
  bus.on('party:levelup', onLevelUp);

  return () => {
    bus.off('combat:victory', onVictory);
    bus.off('combat:defeat', onDefeat);
    bus.off('party:levelup', onLevelUp);
  };
}
