import { createInitialState } from './state.js';
import { bus } from './events.js';

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
    this.root.innerHTML = scene ? scene.render(this) : '<p>Missing scene</p>';
    if (this.renderedScene === sceneName) return;
    this.renderedScene = sceneName;

    // A new scene is a navigation step: do not leave players at the old scroll position.
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
    const heading = this.root.querySelector?.('h1, h2, [data-scene-heading]');
    if (heading && typeof heading.focus === 'function') {
      heading.setAttribute?.('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }
}
