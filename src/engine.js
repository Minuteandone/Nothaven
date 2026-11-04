import { createInitialState } from './state.js';
import { bus } from './events.js';

const HEADING_SELECTOR = 'h1, h2, [data-scene-heading]';
const FOCUS_TARGET_SELECTOR = '[data-action], [data-focus-key], [id]';

function canReceiveFocus(el) {
  return typeof el?.focus === 'function'
    && !el.disabled
    && !el.hasAttribute?.('disabled')
    && el.getAttribute?.('aria-disabled') !== 'true';
}

// Remember only focus inside the game. Dynamic arguments are compared as values,
// never interpolated into selectors.
function captureFocus(root) {
  const active = root.ownerDocument?.activeElement;
  if (!active || typeof root.contains !== 'function' || !root.contains(active)) return null;

  const action = active.getAttribute?.('data-action');
  if (action !== null && action !== undefined) {
    return { type: 'action', action, arg: active.getAttribute?.('data-arg') ?? null };
  }
  const focusKey = active.getAttribute?.('data-focus-key');
  if (focusKey) return { type: 'key', key: focusKey, attribute: 'data-focus-key' };
  const id = active.getAttribute?.('id');
  if (id) return { type: 'key', key: id, attribute: 'id' };
  if (active.matches?.(HEADING_SELECTOR)) return { type: 'heading' };
  return null;
}

function restoreFocus(root, snapshot) {
  if (!snapshot) return;
  let target = null;

  if (snapshot.type === 'heading') {
    target = root.querySelector?.(HEADING_SELECTOR);
    target?.setAttribute?.('tabindex', '-1');
  } else {
    const candidates = Array.from(root.querySelectorAll?.(FOCUS_TARGET_SELECTOR) || []);
    if (snapshot.type === 'action') {
      target = candidates.find((el) =>
        el.getAttribute?.('data-action') === snapshot.action
        && (el.getAttribute?.('data-arg') ?? null) === snapshot.arg
        && canReceiveFocus(el));
      // A command may open a submenu. Put keyboard users at its first available
      // command instead of dropping focus back to the document body.
      if (!target) {
        target = candidates.find((el) =>
          el.getAttribute?.('data-action') !== null
          && el.getAttribute?.('data-action') !== undefined
          && canReceiveFocus(el));
      }
    } else {
      target = candidates.find((el) =>
        el.getAttribute?.(snapshot.attribute) === snapshot.key && canReceiveFocus(el));
    }
  }

  if (canReceiveFocus(target)) target.focus({ preventScroll: true });
}

// Scene contract: { render(game) -> html string, onEnter?(game, data), actions?: { name(game, el) } }
// Buttons use data-action="name" (optional data-arg="...") to call scene actions.
export class Game {
  constructor(root) {
    this.root = root;
    this.state = createInitialState();
    this.scenes = {};
    this.renderedScene = null;
    this.bus = bus;
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const scene = this.scenes[this.state.scene];
      const fn = scene?.actions?.[el.dataset.action];
      if (fn) { fn(this, el); this.render(); }
    });
  }
  registerScene(name, scene) { this.scenes[name] = scene; }
  setScene(name, data) {
    if (!this.scenes[name]) throw new Error(`Unknown scene: ${name}`);
    this.state.scene = name;
    this.scenes[name].onEnter?.(this, data);
    bus.emit('scene:enter', { name, data });
    this.render();
  }
  render() {
    const sceneName = this.state.scene;
    const scene = this.scenes[sceneName];
    const sameScene = this.renderedScene === sceneName;
    const focusSnapshot = sameScene ? captureFocus(this.root) : null;
    this.root.innerHTML = scene ? scene.render(this) : '<p>Missing scene</p>';
    if (sameScene) {
      restoreFocus(this.root, focusSnapshot);
      return;
    }
    this.renderedScene = sceneName;

    // A new scene is a navigation step: do not leave players at the old scroll position.
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
    const heading = this.root.querySelector?.(HEADING_SELECTOR);
    if (canReceiveFocus(heading)) {
      heading.setAttribute?.('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }
}
