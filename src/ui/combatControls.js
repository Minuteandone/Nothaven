const installedGames = new WeakMap();

const MAIN_SHORTCUTS = Object.freeze({
  KeyA: { action: 'attack' },
  KeyS: { action: 'menu', arg: 'skills' },
  KeyI: { action: 'menu', arg: 'items' },
  KeyD: { action: 'defend' },
  KeyF: { action: 'flee' },
  KeyB: { action: 'burst' },
  KeyC: { action: 'finish' },
});

const KEY_CODES = Object.freeze({
  a: 'KeyA', s: 'KeyS', i: 'KeyI', d: 'KeyD', f: 'KeyF', b: 'KeyB', c: 'KeyC',
  escape: 'Escape',
});

function codeFor(event) {
  if (event?.code) return event.code;
  const key = String(event?.key || '').toLowerCase();
  return KEY_CODES[key] || (/^[1-9]$/.test(key) ? `Digit${key}` : '');
}

function editableTarget(target) {
  const tag = String(target?.tagName || '').toUpperCase();
  return target?.isContentEditable === true
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)
    || Boolean(target?.closest?.('[contenteditable="true"]'));
}

function attribute(button, name) {
  if (typeof button?.getAttribute === 'function') return button.getAttribute(name);
  if (name === 'data-action') return button?.dataset?.action ?? null;
  if (name === 'data-arg') return button?.dataset?.arg ?? null;
  return null;
}

function available(button) {
  return Boolean(button)
    && button.disabled !== true
    && !button.hasAttribute?.('disabled')
    && attribute(button, 'aria-disabled') !== 'true'
    && typeof button.click === 'function';
}

function matching(buttons, action, arg = null) {
  return buttons.find(button => available(button)
    && attribute(button, 'data-action') === action
    && (arg === null || attribute(button, 'data-arg') === arg)) || null;
}

/** Resolve a key press to an existing enabled combat button, or null when unavailable. */
export function combatShortcutTarget(root, event) {
  if (!root || !event || event.defaultPrevented || event.repeat
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editableTarget(event.target)) return null;
  const doc = root.ownerDocument;
  if (doc?.querySelector?.('.display-settings:not([hidden])')) return null;

  const code = codeFor(event);
  const buttons = Array.from(root.querySelectorAll?.('button[data-action]') || []);
  if (code === 'Escape') return matching(buttons, 'menu', 'main');

  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (digit) {
    const choices = buttons.filter(button => button.classList?.contains?.('command-card')
      && ['skill', 'item'].includes(attribute(button, 'data-action')));
    const choice = choices[Number(digit[1]) - 1];
    return available(choice) ? choice : null;
  }

  const binding = MAIN_SHORTCUTS[code];
  return binding ? matching(buttons, binding.action, binding.arg ?? null) : null;
}

/** Install one combat-scoped key listener. Button clicks retain normal action dispatch/rendering. */
export function installCombatControls(game, options = {}) {
  if (!game || (typeof game !== 'object' && typeof game !== 'function')) return () => {};
  if (installedGames.has(game)) return installedGames.get(game);
  const root = game.root;
  const doc = options.document || root?.ownerDocument || globalThis.document;
  const view = options.window || doc?.defaultView || globalThis.window;
  if (!root?.querySelectorAll || !view?.addEventListener) return () => {};

  const keyHandler = (event) => {
    if (game.state?.scene !== 'combat') return;
    const button = combatShortcutTarget(root, event);
    if (!button) return;
    event.preventDefault?.();
    button.click();
  };
  view.addEventListener('keydown', keyHandler);
  const cleanup = () => {
    view.removeEventListener?.('keydown', keyHandler);
    installedGames.delete(game);
  };
  installedGames.set(game, cleanup);
  return cleanup;
}
