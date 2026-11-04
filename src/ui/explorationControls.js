const installedGames = new WeakMap();

function codeFor(event) {
  if (event?.code) return event.code;
  const key = String(event?.key || '').toLowerCase();
  if (key === 'e') return 'KeyE';
  return /^[1-9]$/.test(key) ? `Digit${key}` : '';
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
  return null;
}

function available(button) {
  return Boolean(button)
    && button.disabled !== true
    && !button.hasAttribute?.('disabled')
    && attribute(button, 'aria-disabled') !== 'true'
    && typeof button.click === 'function';
}

/** Resolve Survey or a visible nearby-action position to an existing enabled button. */
export function explorationShortcutTarget(root, event) {
  if (!root || !event || event.defaultPrevented || event.repeat
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editableTarget(event.target)) return null;
  const doc = root.ownerDocument;
  if (doc?.querySelector?.('.display-settings:not([hidden])')) return null;

  const code = codeFor(event);
  const buttons = Array.from(root.querySelectorAll?.('button[data-action]') || []);
  if (code === 'KeyE') {
    return buttons.find(button => available(button) && attribute(button, 'data-action') === 'waitTurn') || null;
  }

  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (!digit) return null;
  const actions = buttons.filter(button => button.classList?.contains?.('nearby-action'));
  const choice = actions[Number(digit[1]) - 1];
  return available(choice) ? choice : null;
}

/** Install one exploration-scoped listener; ordinary clicks retain engine dispatch and rendering. */
export function installExplorationControls(game, options = {}) {
  if (!game || (typeof game !== 'object' && typeof game !== 'function')) return () => {};
  if (installedGames.has(game)) return installedGames.get(game);
  const root = game.root;
  const doc = options.document || root?.ownerDocument || globalThis.document;
  const view = options.window || doc?.defaultView || globalThis.window;
  if (!root?.querySelectorAll || !view?.addEventListener) return () => {};

  const keyHandler = (event) => {
    if (game.state?.scene !== 'explore') return;
    const button = explorationShortcutTarget(root, event);
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
