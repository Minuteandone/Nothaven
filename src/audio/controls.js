import { StormSoundscape, loadAudioPreferences, saveAudioPreferences } from './soundscape.js';

const SPEAKER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path class="sound-waves" d="M16 8q4 4 0 8M18.5 5.5q6 6.5 0 13"/></svg>';

function cueForAction(action, arg) {
  if (action === 'attack') return 'attack';
  if (action === 'flee') return 'warning';
  if (action === 'skill') return 'skill';
  if (action === 'defend') return 'defend';
  if (action === 'rest') return 'rest';
  if (['buyItem', 'sellItem', 'buy', 'buy5', 'buyMax', 'buyEquip', 'sell', 'sellQty', 'sellAll', 'trade', 'tradeAll'].includes(action)) return 'trade';
  if (['craftItem', 'craftFieldItem', 'craft', 'craftAll'].includes(action)) return 'craft';
  if (['item', 'useItem', 'useFieldItem', 'use', 'equip', 'unequip'].includes(action)) return 'item';
  if (['storyRescue', 'storyRelayAccept', 'storyHeart', 'storySpire', 'storyWatch', 'storyCalibration', 'storySupplyLine', 'storyCommissionAccept', 'storyCommissionReport', 'storyRelief'].includes(action)) return 'quest';
  if (action === 'storyExpedition') return arg === 'cancel' ? 'warning' : 'quest';
  if (['storyChoose', 'storyRelayChoose'].includes(action)) return 'discovery';
  return 'ui';
}

export function installAudio(game, options = {}) {
  const doc = options.document || globalThis.document;
  if (!doc?.createElement || !doc.body || !game?.root) return null;
  const view = doc.defaultView || globalThis;
  let storage = options.storage;
  if (storage === undefined) {
    try { storage = view.localStorage; } catch { storage = null; }
  }
  const preferences = loadAudioPreferences(storage);
  const AudioContextClass = options.AudioContextClass || view.AudioContext || view.webkitAudioContext;
  const audio = new StormSoundscape({ AudioContextClass, random: options.random, startTimeoutMs: options.startTimeoutMs });
  audio.muted = preferences.muted;
  audio.volume = preferences.volume;

  const dock = doc.createElement('aside');
  dock.className = 'audio-dock';
  dock.setAttribute('aria-label', 'Sound controls');
  dock.innerHTML = `<div class="audio-dock__inner">
    <button type="button" class="audio-toggle" data-focus-key="audio-toggle" aria-pressed="false">${SPEAKER_ICON}<span data-audio-label>Enable sound</span></button>
    <div class="audio-volume"><label for="storm-volume">Volume</label><input id="storm-volume" data-focus-key="audio-volume" type="range" min="0" max="100" step="5" value="35"><output for="storm-volume" data-audio-output>35%</output></div>
    <span class="visually-hidden" data-audio-status role="status" aria-live="polite">Sound is off.</span>
  </div>`;
  doc.body.insertBefore(dock, doc.body.firstChild);
  const button = dock.querySelector('.audio-toggle');
  const label = dock.querySelector('[data-audio-label]');
  const slider = dock.querySelector('#storm-volume');
  const output = dock.querySelector('[data-audio-output]');
  const status = dock.querySelector('[data-audio-status]');
  let failed = false;
  let busy = false;

  function persist() { saveAudioPreferences(storage, { muted: audio.muted, volume: audio.volume }); }
  function updateVolume() {
    const percent = Math.round(audio.volume * 100);
    slider.value = String(percent);
    slider.setAttribute('aria-valuetext', `${percent} percent`);
    output.value = `${percent}%`;
    output.textContent = `${percent}%`;
  }
  function update() {
    const unavailable = failed || !audio.available;
    const needsActivation = !audio.started || audio.context?.state === 'suspended';
    const on = audio.started && !needsActivation && !audio.muted;
    button.disabled = unavailable || busy;
    slider.disabled = unavailable;
    button.setAttribute('aria-pressed', String(on));
    dock.dataset.sound = unavailable ? 'unavailable' : on ? 'on' : 'off';
    label.textContent = unavailable ? 'Sound unavailable' : busy ? 'Starting sound…' : needsActivation
      ? audio.muted ? 'Enable sound' : 'Resume sound'
      : audio.muted ? 'Unmute sound' : 'Mute sound';
    status.textContent = unavailable
      ? 'Audio is unavailable in this browser. The game remains fully playable.'
      : on ? `Storm ambience on. Volume ${Math.round(audio.volume * 100)} percent.` : 'Sound is off.';
    updateVolume();
  }

  button.addEventListener('click', async () => {
    if (busy || failed) return;
    busy = true;
    update();
    try {
      const needsActivation = !audio.started || audio.context?.state === 'suspended';
      if (needsActivation) audio.setMuted(false);
      else audio.setMuted(!audio.muted);
      if (!audio.muted) {
        const started = await audio.start();
        if (!started) failed = true;
        else audio.playCue('ui');
      }
      persist();
    } catch {
      failed = true;
    } finally {
      busy = false;
      update();
    }
  });

  slider.addEventListener('input', () => {
    audio.setVolume(Number(slider.value) / 100);
    persist();
    updateVolume();
  });

  const clickHandler = (event) => {
    const control = event.target.closest?.('[data-action]');
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    audio.setRegion(game.state.map?.zoneId || game.state.location);
    audio.playCue(cueForAction(control.dataset.action, control.dataset.arg));
  };
  game.root.addEventListener('click', clickHandler);
  const sceneHandler = ({ name, data } = {}) => {
    audio.setRegion(data?.zoneId || game.state.map?.zoneId || game.state.location);
    audio.setScene(name);
  };
  const storyHandler = (event = {}) => {
    if (event.type !== 'visit' || !event.locationId) return;
    audio.setRegion(event.locationId);
    audio.playCue('travel');
  };
  const victoryHandler = () => audio.playCue('victory');
  const defeatHandler = () => audio.playCue('warning');
  const levelHandler = () => audio.playCue('levelup');
  game.bus.on('scene:enter', sceneHandler);
  game.bus.on('story:event', storyHandler);
  game.bus.on('combat:victory', victoryHandler);
  game.bus.on('combat:defeat', defeatHandler);
  game.bus.on('party:levelup', levelHandler);
  audio.setRegion(game.state.map?.zoneId || game.state.location);
  audio.setScene(game.state.scene);

  const visibilityHandler = async () => {
    if (!audio.started) return;
    try {
      if (doc.hidden && typeof audio.context.suspend === 'function') await audio.context.suspend();
      else if (!doc.hidden && !audio.muted && typeof audio.context.resume === 'function') await audio.context.resume();
      update();
    } catch { /* A later explicit Resume sound click can recover. */ }
  };
  doc.addEventListener?.('visibilitychange', visibilityHandler);
  update();

  return {
    audio,
    dock,
    async destroy() {
      game.root.removeEventListener('click', clickHandler);
      game.bus.off('scene:enter', sceneHandler);
      game.bus.off('story:event', storyHandler);
      game.bus.off('combat:victory', victoryHandler);
      game.bus.off('combat:defeat', defeatHandler);
      game.bus.off('party:levelup', levelHandler);
      doc.removeEventListener?.('visibilitychange', visibilityHandler);
      dock.remove();
      await audio.destroy();
    },
  };
}
